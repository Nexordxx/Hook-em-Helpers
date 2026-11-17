-- VOLY volunteer progress tracking: no Garza administrator account required.
-- Run in staging AFTER 20261112_voly_clearance.sql and before deploying preview UI.
-- Self-reported progress NEVER creates or modifies mentor_clearances.
create table if not exists public.voly_application_progress (
  mentor_id uuid primary key references public.volunteer_profiles(id) on delete cascade,
  stage text not null default 'not_started'
    check (stage in ('not_started','application_submitted','approval_email_received')),
  updated_at timestamptz not null default now()
);
alter table public.voly_application_progress enable row level security;
revoke all on public.voly_application_progress from anon, authenticated;
grant select, insert, update on public.voly_application_progress to authenticated;
drop policy if exists volunteer_progress_read on public.voly_application_progress;
create policy volunteer_progress_read on public.voly_application_progress for select to authenticated
using (mentor_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists volunteer_progress_create on public.voly_application_progress;
create policy volunteer_progress_create on public.voly_application_progress for insert to authenticated
with check (mentor_id = (select auth.uid()));
drop policy if exists volunteer_progress_update on public.voly_application_progress;
create policy volunteer_progress_update on public.voly_application_progress for update to authenticated
using (mentor_id = (select auth.uid()))
with check (mentor_id = (select auth.uid()));
-- Only an authenticated volunteer can mark their own progress.
-- A claim that an approval email was received is NOT clearance.
