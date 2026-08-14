-- Instant follow-back: create accepted mutual when they already follow you.

create or replace function public.follow_back(p_user_id uuid)
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

  if p_user_id is null or p_user_id = v_uid then
    raise exception 'invalid_target';
  end if;

  -- They must already follow you (accepted).
  if not exists (
    select 1
    from public.follows f
    where f.follower_id = p_user_id
      and f.following_id = v_uid
      and f.status = 'accepted'
  ) then
    raise exception 'not_following_you';
  end if;

  insert into public.follows (follower_id, following_id, status)
  values (v_uid, p_user_id, 'accepted')
  on conflict (follower_id, following_id)
  do update set status = 'accepted';
end;
$$;

revoke all on function public.follow_back(uuid) from public;
grant execute on function public.follow_back(uuid) to authenticated;
