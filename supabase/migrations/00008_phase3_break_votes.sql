-- Phase 3: shared break voting (majority, 30s, non-votes count as stay)

create table if not exists public.room_break_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  round_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  choice text not null check (choice in ('break', 'stay')),
  created_at timestamptz not null default now(),
  constraint room_break_votes_round_user_unique unique (round_id, user_id)
);

create index if not exists room_break_votes_room_round_idx
  on public.room_break_votes (room_id, round_id);

alter table public.room_break_votes enable row level security;

create policy "room_break_votes_select_member"
  on public.room_break_votes
  for select
  using (
    exists (
      select 1
      from public.room_members rm
      where rm.room_id = room_break_votes.room_id
        and rm.user_id = auth.uid()
    )
  );

-- Writes go through security definer RPCs.
create policy "room_break_votes_insert_self"
  on public.room_break_votes
  for insert
  with check (auth.uid() = user_id);

-- Realtime publication (ignore if already added)
do $$
begin
  begin
    alter publication supabase_realtime add table public.rooms;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.room_members;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.room_break_votes;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_break_vote
-- majority of members; non-votes = stay; tie → stay
-- returns jsonb { round_id, result, break_votes, stay_votes, eligible }
-- ---------------------------------------------------------------------------
create or replace function public.resolve_break_vote(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_round uuid;
  v_eligible int;
  v_break int;
  v_stay_explicit int;
  v_stay int;
  v_result text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_room
  from public.rooms r
  where r.id = p_room_id
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = v_uid
  ) then
    raise exception 'not_in_room';
  end if;

  v_round := v_room.active_break_round_id;

  if v_round is null then
    return jsonb_build_object('result', null, 'message', 'no_active_vote');
  end if;

  select count(*)::int into v_eligible
  from public.room_members
  where room_id = p_room_id;

  select
    count(*) filter (where choice = 'break')::int,
    count(*) filter (where choice = 'stay')::int
  into v_break, v_stay_explicit
  from public.room_break_votes
  where room_id = p_room_id
    and round_id = v_round;

  -- Non-votes count as stay.
  v_stay := v_stay_explicit + greatest(v_eligible - (v_break + v_stay_explicit), 0);

  if v_break > v_stay then
    v_result := 'break';
  else
    v_result := 'stay';
  end if;

  update public.rooms
  set
    active_break_round_id = null,
    break_vote_ends_at = null
  where id = p_room_id;

  return jsonb_build_object(
    'round_id', v_round,
    'result', v_result,
    'break_votes', v_break,
    'stay_votes', v_stay,
    'eligible', v_eligible
  );
end;
$$;

revoke all on function public.resolve_break_vote(uuid) from public;
grant execute on function public.resolve_break_vote(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- request_shared_break
-- ---------------------------------------------------------------------------
create or replace function public.request_shared_break(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_round uuid := gen_random_uuid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_room
  from public.rooms r
  where r.id = p_room_id
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  if v_room.kind <> 'vote' then
    raise exception 'not_vote_room';
  end if;

  if v_room.status <> 'live' then
    raise exception 'room_not_live';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = v_uid
  ) then
    raise exception 'not_in_room';
  end if;

  -- Active unresolved round still running.
  if v_room.active_break_round_id is not null
     and v_room.break_vote_ends_at is not null
     and v_room.break_vote_ends_at > now() then
    raise exception 'vote_in_progress';
  end if;

  -- Auto-resolve expired round before starting a new one.
  if v_room.active_break_round_id is not null
     and v_room.break_vote_ends_at is not null
     and v_room.break_vote_ends_at <= now() then
    perform public.resolve_break_vote(p_room_id);
  end if;

  update public.rooms
  set
    active_break_round_id = v_round,
    break_vote_ends_at = now() + interval '30 seconds'
  where id = p_room_id
  returning * into v_room;

  insert into public.room_break_votes (room_id, round_id, user_id, choice)
  values (p_room_id, v_round, v_uid, 'break');

  return v_room;
end;
$$;

revoke all on function public.request_shared_break(uuid) from public;
grant execute on function public.request_shared_break(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cast_break_vote
-- ---------------------------------------------------------------------------
create or replace function public.cast_break_vote(
  p_room_id uuid,
  p_choice text
)
returns public.room_break_votes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_vote public.room_break_votes;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_choice is null or p_choice not in ('break', 'stay') then
    raise exception 'invalid_choice';
  end if;

  select * into v_room
  from public.rooms r
  where r.id = p_room_id
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  if v_room.kind <> 'vote' then
    raise exception 'not_vote_room';
  end if;

  if v_room.active_break_round_id is null
     or v_room.break_vote_ends_at is null then
    raise exception 'no_active_vote';
  end if;

  if v_room.break_vote_ends_at <= now() then
    perform public.resolve_break_vote(p_room_id);
    raise exception 'vote_expired';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = v_uid
  ) then
    raise exception 'not_in_room';
  end if;

  insert into public.room_break_votes (room_id, round_id, user_id, choice)
  values (p_room_id, v_room.active_break_round_id, v_uid, p_choice)
  on conflict (round_id, user_id)
  do update set choice = excluded.choice
  returning * into v_vote;

  return v_vote;
end;
$$;

revoke all on function public.cast_break_vote(uuid, text) from public;
grant execute on function public.cast_break_vote(uuid, text) to authenticated;
