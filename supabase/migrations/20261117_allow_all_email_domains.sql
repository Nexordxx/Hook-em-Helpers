-- Hook'Em Helpers: permit authenticated volunteers with any email domain.
-- Apply once to the existing Supabase project in SQL Editor.
-- The account must still be authenticated; all user-owned rows/files remain restricted
-- to their respective user UUID. Profile review remains pending by default.
-- This does NOT grant administrator privileges, publish profiles, or bypass school clearance.

drop policy if exists volunteer_create on public.volunteer_profiles;
create policy volunteer_create on public.volunteer_profiles for insert to authenticated
with check (id = (select auth.uid()) and status = 'pending');

drop policy if exists volunteer_self_edit on public.volunteer_profiles;
create policy volunteer_self_edit on public.volunteer_profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()) and status = 'pending');

drop policy if exists resume_metadata_insert on public.volunteer_documents;
create policy resume_metadata_insert on public.volunteer_documents for insert to authenticated
with check (user_id = (select auth.uid()) and
  resume_path like ((select auth.uid())::text || '/%'));

drop policy if exists resume_metadata_update on public.volunteer_documents;
create policy resume_metadata_update on public.volunteer_documents for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and
  resume_path like ((select auth.uid())::text || '/%'));

drop policy if exists own_photo_upload on storage.objects;
create policy own_photo_upload on storage.objects for insert to authenticated
with check (bucket_id = 'mentor-photos' and
  (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists own_resume_upload on storage.objects;
create policy own_resume_upload on storage.objects for insert to authenticated
with check (bucket_id = 'mentor-resumes' and
  (storage.foldername(name))[1] = (select auth.uid())::text);

-- Check actual Supabase Auth email-provider settings separately: this migration
-- changes row-level security, not signup providers or email confirmation settings.
