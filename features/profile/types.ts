export type Profile = {
  id: string;
  username: string;
  avatar_path: string | null;
  bio: string | null;
  timezone: string;
  email?: string | null;
  username_changed_at?: string | null;
};
