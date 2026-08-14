-- Privacy: provisional usernames (no email leak), claim flow, reserved names,
-- follower-gated heatmap.

-- ---------------------------------------------------------------------------
-- username_claimed_at: null = still on provisional handle, must claim
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username_claimed_at timestamptz;

-- Existing users who already picked a non-provisional name are treated as claimed.
update public.profiles
set username_claimed_at = coalesce(username_changed_at, now())
where username_claimed_at is null
  and username::text !~ '^u_[a-f0-9]{8,}$'
  and username::text !~ '^user_[a-f0-9]{6,}$';

-- ---------------------------------------------------------------------------
-- Reserved usernames
-- ---------------------------------------------------------------------------
create table if not exists public.reserved_usernames (
  username citext primary key
);

insert into public.reserved_usernames (username) values
  ('admin'),
  ('administrator'),
  ('support'),
  ('help'),
  ('lockedin'),
  ('locked_in'),
  ('lockin'),
  ('explore'),
  ('login'),
  ('logout'),
  ('signup'),
  ('signin'),
  ('signout'),
  ('auth'),
  ('api'),
  ('about'),
  ('privacy'),
  ('terms'),
  ('settings'),
  ('profile'),
  ('profiles'),
  ('rooms'),
  ('room'),
  ('dashboard'),
  ('dev'),
  ('developer'),
  ('null'),
  ('undefined'),
  ('system'),
  ('mod'),
  ('moderator'),
  ('official')
on conflict do nothing;

alter table public.reserved_usernames enable row level security;

drop policy if exists "reserved_usernames_select_auth" on public.reserved_usernames;
create policy "reserved_usernames_select_auth"
  on public.reserved_usernames
  for select
  to authenticated
  using (true);

create or replace function public.is_reserved_username(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.reserved_usernames r
    where r.username = lower(trim(p_username))::citext
  );
$$;

revoke all on function public.is_reserved_username(text) from public;
grant execute on function public.is_reserved_username(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Provisional username helper (never email / OAuth display name)
-- ---------------------------------------------------------------------------
create or replace function public._provisional_username(p_uid uuid)
returns text
language plpgsql
immutable
as $$
declare
  v text;
begin
  v := 'u_' || substr(replace(p_uid::text, '-', ''), 1, 17);
  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user: provisional only
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  final_username text;
  avatar text;
begin
  final_username := public._provisional_username(new.id);

  if exists (select 1 from public.profiles p where p.username = final_username) then
    final_username := 'u_' || substr(replace(new.id::text, '-', ''), 1, 14)
      || substr(md5(random()::text), 1, 3);
  end if;

  avatar := nullif(
    coalesce(meta->>'avatar_url', meta->>'picture'),
    ''
  );

  begin
    insert into public.profiles (id, username, avatar_path, timezone, username_claimed_at)
    values (new.id, final_username, avatar, 'UTC', null)
    on conflict (id) do nothing;
  exception
    when unique_violation or check_violation then
      final_username := 'u_' || substr(replace(new.id::text, '-', ''), 1, 14)
        || substr(md5(random()::text), 1, 3);
      insert into public.profiles (id, username, avatar_path, timezone, username_claimed_at)
      values (new.id, final_username, avatar, 'UTC', null)
      on conflict (id) do nothing;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

grant execute on function public.handle_new_user() to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- ensure_own_profile: provisional only
-- ---------------------------------------------------------------------------
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
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.profiles p where p.id = v_uid) then
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
    insert into public.profiles (id, username, avatar_path, timezone, username_claimed_at)
    values (v_uid, final_username, avatar, 'UTC', null)
    on conflict (id) do nothing;
  exception
    when unique_violation or check_violation then
      final_username := 'u_' || substr(replace(v_uid::text, '-', ''), 1, 14)
        || substr(md5(random()::text), 1, 3);
      insert into public.profiles (id, username, avatar_path, timezone, username_claimed_at)
      values (v_uid, final_username, avatar, 'UTC', null)
      on conflict (id) do nothing;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- change_username: reserved check; first claim skips cooldown
-- ---------------------------------------------------------------------------
create or replace function public.change_username(p_new text)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_new citext;
  v_old citext;
  v_first_claim boolean;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_new := lower(trim(p_new));

  if v_new is null
     or length(v_new::text) < 3
     or length(v_new::text) > 20
     or v_new::text !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'invalid_username';
  end if;

  if public.is_reserved_username(v_new::text) then
    raise exception 'username_reserved';
  end if;

  -- Block provisional-looking claims as final handles
  if v_new::text ~ '^u_[a-f0-9]{8,}$' or v_new::text ~ '^user_[a-f0-9]{6,}$' then
    raise exception 'invalid_username';
  end if;

  select * into v_profile
  from public.profiles p
  where p.id = v_uid
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_profile.username = v_new then
    if v_profile.username_claimed_at is null then
      update public.profiles
      set username_claimed_at = now()
      where id = v_uid
      returning * into v_profile;
    end if;
    return v_profile;
  end if;

  v_first_claim := v_profile.username_claimed_at is null;

  if not v_first_claim
     and v_profile.username_changed_at is not null
     and v_profile.username_changed_at > now() - interval '30 days' then
    raise exception 'username_cooldown';
  end if;

  if exists (
    select 1 from public.profiles p where p.username = v_new and p.id <> v_uid
  ) then
    raise exception 'username_taken';
  end if;

  if exists (
    select 1 from public.username_history h where h.old_username = v_new
  ) then
    raise exception 'username_taken';
  end if;

  v_old := v_profile.username;

  insert into public.username_history (old_username, profile_id, changed_at)
  values (v_old, v_uid, now())
  on conflict (old_username) do nothing;

  update public.profiles
  set
    username = v_new,
    username_changed_at = now(),
    username_claimed_at = coalesce(username_claimed_at, now())
  where id = v_uid
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.change_username(text) from public;
grant execute on function public.change_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- profile_activity_heatmap: owner or accepted follower only
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
