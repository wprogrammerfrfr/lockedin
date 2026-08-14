-- RLS helpers (no recursion), vote result fan-out + cancel, live member status.

-- ---------------------------------------------------------------------------
-- Security-definer membership helpers (owner bypasses RLS)
-- ---------------------------------------------------------------------------
create or replace function public._is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
  );
$$;

create or replace function public._room_is_joinable(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = p_room_id
      and r.status in ('waiting', 'live')
  );
$$;

create or replace function public._is_room_session_peer(p_room_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.room_sessions rs
      where rs.id = p_room_session_id
        and rs.host_id = auth.uid()
    )
    or exists (
      select 1
      from public.room_session_participants p
      where p.room_session_id = p_room_session_id
        and p.user_id = auth.uid()
    );
$$;

revoke all on function public._is_room_member(uuid) from public;
revoke all on function public._room_is_joinable(uuid) from public;
revoke all on function public._is_room_session_peer(uuid) from public;
grant execute on function public._is_room_member(uuid) to authenticated;
grant execute on function public._room_is_joinable(uuid) to authenticated;
grant execute on function public._is_room_session_peer(uuid) to authenticated;

drop policy if exists "rooms_select_member" on public.rooms;
drop policy if exists rooms_select_member on public.rooms;
create policy rooms_select_member
  on public.rooms
  for select
  using (public._is_room_member(id));

drop policy if exists "room_members_select_same_room" on public.room_members;
drop policy if exists room_members_select_same_room on public.room_members;
create policy room_members_select_same_room
  on public.room_members
  for select
  using (public._is_room_member(room_id));

drop policy if exists "room_members_select_joinable" on public.room_members;
drop policy if exists room_members_select_joinable on public.room_members;
create policy room_members_select_joinable
  on public.room_members
  for select
  to authenticated
  using (public._room_is_joinable(room_id));

drop policy if exists "room_break_votes_select_member" on public.room_break_votes;
drop policy if exists room_break_votes_select_member on public.room_break_votes;
create policy room_break_votes_select_member
  on public.room_break_votes
  for select
  using (public._is_room_member(room_id));

drop policy if exists room_sessions_select_participant on public.room_sessions;
create policy room_sessions_select_participant
  on public.room_sessions
  for select
  using (public._is_room_session_peer(id));

drop policy if exists room_session_participants_select_peer on public.room_session_participants;
create policy room_session_participants_select_peer
  on public.room_session_participants
  for select
  using (public._is_room_session_peer(room_session_id));

-- ---------------------------------------------------------------------------
-- Vote result columns + live member status
-- ---------------------------------------------------------------------------
alter table public.rooms add column if not exists break_vote_requested_by uuid
  references public.profiles (id) on delete set null;
alter table public.rooms add column if not exists last_vote_round_id uuid;
alter table public.rooms add column if not exists last_vote_result text;

alter table public.rooms drop constraint if exists rooms_last_vote_result;
alter table public.rooms
  add constraint rooms_last_vote_result
  check (
    last_vote_result is null
    or last_vote_result in ('break', 'stay', 'cancelled')
  );

alter table public.room_members add column if not exists focus_status text;
alter table public.room_members add column if not exists elapsed_ms bigint;

update public.room_members
set focus_status = coalesce(nullif(focus_status, ''), 'WAITING')
where focus_status is null;

update public.room_members
set elapsed_ms = coalesce(elapsed_ms, 0)
where elapsed_ms is null;

alter table public.room_members
  alter column focus_status set default 'WAITING';
alter table public.room_members
  alter column elapsed_ms set default 0;

alter table public.room_members drop constraint if exists room_members_focus_status;
alter table public.room_members
  add constraint room_members_focus_status
  check (focus_status in ('WAITING', 'LOCKED_IN', 'BREAK', 'LACKING', 'IDLE'));

-- ---------------------------------------------------------------------------
-- resolve / maybe-resolve / request / cast / cancel
-- ---------------------------------------------------------------------------
create or replace function public.resolve_break_vote(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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

  if not public._is_room_member(p_room_id) then
    raise exception 'not_in_room';
  end if;

  v_round := v_room.active_break_round_id;

  if v_round is null then
    return jsonb_build_object(
      'result', v_room.last_vote_result,
      'round_id', v_room.last_vote_round_id,
      'message', 'no_active_vote'
    );
  end if;

  v_eligible := public._room_member_count(p_room_id);

  select
    count(*) filter (where choice = 'break')::int,
    count(*) filter (where choice = 'stay')::int
  into v_break, v_stay_explicit
  from public.room_break_votes
  where room_id = p_room_id
    and round_id = v_round;

  v_stay := v_stay_explicit + greatest(v_eligible - (v_break + v_stay_explicit), 0);

  if v_break > v_stay then
    v_result := 'break';
  else
    v_result := 'stay';
  end if;

  update public.rooms
  set
    last_vote_round_id = v_round,
    last_vote_result = v_result,
    active_break_round_id = null,
    break_vote_ends_at = null,
    break_vote_requested_by = null
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

create or replace function public._maybe_resolve_break_vote(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms;
  v_eligible int;
  v_break int := 0;
  v_stay int := 0;
  v_voted int;
  v_remaining int;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    return;
  end if;
  if v_room.active_break_round_id is null then
    return;
  end if;

  v_eligible := public._room_member_count(p_room_id);
  if v_eligible < 1 then
    return;
  end if;

  select
    count(*) filter (where choice = 'break')::int,
    count(*) filter (where choice = 'stay')::int
  into v_break, v_stay
  from public.room_break_votes
  where room_id = p_room_id
    and round_id = v_room.active_break_round_id;

  v_voted := v_break + v_stay;
  v_remaining := greatest(v_eligible - v_voted, 0);

  if v_remaining = 0
     or v_break > v_stay + v_remaining
     or v_break + v_remaining <= v_stay then
    perform public.resolve_break_vote(p_room_id);
  end if;
end;
$$;

revoke all on function public._maybe_resolve_break_vote(uuid) from public;

create or replace function public.request_shared_break(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
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

  if not public._is_room_member(p_room_id) then
    raise exception 'not_in_room';
  end if;

  if v_room.active_break_round_id is not null
     and v_room.break_vote_ends_at is not null
     and v_room.break_vote_ends_at > now() then
    raise exception 'vote_in_progress';
  end if;

  if v_room.active_break_round_id is not null
     and v_room.break_vote_ends_at is not null
     and v_room.break_vote_ends_at <= now() then
    perform public.resolve_break_vote(p_room_id);
  end if;

  update public.rooms
  set
    active_break_round_id = v_round,
    break_vote_ends_at = now() + interval '30 seconds',
    break_vote_requested_by = v_uid
  where id = p_room_id
  returning * into v_room;

  insert into public.room_break_votes (room_id, round_id, user_id, choice)
  values (p_room_id, v_round, v_uid, 'break');

  perform public._maybe_resolve_break_vote(p_room_id);
  select * into v_room from public.rooms where id = p_room_id;
  return v_room;
end;
$$;

create or replace function public.cast_break_vote(
  p_room_id uuid,
  p_choice text
)
returns public.room_break_votes
language plpgsql
security definer
set search_path = public, pg_temp
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

  if not public._is_room_member(p_room_id) then
    raise exception 'not_in_room';
  end if;

  insert into public.room_break_votes (room_id, round_id, user_id, choice)
  values (p_room_id, v_room.active_break_round_id, v_uid, p_choice)
  on conflict (round_id, user_id)
  do update set choice = excluded.choice
  returning * into v_vote;

  perform public._maybe_resolve_break_vote(p_room_id);
  return v_vote;
end;
$$;

create or replace function public.cancel_break_vote(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_round uuid;
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

  if not public._is_room_member(p_room_id) then
    raise exception 'not_in_room';
  end if;

  if v_room.active_break_round_id is null then
    raise exception 'no_active_vote';
  end if;

  if v_room.break_vote_requested_by is distinct from v_uid then
    raise exception 'not_vote_requester';
  end if;

  v_round := v_room.active_break_round_id;

  update public.rooms
  set
    last_vote_round_id = v_round,
    last_vote_result = 'cancelled',
    active_break_round_id = null,
    break_vote_ends_at = null,
    break_vote_requested_by = null
  where id = p_room_id
  returning * into v_room;

  return v_room;
end;
$$;

revoke all on function public.resolve_break_vote(uuid) from public;
grant execute on function public.resolve_break_vote(uuid) to authenticated;
revoke all on function public.request_shared_break(uuid) from public;
grant execute on function public.request_shared_break(uuid) to authenticated;
revoke all on function public.cast_break_vote(uuid, text) from public;
grant execute on function public.cast_break_vote(uuid, text) to authenticated;
revoke all on function public.cancel_break_vote(uuid) from public;
grant execute on function public.cancel_break_vote(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Live presence on room_members
-- ---------------------------------------------------------------------------
drop function if exists public.touch_room_presence(uuid);

create or replace function public.touch_room_presence(
  p_room_id uuid,
  p_status text default null,
  p_elapsed_ms bigint default null
)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_status := coalesce(nullif(trim(p_status), ''), 'WAITING');
  if v_status not in ('WAITING', 'LOCKED_IN', 'BREAK', 'LACKING', 'IDLE') then
    v_status := 'WAITING';
  end if;

  update public.room_members
  set
    last_seen_at = now(),
    focus_status = v_status,
    elapsed_ms = coalesce(p_elapsed_ms, elapsed_ms, 0)
  where room_id = p_room_id
    and user_id = v_uid;

  if not found then
    raise exception 'not_in_room';
  end if;

  return public._finalize_room_if_due(p_room_id);
end;
$$;

revoke all on function public.touch_room_presence(uuid, text, bigint) from public;
grant execute on function public.touch_room_presence(uuid, text, bigint) to authenticated;
