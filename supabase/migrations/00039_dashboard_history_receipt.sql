-- Dashboard lifetime totals, enriched day-session receipts, and paginated
-- profile session history for calendar/list views.

-- ---------------------------------------------------------------------------
-- dashboard_stats: add sessions / group_sessions / total_active_ms
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats(
  p_tz text,
  p_on_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_today_ms bigint := 0;
  v_pr_ms bigint := 0;
  v_streak int := 0;
  v_cursor date;
  v_recent jsonb;
  v_total_sessions int := 0;
  v_group_sessions int := 0;
  v_total_active_ms bigint := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_tz := coalesce(nullif(trim(p_tz), ''), 'UTC');

  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  v_today := (timezone(v_tz, now()))::date;

  select coalesce(sum(s.active_ms), 0)::bigint
  into v_today_ms
  from public.sessions s
  where s.user_id = v_uid
    and (timezone(v_tz, s.started_at))::date = v_today
    and s.status in ('active', 'on_break', 'ended', 'tapped_out');

  select coalesce(max(s.active_ms), 0)::bigint
  into v_pr_ms
  from public.sessions s
  where s.user_id = v_uid
    and s.status in ('ended', 'tapped_out');

  select count(*)::int
  into v_total_sessions
  from public.sessions s
  where s.user_id = v_uid
    and s.status in ('ended', 'tapped_out');

  select count(distinct s.room_session_id)::int
  into v_group_sessions
  from public.sessions s
  where s.user_id = v_uid
    and s.room_session_id is not null
    and s.status in ('ended', 'tapped_out', 'active', 'on_break');

  select coalesce(sum(s.active_ms), 0)::bigint
  into v_total_active_ms
  from public.sessions s
  where s.user_id = v_uid
    and s.status in ('ended', 'tapped_out', 'active', 'on_break');

  if exists (
    select 1
    from public.sessions s
    where s.user_id = v_uid
      and s.status in ('ended', 'tapped_out', 'active', 'on_break')
      and s.active_ms > 0
      and (timezone(v_tz, s.started_at))::date = v_today
  ) then
    v_cursor := v_today;
  else
    v_cursor := v_today - 1;
  end if;

  loop
    exit when not exists (
      select 1
      from public.sessions s
      where s.user_id = v_uid
        and s.status in ('ended', 'tapped_out', 'active', 'on_break')
        and s.active_ms > 0
        and (timezone(v_tz, s.started_at))::date = v_cursor
    );
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  select coalesce(jsonb_agg(item order by (item->>'started_at') desc), '[]'::jsonb)
  into v_recent
  from (
    (
      select jsonb_build_object(
        'id', s.id,
        'kind', 'solo',
        'session_name', s.session_name,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'active_ms', s.active_ms,
        'break_ms', s.break_ms,
        'break_types_used', s.break_types_used,
        'status', s.status,
        'outcome', s.outcome,
        'pr_broken', s.pr_broken
      ) as item
      from public.sessions s
      where s.user_id = v_uid
        and s.room_session_id is null
        and (
          p_on_date is null
          or (timezone(v_tz, s.started_at))::date = p_on_date
        )
      order by s.started_at desc
      limit case when p_on_date is null then 20 else 100 end
    )
    union all
    (
      select jsonb_build_object(
        'id', rs.id,
        'kind', 'room',
        'session_name', rs.name,
        'code', rs.code,
        'started_at', rs.started_at,
        'ended_at', rs.ended_at,
        'active_ms', rs.live_ms,
        'break_ms', coalesce((
          select sum(p.break_ms)::bigint
          from public.room_session_participants p
          where p.room_session_id = rs.id
        ), 0),
        'status', case when rs.ended_at is null then 'live' else 'ended' end,
        'participants', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'user_id', p.user_id,
              'username', pr.username,
              'active_ms', p.active_ms,
              'break_ms', p.break_ms,
              'break_types_used', p.break_types_used,
              'status_at_end', p.status_at_end,
              'outcome', p.outcome
            )
            order by p.seat nulls last
          )
          from public.room_session_participants p
          join public.profiles pr on pr.id = p.user_id
          where p.room_session_id = rs.id
        ), '[]'::jsonb)
      ) as item
      from public.room_sessions rs
      where (
        exists (
          select 1
          from public.room_session_participants p
          where p.room_session_id = rs.id
            and p.user_id = v_uid
        )
        or rs.host_id = v_uid
      )
      and (
        p_on_date is null
        or (timezone(v_tz, rs.started_at))::date = p_on_date
      )
      order by rs.started_at desc
      limit case when p_on_date is null then 20 else 100 end
    )
  ) q;

  return jsonb_build_object(
    'today_ms', v_today_ms,
    'streak_days', v_streak,
    'pr_ms', v_pr_ms,
    'total_sessions', v_total_sessions,
    'group_sessions', v_group_sessions,
    'total_active_ms', v_total_active_ms,
    'recent', v_recent
  );
end;
$$;

revoke all on function public.dashboard_stats(text, date) from public;
grant execute on function public.dashboard_stats(text, date) to authenticated;

-- ---------------------------------------------------------------------------
-- profile_sessions_for_day: room name/code + participant break_types_used
-- ---------------------------------------------------------------------------
create or replace function public.profile_sessions_for_day(
  p_username citext,
  p_day date,
  p_tz text default 'UTC'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_tz text;
  v_allowed boolean := false;
  v_rows jsonb;
begin
  if p_username is null or p_day is null then
    return '[]'::jsonb;
  end if;

  select p.id into v_target
  from public.profiles p
  where p.username = p_username;

  if v_target is null then
    return '[]'::jsonb;
  end if;

  if v_uid is not null and public.is_blocked(v_uid, v_target) then
    raise exception 'not_authorized';
  end if;

  v_tz := coalesce(nullif(trim(p_tz), ''), 'UTC');
  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  if v_uid is not null and v_uid = v_target then
    v_allowed := true;
  elsif v_uid is not null and exists (
    select 1
    from public.follows f
    where f.follower_id = v_uid
      and f.following_id = v_target
      and f.status = 'accepted'
  ) then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'not_authorized';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'session_name', coalesce(rs.name, s.session_name),
        'active_ms', s.active_ms,
        'break_ms', s.break_ms,
        'break_types_used', s.break_types_used,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'outcome', s.outcome,
        'pr_broken', s.pr_broken,
        'status', s.status,
        'room_session_id', s.room_session_id,
        'room_name', rs.name,
        'room_code', rs.code,
        'kind', case
          when s.room_session_id is null then 'solo'
          else 'room'
        end,
        'participants', case
          when s.room_session_id is null then '[]'::jsonb
          else coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'user_id', p.user_id,
                'username', pr.username,
                'active_ms', p.active_ms,
                'break_ms', p.break_ms,
                'break_types_used', p.break_types_used,
                'outcome', p.outcome,
                'status_at_end', p.status_at_end
              )
              order by p.seat nulls last, pr.username
            )
            from public.room_session_participants p
            join public.profiles pr on pr.id = p.user_id
            where p.room_session_id = s.room_session_id
          ), '[]'::jsonb)
        end
      )
      order by s.started_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.sessions s
  left join public.room_sessions rs on rs.id = s.room_session_id
  where s.user_id = v_target
    and s.status in ('ended', 'tapped_out', 'active', 'on_break')
    and (timezone(v_tz, s.started_at))::date = p_day;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.profile_sessions_for_day(citext, date, text) from public;
grant execute on function public.profile_sessions_for_day(citext, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- profile_session_history: paginated list (self or accepted follower)
-- ---------------------------------------------------------------------------
create or replace function public.profile_session_history(
  p_username citext,
  p_tz text default 'UTC',
  p_limit int default 30,
  p_before timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_tz text;
  v_allowed boolean := false;
  v_limit int;
  v_rows jsonb;
begin
  if p_username is null then
    return '[]'::jsonb;
  end if;

  select p.id into v_target
  from public.profiles p
  where p.username = p_username;

  if v_target is null then
    return '[]'::jsonb;
  end if;

  if v_uid is not null and public.is_blocked(v_uid, v_target) then
    raise exception 'not_authorized';
  end if;

  v_tz := coalesce(nullif(trim(p_tz), ''), 'UTC');
  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  if v_uid is not null and v_uid = v_target then
    v_allowed := true;
  elsif v_uid is not null and exists (
    select 1
    from public.follows f
    where f.follower_id = v_uid
      and f.following_id = v_target
      and f.status = 'accepted'
  ) then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'not_authorized';
  end if;

  v_limit := greatest(1, least(coalesce(p_limit, 30), 100));

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'session_name', coalesce(rs.name, s.session_name),
        'active_ms', s.active_ms,
        'break_ms', s.break_ms,
        'break_types_used', s.break_types_used,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'outcome', s.outcome,
        'pr_broken', s.pr_broken,
        'status', s.status,
        'room_session_id', s.room_session_id,
        'room_name', rs.name,
        'room_code', rs.code,
        'kind', case
          when s.room_session_id is null then 'solo'
          else 'room'
        end,
        'participants', case
          when s.room_session_id is null then '[]'::jsonb
          else coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'user_id', p.user_id,
                'username', pr.username,
                'active_ms', p.active_ms,
                'break_ms', p.break_ms,
                'break_types_used', p.break_types_used,
                'outcome', p.outcome,
                'status_at_end', p.status_at_end
              )
              order by p.seat nulls last, pr.username
            )
            from public.room_session_participants p
            join public.profiles pr on pr.id = p.user_id
            where p.room_session_id = s.room_session_id
          ), '[]'::jsonb)
        end
      )
      order by s.started_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select s.*
    from public.sessions s
    where s.user_id = v_target
      and s.status in ('ended', 'tapped_out', 'active', 'on_break')
      and (p_before is null or s.started_at < p_before)
    order by s.started_at desc
    limit v_limit
  ) s
  left join public.room_sessions rs on rs.id = s.room_session_id;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.profile_session_history(citext, text, int, timestamptz) from public;
grant execute on function public.profile_session_history(citext, text, int, timestamptz) to authenticated;
