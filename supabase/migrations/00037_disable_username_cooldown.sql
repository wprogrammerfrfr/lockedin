-- Temporarily disable username change cooldown; keep format / reserved / taken checks.

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

  -- Cooldown intentionally disabled (was: 30-day username_cooldown).

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
