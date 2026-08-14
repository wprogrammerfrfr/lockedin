-- Phase 4: follows + search_profiles

create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index if not exists follows_following_status_idx
  on public.follows (following_id, status);

create index if not exists follows_follower_status_idx
  on public.follows (follower_id, status);

alter table public.follows enable row level security;

create policy "follows_select_involved"
  on public.follows
  for select
  using (auth.uid() = follower_id or auth.uid() = following_id);

-- Public accepted follows (follower graphs / counts).
create policy "follows_select_accepted_public"
  on public.follows
  for select
  using (status = 'accepted');

create policy "follows_insert_follower"
  on public.follows
  for insert
  with check (auth.uid() = follower_id);

create policy "follows_update_following"
  on public.follows
  for update
  using (auth.uid() = following_id)
  with check (auth.uid() = following_id);

create policy "follows_delete_follower"
  on public.follows
  for delete
  using (auth.uid() = follower_id);

-- ---------------------------------------------------------------------------
-- request_follow
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

revoke all on function public.request_follow(uuid) from public;
grant execute on function public.request_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- accept_follow
-- ---------------------------------------------------------------------------
create or replace function public.accept_follow(p_follower_id uuid)
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

  update public.follows
  set status = 'accepted', updated_at = now()
  where follower_id = p_follower_id
    and following_id = v_uid
    and status = 'pending'
  returning * into v_row;

  if not found then
    raise exception 'follow_request_not_found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.accept_follow(uuid) from public;
grant execute on function public.accept_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reject_follow
-- ---------------------------------------------------------------------------
create or replace function public.reject_follow(p_follower_id uuid)
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

  update public.follows
  set status = 'rejected', updated_at = now()
  where follower_id = p_follower_id
    and following_id = v_uid
    and status = 'pending'
  returning * into v_row;

  if not found then
    raise exception 'follow_request_not_found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.reject_follow(uuid) from public;
grant execute on function public.reject_follow(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- unfollow
-- ---------------------------------------------------------------------------
create or replace function public.unfollow(p_following_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.follows
  where follower_id = v_uid
    and following_id = p_following_id;

  if not found then
    raise exception 'follow_not_found';
  end if;
end;
$$;

revoke all on function public.unfollow(uuid) from public;
grant execute on function public.unfollow(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- search_profiles
-- ---------------------------------------------------------------------------
create or replace function public.search_profiles(q text)
returns table (
  id uuid,
  username citext,
  display_name text,
  avatar_path text,
  bio text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_q text := nullif(trim(q), '');
begin
  if v_q is null or length(v_q) < 1 then
    return;
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_path,
    p.bio
  from public.profiles p
  where p.username ilike ('%' || v_q || '%')
     or coalesce(p.display_name, '') ilike ('%' || v_q || '%')
  order by
    case when p.username ilike (v_q || '%') then 0 else 1 end,
    p.username
  limit 20;
end;
$$;

revoke all on function public.search_profiles(text) from public;
grant execute on function public.search_profiles(text) to authenticated;
