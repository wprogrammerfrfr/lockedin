-- Phase 5: posts, likes, comments (following-only feed MVP)

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  session_id uuid unique references public.sessions (id) on delete set null,
  caption text,
  show_project_names boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists posts_author_id_idx on public.posts (author_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);

create table if not exists public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists likes_user_id_idx on public.likes (user_id);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_length check (char_length(body) > 0 and char_length(body) <= 250)
);

create index if not exists comments_post_id_idx on public.comments (post_id, created_at);

alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

-- Following-only (or own posts).
create policy "posts_select_following"
  on public.posts
  for select
  using (
    author_id = auth.uid()
    or exists (
      select 1
      from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = posts.author_id
        and f.status = 'accepted'
    )
  );

create policy "posts_insert_own"
  on public.posts
  for insert
  with check (auth.uid() = author_id);

create policy "posts_update_own"
  on public.posts
  for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "posts_delete_own"
  on public.posts
  for delete
  using (auth.uid() = author_id);

create policy "likes_select_visible_post"
  on public.likes
  for select
  using (
    exists (
      select 1
      from public.posts p
      where p.id = likes.post_id
        and (
          p.author_id = auth.uid()
          or exists (
            select 1
            from public.follows f
            where f.follower_id = auth.uid()
              and f.following_id = p.author_id
              and f.status = 'accepted'
          )
        )
    )
  );

create policy "likes_insert_own"
  on public.likes
  for insert
  with check (auth.uid() = user_id);

create policy "likes_delete_own"
  on public.likes
  for delete
  using (auth.uid() = user_id);

create policy "comments_select_visible_post"
  on public.comments
  for select
  using (
    exists (
      select 1
      from public.posts p
      where p.id = comments.post_id
        and (
          p.author_id = auth.uid()
          or exists (
            select 1
            from public.follows f
            where f.follower_id = auth.uid()
              and f.following_id = p.author_id
              and f.status = 'accepted'
          )
        )
    )
  );

create policy "comments_insert_own"
  on public.comments
  for insert
  with check (auth.uid() = user_id);

create policy "comments_delete_own"
  on public.comments
  for delete
  using (auth.uid() = user_id);
