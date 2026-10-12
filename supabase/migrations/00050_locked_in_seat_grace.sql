-- App switch freezes the PWA heartbeat. Keep LOCKED_IN / BREAK seats for 10
-- minutes. Waiting, idle, and lacking seats still drop after 35 seconds.

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

  delete from public.room_members rm
  where rm.room_id = p_room_id
    and (
      (
        coalesce(rm.focus_status, 'WAITING') in ('LOCKED_IN', 'BREAK')
        and rm.last_seen_at < now() - interval '10 minutes'
      )
      or (
        coalesce(rm.focus_status, 'WAITING') not in ('LOCKED_IN', 'BREAK')
        and rm.last_seen_at < now() - interval '35 seconds'
      )
    );

  v_count := public._room_member_count(p_room_id);

  -- Waiting never reached 2 members within 5 minutes → purge.
  if v_room.status = 'waiting'
     and v_room.created_at <= now() - interval '5 minutes'
     and v_count < 2 then
    return public._purge_empty_room(p_room_id);
  end if;

  -- Live dropped below 2 (including 0) → start 60s closing, do not purge yet.
  if v_room.status = 'live' and v_count < 2 then
    update public.rooms
    set
      status = 'closing',
      closes_at = now() + interval '60 seconds'
    where id = p_room_id
    returning * into v_room;
    return v_room;
  end if;

  -- Already closing with < 2: keep original closes_at; purge only when due.
  if v_room.status = 'closing'
     and v_room.closes_at is not null
     and v_room.closes_at <= now() then
    return public._purge_empty_room(p_room_id);
  end if;

  -- Closing with no timer set (legacy) and empty → start a fresh 60s window.
  if v_room.status = 'closing'
     and v_room.closes_at is null
     and v_count < 2 then
    update public.rooms
    set closes_at = now() + interval '60 seconds'
    where id = p_room_id
    returning * into v_room;
    return v_room;
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

  -- Empty waiting room with no members left during grace → keep waiting
  -- (5-minute rule above handles purge). Do not instant-purge count=0 live.
  return v_room;
end;
$$;
