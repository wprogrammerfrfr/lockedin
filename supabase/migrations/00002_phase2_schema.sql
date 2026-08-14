-- Phase 2: profiles, sessions, auth signup trigger, avatars storage RLS
-- Safety net if applied without 00001 (Phase 0 already enables these).
create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username citext not null,
  display_name text,
  avatar_path text,
  bio text,
  timezone text not null default 'UTC',
  constraint profiles_username_format
    check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_username_unique unique (username)
);

alter table public.profiles enable row level security;

create policy "profiles_select_public"
  on public.profiles
  for select
  using (true);

create policy "profiles_update_owner"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  session_name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'ended',
  active_ms bigint not null default 0,
  break_ms bigint not null default 0,
  break_types_used jsonb not null default '[]'::jsonb,
  is_shared boolean not null default false
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_is_shared_idx on public.sessions (is_shared)
  where is_shared = true;

alter table public.sessions enable row level security;

create policy "sessions_select_owner"
  on public.sessions
  for select
  using (auth.uid() = user_id);

create policy "sessions_select_shared_public"
  on public.sessions
  for select
  using (is_shared = true);

create policy "sessions_insert_owner"
  on public.sessions
  for insert
  with check (auth.uid() = user_id);

create policy "sessions_update_owner"
  on public.sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "sessions_delete_owner"
  on public.sessions
  for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Auth trigger: auto-create profile on signup (email + Google/GitHub OAuth)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  candidate text;
  base_username text;
  final_username text;
  suffix text;
  display text;
  avatar text;
begin
  display := nullif(
    trim(
      coalesce(
        meta->>'full_name',
        meta->>'name',
        meta->>'user_name',
        meta->>'preferred_username',
        split_part(coalesce(new.email, ''), '@', 1),
        'LockedIn user'
      )
    ),
    ''
  );

  candidate := coalesce(
    meta->>'user_name',
    meta->>'preferred_username',
    meta->>'name',
    meta->>'full_name',
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  );

  -- Keep only alphanumeric + underscore (GitHub hyphens become underscores).
  base_username := lower(regexp_replace(candidate, '[^A-Za-z0-9_]', '_', 'g'));
  base_username := regexp_replace(base_username, '_+', '_', 'g');
  base_username := trim(both '_' from base_username);

  if base_username is null or length(base_username) < 3 then
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  if length(base_username) > 20 then
    base_username := left(base_username, 20);
    base_username := rtrim(base_username, '_');
  end if;

  if length(base_username) < 3 then
    base_username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  final_username := base_username;

  -- Resolve unique collisions within the 3–20 character limit.
  if exists (select 1 from public.profiles p where p.username = final_username) then
    suffix := '_' || substr(replace(new.id::text, '-', ''), 1, 6);
    final_username := left(base_username, greatest(3, 20 - length(suffix))) || suffix;
  end if;

  -- Final collision fallback (extremely rare).
  if exists (select 1 from public.profiles p where p.username = final_username) then
    final_username := 'u_' || substr(replace(new.id::text, '-', ''), 1, 17);
  end if;

  avatar := nullif(
    coalesce(meta->>'avatar_url', meta->>'picture'),
    ''
  );

  insert into public.profiles (id, username, display_name, avatar_path, timezone)
  values (
    new.id,
    final_username,
    display,
    avatar,
    'UTC'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Avatars storage bucket + RLS
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read for avatar objects
create policy "avatars_select_public"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Authenticated users may upload only under {user_id}/**
-- Size/MIME: bucket limits always apply; RLS re-checks when metadata is present
-- (metadata can be empty at INSERT evaluation time).
create policy "avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      metadata is null
      or (
        coalesce((metadata->>'size')::bigint, 0) <= 2097152
        and (
          coalesce(metadata->>'mimetype', '') = ''
          or metadata->>'mimetype'
            in ('image/jpeg', 'image/png', 'image/webp')
        )
      )
    )
  );

create policy "avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (
      metadata is null
      or (
        coalesce((metadata->>'size')::bigint, 0) <= 2097152
        and (
          coalesce(metadata->>'mimetype', '') = ''
          or metadata->>'mimetype'
            in ('image/jpeg', 'image/png', 'image/webp')
        )
      )
    )
  );

create policy "avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
