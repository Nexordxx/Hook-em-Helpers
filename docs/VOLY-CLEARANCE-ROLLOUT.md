# VOLY clearance rollout — Hook'Em Helpers

**This is a staged, manual verification workflow; NOT an Austin ISD / VOLY API integration.**

## Required prerequisite
Obtain independent confirmation from Austin ISD (or its formally authorized delegate) that:
- Hook'Em Helpers is authorized to coordinate this volunteer program;
- the Hook'Em Helpers program administrator has a permitted channel for checking current district clearance without a Garza High School staff login;
- the school has specified how to confirm and renew clearance and what dates to use;
- the approved youth-protection rules, volunteer supervision, privacy, and incident-response procedures are in place.

## Deployment sequence
1. Back up the existing Supabase database and confirm the current project is the correct one.
2. Review `supabase/migrations/20261112_voly_clearance.sql` with a database administrator.
3. Apply the migrations `20261112_voly_clearance.sql` then `20261117_voly_progress.sql` in a staging Supabase project first; confirm RLS and request-insert policies. The separate `20261117_allow_all_email_domains.sql` migration may also be required in environments still using old UT-only policies.
4. **Important:** the migration immediately hides all approved mentors who have no *current school-confirmed clearance* from public discovery and prevents new requests to them. Existing requests and profile data are preserved. Do not apply it until this behavior is acceptable.
5. Deploy the `feature/voly-clearance` branch to a Vercel preview using the matching staging Supabase database. Do not deploy frontend before migration.
6. Run tests with fictional volunteers and admin users. An ordinary volunteer must not be able to update clearance records, approve themselves, or read other volunteers' records.
7. After school authorization and successful staging tests, schedule the production migration and website deployment. Verify fresh login, site settings, public directory, admin visibility, clearance renewal and revocation.

## What an administrator can do
- Review existing mentor profiles (a separate approval).
- In the `VOLY clearance` tab, review the mentor's self-reported VOLY progress, then separately confirm current clearance through an authorized Austin ISD channel before recording approval. A screenshot or a self-reported email is not independent verification.
- Record the **school year** and a **valid-through date supplied by the school**.
- Revoke clearance immediately if the school withdraws it.
- The admin must affirm independent confirmation; a volunteer self-report is insufficient.

## What a volunteer sees
- A link to https://austinisd.voly.org/ to complete Austin ISD's external volunteer process.
- An optional self-reported `not started`, `submitted`, or `approval email received` application-progress field, which never creates verified clearance.
- A read-only Hook'Em Helpers verification status.
- No ability to approve their own clearance.

## Youth protection
This workflow does not automatically run background checks or prove a volunteer is safe. VOLY screening and any decision remain Austin ISD's responsibility. Do not store criminal-history reports, DOBs, SSNs, IDs, approval screenshots containing sensitive data, or minor information. Independent authorization, supervision, training and incident reporting are still required.
