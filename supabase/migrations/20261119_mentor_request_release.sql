-- STAGED migration. Run on a staging project first; production only after review.
-- A volunteer/mentor is emailed ONLY after an explicit administrator action and
-- the submitting adult's consent to share their request details with the mentor.
alter table public.mentorship_requests
  add column if not exists mentor_contact_consent boolean not null default false,
  add column if not exists mentor_release_authorized boolean not null default false,
  add column if not exists mentor_released_at timestamptz;

-- Preserve all existing status values, adding one explicit release state.
alter table public.mentorship_requests
  drop constraint if exists mentorship_requests_status_check;
alter table public.mentorship_requests
  add constraint mentorship_requests_status_check
  check (status in ('pending','reviewing','coordinating','approved_for_mentor','closed','declined'));

alter table public.mentorship_requests
  add constraint mentor_release_requires_consent_check
  check (status <> 'approved_for_mentor' or
    (mentor_contact_consent = true and mentor_release_authorized = true));

-- Protect volunteer-facing status and contact-consent fields from unauthorized updates.
-- Existing request UPDATE policy is admin-only. Preserve it; do not relax it.
-- Old requests have false consent and cannot be released without obtaining
-- affirmative consent from the adult contact through an independently reviewed process.
create or replace function public.guard_mentorship_release()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'approved_for_mentor' and old.status <> 'approved_for_mentor' then
    if not (new.mentor_contact_consent and new.mentor_release_authorized) then
      raise exception 'Adult sharing consent and administrator release authorization required';
    end if;
    -- The approval state is not proof of district clearance; the administrator
    -- must verify the mentor is eligible to participate before clicking release.
    if not exists (select 1 from public.volunteer_profiles p
       where p.id = new.mentor_id and p.status = 'approved') then
      raise exception 'Mentor profile must be approved before release';
    end if;
    new.mentor_released_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists guard_mentorship_release_trigger on public.mentorship_requests;
create trigger guard_mentorship_release_trigger before update on public.mentorship_requests
  for each row execute function public.guard_mentorship_release();

-- Keep notification delivery metadata server-only.
alter table public.notification_deliveries drop constraint if exists notification_deliveries_event_type_check;
alter table public.notification_deliveries add constraint notification_deliveries_event_type_check
  check (event_type in ('new_mentorship_request','new_volunteer_application','mentor_request_approved'));
