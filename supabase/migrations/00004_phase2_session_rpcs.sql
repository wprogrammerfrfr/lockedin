-- Phase 2: session RPCs (security definer, auth.uid() gated, 12h clamp)

-- ---------------------------------------------------------------------------
-- Clamp helper
-- least(client, wall_clock - breaks, 12h); never negative
-- ---------------------------------------------------------------------------
create or replace function public.clamp_session_active_ms(
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_break_ms bigint,
  p_client_active_ms bigint
)
returns bigint
language sql
stable
as $$
  select least(
    greatest(coalesce(p_client_active_ms, 0), 0),
    greatest(
      0,
      (
        extract(
          epoch from (
            coalesce(p_ended_at, now()) - p_started_at
          )
        ) * 1000
      )::bigint - greatest(coalesce(p_break_ms, 0), 0)
    ),
    (12 * 60 * 60 * 1000)::bigint
  );
$$;

revoke all on function public.clamp_session_active_ms(timestamptz, timestamptz, bigint, bigint) from public;
grant execute on function public.clamp_session_active_ms(timestamptz, timestamptz, bigint, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- start_session
-- ---------------------------------------------------------------------------
create or replace function public.start_session(
  p_session_name text,
  p_client_id uuid
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if exists (
    select 1
    from public.sessions s
    where s.user_id = v_uid
      and s.status in ('active', 'on_break')
  ) then
    raise exception 'active_session_exists';
  end if;

  insert into public.sessions (
    user_id,
    session_name,
    started_at,
    status,
    active_ms,
    break_ms,
    break_types_used,
    client_id,
    pr_broken
  )
  values (
    v_uid,
    nullif(trim(p_session_name), ''),
    now(),
    'active',
    0,
    0,
    '[]'::jsonb,
    p_client_id,
    false
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.start_session(text, uuid) from public;
grant execute on function public.start_session(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- heartbeat_session
-- ---------------------------------------------------------------------------
create or replace function public.heartbeat_session(
  p_id uuid,
  p_active_ms bigint,
  p_break_ms bigint,
  p_break_types jsonb,
  p_status text
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.sessions;
  v_break bigint;
  v_active bigint;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_status is null or p_status not in ('active', 'on_break') then
    raise exception 'invalid_status';
  end if;

  select * into v_row
  from public.sessions s
  where s.id = p_id
  for update;

  if not found then
    raise exception 'session_not_found';
  end if;

  if v_row.user_id <> v_uid then
    raise exception 'forbidden';
  end if;

  if v_row.status not in ('active', 'on_break') then
    raise exception 'session_not_active';
  end if;

  v_break := greatest(coalesce(p_break_ms, 0), 0);
  v_active := public.clamp_session_active_ms(
    v_row.started_at,
    null,
    v_break,
    p_active_ms
  );

  update public.sessions
  set
    active_ms = v_active,
    break_ms = v_break,
    break_types_used = coalesce(p_break_types, break_types_used),
    status = p_status
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.heartbeat_session(uuid, bigint, bigint, jsonb, text) from public;
grant execute on function public.heartbeat_session(uuid, bigint, bigint, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- end_session
-- ---------------------------------------------------------------------------
create or replace function public.end_session(
  p_id uuid,
  p_active_ms bigint,
  p_break_ms bigint,
  p_break_types jsonb,
  p_outcome text,
  p_pr_broken boolean
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.sessions;
  v_break bigint;
  v_active bigint;
  v_ended_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row
  from public.sessions s
  where s.id = p_id
  for update;

  if not found then
    raise exception 'session_not_found';
  end if;

  if v_row.user_id <> v_uid then
    raise exception 'forbidden';
  end if;

  if v_row.status not in ('active', 'on_break') then
    raise exception 'session_not_active';
  end if;

  v_break := greatest(coalesce(p_break_ms, 0), 0);
  v_active := public.clamp_session_active_ms(
    v_row.started_at,
    v_ended_at,
    v_break,
    p_active_ms
  );

  update public.sessions
  set
    ended_at = v_ended_at,
    status = 'ended',
    active_ms = v_active,
    break_ms = v_break,
    break_types_used = coalesce(p_break_types, break_types_used),
    outcome = p_outcome,
    pr_broken = coalesce(p_pr_broken, false)
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.end_session(uuid, bigint, bigint, jsonb, text, boolean) from public;
grant execute on function public.end_session(uuid, bigint, bigint, jsonb, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- tap_out_session
-- ---------------------------------------------------------------------------
create or replace function public.tap_out_session(
  p_id uuid,
  p_active_ms bigint,
  p_break_ms bigint,
  p_break_types jsonb,
  p_outcome text,
  p_pr_broken boolean
)
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.sessions;
  v_break bigint;
  v_active bigint;
  v_ended_at timestamptz := now();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row
  from public.sessions s
  where s.id = p_id
  for update;

  if not found then
    raise exception 'session_not_found';
  end if;

  if v_row.user_id <> v_uid then
    raise exception 'forbidden';
  end if;

  if v_row.status not in ('active', 'on_break') then
    raise exception 'session_not_active';
  end if;

  v_break := greatest(coalesce(p_break_ms, 0), 0);
  v_active := public.clamp_session_active_ms(
    v_row.started_at,
    v_ended_at,
    v_break,
    p_active_ms
  );

  update public.sessions
  set
    ended_at = v_ended_at,
    status = 'tapped_out',
    active_ms = v_active,
    break_ms = v_break,
    break_types_used = coalesce(p_break_types, break_types_used),
    outcome = coalesce(p_outcome, 'tapout'),
    pr_broken = coalesce(p_pr_broken, false)
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.tap_out_session(uuid, bigint, bigint, jsonb, text, boolean) from public;
grant execute on function public.tap_out_session(uuid, bigint, bigint, jsonb, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- resume_active_session
-- ---------------------------------------------------------------------------
create or replace function public.resume_active_session()
returns public.sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_row
  from public.sessions s
  where s.user_id = v_uid
    and s.status in ('active', 'on_break')
  order by s.started_at desc
  limit 1;

  return v_row; -- null if none
end;
$$;

revoke all on function public.resume_active_session() from public;
grant execute on function public.resume_active_session() to authenticated;
