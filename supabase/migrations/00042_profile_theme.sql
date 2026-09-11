-- Persist appearance preference (light | dark | system) on profiles.
alter table public.profiles
  add column if not exists theme text not null default 'light';

alter table public.profiles
  drop constraint if exists profiles_theme_check;

alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('light', 'dark', 'system'));
