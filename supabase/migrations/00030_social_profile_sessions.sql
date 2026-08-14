-- Social profile counts + follower-gated day session details.

-- ---------------------------------------------------------------------------
-- profile_social_counts: friends (mutual), followers, following
-- ---------------------------------------------------------------------------
create or replace function public.profile_social_counts(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_followers bigint := 0;
  v_following bigint := 0;
  v_friends bigint := 0;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'friends', 0,
      'followers', 0,
      'following', 0
    );
  end if;

  select count(*)::bigint
  into v_followers
  from public.follows f
  where f.following_id = p_user_id
    and f.status = 'accepted';

  select count(*)::bigint
  into v_following
  from public.follows f
  where f.follower_id = p_user_id
    and f.status = 'accepted';

  select count(*)::bigint
  into v_friends
  from public.follows f1
  join public.follows f2
    on f2.follower_id = f1.following_id
   and f2.following_id = f1.follower_id
  where f1.follower_id = p_user_id
    and f1.status = 'accepted'
    and f2.status = 'accepted';

  return jsonb_build_object(
    'friends', v_friends,
    'followers', v_followers,
    'following', v_following
  );
end;
$$;

revoke all on function public.profile_social_counts(uuid) from public;
grant execute on function public.profile_social_counts(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- profile_sessions_for_day: owner or accepted follower of target
-- ---------------------------------------------------------------------------
create or replace function public.profile_sessions_for_day(
  p_username citext,
  p_day date,
  p_tz text default 'UTC'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_target uuid;
  v_tz text;
  v_allowed boolean := false;
  v_rows jsonb;
begin
  if p_username is null or p_day is null then
    return '[]'::jsonb;
  end if;

  select p.id into v_target
  from public.profiles p
  where p.username = p_username;

  if v_target is null then
    return '[]'::jsonb;
  end if;

  v_tz := coalesce(nullif(trim(p_tz), ''), 'UTC');
  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  if v_uid is not null and v_uid = v_target then
    v_allowed := true;
  elsif v_uid is not null and exists (
    select 1
    from public.follows f
    where f.follower_id = v_uid
      and f.following_id = v_target
      and f.status = 'accepted'
  ) then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'not_authorized';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'session_name', s.session_name,
        'active_ms', s.active_ms,
        'break_ms', s.break_ms,
        'break_types_used', s.break_types_used,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'outcome', s.outcome,
        'pr_broken', s.pr_broken,
        'status', s.status
      )
      order by s.started_at desc
    ),
    '[]'::jsonb
  )
  into v_rows
  from public.sessions s
  where s.user_id = v_target
    and s.room_session_id is null
    and s.status in ('ended', 'tapped_out', 'active', 'on_break')
    and (timezone(v_tz, s.started_at))::date = p_day;

  return coalesce(v_rows, '[]'::jsonb);
end;
$$;

revoke all on function public.profile_sessions_for_day(citext, date, text) from public;
grant execute on function public.profile_sessions_for_day(citext, date, text) to authenticated;

-- ---------------------------------------------------------------------------
-- get_follow_relation: viewer → target status for FollowButton
-- ---------------------------------------------------------------------------
create or replace function public.get_follow_relation(p_target_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_out text;
  v_in text;
begin
  if v_uid is null then
    return 'none';
  end if;
  if p_target_id is null then
    return 'none';
  end if;
  if v_uid = p_target_id then
    return 'self';
  end if;

  select f.status into v_out
  from public.follows f
  where f.follower_id = v_uid
    and f.following_id = p_target_id;

  select f.status into v_in
  from public.follows f
  where f.follower_id = p_target_id
    and f.following_id = v_uid;

  if v_out = 'accepted' then
    return 'accepted';
  end if;
  if v_out = 'pending' then
    return 'pending_outgoing';
  end if;
  if v_in = 'pending' then
    return 'pending_incoming';
  end if;
  if v_out = 'rejected' then
    return 'rejected';
  end if;

  return 'none';
end;
$$;

revoke all on function public.get_follow_relation(uuid) from public;
grant execute on function public.get_follow_relation(uuid) to authenticated;
