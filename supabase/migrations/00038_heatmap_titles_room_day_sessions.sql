-- Heatmap day titles + day sessions include room-linked rows with participants.

drop function if exists public.profile_activity_heatmap(citext, text);

create or replace function public.profile_activity_heatmap(
  p_username citext,
  p_tz text
)
returns table (day date, active_ms bigint, title text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_tz text;
  v_end date;
  v_start date;
  v_allowed boolean := false;
begin
  select p.id into v_profile_id
  from public.profiles p
  where p.username = p_username;

  if v_profile_id is null then
    return;
  end if;

  if v_uid is not null and public.is_blocked(v_uid, v_profile_id) then
    return;
  end if;

  if v_uid is not null and v_uid = v_profile_id then
    v_allowed := true;
  elsif v_uid is not null and exists (
    select 1
    from public.follows f
    where f.follower_id = v_uid
      and f.following_id = v_profile_id
      and f.status = 'accepted'
  ) then
    v_allowed := true;
  end if;

  if not v_allowed then
    return;
  end if;

  v_tz := coalesce(nullif(trim(p_tz), ''), 'UTC');

  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  v_end := (timezone(v_tz, now()))::date;
  v_start := v_end - 370;

  return query
  with day_totals as (
    select
      (timezone(v_tz, s.started_at))::date as d,
      sum(s.active_ms)::bigint as ms
    from public.sessions s
    where s.user_id = v_profile_id
      and s.status in ('ended', 'tapped_out')
      and (timezone(v_tz, s.started_at))::date between v_start and v_end
    group by 1
  ),
  longest as (
    select distinct on ((timezone(v_tz, s.started_at))::date)
      (timezone(v_tz, s.started_at))::date as d,
      nullif(trim(s.session_name), '') as session_title
    from public.sessions s
    where s.user_id = v_profile_id
      and s.status in ('ended', 'tapped_out')
      and (timezone(v_tz, s.started_at))::date between v_start and v_end
    order by
      (timezone(v_tz, s.started_at))::date,
      s.active_ms desc nulls last,
      s.started_at desc
  )
  select
    t.d as day,
    t.ms as active_ms,
    l.session_title as title
  from day_totals t
  left join longest l on l.d = t.d
  order by 1;
end;
$$;

revoke all on function public.profile_activity_heatmap(citext, text) from public;
grant execute on function public.profile_activity_heatmap(citext, text) to anon, authenticated;

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
        'session_name', s.session_name,
        'active_ms', s.active_ms,
        'break_ms', s.break_ms,
        'break_types_used', s.break_types_used,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'outcome', s.outcome,
        'pr_broken', s.pr_broken,
        'status', s.status,
        'room_session_id', s.room_session_id,
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
  where s.user_id = v_target
    and s.status in ('ended', 'tapped_out', 'active', 'on_break')
    and (timezone(v_tz, s.started_at))::date = p_day;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.profile_sessions_for_day(citext, date, text) from public;
grant execute on function public.profile_sessions_for_day(citext, date, text) to authenticated;
