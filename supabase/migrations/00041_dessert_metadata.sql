-- Dessert / melt metadata for sessions and room participants.

alter table public.sessions
  add column if not exists dessert_metadata jsonb not null default '{}'::jsonb;

alter table public.room_session_participants
  add column if not exists dessert_metadata jsonb not null default '{}'::jsonb;

-- start_session: optional dessert metadata at lock-in
drop function if exists public.start_session(text, uuid, uuid);

create or replace function public.start_session(
  p_session_name text,
  p_client_id uuid,
  p_room_session_id uuid default null,
  p_dessert_metadata jsonb default '{}'::jsonb
)
returns public.sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_not_found';
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
    pr_broken,
    room_session_id,
    dessert_metadata
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
    false,
    p_room_session_id,
    coalesce(p_dessert_metadata, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.start_session(text, uuid, uuid, jsonb) from public;
grant execute on function public.start_session(text, uuid, uuid, jsonb) to authenticated;

-- end_session: persist optional dessert_metadata
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
    break_history = coalesce(p_break_history, break_history),
    outcome = p_outcome,
    pr_broken = coalesce(p_pr_broken, false),
    dessert_metadata = coalesce(p_dessert_metadata, dessert_metadata)
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

-- tap_out_session: persist optional dessert_metadata
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
    break_history = coalesce(p_break_history, break_history),
    outcome = coalesce(p_outcome, 'tapout'),
    pr_broken = coalesce(p_pr_broken, false),
    dessert_metadata = coalesce(p_dessert_metadata, dessert_metadata)
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
