# VOLY clearance rollout — Hook'Em Helpers

**This is a staged, manual verification workflow; NOT an Austin ISD / VOLY API integration.**

## Required prerequisite
Obtain written confirmation from Austin ISD or the participating school that:
- Hook'Em Helpers is authorized to coordinate this volunteer program;
- a named adult coordinator may confirm current volunteer clearance to our administrators;
- the school has specified how to confirm and renew clearance and what dates to use;
- the approved youth-protection rules, volunteer supervision, privacy, and incident-response procedures are in place.

## Deployment sequence
1. Back up the existing Supabase database and confirm the current project is the correct one.
2. Review `supabase/migrations/20261112_voly_clearance.sql` with a database administrator.
3. Apply the migration in a staging Supabase project first; confirm RLS and request-insert policies.
4. **Important:** the migration immediately hides all approved mentors who have no *current school-confirmed clearance* from public discovery and prevents new requests to them. Existing requests and profile data are preserved. Do not apply it until this behavior is acceptable.
5. Deploy the `feature/voly-clearance` branch to a Vercel preview using the matching staging Supabase database. Do not deploy frontend before migration.
6. Run tests with fictional volunteers and admin users. An ordinary volunteer must not be able to update clearance records, approve themselves, or read other volunteers' records.
7. After school authorization and successful staging tests, schedule the production migration and website deployment. Verify fresh login, site settings, public directory, admin visibility, clearance renewal and revocation.

## What an administrator can do
- Review existing mentor profiles (a separate approval).
- In the `VOLY clearance` tab, select a mentor after an authorized school official has confirmed clearance.
- Record the **school year** and a **valid-through date supplied by the school**.
- Revoke clearance immediately if the school withdraws it.
- The admin must affirm independent confirmation; a volunteer self-report is insufficient.

## What a volunteer sees
- A link to https://austinisd.voly.org/ to complete Austin ISD's external volunteer process.
- A read-only Hook'Em Helpers verification status.
- No ability to approve their own clearance.

## Youth protection
This workflow does not automatically run background checks or prove a volunteer is safe. VOLY screening and any decision remain Austin ISD's responsibility. Do not store criminal-history reports, DOBs, SSNs, IDs, approval screenshots containing sensitive data, or minor information. Independent authorization, supervision, training and incident reporting are still required.
