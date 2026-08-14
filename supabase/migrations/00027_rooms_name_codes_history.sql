-- Room names, 6-digit codes, pgcrypto search_path, ephemeral live rooms,
-- and dashboard history (room_sessions + participants).

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- History tables
-- ---------------------------------------------------------------------------
create table if not exists public.room_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('vote', 'pomodoro')),
  host_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  live_ms bigint not null default 0
);

create table if not exists public.room_session_participants (
  room_session_id uuid not null references public.room_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat int,
  active_ms bigint not null default 0,
  break_ms bigint not null default 0,
  break_types_used jsonb not null default '[]'::jsonb,
  outcome text,
  status_at_end text,
  primary key (room_session_id, user_id)
);

alter table public.room_sessions enable row level security;
alter table public.room_session_participants enable row level security;

drop policy if exists room_sessions_select_participant on public.room_sessions;
create policy room_sessions_select_participant
  on public.room_sessions
  for select
  using (
    host_id = auth.uid()
    or exists (
      select 1
      from public.room_session_participants p
      where p.room_session_id = room_sessions.id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists room_session_participants_select_peer on public.room_session_participants;
create policy room_session_participants_select_peer
  on public.room_session_participants
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.room_session_participants me
      where me.room_session_id = room_session_participants.room_session_id
        and me.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.room_sessions rs
      where rs.id = room_session_participants.room_session_id
        and rs.host_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Live room columns
-- ---------------------------------------------------------------------------
alter table public.rooms add column if not exists name text;
alter table public.rooms add column if not exists room_session_id uuid
  references public.room_sessions (id) on delete set null;

alter table public.sessions add column if not exists room_session_id uuid
  references public.room_sessions (id) on delete set null;

update public.rooms
set name = 'Untitled'
where name is null or length(trim(name)) = 0;

alter table public.rooms alter column name set not null;

alter table public.rooms drop constraint if exists rooms_name_len;
alter table public.rooms
  add constraint rooms_name_len
  check (char_length(trim(name)) between 1 and 80);

-- ---------------------------------------------------------------------------
-- generate_room_code: 6 digits, extensions on search_path
-- ---------------------------------------------------------------------------
create or replace function public.generate_room_code(p_length int default 6)
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  alphabet constant text := '0123456789';
  len int := 6;
  bytes bytea;
  result text := '';
  i int;
  attempt int := 0;
begin
  loop
    attempt := attempt + 1;
    if attempt > 32 then
      raise exception 'room_code_generation_failed';
    end if;

    bytes := gen_random_bytes(len);
    result := '';
    for i in 0 .. (len - 1) loop
      result := result || substr(alphabet, (get_byte(bytes, i) % 10) + 1, 1);
    end loop;

    exit when not exists (
      select 1 from public.rooms r where r.code = result
    );
  end loop;

  return result;
end;
$$;

revoke all on function public.generate_room_code(int) from public;
revoke all on function public.generate_room_code(int) from authenticated;

-- Recycle closed rows so 6-digit codes stay unique.
delete from public.rooms where status = 'closed';

do $$
declare
  r record;
begin
  for r in
    select id from public.rooms where code !~ '^[0-9]{6}$'
  loop
    update public.rooms
    set code = public.generate_room_code(6)
    where id = r.id;
  end loop;
end;
$$;

alter table public.rooms drop constraint if exists rooms_code_format;
alter table public.rooms
  add constraint rooms_code_format check (code ~ '^[0-9]{6}$');

-- ---------------------------------------------------------------------------
-- Snapshot helpers + finalize (delete when empty)
-- ---------------------------------------------------------------------------
create or replace function public._record_room_participant(
  p_room_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sid uuid;
  v_seat int;
  v_active bigint := 0;
  v_break bigint := 0;
  v_types jsonb := '[]'::jsonb;
  v_outcome text := 'left_early';
  v_status text := 'WAITING';
begin
  select room_session_id, seat
  into v_sid, v_seat
  from public.room_members rm
  join public.rooms r on r.id = rm.room_id
  where rm.room_id = p_room_id
    and rm.user_id = p_user_id;

  if v_sid is null then
    select room_session_id into v_sid from public.rooms where id = p_room_id;
  end if;
  if v_sid is null then
    return;
  end if;

  if v_seat is null then
    select seat into v_seat
    from public.room_members
    where room_id = p_room_id and user_id = p_user_id;
  end if;

  select
    coalesce(s.active_ms, 0),
    coalesce(s.break_ms, 0),
    coalesce(s.break_types_used, '[]'::jsonb),
    coalesce(s.outcome, case
      when s.status = 'tapped_out' then 'tapped_out'
      when s.status in ('ended') then 'ended'
      else 'left_early'
    end),
    case
      when s.status = 'on_break' then 'BREAK'
      when s.status = 'active' then 'LOCKED_IN'
      when s.status = 'tapped_out' then 'TAPPED_OUT'
      when s.status = 'ended' then 'ENDED'
      else 'WAITING'
    end
  into v_active, v_break, v_types, v_outcome, v_status
  from public.sessions s
  where s.user_id = p_user_id
    and s.room_session_id = v_sid
  order by s.started_at desc
  limit 1;

  insert into public.room_session_participants (
    room_session_id, user_id, seat, active_ms, break_ms,
    break_types_used, outcome, status_at_end
  )
  values (
    v_sid, p_user_id, v_seat, coalesce(v_active, 0), coalesce(v_break, 0),
    coalesce(v_types, '[]'::jsonb), coalesce(v_outcome, 'left_early'),
    coalesce(v_status, 'WAITING')
  )
  on conflict (room_session_id, user_id) do update
    set
      seat = excluded.seat,
      active_ms = excluded.active_ms,
      break_ms = excluded.break_ms,
      break_types_used = excluded.break_types_used,
      outcome = excluded.outcome,
      status_at_end = excluded.status_at_end;
end;
$$;

revoke all on function public._record_room_participant(uuid, uuid) from public;

create or replace function public._purge_empty_room(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms;
  v_sid uuid;
  v_has_focus boolean;
begin
  select * into v_room from public.rooms where id = p_room_id;
  if not found then
    raise exception 'room_not_found';
  end if;

  v_sid := v_room.room_session_id;

  if v_sid is not null then
    v_has_focus := exists (
      select 1
      from public.sessions s
      where s.room_session_id = v_sid
        and s.active_ms > 0
    ) or exists (
      select 1
      from public.room_session_participants p
      where p.room_session_id = v_sid
        and p.active_ms > 0
    );

    if v_has_focus then
      update public.room_sessions
      set
        ended_at = now(),
        live_ms = greatest(
          0,
          floor(extract(epoch from (now() - started_at)) * 1000)
        )::bigint
      where id = v_sid
        and ended_at is null;
    else
      delete from public.room_sessions where id = v_sid;
    end if;
  end if;

  delete from public.rooms where id = p_room_id;
  v_room.status := 'closed';
  return v_room;
end;
$$;

revoke all on function public._purge_empty_room(uuid) from public;

create or replace function public._finalize_room_if_due(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms;
  v_count int;
begin
  select * into v_room
  from public.rooms r
  where r.id = p_room_id
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  v_count := public._room_member_count(p_room_id);

  if v_count = 0 then
    return public._purge_empty_room(p_room_id);
  end if;

  if v_room.status = 'waiting'
     and v_room.created_at <= now() - interval '5 minutes'
     and v_count < 2 then
    return public._purge_empty_room(p_room_id);
  end if;

  if v_room.status = 'live' and v_count < 2 then
    update public.rooms
    set
      status = 'closing',
      closes_at = now() + interval '60 seconds'
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  if v_room.status = 'closing'
     and v_room.closes_at is not null
     and v_room.closes_at <= now() then
    return public._purge_empty_room(p_room_id);
  end if;

  if v_room.status = 'closing'
     and v_count >= 2
     and (v_room.closes_at is null or v_room.closes_at > now()) then
    update public.rooms
    set status = 'live', closes_at = null
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  return v_room;
end;
$$;

create or replace function public.leave_room(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = v_uid
  ) then
    raise exception 'not_in_room';
  end if;

  perform public._record_room_participant(p_room_id, v_uid);

  delete from public.room_members
  where room_id = p_room_id
    and user_id = v_uid;

  return public._finalize_room_if_due(p_room_id);
end;
$$;

create or replace function public._leave_open_rooms_except(p_keep_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_old uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  for v_old in
    select r.id
    from public.room_members rm
    join public.rooms r on r.id = rm.room_id
    where rm.user_id = v_uid
      and r.status in ('waiting', 'live', 'closing')
      and (p_keep_room_id is null or r.id <> p_keep_room_id)
  loop
    begin
      perform public.leave_room(v_old);
    exception
      when others then
        delete from public.room_members
        where room_id = v_old and user_id = v_uid;
        perform public._finalize_room_if_due(v_old);
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- create / join with name + 6-digit codes
-- ---------------------------------------------------------------------------
drop function if exists public.create_room();
drop function if exists public.create_pomodoro_room(integer, integer);

create or replace function public.create_room(p_name text)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_sid uuid;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'empty_room_name';
  end if;

  perform public.ensure_own_profile();
  perform public._leave_open_rooms_except(null);

  insert into public.room_sessions (name, kind, host_id, started_at)
  values (v_name, 'vote', v_uid, now())
  returning id into v_sid;

  insert into public.rooms (code, host_id, status, kind, name, room_session_id)
  values (public.generate_room_code(6), v_uid, 'waiting', 'vote', v_name, v_sid)
  returning * into v_room;

  insert into public.room_members (room_id, user_id, seat, last_seen_at)
  values (v_room.id, v_uid, 1, now());

  return v_room;
end;
$$;

create or replace function public.create_pomodoro_room(
  work_minutes int,
  break_minutes int,
  p_name text
)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_sid uuid;
  v_work int;
  v_break int;
  v_name text := nullif(trim(p_name), '');
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'empty_room_name';
  end if;

  perform public.ensure_own_profile();
  perform public._leave_open_rooms_except(null);

  v_work := least(greatest(coalesce(work_minutes, 50), 15), 90);
  v_break := least(greatest(coalesce(break_minutes, 10), 5), 30);

  insert into public.room_sessions (name, kind, host_id, started_at)
  values (v_name, 'pomodoro', v_uid, now())
  returning id into v_sid;

  insert into public.rooms (
    code, host_id, status, kind, name, room_session_id,
    work_ms, break_ms, phase, phase_started_at
  )
  values (
    public.generate_room_code(6),
    v_uid,
    'waiting',
    'pomodoro',
    v_name,
    v_sid,
    v_work * 60 * 1000,
    v_break * 60 * 1000,
    'work',
    now()
  )
  returning * into v_room;

  insert into public.room_members (room_id, user_id, seat, last_seen_at)
  values (v_room.id, v_uid, 1, now());

  return v_room;
end;
$$;

create or replace function public.join_room(p_code text)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_room public.rooms;
  v_count int;
  v_seat int;
  v_code text := trim(p_code);
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  perform public.ensure_own_profile();

  if v_code !~ '^[0-9]{6}$' then
    raise exception 'room_not_found';
  end if;

  select * into v_room
  from public.rooms r
  where r.code = v_code
  for update;

  if not found then
    raise exception 'room_not_found';
  end if;

  perform public._leave_open_rooms_except(v_room.id);

  begin
    v_room := public._finalize_room_if_due(v_room.id);
  exception
    when others then
      if sqlerrm like '%room_not_found%' then
        raise exception 'room_not_found';
      end if;
      raise;
  end;

  if v_room.status in ('closed', 'closing') then
    raise exception 'room_closed';
  end if;

  if v_room.status not in ('waiting', 'live') then
    raise exception 'room_closed';
  end if;

  if exists (
    select 1
    from public.room_members rm
    where rm.room_id = v_room.id
      and rm.user_id = v_uid
  ) then
    update public.room_members
    set last_seen_at = now()
    where room_id = v_room.id
      and user_id = v_uid;
    return v_room;
  end if;

  v_count := public._room_member_count(v_room.id);
  if v_count >= 6 then
    raise exception 'room_full';
  end if;

  v_seat := public._next_room_seat(v_room.id);

  insert into public.room_members (room_id, user_id, seat, last_seen_at)
  values (v_room.id, v_uid, v_seat, now());

  v_count := v_count + 1;

  if v_room.status = 'waiting' and v_count >= 2 then
    update public.rooms
    set
      status = 'live',
      phase_started_at = case
        when kind = 'pomodoro' then now()
        else phase_started_at
      end
    where id = v_room.id
    returning * into v_room;
  end if;

  return v_room;
end;
$$;

revoke all on function public.create_room(text) from public;
grant execute on function public.create_room(text) to authenticated;
revoke all on function public.create_pomodoro_room(int, int, text) from public;
grant execute on function public.create_pomodoro_room(int, int, text) to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- start_session: optional room_session_id
-- ---------------------------------------------------------------------------
drop function if exists public.start_session(text, uuid);

create or replace function public.start_session(
  p_session_name text,
  p_client_id uuid,
  p_room_session_id uuid default null
)
returns public.sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.sessions;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from public.profiles p where p.id = v_uid) then
    raise exception 'profile_not_found';
  end if;

  if exists (
    select 1
    from public.sessions s
    where s.user_id = v_uid
      and s.status in ('active', 'on_break')
  ) then
    raise exception 'active_session_exists';
  end if;

  insert into public.sessions (
    user_id,
    session_name,
    started_at,
    status,
    active_ms,
    break_ms,
    break_types_used,
    client_id,
    pr_broken,
    room_session_id
  )
  values (
    v_uid,
    nullif(trim(p_session_name), ''),
    now(),
    'active',
    0,
    0,
    '[]'::jsonb,
    p_client_id,
    false,
    p_room_session_id
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.start_session(text, uuid, uuid) from public;
grant execute on function public.start_session(text, uuid, uuid) to authenticated;
grant execute on function public.dashboard_stats(text) to authenticated;

-- ---------------------------------------------------------------------------
-- dashboard_stats: include room sessions the user was in
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats(p_tz text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_today_ms bigint := 0;
  v_pr_ms bigint := 0;
  v_streak int := 0;
  v_cursor date;
  v_recent jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_tz := coalesce(nullif(trim(p_tz), ''), 'UTC');

  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  v_today := (timezone(v_tz, now()))::date;

  select coalesce(sum(s.active_ms), 0)::bigint
  into v_today_ms
  from public.sessions s
  where s.user_id = v_uid
    and (timezone(v_tz, s.started_at))::date = v_today
    and s.status in ('active', 'on_break', 'ended', 'tapped_out');

  select coalesce(max(s.active_ms), 0)::bigint
  into v_pr_ms
  from public.sessions s
  where s.user_id = v_uid
    and s.status in ('ended', 'tapped_out');

  if exists (
    select 1
    from public.sessions s
    where s.user_id = v_uid
      and s.status in ('ended', 'tapped_out', 'active', 'on_break')
      and s.active_ms > 0
      and (timezone(v_tz, s.started_at))::date = v_today
  ) then
    v_cursor := v_today;
  else
    v_cursor := v_today - 1;
  end if;

  loop
    exit when not exists (
      select 1
      from public.sessions s
      where s.user_id = v_uid
        and s.status in ('ended', 'tapped_out', 'active', 'on_break')
        and s.active_ms > 0
        and (timezone(v_tz, s.started_at))::date = v_cursor
    );
    v_streak := v_streak + 1;
    v_cursor := v_cursor - 1;
  end loop;

  select coalesce(jsonb_agg(item order by (item->>'started_at') desc), '[]'::jsonb)
  into v_recent
  from (
    (
      select jsonb_build_object(
        'id', s.id,
        'kind', 'solo',
        'session_name', s.session_name,
        'started_at', s.started_at,
        'ended_at', s.ended_at,
        'active_ms', s.active_ms,
        'break_ms', s.break_ms,
        'break_types_used', s.break_types_used,
        'status', s.status,
        'outcome', s.outcome,
        'pr_broken', s.pr_broken
      ) as item
      from public.sessions s
      where s.user_id = v_uid
        and s.room_session_id is null
      order by s.started_at desc
      limit 20
    )
    union all
    (
      select jsonb_build_object(
        'id', rs.id,
        'kind', 'room',
        'session_name', rs.name,
        'started_at', rs.started_at,
        'ended_at', rs.ended_at,
        'active_ms', rs.live_ms,
        'status', case when rs.ended_at is null then 'live' else 'ended' end,
        'participants', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'user_id', p.user_id,
              'username', pr.username,
              'active_ms', p.active_ms,
              'break_ms', p.break_ms,
              'break_types_used', p.break_types_used,
              'status_at_end', p.status_at_end,
              'outcome', p.outcome
            )
            order by p.seat nulls last
          )
          from public.room_session_participants p
          join public.profiles pr on pr.id = p.user_id
          where p.room_session_id = rs.id
        ), '[]'::jsonb)
      ) as item
      from public.room_sessions rs
      where exists (
        select 1
        from public.room_session_participants p
        where p.room_session_id = rs.id
          and p.user_id = v_uid
      )
      or rs.host_id = v_uid
      order by rs.started_at desc
      limit 20
    )
  ) q;

  return jsonb_build_object(
    'today_ms', v_today_ms,
    'streak_days', v_streak,
    'pr_ms', v_pr_ms,
    'recent', v_recent
  );
end;
$$;
