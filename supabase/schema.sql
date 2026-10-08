-- Hook'Em Helpers database schema — apply in a NEW Supabase project SQL Editor.
-- This script is safe to rerun for initial setup; do not run unreviewed migrations on a production database.
-- Important: SQL/RLS does not replace youth-protection approval, screening, rate-limits or legal review.

create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- Use a controlled, SECURITY DEFINER lookup to avoid role-table policy recursion.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.is_ut_volunteer()
returns boolean language sql stable set search_path = ''
as $$
  select lower(coalesce((select auth.jwt())->>'email','')) ~ '^[a-z0-9._%+\-]+@([a-z0-9-]+\.)*utexas\.edu$';
$$;
grant execute on function public.is_ut_volunteer() to authenticated;

create table if not exists public.volunteer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 90),
  major text not null check (length(trim(major)) between 2 and 90),
  year text not null check (year in ('Freshman','Sophomore','Junior','Senior','Graduate student')),
  bio text not null check (length(trim(bio)) between 35 and 750),
  experience text not null default '' check (length(experience) <= 500),
  goals text not null default '' check (length(goals) <= 240),
  skills text not null default '' check (length(skills) <= 260),
  availability text not null check (length(trim(availability)) between 2 and 160),
  topics text[] not null check (coalesce(cardinality(topics),0) between 1 and 6),
  avatar_url text not null default '' check (length(avatar_url) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_volunteer_status on public.volunteer_profiles(status);

create table if not exists public.mentorship_requests (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.volunteer_profiles(id) on delete restrict,
  requester_kind text not null check (requester_kind in ('parent','educator','adult_supporter')),
  adult_name text not null check (length(trim(adult_name)) between 2 and 100),
  adult_email text not null check (length(adult_email) between 5 and 180 and adult_email like '%@%.%'),
  grade_band text not null check (grade_band in ('middle','high')),
  topic text not null check (length(topic) between 2 and 100),
  question text not null check (length(trim(question)) between 15 and 1000),
  availability_notes text not null default '' check (length(availability_notes) <= 200),
  adult_confirmed boolean not null default false,
  status text not null default 'pending' check (status in ('pending','reviewing','coordinating','closed','declined')),
  admin_notes text not null default '' check (length(admin_notes) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_requests_created_at on public.mentorship_requests(created_at desc);
create index if not exists idx_requests_status on public.mentorship_requests(status);

create table if not exists public.volunteer_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  resume_path text not null check (length(resume_path) <= 400),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id smallint primary key check (id = 1),
  hero_title text not null check (length(hero_title) between 5 and 130),
  hero_subtitle text not null check (length(hero_subtitle) <= 400),
  mission text not null check (length(mission) <= 600),
  announcement text not null default '' check (length(announcement) <= 250),
  updated_at timestamptz not null default now()
);
insert into public.site_settings(id,hero_title,hero_subtitle,mission,announcement)
values (1,'Your future has a cheering section.',
  'Real questions. Real guidance. Real people in your corner. Find a college student mentor who remembers what it’s like to be right where you are.',
  'We believe guidance should never depend on your ZIP code or who you happen to know. Hook’Em Helpers helps young students discover approachable college volunteers ready to share what they’ve learned.','')
on conflict (id) do nothing;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists touch_volunteer_profiles on public.volunteer_profiles;
create trigger touch_volunteer_profiles before update on public.volunteer_profiles
for each row execute function public.touch_updated_at();
drop trigger if exists touch_mentorship_requests on public.mentorship_requests;
create trigger touch_mentorship_requests before update on public.mentorship_requests
for each row execute function public.touch_updated_at();
drop trigger if exists touch_site_settings on public.site_settings;
create trigger touch_site_settings before update on public.site_settings
for each row execute function public.touch_updated_at();
drop trigger if exists touch_volunteer_documents on public.volunteer_documents;
create trigger touch_volunteer_documents before update on public.volunteer_documents
for each row execute function public.touch_updated_at();

-- Least-privilege table grants; RLS is an additional security layer.
alter table public.user_roles enable row level security;
alter table public.volunteer_profiles enable row level security;
alter table public.mentorship_requests enable row level security;
alter table public.volunteer_documents enable row level security;
alter table public.site_settings enable row level security;
revoke all on public.user_roles,public.volunteer_profiles,public.mentorship_requests,public.volunteer_documents,public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.volunteer_profiles to anon, authenticated;
grant insert, update on public.volunteer_profiles to authenticated;
grant insert on public.mentorship_requests to anon, authenticated;
grant select, update on public.mentorship_requests to authenticated;
grant select, insert, update on public.volunteer_documents to authenticated;

-- Drop existing policies to support repeat initial setup.
drop policy if exists roles_select on public.user_roles;
create policy roles_select on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Everyone sees only approved volunteer profiles. Owners see their own and admins see all.
drop policy if exists volunteer_read on public.volunteer_profiles;
create policy volunteer_read on public.volunteer_profiles for select to anon,authenticated
using (status='approved' or id=(select auth.uid()) or (select public.is_admin()));

drop policy if exists volunteer_create on public.volunteer_profiles;
create policy volunteer_create on public.volunteer_profiles for insert to authenticated
with check (id=(select auth.uid()) and status='pending' and public.is_ut_volunteer());

drop policy if exists volunteer_self_edit on public.volunteer_profiles;
create policy volunteer_self_edit on public.volunteer_profiles for update to authenticated
using (id=(select auth.uid()) and public.is_ut_volunteer())
with check (id=(select auth.uid()) and status='pending' and public.is_ut_volunteer());

drop policy if exists volunteer_admin_edit on public.volunteer_profiles;
create policy volunteer_admin_edit on public.volunteer_profiles for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- No anonymous/adminless SELECT of submitted requests. Admin receives all requests.
drop policy if exists request_submit on public.mentorship_requests;
create policy request_submit on public.mentorship_requests for insert to anon,authenticated
with check (status='pending' and admin_notes='' and adult_confirmed=true and
 exists(select 1 from public.volunteer_profiles p where p.id=mentor_id and p.status='approved'));

drop policy if exists request_admin_read on public.mentorship_requests;
create policy request_admin_read on public.mentorship_requests for select to authenticated
using ((select public.is_admin()));
drop policy if exists request_admin_edit on public.mentorship_requests;
create policy request_admin_edit on public.mentorship_requests for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- A volunteer can access their private résumé metadata; admins can review it.
drop policy if exists resume_metadata_read on public.volunteer_documents;
create policy resume_metadata_read on public.volunteer_documents for select to authenticated
using (user_id=(select auth.uid()) or (select public.is_admin()));
drop policy if exists resume_metadata_insert on public.volunteer_documents;
create policy resume_metadata_insert on public.volunteer_documents for insert to authenticated
with check (user_id=(select auth.uid()) and public.is_ut_volunteer() and resume_path like ((select auth.uid())::text || '/%'));
drop policy if exists resume_metadata_update on public.volunteer_documents;
create policy resume_metadata_update on public.volunteer_documents for update to authenticated
using (user_id=(select auth.uid()))
with check (user_id=(select auth.uid()) and public.is_ut_volunteer() and resume_path like ((select auth.uid())::text || '/%'));

drop policy if exists public_settings_read on public.site_settings;
create policy public_settings_read on public.site_settings for select to anon,authenticated using (true);
drop policy if exists admin_settings_update on public.site_settings;
create policy admin_settings_update on public.site_settings for update to authenticated
using ((select public.is_admin())) with check ((select public.is_admin()));

-- Storage: volunteers can upload to their OWN folder. Photos are public only after
-- the mentor's avatar URL is shown on an APPROVED profile; no minor photos.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('mentor-photos','mentor-photos',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('mentor-resumes','mentor-resumes',false,5242880,array['application/pdf'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists own_photo_upload on storage.objects;
create policy own_photo_upload on storage.objects for insert to authenticated
with check (bucket_id='mentor-photos' and public.is_ut_volunteer() and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists resume_file_read on storage.objects;
create policy resume_file_read on storage.objects for select to authenticated
using (bucket_id='mentor-resumes' and
 ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
drop policy if exists own_resume_upload on storage.objects;
create policy own_resume_upload on storage.objects for insert to authenticated
with check (bucket_id='mentor-resumes' and public.is_ut_volunteer() and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Admin bootstrap: DO NOT store admin identifiers in website source code.
-- 1. Create/sign in to an account using the live website.
-- 2. Replace the example address below with YOUR exact login email and execute in
--    Supabase SQL Editor AFTER you have checked that the account exists:
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where lower(email)=lower('YOUR_ADMIN_EMAIL_HERE')
-- on conflict (user_id) do update set role=excluded.role;
-- 3. Sign out and sign in again; /admin now uses RLS-protected operations.

-- SQL security checks to perform before launch (see README for manual checklist):
-- - Anon can read approved volunteer profiles, but not pending profiles or requests.
-- - A volunteer cannot approve themselves or read a request.
-- - An admin can review requests and edit approved profiles.
-- - A volunteer cannot retrieve anyone else's private résumé.
