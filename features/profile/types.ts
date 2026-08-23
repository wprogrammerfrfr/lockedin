export type Profile = {
  id: string;
  username: string;
  avatar_path: string | null;
  bio: string | null;
  timezone: string;
  locale?: string;
  break_timer_minutes?: number;
  email?: string | null;
  username_changed_at?: string | null;
  username_claimed_at?: string | null;
};
