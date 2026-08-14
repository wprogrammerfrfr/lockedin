-- Harden handle_new_user: idempotent insert, unique/check retry, rebind trigger.
-- Successful-path username derivation is unchanged from 00019.

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
  avatar text;
begin
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

  begin
    insert into public.profiles (id, username, avatar_path, timezone)
    values (
      new.id,
      final_username,
      avatar,
      'UTC'
    )
    on conflict (id) do nothing;
  exception
    when unique_violation or check_violation then
      final_username := 'u_' || substr(replace(new.id::text, '-', ''), 1, 17);
      insert into public.profiles (id, username, avatar_path, timezone)
      values (
        new.id,
        final_username,
        avatar,
        'UTC'
      )
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
