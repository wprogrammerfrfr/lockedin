-- Phase 5: comment rate limit RPC (5 / rolling minute)

create or replace function public.add_comment(
  p_post_id uuid,
  p_body text
)
returns public.comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_body text;
  v_row public.comments;
  v_recent int;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_body := trim(p_body);

  if v_body is null or char_length(v_body) = 0 then
    raise exception 'empty_comment';
  end if;

  if char_length(v_body) > 250 then
    raise exception 'comment_too_long';
  end if;

  if not exists (select 1 from public.posts p where p.id = p_post_id) then
    raise exception 'post_not_found';
  end if;

  -- Must be able to see the post (own or accepted following).
  if not exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and (
        p.author_id = v_uid
        or exists (
          select 1
          from public.follows f
          where f.follower_id = v_uid
            and f.following_id = p.author_id
            and f.status = 'accepted'
        )
      )
  ) then
    raise exception 'forbidden';
  end if;

  select count(*)::int into v_recent
  from public.comments c
  where c.user_id = v_uid
    and c.created_at > now() - interval '60 seconds';

  if v_recent >= 5 then
    raise exception 'rate_limited';
  end if;

  insert into public.comments (post_id, user_id, body)
  values (p_post_id, v_uid, v_body)
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.add_comment(uuid, text) from public;
grant execute on function public.add_comment(uuid, text) to authenticated;
