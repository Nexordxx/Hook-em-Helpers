-- Hook'Em Helpers: VOLY clearance integration (manual school confirmation)
-- Apply in Supabase SQL Editor BEFORE deploying the feature branch.
-- No criminal history, DOB, ID or background-check documents are stored here.
-- Only an existing administrator may record or revoke an independently confirmed clearance.

create table if not exists public.mentor_clearances (
  mentor_id uuid primary key references public.volunteer_profiles(id) on delete cascade,
  school_year text not null check (school_year ~ '^[0-9]{4}-[0-9]{4}$'),
  valid_until date not null,
  verified_at timestamptz not null default now(),
  verified_by uuid not null references auth.users(id),
  verification_source text not null default 'Austin ISD authorized confirmation'
    check (verification_source = 'Austin ISD authorized confirmation')
);

alter table public.mentor_clearances enable row level security;
revoke all on public.mentor_clearances from anon, authenticated;
grant select, insert, update, delete on public.mentor_clearances to authenticated;

drop policy if exists mentor_clearances_select on public.mentor_clearances;
create policy mentor_clearances_select on public.mentor_clearances
for select to authenticated using (mentor_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists mentor_clearances_insert on public.mentor_clearances;
create policy mentor_clearances_insert on public.mentor_clearances
for insert to authenticated with check (
  (select public.is_admin()) and verified_by = (select auth.uid())
);

drop policy if exists mentor_clearances_update on public.mentor_clearances;
create policy mentor_clearances_update on public.mentor_clearances
for update to authenticated using ((select public.is_admin()))
with check ((select public.is_admin()) and verified_by = (select auth.uid()));

drop policy if exists mentor_clearances_delete on public.mentor_clearances;
create policy mentor_clearances_delete on public.mentor_clearances
for delete to authenticated using ((select public.is_admin()));

-- Expose a boolean only, not the underlying verification record.
-- SECURITY DEFINER lets public visitors check eligibility without reading sensitive admin rows.
create or replace function public.is_mentor_cleared(mentor uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.mentor_clearances c
    where c.mentor_id = mentor and c.valid_until >= current_date
  );
$$;
revoke all on function public.is_mentor_cleared(uuid) from public;
grant execute on function public.is_mentor_cleared(uuid) to anon, authenticated;

-- Restrict ALL public profile access (including direct REST queries), not only the UI.
drop policy if exists volunteer_read on public.volunteer_profiles;
create policy volunteer_read on public.volunteer_profiles for select to anon,authenticated
using (
 (status = 'approved' and (select public.is_mentor_cleared(id)))
 or id = (select auth.uid())
 or (select public.is_admin())
);

-- In addition to existing adult-consent and approved-profile checks,
-- requests must now refer to a profile with current VOLY clearance.
drop policy if exists request_submit on public.mentorship_requests;
create policy request_submit on public.mentorship_requests for insert to anon,authenticated
with check (status='pending' and admin_notes='' and adult_confirmed=true and
  exists (
    select 1 from public.volunteer_profiles p
    where p.id = mentor_id and p.status = 'approved'
      and public.is_mentor_cleared(p.id)
  ));

-- Note: the existing requests table is unchanged; existing requests are preserved.
-- A school-confirmed approval is necessary but not sufficient to start unsupervised activities.
