-- Phase 4: username cooldown + history + change_username RPC

alter table public.profiles
  add column if not exists username_changed_at timestamptz;

create table if not exists public.username_history (
  old_username citext primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  changed_at timestamptz not null default now()
);

create index if not exists username_history_profile_id_idx
  on public.username_history (profile_id);

alter table public.username_history enable row level security;

-- Public read so /u/old can resolve redirects.
create policy "username_history_select_public"
  on public.username_history
  for select
  using (true);

create or replace function public.change_username(p_new text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_new citext;
  v_old citext;
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

  select * into v_profile
  from public.profiles p
  where p.id = v_uid
  for update;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if v_profile.username = v_new then
    return v_profile;
  end if;

  if v_profile.username_changed_at is not null
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
    username_changed_at = now()
  where id = v_uid
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.change_username(text) from public;
grant execute on function public.change_username(text) to authenticated;
