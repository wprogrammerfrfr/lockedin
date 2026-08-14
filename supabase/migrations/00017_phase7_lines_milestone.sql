-- Phase 7: lines_1000 milestone RPC

create or replace function public.check_lines_milestone(p_project_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_additions bigint := 0;
  v_notified boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if p_project_id is not null then
    if not exists (
      select 1
      from public.projects p
      where p.id = p_project_id
        and p.user_id = v_uid
    ) then
      raise exception 'project_not_found';
    end if;

    select coalesce(sum(s.additions), 0)::bigint
    into v_additions
    from public.project_stats_snapshots s
    where s.project_id = p_project_id;
  else
    select coalesce(sum(s.additions), 0)::bigint
    into v_additions
    from public.project_stats_snapshots s
    join public.projects p on p.id = s.project_id
    where p.user_id = v_uid;
  end if;

  if v_additions >= 1000 then
    if not exists (
      select 1
      from public.notifications n
      where n.user_id = v_uid
        and n.type = 'lines_1000'
    ) then
      perform public._notify(
        v_uid,
        'lines_1000',
        jsonb_build_object(
          'additions', v_additions,
          'project_id', p_project_id
        )
      );
      v_notified := true;
    end if;
  end if;

  return jsonb_build_object(
    'additions', v_additions,
    'milestone_reached', v_additions >= 1000,
    'notified', v_notified
  );
end;
$$;

revoke all on function public.check_lines_milestone(uuid) from public;
grant execute on function public.check_lines_milestone(uuid) to authenticated;
