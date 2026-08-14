-- Dashboard session detail: persist room codes, live break labels,
-- date-filterable dashboard_stats, and touch_room_presence break_label.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.room_sessions
  add column if not exists code text;

alter table public.room_members
  add column if not exists break_label text;

-- ---------------------------------------------------------------------------
-- create_room / create_pomodoro_room: snapshot code onto room_sessions
-- ---------------------------------------------------------------------------
create or replace function public.create_room(p_name text)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_sid uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'empty_room_name';
  end if;

  perform public.ensure_own_profile();
  perform public._leave_open_rooms_except(null);

  insert into public.room_sessions (name, kind, host_id, started_at)
  values (v_name, 'vote', v_uid, now())
  returning id into v_sid;

  insert into public.rooms (code, host_id, status, kind, name, room_session_id)
  values (public.generate_room_code(6), v_uid, 'waiting', 'vote', v_name, v_sid)
  returning * into v_room;

  update public.room_sessions
  set code = v_room.code
  where id = v_sid;

  insert into public.room_members (room_id, user_id, seat, last_seen_at)
  values (v_room.id, v_uid, 1, now());

  return v_room;
end;
$$;

create or replace function public.create_pomodoro_room(
  work_minutes int,
  break_minutes int,
  p_name text
)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_sid uuid;
  v_work int;
  v_break int;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'empty_room_name';
  end if;

  perform public.ensure_own_profile();
  perform public._leave_open_rooms_except(null);

  v_work := least(greatest(coalesce(work_minutes, 50), 15), 90);
  v_break := least(greatest(coalesce(break_minutes, 10), 5), 30);

  insert into public.room_sessions (name, kind, host_id, started_at)
  values (v_name, 'pomodoro', v_uid, now())
  returning id into v_sid;

  insert into public.rooms (
    code, host_id, status, kind, name, room_session_id,
    work_ms, break_ms, phase, phase_started_at
  )
  values (
    public.generate_room_code(6),
    v_uid,
    'waiting',
    'pomodoro',
    v_name,
    v_sid,
    v_work * 60 * 1000,
    v_break * 60 * 1000,
    'work',
    now()
  )
  returning * into v_room;

  update public.room_sessions
  set code = v_room.code
  where id = v_sid;

  insert into public.room_members (room_id, user_id, seat, last_seen_at)
  values (v_room.id, v_uid, 1, now());

  return v_room;
end;
$$;

revoke all on function public.create_room(text) from public;
grant execute on function public.create_room(text) to authenticated;
revoke all on function public.create_pomodoro_room(integer, integer, text) from public;
grant execute on function public.create_pomodoro_room(integer, integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- touch_room_presence: optional break_label
-- ---------------------------------------------------------------------------
drop function if exists public.touch_room_presence(uuid, text, bigint);

create or replace function public.touch_room_presence(
  p_room_id uuid,
  p_status text default null,
  p_elapsed_ms bigint default null,
  p_break_label text default null
)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_label text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_status := coalesce(nullif(trim(p_status), ''), 'WAITING');
  if v_status not in ('WAITING', 'LOCKED_IN', 'BREAK', 'LACKING', 'IDLE') then
    v_status := 'WAITING';
  end if;

  v_label := case
    when v_status = 'BREAK' then nullif(trim(p_break_label), '')
    else null
  end;

  update public.room_members
  set
    last_seen_at = now(),
    focus_status = v_status,
    elapsed_ms = coalesce(p_elapsed_ms, elapsed_ms, 0),
    break_label = v_label
  where room_id = p_room_id
    and user_id = v_uid;

  if not found then
    raise exception 'not_in_room';
  end if;

  return public._finalize_room_if_due(p_room_id);
end;
$$;

revoke all on function public.touch_room_presence(uuid, text, bigint, text) from public;
grant execute on function public.touch_room_presence(uuid, text, bigint, text) to authenticated;

-- ---------------------------------------------------------------------------
-- dashboard_stats: optional date filter + richer recent payload
-- ---------------------------------------------------------------------------
drop function if exists public.dashboard_stats(text);

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
    'recent', v_recent
  );
end;
$$;

revoke all on function public.dashboard_stats(text, date) from public;
grant execute on function public.dashboard_stats(text, date) to authenticated;
