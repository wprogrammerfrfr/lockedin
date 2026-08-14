-- Phase 6: streak_7 + session_4h milestone hooks

create or replace function public._compute_streak_days(
  p_user_id uuid,
  p_tz text
)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tz text := coalesce(nullif(trim(p_tz), ''), 'UTC');
  v_today date;
  v_cursor date;
  v_streak int := 0;
begin
  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  v_today := (timezone(v_tz, now()))::date;

  if exists (
    select 1
    from public.sessions s
    where s.user_id = p_user_id
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
      where s.user_id = p_user_id
        and s.status in ('ended', 'tapped_out', 'active', 'on_break')
        and s.active_ms > 0
        and (timezone(v_tz, s.started_at))::date = v_cursor
    );
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  return v_streak;
end;
$$;

create or replace function public._maybe_notify_streak_7(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_streak int;
begin
  select coalesce(p.timezone, 'UTC') into v_tz
  from public.profiles p
  where p.id = p_user_id;

  v_streak := public._compute_streak_days(p_user_id, v_tz);

  if v_streak < 7 then
    return;
  end if;

  -- One streak_7 notification per local calendar day.
  if exists (
    select 1
    from public.notifications n
    where n.user_id = p_user_id
      and n.type = 'streak_7'
      and (timezone(v_tz, n.created_at))::date = (timezone(v_tz, now()))::date
  ) then
    return;
  end if;

  perform public._notify(
    p_user_id,
    'streak_7',
    jsonb_build_object('streak_days', v_streak)
  );
end;
$$;

create or replace function public._maybe_notify_session_4h(
  p_user_id uuid,
  p_session_id uuid,
  p_active_ms bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_active_ms, 0) < (4 * 60 * 60 * 1000) then
    return;
  end if;

  if exists (
    select 1
    from public.notifications n
    where n.user_id = p_user_id
      and n.type = 'session_4h'
      and (n.payload->>'session_id') = p_session_id::text
  ) then
    return;
  end if;

  perform public._notify(
    p_user_id,
    'session_4h',
    jsonb_build_object(
      'session_id', p_session_id,
      'active_ms', p_active_ms
    )
  );
end;
$$;

create or replace function public._sessions_milestone_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 4h session milestone on terminal transition.
  if new.status in ('ended', 'tapped_out')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public._maybe_notify_session_4h(new.user_id, new.id, new.active_ms);
  end if;

  -- Streak check on heartbeat and end (active_ms / status changes).
  if new.active_ms > 0 then
    perform public._maybe_notify_streak_7(new.user_id);
  end if;

  return new;
end;
$$;

drop trigger if exists sessions_milestones on public.sessions;
create trigger sessions_milestones
  after insert or update of status, active_ms on public.sessions
  for each row
  execute function public._sessions_milestone_trigger();

revoke all on function public._compute_streak_days(uuid, text) from public;
revoke all on function public._maybe_notify_streak_7(uuid) from public;
revoke all on function public._maybe_notify_session_4h(uuid, uuid, bigint) from public;
revoke all on function public._sessions_milestone_trigger() from public;
