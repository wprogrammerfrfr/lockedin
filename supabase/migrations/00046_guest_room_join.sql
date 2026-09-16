-- Guest room join: allow anonymous auth for join_room (auth.uid present),
-- but block anonymous users from creating rooms.

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
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_not_allowed';
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
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_not_allowed';
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
