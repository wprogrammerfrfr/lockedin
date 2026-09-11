-- Server-side PR computation: ignore client p_pr_broken and recompute against
-- the user's prior max active_ms among terminal sessions.

create or replace function public.end_session(
  p_id uuid,
  p_active_ms bigint,
  p_break_ms bigint,
  p_break_types jsonb,
  p_outcome text,
  p_pr_broken boolean,
  p_break_history jsonb default '[]'::jsonb,
  p_dessert_metadata jsonb default null
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
  v_prior_pr bigint;
  v_pr_broken boolean;
  v_outcome text;
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

  select coalesce(max(s.active_ms), 0)
  into v_prior_pr
  from public.sessions s
  where s.user_id = v_uid
    and s.id <> p_id
    and s.status in ('ended', 'tapped_out');

  v_pr_broken := v_active > 0 and v_active > v_prior_pr;
  v_outcome := case
    when v_pr_broken then 'pr'
    when coalesce(p_outcome, '') in ('pr', 'solid', 'tapout', 'break') then p_outcome
    else 'solid'
  end;
  if v_pr_broken and v_outcome = 'solid' then
    v_outcome := 'pr';
  end if;

  update public.sessions
  set
    ended_at = v_ended_at,
    status = 'ended',
    active_ms = v_active,
    break_ms = v_break,
    break_types_used = coalesce(p_break_types, break_types_used),
    break_history = coalesce(p_break_history, break_history),
    outcome = v_outcome,
    pr_broken = v_pr_broken,
    dessert_metadata = coalesce(p_dessert_metadata, dessert_metadata)
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.tap_out_session(
  p_id uuid,
  p_active_ms bigint,
  p_break_ms bigint,
  p_break_types jsonb,
  p_outcome text,
  p_pr_broken boolean,
  p_break_history jsonb default '[]'::jsonb,
  p_dessert_metadata jsonb default null
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
  v_prior_pr bigint;
  v_pr_broken boolean;
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

  select coalesce(max(s.active_ms), 0)
  into v_prior_pr
  from public.sessions s
  where s.user_id = v_uid
    and s.id <> p_id
    and s.status in ('ended', 'tapped_out');

  v_pr_broken := v_active > 0 and v_active > v_prior_pr;

  update public.sessions
  set
    ended_at = v_ended_at,
    status = 'tapped_out',
    active_ms = v_active,
    break_ms = v_break,
    break_types_used = coalesce(p_break_types, break_types_used),
    break_history = coalesce(p_break_history, break_history),
    outcome = coalesce(nullif(p_outcome, ''), 'tapout'),
    pr_broken = v_pr_broken,
    dessert_metadata = coalesce(p_dessert_metadata, dessert_metadata)
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.end_session(uuid, bigint, bigint, jsonb, text, boolean, jsonb, jsonb) from public;
grant execute on function public.end_session(uuid, bigint, bigint, jsonb, text, boolean, jsonb, jsonb) to authenticated;

revoke all on function public.tap_out_session(uuid, bigint, bigint, jsonb, text, boolean, jsonb, jsonb) from public;
grant execute on function public.tap_out_session(uuid, bigint, bigint, jsonb, text, boolean, jsonb, jsonb) to authenticated;
