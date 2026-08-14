-- Purge profiles.display_name: username is the sole public identifier.

-- ---------------------------------------------------------------------------
-- handle_new_user: no longer writes display_name
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

  insert into public.profiles (id, username, avatar_path, timezone)
  values (
    new.id,
    final_username,
    avatar,
    'UTC'
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- search_profiles: username only (OUT signature change requires drop)
-- ---------------------------------------------------------------------------
drop function if exists public.search_profiles(text);

create function public.search_profiles(q text)
returns table (
  id uuid,
  username citext,
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
    p.avatar_path,
    p.bio
  from public.profiles p
  where p.username ilike ('%' || v_q || '%')
  order by
    case when p.username ilike (v_q || '%') then 0 else 1 end,
    p.username
  limit 20;
end;
$$;

revoke all on function public.search_profiles(text) from public;
grant execute on function public.search_profiles(text) to authenticated;

-- ---------------------------------------------------------------------------
-- weekly_leaderboard: drop display_name from JSON payload
-- ---------------------------------------------------------------------------
create or replace function public.weekly_leaderboard(viewer_tz text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_local_now timestamp;
  v_week_start date;
  v_week_end date;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_tz := coalesce(nullif(trim(viewer_tz), ''), 'UTC');

  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  v_local_now := timezone(v_tz, now());
  -- ISO week: Monday start (Postgres date_trunc('week') is Monday).
  v_week_start := date_trunc('week', v_local_now)::date;
  v_week_end := v_week_start + 7;

  with mutuals as (
    select v_uid as user_id
    union
    select f1.following_id as user_id
    from public.follows f1
    join public.follows f2
      on f2.follower_id = f1.following_id
     and f2.following_id = f1.follower_id
    where f1.follower_id = v_uid
      and f1.status = 'accepted'
      and f2.status = 'accepted'
  ),
  scored as (
    select
      m.user_id,
      coalesce(sum(s.active_ms), 0)::bigint as active_ms
    from mutuals m
    left join public.sessions s
      on s.user_id = m.user_id
     and s.status in ('ended', 'tapped_out', 'active', 'on_break')
     and (timezone(v_tz, s.started_at))::date >= v_week_start
     and (timezone(v_tz, s.started_at))::date < v_week_end
    group by m.user_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', sc.user_id,
        'username', p.username,
        'avatar_path', p.avatar_path,
        'active_ms', sc.active_ms,
        'rank', sc.rank
      )
      order by sc.rank
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select
      scored.*,
      rank() over (order by scored.active_ms desc, scored.user_id)::int as rank
    from scored
  ) sc
  join public.profiles p on p.id = sc.user_id;

  return jsonb_build_object(
    'tz', v_tz,
    'week_start', v_week_start,
    'week_end', v_week_end,
    'entries', v_result
  );
end;
$$;

revoke all on function public.weekly_leaderboard(text) from public;
grant execute on function public.weekly_leaderboard(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Drop the column last (after all writers/readers are replaced)
-- ---------------------------------------------------------------------------
alter table public.profiles drop column if exists display_name;
