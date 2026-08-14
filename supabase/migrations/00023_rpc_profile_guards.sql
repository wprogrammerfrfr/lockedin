-- Raise profile_not_found before FK inserts when the caller has no profiles row.
-- Function bodies otherwise unchanged from 00004 / 00007 / 00010 / 00012.

-- ---------------------------------------------------------------------------
-- start_session
-- ---------------------------------------------------------------------------
create or replace function public.start_session(
  p_session_name text,
  p_client_id uuid
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  if exists (
    select 1
    from public.sessions s
    where s.user_id = v_uid
      and s.status in ('active', 'on_break')
  ) then
    raise exception 'active_session_exists';
  end if;

  insert into public.sessions (
    user_id,
    session_name,
    started_at,
    status,
    active_ms,
    break_ms,
    break_types_used,
    client_id,
    pr_broken
  )
  values (
    v_uid,
    nullif(trim(p_session_name), ''),
    now(),
    'active',
    0,
    0,
    '[]'::jsonb,
    p_client_id,
    false
  )
  returning * into v_row;

  return v_row;
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

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_not_found';
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

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_not_found';
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

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_not_found';
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

-- ---------------------------------------------------------------------------
-- add_comment
-- ---------------------------------------------------------------------------
create or replace function public.add_comment(
  p_post_id uuid,
  p_body text
)
returns public.comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_body text;
  v_row public.comments;
  v_recent int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  v_body := trim(p_body);

  if v_body is null or char_length(v_body) = 0 then
    raise exception 'empty_comment';
  end if;

  if char_length(v_body) > 250 then
    raise exception 'comment_too_long';
  end if;

  if not exists (select 1 from public.posts p where p.id = p_post_id) then
    raise exception 'post_not_found';
  end if;

  -- Must be able to see the post (own or accepted following).
  if not exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and (
        p.author_id = v_uid
        or exists (
          select 1
          from public.follows f
          where f.follower_id = v_uid
            and f.following_id = p.author_id
            and f.status = 'accepted'
        )
      )
  ) then
    raise exception 'forbidden';
  end if;

  select count(*)::int into v_recent
  from public.comments c
  where c.user_id = v_uid
    and c.created_at > now() - interval '60 seconds';

  if v_recent >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.comments (post_id, user_id, body)
  values (p_post_id, v_uid, v_body)
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- request_follow (caller profile check in addition to existing target check)
-- ---------------------------------------------------------------------------
create or replace function public.request_follow(p_following_id uuid)
returns public.follows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.follows;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  if p_following_id is null or p_following_id = v_uid then
    raise exception 'invalid_target';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_following_id) then
    raise exception 'profile_not_found';
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
