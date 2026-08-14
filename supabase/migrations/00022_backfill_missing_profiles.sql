-- Backfill public.profiles for auth.users rows that have no profile.
-- Username derivation matches handle_new_user (00019 / 00021). Idempotent.

do $$
declare
  u record;
  meta jsonb;
  candidate text;
  base_username text;
  final_username text;
  suffix text;
  avatar text;
begin
  for u in
    select au.id, au.email, au.raw_user_meta_data
    from auth.users au
    where not exists (
      select 1 from public.profiles p where p.id = au.id
    )
  loop
    meta := coalesce(u.raw_user_meta_data, '{}'::jsonb);

    candidate := coalesce(
      meta->>'user_name',
      meta->>'preferred_username',
      meta->>'name',
      meta->>'full_name',
      split_part(coalesce(u.email, ''), '@', 1),
      'user'
    );

    base_username := lower(regexp_replace(candidate, '[^A-Za-z0-9_]', '_', 'g'));
    base_username := regexp_replace(base_username, '_+', '_', 'g');
    base_username := trim(both '_' from base_username);

    if base_username is null or length(base_username) < 3 then
      base_username := 'user_' || substr(replace(u.id::text, '-', ''), 1, 8);
    end if;

    if length(base_username) > 20 then
      base_username := left(base_username, 20);
      base_username := rtrim(base_username, '_');
    end if;

    if length(base_username) < 3 then
      base_username := 'user_' || substr(replace(u.id::text, '-', ''), 1, 8);
    end if;

    final_username := base_username;

    if exists (select 1 from public.profiles p where p.username = final_username) then
      suffix := '_' || substr(replace(u.id::text, '-', ''), 1, 6);
      final_username := left(base_username, greatest(3, 20 - length(suffix))) || suffix;
    end if;

    if exists (select 1 from public.profiles p where p.username = final_username) then
      final_username := 'u_' || substr(replace(u.id::text, '-', ''), 1, 17);
    end if;

    avatar := nullif(
      coalesce(meta->>'avatar_url', meta->>'picture'),
      ''
    );

    begin
      insert into public.profiles (id, username, avatar_path, timezone)
      values (
        u.id,
        final_username,
        avatar,
        'UTC'
      )
      on conflict (id) do nothing;
    exception
      when unique_violation or check_violation then
        final_username := 'u_' || substr(replace(u.id::text, '-', ''), 1, 17);
        insert into public.profiles (id, username, avatar_path, timezone)
        values (
          u.id,
          final_username,
          avatar,
          'UTC'
        )
        on conflict (id) do nothing;
    end;
  end loop;
end;
$$;
