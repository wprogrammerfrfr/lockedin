-- Phase 7: projects, session tagging, GitHub stats snapshots

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  github_repo text,
  hourly_rate_usd numeric(12, 2),
  project_value_usd numeric(14, 2),
  created_at timestamptz not null default now(),
  constraint projects_display_name_nonempty check (char_length(trim(display_name)) > 0)
);

create index if not exists projects_user_id_idx on public.projects (user_id);

create table if not exists public.session_projects (
  session_id uuid not null references public.sessions (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  primary key (session_id, project_id)
);

create index if not exists session_projects_project_id_idx
  on public.session_projects (project_id);

create table if not exists public.project_stats_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  captured_at timestamptz not null default now(),
  additions bigint not null default 0,
  deletions bigint not null default 0,
  commits bigint not null default 0,
  constraint project_stats_nonnegative check (
    additions >= 0 and deletions >= 0 and commits >= 0
  )
);

create index if not exists project_stats_snapshots_project_captured_idx
  on public.project_stats_snapshots (project_id, captured_at desc);

alter table public.projects enable row level security;
alter table public.session_projects enable row level security;
alter table public.project_stats_snapshots enable row level security;

create policy "projects_select_owner"
  on public.projects
  for select
  using (auth.uid() = user_id);

create policy "projects_insert_owner"
  on public.projects
  for insert
  with check (auth.uid() = user_id);

create policy "projects_update_owner"
  on public.projects
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "projects_delete_owner"
  on public.projects
  for delete
  using (auth.uid() = user_id);

create policy "session_projects_select_owner"
  on public.session_projects
  for select
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_projects.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "session_projects_insert_owner"
  on public.session_projects
  for insert
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

create policy "session_projects_delete_owner"
  on public.session_projects
  for delete
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_projects.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "project_stats_select_owner"
  on public.project_stats_snapshots
  for select
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_stats_snapshots.project_id
        and p.user_id = auth.uid()
    )
  );

create policy "project_stats_insert_owner"
  on public.project_stats_snapshots
  for insert
  with check (
    exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

create policy "project_stats_delete_owner"
  on public.project_stats_snapshots
  for delete
  using (
    exists (
      select 1
      from public.projects p
      where p.id = project_stats_snapshots.project_id
        and p.user_id = auth.uid()
    )
  );
