-- Ensure a profiles row for the caller, then leave stale open-room memberships
-- so create_room / create_pomodoro_room / join_room succeed after navigating away.

-- ---------------------------------------------------------------------------
-- ensure_own_profile
-- Username derivation matches handle_new_user (00021).
-- ---------------------------------------------------------------------------
create or replace function public.ensure_own_profile()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_meta jsonb;
  candidate text;
  base_username text;
  final_username text;
  suffix text;
  avatar text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
    return;
  end if;

  select au.email, coalesce(au.raw_user_meta_data, '{}'::jsonb)
  into v_email, v_meta
  from auth.users au
  where au.id = v_uid;

  candidate := coalesce(
    v_meta->>'user_name',
    v_meta->>'preferred_username',
    v_meta->>'name',
    v_meta->>'full_name',
    split_part(coalesce(v_email, ''), '@', 1),
    'user'
  );

  base_username := lower(regexp_replace(candidate, '[^A-Za-z0-9_]', '_', 'g'));
  base_username := regexp_replace(base_username, '_+', '_', 'g');
  base_username := trim(both '_' from base_username);

  if base_username is null or length(base_username) < 3 then
    base_username := 'user_' || substr(replace(v_uid::text, '-', ''), 1, 8);
  end if;

  if length(base_username) > 20 then
    base_username := left(base_username, 20);
    base_username := rtrim(base_username, '_');
  end if;

  if length(base_username) < 3 then
    base_username := 'user_' || substr(replace(v_uid::text, '-', ''), 1, 8);
  end if;

  final_username := base_username;

  if exists (select 1 from public.profiles p where p.username = final_username) then
    suffix := '_' || substr(replace(v_uid::text, '-', ''), 1, 6);
    final_username := left(base_username, greatest(3, 20 - length(suffix))) || suffix;
  end if;

  if exists (select 1 from public.profiles p where p.username = final_username) then
    final_username := 'u_' || substr(replace(v_uid::text, '-', ''), 1, 17);
  end if;

  avatar := nullif(
    coalesce(v_meta->>'avatar_url', v_meta->>'picture'),
    ''
  );

  begin
    insert into public.profiles (id, username, avatar_path, timezone)
    values (v_uid, final_username, avatar, 'UTC')
    on conflict (id) do nothing;
  exception
    when unique_violation or check_violation then
      final_username := 'u_' || substr(replace(v_uid::text, '-', ''), 1, 17);
      insert into public.profiles (id, username, avatar_path, timezone)
      values (v_uid, final_username, avatar, 'UTC')
      on conflict (id) do nothing;
  end;
end;
$$;

revoke all on function public.ensure_own_profile() from public;
grant execute on function public.ensure_own_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- Leave every open room except an optional keep-id (null = leave all).
-- ---------------------------------------------------------------------------
create or replace function public._leave_open_rooms_except(p_keep_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_old uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  for v_old in
    select r.id
    from public.room_members rm
    join public.rooms r on r.id = rm.room_id
    where rm.user_id = v_uid
      and r.status in ('waiting', 'live', 'closing')
      and (p_keep_room_id is null or r.id <> p_keep_room_id)
  loop
    delete from public.room_members
    where room_id = v_old
      and user_id = v_uid;
    perform public._finalize_room_if_due(v_old);
  end loop;
end;
$$;

revoke all on function public._leave_open_rooms_except(uuid) from public;

-- ---------------------------------------------------------------------------
-- create_room (vote kind)
-- ---------------------------------------------------------------------------
create or replace function public.create_room()
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  perform public.ensure_own_profile();
  perform public._leave_open_rooms_except(null);

  insert into public.rooms (code, host_id, status, kind)
  values (public.generate_room_code(7), v_uid, 'waiting', 'vote')
  returning * into v_room;

  insert into public.room_members (room_id, user_id, seat, last_seen_at)
  values (v_room.id, v_uid, 1, now());

  return v_room;
end;
$$;

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
set search_path = public, pg_temp
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

  perform public.ensure_own_profile();
  perform public._leave_open_rooms_except(null);

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

-- ---------------------------------------------------------------------------
-- join_room: ensure profile, leave other rooms, then join (or re-touch).
-- ---------------------------------------------------------------------------
create or replace function public.join_room(p_code text)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
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

  perform public.ensure_own_profile();

  select * into v_room
  from public.rooms r
  where r.code = p_code
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  perform public._leave_open_rooms_except(v_room.id);

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
