-- Developer Mode: imported GitHub commits per project + project start date

alter table public.projects
  add column if not exists first_commit_at timestamptz,
  add column if not exists first_commit_message text,
  add column if not exists first_commit_sha text,
  add column if not exists commits_synced_at timestamptz;

create table if not exists public.project_commits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  sha text not null,
  message text not null default '',
  committed_at timestamptz not null,
  html_url text,
  created_at timestamptz not null default now(),
  constraint project_commits_project_sha_key unique (project_id, sha)
);

create index if not exists project_commits_project_committed_idx
  on public.project_commits (project_id, committed_at);

create index if not exists project_commits_user_id_idx
  on public.project_commits (user_id);

alter table public.project_commits enable row level security;

create policy "project_commits_select_owner"
  on public.project_commits
  for select
  using (auth.uid() = user_id);

create policy "project_commits_insert_owner"
  on public.project_commits
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

create policy "project_commits_update_owner"
  on public.project_commits
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

create policy "project_commits_delete_owner"
  on public.project_commits
  for delete
  using (auth.uid() = user_id);
