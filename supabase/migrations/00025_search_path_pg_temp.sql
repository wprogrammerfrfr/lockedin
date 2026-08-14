-- Pin search_path to public, pg_temp on DEFINER functions (no body rewrites).

alter function public.handle_new_user() set search_path = public, pg_temp;

alter function public.start_session(text, uuid) set search_path = public, pg_temp;
alter function public.heartbeat_session(uuid, bigint, bigint, jsonb, text) set search_path = public, pg_temp;
alter function public.end_session(uuid, bigint, bigint, jsonb, text, boolean) set search_path = public, pg_temp;
alter function public.tap_out_session(uuid, bigint, bigint, jsonb, text, boolean) set search_path = public, pg_temp;
alter function public.resume_active_session() set search_path = public, pg_temp;

alter function public.dashboard_stats(text) set search_path = public, pg_temp;
alter function public.profile_activity_heatmap(citext, text) set search_path = public, pg_temp;

alter function public.generate_room_code(int) set search_path = public, pg_temp;
alter function public._room_member_count(uuid) set search_path = public, pg_temp;
alter function public._next_room_seat(uuid) set search_path = public, pg_temp;
alter function public._finalize_room_if_due(uuid) set search_path = public, pg_temp;
alter function public.create_room() set search_path = public, pg_temp;
alter function public.create_pomodoro_room(int, int) set search_path = public, pg_temp;
alter function public.join_room(text) set search_path = public, pg_temp;
alter function public.leave_room(uuid) set search_path = public, pg_temp;
alter function public.touch_room_presence(uuid) set search_path = public, pg_temp;
alter function public.pomodoro_tick(uuid) set search_path = public, pg_temp;

alter function public.resolve_break_vote(uuid) set search_path = public, pg_temp;
alter function public.request_shared_break(uuid) set search_path = public, pg_temp;
alter function public.cast_break_vote(uuid, text) set search_path = public, pg_temp;

alter function public.change_username(text) set search_path = public, pg_temp;

alter function public.request_follow(uuid) set search_path = public, pg_temp;
alter function public.accept_follow(uuid) set search_path = public, pg_temp;
alter function public.reject_follow(uuid) set search_path = public, pg_temp;
alter function public.unfollow(uuid) set search_path = public, pg_temp;
alter function public.search_profiles(text) set search_path = public, pg_temp;

alter function public.add_comment(uuid, text) set search_path = public, pg_temp;
alter function public.weekly_leaderboard(text) set search_path = public, pg_temp;

alter function public.are_mutual(uuid, uuid) set search_path = public, pg_temp;
alter function public._notify(uuid, text, jsonb) set search_path = public, pg_temp;
alter function public._follows_notify_trigger() set search_path = public, pg_temp;
alter function public._likes_notify_trigger() set search_path = public, pg_temp;
alter function public._comments_notify_trigger() set search_path = public, pg_temp;

alter function public._compute_streak_days(uuid, text) set search_path = public, pg_temp;
alter function public._maybe_notify_streak_7(uuid) set search_path = public, pg_temp;
alter function public._maybe_notify_session_4h(uuid, uuid, bigint) set search_path = public, pg_temp;
alter function public._sessions_milestone_trigger() set search_path = public, pg_temp;

alter function public.check_lines_milestone(uuid) set search_path = public, pg_temp;
alter function public.delete_own_account() set search_path = public, pg_temp;
