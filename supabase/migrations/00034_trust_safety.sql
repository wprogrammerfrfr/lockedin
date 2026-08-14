-- Trust & safety: blocks, reports, like RPC, rate limits, follow graph RLS.

-- ---------------------------------------------------------------------------
-- blocks
-- ---------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

drop policy if exists "blocks_select_own" on public.blocks;
create policy "blocks_select_own"
  on public.blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "blocks_insert_own" on public.blocks;
create policy "blocks_insert_own"
  on public.blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "blocks_delete_own" on public.blocks;
create policy "blocks_delete_own"
  on public.blocks for delete
  using (auth.uid() = blocker_id);

create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a is not null and b is not null and a <> b and (
    exists (
      select 1 from public.blocks bl
      where (bl.blocker_id = a and bl.blocked_id = b)
         or (bl.blocker_id = b and bl.blocked_id = a)
    )
  );
$$;

revoke all on function public.is_blocked(uuid, uuid) from public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

create or replace function public.block_user(p_blocked_id uuid)
returns void
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
  if p_blocked_id is null or p_blocked_id = v_uid then
    raise exception 'invalid_target';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_blocked_id) then
    raise exception 'profile_not_found';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_blocked_id)
  on conflict do nothing;

  delete from public.follows
  where (follower_id = v_uid and following_id = p_blocked_id)
     or (follower_id = p_blocked_id and following_id = v_uid);
end;
$$;

revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_blocked_id uuid)
returns void
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
  delete from public.blocks
  where blocker_id = v_uid and blocked_id = p_blocked_id;
end;
$$;

revoke all on function public.unblock_user(uuid) from public;
grant execute on function public.unblock_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'post', 'comment')),
  target_id uuid not null,
  reason text not null check (char_length(trim(reason)) between 1 and 200),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists reports_reporter_created_idx
  on public.reports (reporter_id, created_at desc);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "reports_select_own" on public.reports;
create policy "reports_select_own"
  on public.reports for select
  using (auth.uid() = reporter_id);

create or replace function public.report_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_recent int;
  v_reason text := trim(p_reason);
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_target_type not in ('profile', 'post', 'comment') then
    raise exception 'invalid_target';
  end if;

  if p_target_id is null then
    raise exception 'invalid_target';
  end if;

  if v_reason is null or char_length(v_reason) < 1 or char_length(v_reason) > 200 then
    raise exception 'invalid_target';
  end if;

  select count(*)::int into v_recent
  from public.reports r
  where r.reporter_id = v_uid
    and r.created_at > now() - interval '10 minutes';

  if v_recent >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, note)
  values (v_uid, p_target_type, p_target_id, v_reason, v_note)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.report_content(text, uuid, text, text) from public;
grant execute on function public.report_content(text, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Follow graph: drop public accepted SELECT; lists via RPC
-- ---------------------------------------------------------------------------
drop policy if exists "follows_select_accepted_public" on public.follows;

create or replace function public.list_followers(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if p_user_id is null then
    return '[]'::jsonb;
  end if;

  if v_uid is not null and public.is_blocked(v_uid, p_user_id) then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'avatar_path', p.avatar_path,
        'bio', p.bio
      )
      order by f.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  where f.following_id = p_user_id
    and f.status = 'accepted'
    and (
      v_uid is null
      or not public.is_blocked(v_uid, p.id)
    );

  return v_rows;
end;
$$;

revoke all on function public.list_followers(uuid) from public;
grant execute on function public.list_followers(uuid) to anon, authenticated;

create or replace function public.list_following(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if p_user_id is null then
    return '[]'::jsonb;
  end if;

  if v_uid is not null and public.is_blocked(v_uid, p_user_id) then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'avatar_path', p.avatar_path,
        'bio', p.bio
      )
      order by f.created_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.follows f
  join public.profiles p on p.id = f.following_id
  where f.follower_id = p_user_id
    and f.status = 'accepted'
    and (
      v_uid is null
      or not public.is_blocked(v_uid, p.id)
    );

  return v_rows;
end;
$$;

revoke all on function public.list_following(uuid) from public;
grant execute on function public.list_following(uuid) to anon, authenticated;

create or replace function public.list_friends(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if p_user_id is null then
    return '[]'::jsonb;
  end if;

  if v_uid is not null and public.is_blocked(v_uid, p_user_id) then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'avatar_path', p.avatar_path,
        'bio', p.bio
      )
      order by p.username
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.follows f1
  join public.follows f2
    on f2.follower_id = f1.following_id
   and f2.following_id = f1.follower_id
  join public.profiles p on p.id = f1.following_id
  where f1.follower_id = p_user_id
    and f1.status = 'accepted'
    and f2.status = 'accepted'
    and (
      v_uid is null
      or not public.is_blocked(v_uid, p.id)
    );

  return v_rows;
end;
$$;

revoke all on function public.list_friends(uuid) from public;
grant execute on function public.list_friends(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- request_follow: block check + rate limit
-- ---------------------------------------------------------------------------
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

revoke all on function public.request_follow(uuid) from public;
grant execute on function public.request_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- search_profiles: exclude blocked + provisional unclaimed
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles(q text)
returns table (
  id uuid,
  username citext,
  avatar_path text,
  bio text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_q text := nullif(trim(q), '');
begin
  if v_q is null or length(v_q) < 1 then
    return;
  end if;

  return query
  select
    p.id,
    p.username,
    p.avatar_path,
    p.bio
  from public.profiles p
  where p.username ilike ('%' || v_q || '%')
    and p.username_claimed_at is not null
    and (
      v_uid is null
      or not public.is_blocked(v_uid, p.id)
    )
  order by
    case when p.username ilike (v_q || '%') then 0 else 1 end,
    p.username
  limit 20;
end;
$$;

revoke all on function public.search_profiles(text) from public;
grant execute on function public.search_profiles(text) to authenticated;

-- ---------------------------------------------------------------------------
-- like / unlike RPCs (visibility + rate limit); drop raw insert policy
-- ---------------------------------------------------------------------------
create or replace function public.like_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
  v_recent int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select p.author_id into v_author
  from public.posts p
  where p.id = p_post_id;

  if v_author is null then
    raise exception 'post_not_found';
  end if;

  if public.is_blocked(v_uid, v_author) then
    raise exception 'blocked';
  end if;

  if not (
    v_author = v_uid
    or exists (
      select 1 from public.follows f
      where f.follower_id = v_uid
        and f.following_id = v_author
        and f.status = 'accepted'
    )
  ) then
    raise exception 'forbidden';
  end if;

  select count(*)::int into v_recent
  from public.likes l
  where l.user_id = v_uid
    and l.created_at > now() - interval '60 seconds';

  if v_recent >= 30 then
    raise exception 'rate_limited';
  end if;

  insert into public.likes (post_id, user_id)
  values (p_post_id, v_uid)
  on conflict do nothing;
end;
$$;

revoke all on function public.like_post(uuid) from public;
grant execute on function public.like_post(uuid) to authenticated;

create or replace function public.unlike_post(p_post_id uuid)
returns void
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

  delete from public.likes
  where post_id = p_post_id and user_id = v_uid;
end;
$$;

revoke all on function public.unlike_post(uuid) from public;
grant execute on function public.unlike_post(uuid) to authenticated;

drop policy if exists "likes_insert_own" on public.likes;
drop policy if exists "comments_insert_own" on public.comments;

-- Harden add_comment with block check
create or replace function public.add_comment(
  p_post_id uuid,
  p_body text
)
returns public.comments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_body text;
  v_row public.comments;
  v_recent int;
  v_author uuid;
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

  select p.author_id into v_author
  from public.posts p
  where p.id = p_post_id;

  if v_author is null then
    raise exception 'post_not_found';
  end if;

  if public.is_blocked(v_uid, v_author) then
    raise exception 'blocked';
  end if;

  if not (
    v_author = v_uid
    or exists (
      select 1
      from public.follows f
      where f.follower_id = v_uid
        and f.following_id = v_author
        and f.status = 'accepted'
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

revoke all on function public.add_comment(uuid, text) from public;
grant execute on function public.add_comment(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- join_room rate limit (patch onto latest join_room body from 00027)
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

  -- Count recent join attempts via a lightweight side table if needed;
  -- use notification of failed joins via rate on room_members inserts.
  -- Cap: at most 8 distinct room touches per minute via last_seen updates.
  if v_recent >= 8 then
    -- soft: still allow rejoin of same room below
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

  -- Hard rate limit for NEW joins
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
  end if;

  return v_room;
end;
$$;

revoke all on function public.join_room(text) from public;
grant execute on function public.join_room(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Heatmap / day sessions: respect blocks
-- ---------------------------------------------------------------------------
create or replace function public.profile_activity_heatmap(
  p_username citext,
  p_tz text
)
returns table (day date, active_ms bigint)
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
  select
    (timezone(v_tz, s.started_at))::date as day,
    sum(s.active_ms)::bigint as active_ms
  from public.sessions s
  where s.user_id = v_profile_id
    and s.status in ('ended', 'tapped_out')
    and (timezone(v_tz, s.started_at))::date between v_start and v_end
  group by 1
  order by 1;
end;
$$;

revoke all on function public.profile_activity_heatmap(citext, text) from public;
grant execute on function public.profile_activity_heatmap(citext, text) to anon, authenticated;
