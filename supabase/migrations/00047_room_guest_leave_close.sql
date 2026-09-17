-- Guest follow guards, stale seat prune, and closing-window rejoin.
-- 1) profiles.is_anonymous so clients can hide Follow for guests
-- 2) request_follow / get_follow_relation reject anonymous parties
-- 3) prune stale last_seen seats; last leave starts 60s closing (no instant purge)
-- 4) join_room allowed during closing until closes_at

-- ---------------------------------------------------------------------------
-- profiles.is_anonymous
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_anonymous boolean not null default false;

-- Backfill from auth.users when possible
update public.profiles p
set is_anonymous = coalesce(
  (
    select (au.is_anonymous is true)
      or coalesce((au.raw_app_meta_data ->> 'provider') = 'anonymous', false)
    from auth.users au
    where au.id = p.id
  ),
  false
)
where p.is_anonymous is distinct from coalesce(
  (
    select (au.is_anonymous is true)
      or coalesce((au.raw_app_meta_data ->> 'provider') = 'anonymous', false)
    from auth.users au
    where au.id = p.id
  ),
  false
);

create or replace function public.ensure_own_profile()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_meta jsonb;
  final_username text;
  avatar text;
  v_anon boolean := coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
    update public.profiles
    set is_anonymous = v_anon
    where id = v_uid
      and is_anonymous is distinct from v_anon;
    return;
  end if;

  select coalesce(au.raw_user_meta_data, '{}'::jsonb)
  into v_meta
  from auth.users au
  where au.id = v_uid;

  final_username := public._provisional_username(v_uid);

  if exists (select 1 from public.profiles p where p.username = final_username) then
    final_username := 'u_' || substr(replace(v_uid::text, '-', ''), 1, 14)
      || substr(md5(random()::text), 1, 3);
  end if;

  avatar := nullif(
    coalesce(v_meta->>'avatar_url', v_meta->>'picture'),
    ''
  );

  begin
    insert into public.profiles (
      id, username, avatar_path, timezone, username_claimed_at, is_anonymous
    )
    values (v_uid, final_username, avatar, 'UTC', null, v_anon)
    on conflict (id) do update
      set is_anonymous = excluded.is_anonymous;
  exception
    when unique_violation or check_violation then
      final_username := 'u_' || substr(replace(v_uid::text, '-', ''), 1, 14)
        || substr(md5(random()::text), 1, 3);
      insert into public.profiles (
        id, username, avatar_path, timezone, username_claimed_at, is_anonymous
      )
      values (v_uid, final_username, avatar, 'UTC', null, v_anon)
      on conflict (id) do update
        set is_anonymous = excluded.is_anonymous;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Follow: no anonymous viewers or targets
-- ---------------------------------------------------------------------------
create or replace function public.get_follow_relation(p_target_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_out text;
  v_in text;
  v_self_anon boolean;
  v_target_anon boolean;
begin
  if v_uid is null then
    return 'none';
  end if;
  if p_target_id is null then
    return 'none';
  end if;
  if v_uid = p_target_id then
    return 'self';
  end if;

  select coalesce(p.is_anonymous, false) into v_self_anon
  from public.profiles p
  where p.id = v_uid;

  if coalesce(v_self_anon, coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) then
    return 'none';
  end if;

  select coalesce(p.is_anonymous, false) into v_target_anon
  from public.profiles p
  where p.id = p_target_id;

  if coalesce(v_target_anon, false) then
    return 'none';
  end if;

  if public.is_blocked(v_uid, p_target_id) then
    return 'blocked';
  end if;

  select f.status into v_out
  from public.follows f
  where f.follower_id = v_uid
    and f.following_id = p_target_id;

  select f.status into v_in
  from public.follows f
  where f.follower_id = p_target_id
    and f.following_id = v_uid;

  if v_out = 'accepted' then
    return 'accepted';
  end if;
  if v_out = 'pending' then
    return 'pending_outgoing';
  end if;
  if v_in = 'pending' then
    return 'pending_incoming';
  end if;
  if v_out = 'rejected' then
    return 'rejected';
  end if;

  return 'none';
end;
$$;

create or replace function public.request_follow(p_following_id uuid)
returns public.follows
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.follows;
  v_recent int;
  v_self_anon boolean;
  v_target_anon boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'anonymous_not_allowed';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  select coalesce(p.is_anonymous, false) into v_self_anon
  from public.profiles p
  where p.id = v_uid;

  if coalesce(v_self_anon, false) then
    raise exception 'anonymous_not_allowed';
  end if;

  if p_following_id is null or p_following_id = v_uid then
    raise exception 'invalid_target';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_following_id) then
    raise exception 'profile_not_found';
  end if;

  select coalesce(p.is_anonymous, false) into v_target_anon
  from public.profiles p
  where p.id = p_following_id;

  if coalesce(v_target_anon, false) then
    raise exception 'anonymous_not_allowed';
  end if;

  if public.is_blocked(v_uid, p_following_id) then
    raise exception 'blocked';
  end if;

  select count(*)::int into v_recent
  from public.follows f
  where f.follower_id = v_uid
    and f.created_at > now() - interval '60 seconds';

  if v_recent >= 10 then
    raise exception 'rate_limited';
  end if;

  insert into public.follows (follower_id, following_id, status)
  values (v_uid, p_following_id, 'pending')
  on conflict (follower_id, following_id)
  do update
    set
      status = case
        when public.follows.status = 'rejected' then 'pending'
        else public.follows.status
      end,
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.get_follow_relation(uuid) from public;
grant execute on function public.get_follow_relation(uuid) to authenticated;

revoke all on function public.request_follow(uuid) from public;
grant execute on function public.request_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Room finalize: prune stale seats; closing grace even at 0 members
-- ---------------------------------------------------------------------------
create or replace function public._finalize_room_if_due(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
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

  -- Drop seats whose touch heartbeat stopped (tab/app closed without leave).
  delete from public.room_members rm
  where rm.room_id = p_room_id
    and rm.last_seen_at < now() - interval '35 seconds';

  v_count := public._room_member_count(p_room_id);

  -- Waiting never reached 2 members within 5 minutes → purge.
  if v_room.status = 'waiting'
     and v_room.created_at <= now() - interval '5 minutes'
     and v_count < 2 then
    return public._purge_empty_room(p_room_id);
  end if;

  -- Live dropped below 2 (including 0) → start 60s closing, do not purge yet.
  if v_room.status = 'live' and v_count < 2 then
    update public.rooms
    set
      status = 'closing',
      closes_at = now() + interval '60 seconds'
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  -- Already closing with < 2: keep original closes_at; purge only when due.
  if v_room.status = 'closing'
     and v_room.closes_at is not null
     and v_room.closes_at <= now() then
    return public._purge_empty_room(p_room_id);
  end if;

  -- Closing with no timer set (legacy) and empty → start a fresh 60s window.
  if v_room.status = 'closing'
     and v_room.closes_at is null
     and v_count < 2 then
    update public.rooms
    set closes_at = now() + interval '60 seconds'
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  if v_room.status = 'closing'
     and v_count >= 2
     and (v_room.closes_at is null or v_room.closes_at > now()) then
    update public.rooms
    set status = 'live', closes_at = null
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  -- Empty waiting room with no members left during grace → keep waiting
  -- (5-minute rule above handles purge). Do not instant-purge count=0 live.
  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_room: allow closing rooms until closes_at
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
  v_code text := trim(p_code);
  v_recent int;
  v_host uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  perform public.ensure_own_profile();

  if v_code !~ '^[0-9]{6}$' then
    raise exception 'room_not_found';
  end if;

  select count(*)::int into v_recent
  from public.room_members rm
  where rm.user_id = v_uid
    and rm.last_seen_at > now() - interval '60 seconds';

  if v_recent >= 8 then
    null;
  end if;

  select * into v_room
  from public.rooms r
  where r.code = v_code
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  v_host := v_room.host_id;
  if public.is_blocked(v_uid, v_host) then
    raise exception 'blocked';
  end if;

  perform public._leave_open_rooms_except(v_room.id);

  begin
    v_room := public._finalize_room_if_due(v_room.id);
  exception
    when others then
      if sqlerrm like '%room_not_found%' then
        raise exception 'room_not_found';
      end if;
      raise;
  end;

  -- Reject only closed or expired closing (finalize may have purged).
  if v_room.status = 'closed' then
    raise exception 'room_closed';
  end if;

  if v_room.status = 'closing'
     and v_room.closes_at is not null
     and v_room.closes_at <= now() then
    raise exception 'room_closed';
  end if;

  if v_room.status not in ('waiting', 'live', 'closing') then
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
    -- Re-finalize so closing + 2 members can return to live.
    return public._finalize_room_if_due(v_room.id);
  end if;

  select count(*)::int into v_recent
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.user_id = v_uid
    and rm.last_seen_at > now() - interval '60 seconds'
    and r.status in ('waiting', 'live', 'closing');

  if v_recent >= 6 then
    raise exception 'rate_limited';
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
  elsif v_room.status = 'closing' and v_count >= 2 then
    update public.rooms
    set status = 'live', closes_at = null
    where id = v_room.id
    returning * into v_room;
  end if;

  return v_room;
end;
$$;

revoke all on function public.join_room(text) from public;
grant execute on function public.join_room(text) to authenticated;

-- ---------------------------------------------------------------------------
-- sweep_room: members can prune stale seats + advance closing timer
-- ---------------------------------------------------------------------------
create or replace function public.sweep_room(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
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

  return public._finalize_room_if_due(p_room_id);
end;
$$;

revoke all on function public.sweep_room(uuid) from public;
grant execute on function public.sweep_room(uuid) to authenticated;
