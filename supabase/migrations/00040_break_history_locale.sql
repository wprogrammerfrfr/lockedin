-- Locale + break timer preferences on profiles; break history on sessions.

alter table public.profiles
  add column if not exists locale text not null default 'en',
  add column if not exists break_timer_minutes int not null default 15;

alter table public.profiles
  drop constraint if exists profiles_locale_check;

alter table public.profiles
  add constraint profiles_locale_check check (locale in ('en', 'tr', 'ko'));

alter table public.profiles
  drop constraint if exists profiles_break_timer_minutes_check;

alter table public.profiles
  add constraint profiles_break_timer_minutes_check
  check (break_timer_minutes between 1 and 120);

alter table public.sessions
  add column if not exists break_history jsonb not null default '[]'::jsonb;

-- end_session: persist optional break_history
create or replace function public.end_session(
  p_id uuid,
  p_active_ms bigint,
  p_break_ms bigint,
  p_break_types jsonb,
  p_outcome text,
  p_pr_broken boolean,
  p_break_history jsonb default '[]'::jsonb
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
    pr_broken = coalesce(p_pr_broken, false)
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

-- tap_out_session: persist optional break_history
create or replace function public.tap_out_session(
  p_id uuid,
  p_active_ms bigint,
  p_break_ms bigint,
  p_break_types jsonb,
  p_outcome text,
  p_pr_broken boolean,
  p_break_history jsonb default '[]'::jsonb
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
    pr_broken = coalesce(p_pr_broken, false)
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;
