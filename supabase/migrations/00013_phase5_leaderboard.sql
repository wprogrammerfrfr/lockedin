-- Phase 5: weekly mutual leaderboard (viewer-local week)

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
        'display_name', p.display_name,
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
