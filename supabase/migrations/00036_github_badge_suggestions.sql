-- Expose whether a profile has a linked GitHub identity (for verification badge).

create or replace function public.profile_is_github_verified(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from auth.identities i
    where i.user_id = p_user_id
      and i.provider = 'github'
  );
$$;

revoke all on function public.profile_is_github_verified(uuid) from public;
grant execute on function public.profile_is_github_verified(uuid) to anon, authenticated;

-- Suggested profiles for empty Explore cold-start
create or replace function public.suggest_profiles(p_limit int default 8)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_rows jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'username', x.username,
        'avatar_path', x.avatar_path,
        'bio', x.bio
      )
    ),
    '[]'::jsonb
  )
  into v_rows
  from (
    select p.id, p.username, p.avatar_path, p.bio
    from public.profiles p
    where p.id <> v_uid
      and p.username_claimed_at is not null
      and not public.is_blocked(v_uid, p.id)
      and not exists (
        select 1 from public.follows f
        where f.follower_id = v_uid
          and f.following_id = p.id
          and f.status in ('pending', 'accepted')
      )
    order by p.username_claimed_at desc nulls last
    limit greatest(1, least(coalesce(p_limit, 8), 20))
  ) x;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.suggest_profiles(int) from public;
grant execute on function public.suggest_profiles(int) to authenticated;
