
alter table public.organizations add column if not exists onboarding_step text default 'org_created'
  check (onboarding_step in ('org_created','context_done','result_done','project_created','team_step','completed'));
alter table public.organizations add column if not exists onboarding_completed_at timestamptz;

-- Backfill: les orgs qui existaient déjà avant l'onboarding ne doivent pas être
-- renvoyées dans le tunnel au prochain login.
update public.organizations set onboarding_step = 'completed', onboarding_completed_at = now()
  where onboarding_step = 'org_created';
