# Primary feature: administrator-approved mentor request release (STAGED)

The user's primary requirement is **emailing the chosen mentor the adult-supplied request information only AFTER explicit administrator approval**.

This feature is **not deployed** and must not be merged until regression-tested. Existing production website is unchanged.

## Behavior

1. Parent/educator submits request, chooses a mentor, and may check an **explicit optional consent** to share the adult's name, email and reviewed request details with that mentor.
2. Request enters the existing private administrator queue with status `pending`. No mentor notification.
3. Administrator reviews it, removes any identifying or sensitive student details, types an `Administrator-reviewed message for mentor`, verifies program/school clearance and adult coordination, then selects `Approved — email selected mentor` and saves.
4. Supabase database enforces the release gate: approved mentor profile, adult sharing consent, administrator release authorization, and an approved message of at least 15 characters.
5. On that state transition, a server-only webhook calls `mentor-notifications`; the Edge Function re-reads the request under the service role, checks the gate, fetches the mentor's **Supabase Auth** email (never supplied by the requester), sends through Resend, and records delivery status. It shares **adult contact information, grade band, topic, scheduling preferences, and the manually reviewed message**.
6. It does not email the raw free-text question or private administrator notes. The administrator must redact sensitive details from the approved message.
7. Existing requests have consent=false, so they **cannot be sent** without new affirmative adult sharing consent. Do not simply set the consent flag; obtain documented consent first via a future secure process or ask the adult to resubmit.
8. Sending is an asynchronous best-effort attempt, not a guaranteed delivery. Inspect delivery logs. Repeated webhook events do not generate duplicate application sends.

## Release staging instructions

A. Apply both **additive migrations in order** to a nonproduction Supabase project:

- `supabase/migrations/20261119_notification_deliveries.sql`
- `supabase/migrations/20261119_mentor_request_release.sql`

B. Deploy `supabase/functions/mentor-notifications/index.ts` as `mentor-notifications` using `supabase functions deploy mentor-notifications --no-verify-jwt`. Configure server-side secrets:
`RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL=notifications@hookemhelpers.com`, `NOTIFICATION_WEBHOOK_SECRET` (random 32+ characters). Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the function environment.

C. In Supabase Database → Webhooks, create `notify_approved_mentor_request` for **UPDATE ONLY** on `public.mentorship_requests`, URL `https://YOUR_PROJECT_REF.supabase.co/functions/v1/mentor-notifications`, and add request header `x-hookem-webhook-secret` set to the exact private webhook secret. This is not a browser key. The function returns 401 to requests lacking this header.

D. Test with two separate fictional identities, an admin and an approved volunteer, and a fictitious adult:
- A pending request with consent true produces **no mentor email**.
- Admin setting `reviewing` produces **no mentor email**.
- Admin setting `approved_for_mentor` with no consent, no reviewed message, or non-approved mentor is rejected.
- Admin approves valid request → **one mentor email**; verify the adult contact details and reviewed summary, but no raw question or admin notes.
- Duplicate webhook replay → no second email.
- Regular volunteer cannot modify approvals or access the private request table.
- No change to existing administrator login, directory, request submission, résumé upload or volunteer profile approvals.
- Sending failure is visible in `notification_deliveries` and Edge Function logs; the request remains approved in the database. Resolve failures manually before any resend.
- Check adult email consent and coordinator-approved supervision procedures. Avoid direct unsupervised contact with minors.

E. **Production release only after tests pass**, with backup, rollback instructions and operator review. Disable the UPDATE webhook to halt emails immediately if needed. Never remove the pre-existing Vercel domain/Supabase redirects during rollout.

### Critical notes

- This is authorization to **share the approved adult contact details**, NOT a certification that a mentor has passed district background screening. Existing approved public profiles are not proof of VOLY clearance.
- The first phase has no mentor acceptance dashboard; the mentor responds to the adult/coordinator under supervision arrangements.
- Email is not encrypted end-to-end; do not include minors' identifying details.
- The webhook must not run until the migration and the function are deployed. UI code references the new database columns.
- No Supabase or Resend secrets belong in GitHub or client-side environment variables.

---

# Hook’Em Helpers — Notification System (Phase 1, staged)

**Status: code committed to a feature branch; nothing deployed to production.**

## What this phase does

- Notifies **existing administrators** when a new adult mentorship request is inserted.
- Notifies **existing administrators** when a new volunteer application/profile is inserted.
- Uses **Supabase Database Webhooks → Edge Function → Resend**.
- Email body intentionally contains **no parent email, student details, questions, résumés, or other private data**.
- Does **not** notify mentors; assignment, approval, and consent require a later dedicated workflow.
- Does **not** change login, roles, RLS for existing tables, or the Vercel site.

## Before deployment

1. Keep the existing website running and retain the database backup.
2. Test on an isolated **staging Supabase project** with fictional test accounts first.
3. Confirm Resend has verified `hookemhelpers.com` and that an API key is available privately.
4. Inspect migration `supabase/migrations/20261119_notification_deliveries.sql` before applying.
5. Use the same service-role key supplied to Supabase Edge Functions; **never place it in the browser, GitHub, or Vercel client environment variables**.

## 1. Apply the additive SQL migration

Open the staging project's Supabase SQL Editor and run the **notification_deliveries** migration file only. It creates a private server-only delivery ledger with a per-event/per-admin unique key. It does not change existing policies or data.

## 2. Configure and deploy the Edge Function

Function path: `supabase/functions/admin-notifications/index.ts`.

Create a **new, long random secret** (at least 32 characters) for `NOTIFICATION_WEBHOOK_SECRET`. This is **not** the Resend key and is **not** the Supabase anon key.

Set these Edge Function secrets in Supabase (staging first):

- `RESEND_API_KEY` — sending-capable Resend key, stored server-side
- `NOTIFICATION_FROM_EMAIL` — `notifications@hookemhelpers.com`
- `NOTIFICATION_WEBHOOK_SECRET` — private random 32+ character string
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — Supabase-provided server-side environment variables; verify available in your function deployment

Example CLI deployment from the repository root (after linking the intended staging project):

```sh
supabase functions deploy admin-notifications --no-verify-jwt
```

**Why disable automatic JWT checking?** Database Webhooks do not send browser-user JWTs. The function itself requires a private `x-hookem-webhook-secret` HTTP header and rejects requests without it. A public function URL without this secret is not sufficient for sending mail.

Do not put secrets directly in the shell history if avoidable. Use a private secrets file kept outside the Git repository or the Supabase dashboard's Edge Function secrets interface.

## 3. Create TWO database webhooks

In Supabase → Database → Webhooks, create separate **AFTER INSERT** webhooks:

| Name | Table | Event | URL |
| --- | --- | --- | --- |
| `notify_new_mentorship_request` | `public.mentorship_requests` | INSERT only | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/admin-notifications` |
| `notify_new_volunteer_application` | `public.volunteer_profiles` | INSERT only | Same URL |

For **both** webhooks configure request header:

```text
x-hookem-webhook-secret: YOUR_PRIVATE_NOTIFICATION_WEBHOOK_SECRET
```

The header must match the deployed Edge Function secret exactly. Do not expose it in screenshots. Set `Content-Type: application/json` if the UI offers header configuration.

Create and enable these webhooks only after the function and delivery ledger have been deployed and smoke-tested in staging. Do not confuse this with Supabase Auth's existing SMTP setup.

## 4. Testing in staging

Use fictional data and separate staging accounts:

1. POST to function without the webhook secret → **401**; no email.
2. POST unsupported event with the valid secret → skipped; no email.
3. Insert one adult-confirmed mentorship request for an approved test mentor; verify one email for each admin user.
4. Verify message links to `https://hookemhelpers.com/admin` and excludes sensitive request details.
5. Check Resend delivery logs.
6. Insert a new volunteer profile; verify admin email, but **no email to volunteer or mentor** from this function.
7. Ensure regular volunteers still cannot use `/admin` or read `notification_deliveries`.
8. Verify old login, directory, request review, status changes, uploaded files and admin actions still function.
9. Test duplicate webhook deliveries: the same event/recipient must not send two emails.
10. Inspect Supabase Edge Function logs and `notification_deliveries` for `sent` and `failed` rows.

### Delivery failure handling

The delivery ledger prevents **automatic duplicate sends**. Failed rows are retained for investigation; the function does not automatically retry them because doing so without a recovery protocol can duplicate a message if an API request succeeded but its response was lost. Reconciliation of uncertain sends should use Resend email logs and the event ID before any manual retry. This first phase is intentionally **at-most-one application attempt** per event/recipient, not guaranteed exactly-once delivery.

### Scope limitations

- New volunteer profile **INSERT** generates an alert; editing an existing profile does not.
- Admins are derived from `public.user_roles` and their current Supabase Auth email; do not hard-code an admin address.
- The notification body intentionally excludes applicant/parent personal details.
- Webhook delivery is asynchronous and may be delayed/failed; the successful form submission **must not depend on email success**.
- Resend free-plan limits apply to both authentication and these notification emails.
- Existing VOLY screening branch is separate and must not be merged as part of this rollout.

## 5. Production rollout (only after staging)

Apply the ledger migration to production, configure production Edge Function secrets, deploy the function, verify its 401 behavior, then enable both production Database Webhooks. Run the same real-world regression checklist with fictional data. Leave a clear rollback path: **disable the two database webhooks**. No database or Vercel rollback is needed to stop emails.

## Phase 2 (not implemented yet)

After a genuine administrator-controlled assignment workflow, add mentor notification (no minor contact details), mentor accept/decline, and carefully controlled adult status notifications. Do not automatically email mentors from raw unreviewed requests.
