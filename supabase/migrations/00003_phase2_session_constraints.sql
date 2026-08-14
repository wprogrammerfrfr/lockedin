-- Phase 2: session columns, status check, one-active-session index

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column if not exists outcome text,
  add column if not exists pr_broken boolean not null default false,
  add column if not exists client_id uuid;

-- Normalize any unexpected legacy statuses before adding the check.
-- Existing rows defaulted to 'ended' in 00002; keep them valid.
update public.sessions
set status = 'ended'
where status is null
   or status not in ('active', 'on_break', 'ended', 'tapped_out');

alter table public.sessions
  drop constraint if exists sessions_status_check;

alter table public.sessions
  add constraint sessions_status_check
  check (status in ('active', 'on_break', 'ended', 'tapped_out'));

-- At most one live (active / on_break) session per user.
create unique index if not exists sessions_one_active
  on public.sessions (user_id)
  where status in ('active', 'on_break');
