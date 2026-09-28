-- Developer Mode: cost to build = monthly cost x started months since first commit

alter table public.projects
  add column if not exists monthly_cost_usd numeric(12, 2);

alter table public.projects
  drop constraint if exists projects_monthly_cost_nonnegative;

alter table public.projects
  add constraint projects_monthly_cost_nonnegative
  check (monthly_cost_usd is null or monthly_cost_usd >= 0);

alter table public.projects
  drop column if exists hourly_rate_usd,
  drop column if exists project_value_usd;
