-- Notification delivery audit: standalone additive migration.
-- Apply only after reviewing on a staging Supabase project.
-- Do not execute supabase/schema.sql on production.
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('new_mentorship_request','new_volunteer_application')),
  source_id uuid not null,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('processing','sent','failed')),
  error_detail text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, source_id, recipient_user_id)
);
create index if not exists idx_notification_deliveries_status
  on public.notification_deliveries (status, created_at);
alter table public.notification_deliveries enable row level security;
revoke all on public.notification_deliveries from anon, authenticated;
-- No frontend RLS policies. Only the trusted service role can read/write this table.
comment on table public.notification_deliveries is
  'Server-only notification audit/idempotency ledger; contains no student or family information.';
