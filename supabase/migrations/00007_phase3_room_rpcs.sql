-- Phase 3: room lifecycle RPCs (2–6, presence, pomodoro cadence)

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function public._room_member_count(p_room_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.room_members where room_id = p_room_id;
$$;

create or replace function public._next_room_seat(p_room_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat int;
begin
  select s.seat into v_seat
  from generate_series(1, 6) as s(seat)
  where not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.seat = s.seat
  )
  order by s.seat
  limit 1;

  if v_seat is null then
    raise exception 'room_full';
  end if;

  return v_seat;
end;
$$;

create or replace function public._finalize_room_if_due(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.rooms;
  v_count int;
begin
  select * into v_room
  from public.rooms r
  where r.id = p_room_id
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  if v_room.status = 'closed' then
    return v_room;
  end if;

  -- Waiting grace: never reached 2 members within 5 minutes → close.
  if v_room.status = 'waiting'
     and v_room.created_at <= now() - interval '5 minutes' then
    update public.rooms
    set status = 'closed', closes_at = coalesce(closes_at, now())
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  -- Closing timer elapsed → closed.
  if v_room.status = 'closing'
     and v_room.closes_at is not null
     and v_room.closes_at <= now() then
    update public.rooms
    set status = 'closed'
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  v_count := public._room_member_count(p_room_id);

  -- After live, drop below 2 → 60s closing warning.
  if v_room.status = 'live' and v_count < 2 then
    update public.rooms
    set
      status = 'closing',
      closes_at = now() + interval '60 seconds'
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  -- Recover from closing if members climb back to >= 2 before closes_at.
  if v_room.status = 'closing'
     and v_count >= 2
     and (v_room.closes_at is null or v_room.closes_at > now()) then
    update public.rooms
    set status = 'live', closes_at = null
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_room (vote kind)
-- ---------------------------------------------------------------------------
create or replace function public.create_room()
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1
    from public.room_members rm
    join public.rooms r on r.id = rm.room_id
    where rm.user_id = v_uid
      and r.status in ('waiting', 'live', 'closing')
  ) then
    raise exception 'already_in_other_room';
  end if;

  insert into public.rooms (code, host_id, status, kind)
  values (public.generate_room_code(7), v_uid, 'waiting', 'vote')
  returning * into v_room;

  insert into public.room_members (room_id, user_id, seat, last_seen_at)
  values (v_room.id, v_uid, 1, now());

  return v_room;
end;
$$;

revoke all on function public.create_room() from public;
grant execute on function public.create_room() to authenticated;

revoke all on function public._room_member_count(uuid) from public;
revoke all on function public._next_room_seat(uuid) from public;
revoke all on function public._finalize_room_if_due(uuid) from public;

-- ---------------------------------------------------------------------------
-- create_pomodoro_room
-- ---------------------------------------------------------------------------
create or replace function public.create_pomodoro_room(
  work_minutes int,
  break_minutes int
)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_work int;
  v_break int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1
    from public.room_members rm
    join public.rooms r on r.id = rm.room_id
    where rm.user_id = v_uid
      and r.status in ('waiting', 'live', 'closing')
  ) then
    raise exception 'already_in_other_room';
  end if;

  v_work := least(greatest(coalesce(work_minutes, 50), 15), 90);
  v_break := least(greatest(coalesce(break_minutes, 10), 5), 30);

  insert into public.rooms (
    code,
    host_id,
    status,
    kind,
    work_ms,
    break_ms,
    phase,
    phase_started_at
  )
  values (
    public.generate_room_code(7),
    v_uid,
    'waiting',
    'pomodoro',
    v_work * 60 * 1000,
    v_break * 60 * 1000,
    'work',
    now()
  )
  returning * into v_room;

  insert into public.room_members (room_id, user_id, seat, last_seen_at)
  values (v_room.id, v_uid, 1, now());

  return v_room;
end;
$$;

revoke all on function public.create_pomodoro_room(int, int) from public;
grant execute on function public.create_pomodoro_room(int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- join_room
-- ---------------------------------------------------------------------------
create or replace function public.join_room(p_code text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_count int;
  v_seat int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1
    from public.room_members rm
    join public.rooms r on r.id = rm.room_id
    where rm.user_id = v_uid
      and r.status in ('waiting', 'live', 'closing')
  ) then
    raise exception 'already_in_other_room';
  end if;

  select * into v_room
  from public.rooms r
  where r.code = p_code
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  v_room := public._finalize_room_if_due(v_room.id);

  if v_room.status in ('closed', 'closing') then
    raise exception 'room_closed';
  end if;

  if v_room.status not in ('waiting', 'live') then
    raise exception 'room_closed';
  end if;

  if exists (
    select 1
    from public.room_members rm
    where rm.room_id = v_room.id
      and rm.user_id = v_uid
  ) then
    update public.room_members
    set last_seen_at = now()
    where room_id = v_room.id
      and user_id = v_uid;
    return v_room;
  end if;

  v_count := public._room_member_count(v_room.id);
  if v_count >= 6 then
    raise exception 'room_full';
  end if;

  v_seat := public._next_room_seat(v_room.id);

  insert into public.room_members (room_id, user_id, seat, last_seen_at)
  values (v_room.id, v_uid, v_seat, now());

  v_count := v_count + 1;

  if v_room.status = 'waiting' and v_count >= 2 then
    update public.rooms
    set
      status = 'live',
      phase_started_at = case
        when kind = 'pomodoro' then now()
        else phase_started_at
      end
    where id = v_room.id
    returning * into v_room;
  end if;

  return v_room;
end;
$$;

revoke all on function public.join_room(text) from public;
grant execute on function public.join_room(text) to authenticated;

-- ---------------------------------------------------------------------------
-- leave_room
-- ---------------------------------------------------------------------------
create or replace function public.leave_room(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = v_uid;

  if not found then
    raise exception 'not_in_room';
  end if;

  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'room_not_found';
  end if;

  return public._finalize_room_if_due(p_room_id);
end;
$$;

revoke all on function public.leave_room(uuid) from public;
grant execute on function public.leave_room(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- touch_room_presence
-- ---------------------------------------------------------------------------
create or replace function public.touch_room_presence(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.room_members
  set last_seen_at = now()
  where room_id = p_room_id
    and user_id = v_uid;

  if not found then
    raise exception 'not_in_room';
  end if;

  return public._finalize_room_if_due(p_room_id);
end;
$$;

revoke all on function public.touch_room_presence(uuid) from public;
grant execute on function public.touch_room_presence(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- pomodoro_tick (idempotent phase flip)
-- ---------------------------------------------------------------------------
create or replace function public.pomodoro_tick(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_duration_ms int;
  v_elapsed_ms bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = v_uid
  ) then
    raise exception 'not_in_room';
  end if;

  select * into v_room
  from public.rooms r
  where r.id = p_room_id
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  v_room := public._finalize_room_if_due(p_room_id);

  if v_room.kind <> 'pomodoro' or v_room.status <> 'live' then
    return v_room;
  end if;

  if v_room.phase is null or v_room.phase_started_at is null then
    update public.rooms
    set phase = 'work', phase_started_at = now()
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  v_duration_ms := case
    when v_room.phase = 'work' then v_room.work_ms
    else v_room.break_ms
  end;

  if v_duration_ms is null then
    return v_room;
  end if;

  -- Catch up multiple elapsed phases if clients were offline.
  loop
    v_elapsed_ms := (
      extract(epoch from (now() - v_room.phase_started_at)) * 1000
    )::bigint;

    exit when v_elapsed_ms < v_duration_ms;

    v_room.phase_started_at :=
      v_room.phase_started_at
      + make_interval(secs => v_duration_ms / 1000.0);

    if v_room.phase = 'work' then
      v_room.phase := 'break';
      v_duration_ms := v_room.break_ms;
    else
      v_room.phase := 'work';
      v_duration_ms := v_room.work_ms;
    end if;

    if v_duration_ms is null then
      exit;
    end if;
  end loop;

  update public.rooms r
  set
    phase = v_room.phase,
    phase_started_at = v_room.phase_started_at
  where r.id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

revoke all on function public.pomodoro_tick(uuid) from public;
grant execute on function public.pomodoro_tick(uuid) to authenticated;
