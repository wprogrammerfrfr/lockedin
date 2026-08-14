-- Phase 8: hardening indexes

create index if not exists follows_pair_status_idx
  on public.follows (follower_id, following_id, status);

create index if not exists posts_created_at_idx
  on public.posts (created_at desc);

create index if not exists posts_author_created_at_idx
  on public.posts (author_id, created_at desc);

create index if not exists notifications_user_id_idx
  on public.notifications (user_id);

create index if not exists notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists sessions_user_started_at_idx
  on public.sessions (user_id, started_at desc);

create index if not exists sessions_user_status_started_at_idx
  on public.sessions (user_id, status, started_at desc);

create index if not exists sessions_shared_started_at_idx
  on public.sessions (started_at desc)
  where is_shared = true;

create index if not exists comments_user_created_at_idx
  on public.comments (user_id, created_at desc);

create index if not exists room_members_room_last_seen_idx
  on public.room_members (room_id, last_seen_at desc);

create index if not exists rooms_code_status_idx
  on public.rooms (code, status);
