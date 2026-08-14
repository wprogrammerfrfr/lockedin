-- Post summary card images for Explore feed shares.

alter table public.posts
  add column if not exists image_path text;

-- Public bucket for session summary cards
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'post-cards',
  'post-cards',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post_cards_select_public" on storage.objects;
create policy "post_cards_select_public"
  on storage.objects
  for select
  using (bucket_id = 'post-cards');

drop policy if exists "post_cards_insert_own" on storage.objects;
create policy "post_cards_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'post-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "post_cards_update_own" on storage.objects;
create policy "post_cards_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'post-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'post-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "post_cards_delete_own" on storage.objects;
create policy "post_cards_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'post-cards'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Extend delete_own_account to wipe post-cards too
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = v_uid::text;

  delete from storage.objects
  where bucket_id = 'post-cards'
    and (storage.foldername(name))[1] = v_uid::text;

  delete from auth.users
  where id = v_uid;
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
