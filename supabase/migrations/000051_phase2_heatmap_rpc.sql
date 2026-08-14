-- Phase 2: public profile activity heatmap (last 371 local days)

create or replace function public.profile_activity_heatmap(
  p_username citext,
  p_tz text
)
returns table (day date, active_ms bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_tz text;
  v_end date;
  v_start date;
begin
  select p.id into v_profile_id
  from public.profiles p
  where p.username = p_username;

  if v_profile_id is null then
    return;
  end if;

  v_tz := coalesce(nullif(trim(p_tz), ''), 'UTC');

  begin
    perform timezone(v_tz, now());
  exception
    when invalid_parameter_value then
      v_tz := 'UTC';
  end;

  v_end := (timezone(v_tz, now()))::date;
  v_start := v_end - 370; -- inclusive window of 371 days

  return query
  select
    (timezone(v_tz, s.started_at))::date as day,
    sum(s.active_ms)::bigint as active_ms
  from public.sessions s
  where s.user_id = v_profile_id
    and s.status in ('ended', 'tapped_out')
    and (timezone(v_tz, s.started_at))::date between v_start and v_end
  group by 1
  order by 1;
end;
$$;

revoke all on function public.profile_activity_heatmap(citext, text) from public;
grant execute on function public.profile_activity_heatmap(citext, text) to anon, authenticated;
