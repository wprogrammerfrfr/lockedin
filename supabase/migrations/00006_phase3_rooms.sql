-- Phase 3: rooms + room_members schema, code generator, RLS

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  host_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'live', 'closing', 'closed')),
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  kind text not null default 'vote'
    check (kind in ('vote', 'pomodoro')),
  work_ms int,
  break_ms int,
  phase text
    check (phase is null or phase in ('work', 'break')),
  phase_started_at timestamptz,
  active_break_round_id uuid,
  break_vote_ends_at timestamptz,
  constraint rooms_code_format check (code ~ '^[A-Za-z0-9]{6,8}$'),
  constraint rooms_code_unique unique (code),
  constraint rooms_pomodoro_fields check (
    kind <> 'pomodoro'
    or (
      work_ms is not null
      and break_ms is not null
      and work_ms > 0
      and break_ms > 0
    )
  )
);

create index if not exists rooms_host_id_idx on public.rooms (host_id);
create index if not exists rooms_status_idx on public.rooms (status)
  where status in ('waiting', 'live', 'closing');

-- ---------------------------------------------------------------------------
-- room_members
-- ---------------------------------------------------------------------------
create table if not exists public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat int not null,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id),
  constraint room_members_seat_range check (seat between 1 and 6),
  constraint room_members_room_seat_unique unique (room_id, seat)
);

create index if not exists room_members_user_id_idx on public.room_members (user_id);

-- ---------------------------------------------------------------------------
-- generate_room_code (CSPRNG NanoID-style alphanumeric)
-- ---------------------------------------------------------------------------
create or replace function public.generate_room_code(p_length int default 7)
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text :=
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  len int := coalesce(p_length, 7);
  bytes bytea;
  result text := '';
  i int;
  attempt int := 0;
begin
  if len < 6 then
    len := 6;
  elsif len > 8 then
    len := 8;
  end if;

  loop
    attempt := attempt + 1;
    if attempt > 32 then
      raise exception 'room_code_generation_failed';
    end if;

    bytes := gen_random_bytes(len);
    result := '';
    for i in 0 .. (len - 1) loop
      result := result || substr(alphabet, (get_byte(bytes, i) % 62) + 1, 1);
    end loop;

    exit when not exists (
      select 1 from public.rooms r where r.code = result
    );
  end loop;

  return result;
end;
$$;

revoke all on function public.generate_room_code(int) from public;
grant execute on function public.generate_room_code(int) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;

-- Members can read rooms they belong to.
create policy "rooms_select_member"
  on public.rooms
  for select
  using (
    exists (
      select 1
      from public.room_members rm
      where rm.room_id = rooms.id
        and rm.user_id = auth.uid()
    )
  );

-- Anyone authenticated can preview joinable rooms by code (waiting/live).
create policy "rooms_select_joinable"
  on public.rooms
  for select
  to authenticated
  using (status in ('waiting', 'live'));

-- Host can update their open room (status transitions also go through RPCs).
create policy "rooms_update_host"
  on public.rooms
  for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

create policy "rooms_insert_host"
  on public.rooms
  for insert
  with check (auth.uid() = host_id);

-- Members of a room can see other members.
create policy "room_members_select_same_room"
  on public.room_members
  for select
  using (
    exists (
      select 1
      from public.room_members me
      where me.room_id = room_members.room_id
        and me.user_id = auth.uid()
    )
  );

-- Join preview: see seats for joinable rooms.
create policy "room_members_select_joinable"
  on public.room_members
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.rooms r
      where r.id = room_members.room_id
        and r.status in ('waiting', 'live')
    )
  );

create policy "room_members_insert_self"
  on public.room_members
  for insert
  with check (auth.uid() = user_id);

create policy "room_members_update_self"
  on public.room_members
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "room_members_delete_self"
  on public.room_members
  for delete
  using (auth.uid() = user_id);
