-- Persist live melt config on room_members so the melt board does not
-- depend solely on nested Realtime presence payloads.

alter table public.room_members
  add column if not exists melt_config jsonb,
  add column if not exists melt_anim_offset_ms bigint not null default 0;

drop function if exists public.touch_room_presence(uuid, text, bigint, text);

create or replace function public.touch_room_presence(
  p_room_id uuid,
  p_status text default null,
  p_elapsed_ms bigint default null,
  p_break_label text default null,
  p_melt_config jsonb default null,
  p_melt_anim_offset_ms bigint default null
)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_label text;
  v_melt jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  v_status := coalesce(nullif(trim(p_status), ''), 'WAITING');
  if v_status not in ('WAITING', 'LOCKED_IN', 'BREAK', 'LACKING', 'IDLE') then
    v_status := 'WAITING';
  end if;

  v_label := case
    when v_status = 'BREAK' then nullif(trim(p_break_label), '')
    else null
  end;

  -- jsonb 'null' and SQL NULL both clear the dessert.
  if p_melt_config is null or jsonb_typeof(p_melt_config) = 'null' then
    v_melt := null;
  else
    v_melt := p_melt_config;
  end if;

  update public.room_members
  set
    last_seen_at = now(),
    focus_status = v_status,
    elapsed_ms = coalesce(p_elapsed_ms, elapsed_ms, 0),
    break_label = v_label,
    melt_config = v_melt,
    melt_anim_offset_ms = case
      when v_melt is null then 0
      else coalesce(p_melt_anim_offset_ms, melt_anim_offset_ms, 0)
    end
  where room_id = p_room_id
    and user_id = v_uid;

  if not found then
    raise exception 'not_in_room';
  end if;

  return public._finalize_room_if_due(p_room_id);
end;
$$;

revoke all on function public.touch_room_presence(uuid, text, bigint, text, jsonb, bigint) from public;
grant execute on function public.touch_room_presence(uuid, text, bigint, text, jsonb, bigint) to authenticated;
