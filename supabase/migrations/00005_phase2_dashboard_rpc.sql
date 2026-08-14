-- Phase 2: dashboard_stats RPC (timezone-aware today / streak / PR)

create or replace function public.dashboard_stats(p_tz text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_today_ms bigint := 0;
  v_pr_ms bigint := 0;
  v_streak int := 0;
  v_cursor date;
  v_recent jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_tz := coalesce(nullif(trim(p_tz), ''), 'UTC');

  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  v_today := (timezone(v_tz, now()))::date;

  select coalesce(sum(s.active_ms), 0)::bigint
  into v_today_ms
  from public.sessions s
  where s.user_id = v_uid
    and (timezone(v_tz, s.started_at))::date = v_today
    and s.status in ('active', 'on_break', 'ended', 'tapped_out');

  select coalesce(max(s.active_ms), 0)::bigint
  into v_pr_ms
  from public.sessions s
  where s.user_id = v_uid
    and s.status in ('ended', 'tapped_out');

  -- Streak: consecutive local days with any completed focus time,
  -- counting back from today if today has activity, else from yesterday.
  if exists (
    select 1
    from public.sessions s
    where s.user_id = v_uid
      and s.status in ('ended', 'tapped_out', 'active', 'on_break')
      and s.active_ms > 0
      and (timezone(v_tz, s.started_at))::date = v_today
  ) then
    v_cursor := v_today;
  else
    v_cursor := v_today - 1;
  end if;

  loop
    exit when not exists (
      select 1
      from public.sessions s
      where s.user_id = v_uid
        and s.status in ('ended', 'tapped_out', 'active', 'on_break')
        and s.active_ms > 0
        and (timezone(v_tz, s.started_at))::date = v_cursor
    );
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'session_name', r.session_name,
        'started_at', r.started_at,
        'ended_at', r.ended_at,
        'active_ms', r.active_ms,
        'break_ms', r.break_ms,
        'break_types_used', r.break_types_used,
        'status', r.status,
        'outcome', r.outcome,
        'pr_broken', r.pr_broken
      )
      order by r.started_at desc
    ),
    '[]'::jsonb
  )
  into v_recent
  from (
    select s.*
    from public.sessions s
    where s.user_id = v_uid
    order by s.started_at desc
    limit 20
  ) r;

  return jsonb_build_object(
    'today_ms', v_today_ms,
    'streak_days', v_streak,
    'pr_ms', v_pr_ms,
    'recent', v_recent
  );
end;
$$;

revoke all on function public.dashboard_stats(text) from public;
grant execute on function public.dashboard_stats(text) to authenticated;
