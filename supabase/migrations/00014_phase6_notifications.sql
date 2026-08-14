-- Phase 6: notifications + are_mutual helper

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null
    check (type in (
      'follow_request',
      'follow_accept',
      'like',
      'comment',
      'streak_7',
      'session_4h',
      'lines_1000'
    )),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_owner"
  on public.notifications
  for select
  using (auth.uid() = user_id);

create policy "notifications_update_owner"
  on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- are_mutual: both directions accepted
-- ---------------------------------------------------------------------------
create or replace function public.are_mutual(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    a is not null
    and b is not null
    and a <> b
    and exists (
      select 1
      from public.follows f1
      where f1.follower_id = a
        and f1.following_id = b
        and f1.status = 'accepted'
    )
    and exists (
      select 1
      from public.follows f2
      where f2.follower_id = b
        and f2.following_id = a
        and f2.status = 'accepted'
    );
$$;

revoke all on function public.are_mutual(uuid, uuid) from public;
grant execute on function public.are_mutual(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Helper: insert notification (internal)
-- ---------------------------------------------------------------------------
create or replace function public._notify(
  p_user_id uuid,
  p_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (p_user_id, p_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke all on function public._notify(uuid, text, jsonb) from public;

-- ---------------------------------------------------------------------------
-- Follow request / accept notification hooks
-- ---------------------------------------------------------------------------
create or replace function public._follows_notify_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public._notify(
      new.following_id,
      'follow_request',
      jsonb_build_object('follower_id', new.follower_id)
    );
  elsif tg_op = 'UPDATE'
        and old.status is distinct from new.status
        and new.status = 'accepted' then
    perform public._notify(
      new.follower_id,
      'follow_accept',
      jsonb_build_object('following_id', new.following_id)
    );
  elsif tg_op = 'INSERT' and new.status = 'accepted' then
    perform public._notify(
      new.follower_id,
      'follow_accept',
      jsonb_build_object('following_id', new.following_id)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert or update of status on public.follows
  for each row
  execute function public._follows_notify_trigger();

-- ---------------------------------------------------------------------------
-- Like / comment activity: mutual-only
-- ---------------------------------------------------------------------------
create or replace function public._likes_notify_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select p.author_id into v_author
  from public.posts p
  where p.id = new.post_id;

  if v_author is null or v_author = new.user_id then
    return new;
  end if;

  if public.are_mutual(v_author, new.user_id) then
    perform public._notify(
      v_author,
      'like',
      jsonb_build_object(
        'post_id', new.post_id,
        'actor_id', new.user_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify
  after insert on public.likes
  for each row
  execute function public._likes_notify_trigger();

create or replace function public._comments_notify_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author uuid;
begin
  select p.author_id into v_author
  from public.posts p
  where p.id = new.post_id;

  if v_author is null or v_author = new.user_id then
    return new;
  end if;

  if public.are_mutual(v_author, new.user_id) then
    perform public._notify(
      v_author,
      'comment',
      jsonb_build_object(
        'post_id', new.post_id,
        'comment_id', new.id,
        'actor_id', new.user_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row
  execute function public._comments_notify_trigger();

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;
