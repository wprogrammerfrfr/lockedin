-- generate_room_code: SECURITY DEFINER so uniqueness sees all rooms (not caller RLS).
-- Revoke client EXECUTE; create_room / create_pomodoro_room still call it internally.

create or replace function public.generate_room_code(p_length int default 7)
returns text
language plpgsql
volatile
security definer
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
revoke all on function public.generate_room_code(int) from authenticated;
