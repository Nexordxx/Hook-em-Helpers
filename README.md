# Hook'Em Helpers 🤘

A polished mentorship discovery platform for a BGS 375 class project. Students can browse approved UT-volunteer profiles. Trusted adults submit requests. Administrators review requests and control published profiles and website content.

**Two modes:**
- **Demo:** No credentials needed; browse fictional mentors, submit fictional requests, create fictional profiles, and preview admin operations. Everything stays in this browser's `localStorage`, and the site displays a DEMO MODE warning. Do not use real personal information in demo.
- **Live:** Configure Supabase and deploy to Vercel or another static web host. Accounts, requests, review queue, profile publishing, settings, and private résumé uploads use a real database with row-level security.

> **Youth safety:** This is publishable software, *not* an approved youth service. Do not accept real student requests until UT/school permission, child-privacy review, youth-protection rules, volunteer verification/screening, moderator training, records policy, incident response, and production anti-spam protections are established. The request form intentionally excludes minor identity/contact fields; a responsible adult submits the request and receives any follow-up.

## Pages and functions

| Page | Features |
|---|---|
| `/` | Homepage, editable title/mission/announcement, featured mentors |
| `/discover` | Search/filter approved volunteers |
| `/mentor/:id` | Public profile, topics, background, general availability |
| `/request/:id` | Adult-submitted request with privacy notice; stored privately |
| `/volunteer` | Volunteer recruitment information |
| `/signup`, `/login` | Supabase email/password auth (live mode) |
| `/my-profile` | Volunteer profile editor and photo + private PDF résumé uploads |
| `/admin` | Role-protected dashboard: approvals, suspensions, request review and notes, website editor |
| `/safety`, `/how-it-works`, `/contact` | Program info |
| `/setup` | Plain-language publishing checklist |

## Fast start: run it locally

Requires Node.js 20+ and npm.

```sh
npm install
npm run dev
```

Visit `http://localhost:5173`. Without environment variables, you'll see the fictional demo. Navigate to **Become a helper → Create volunteer profile** to test submissions and `/admin` to approve them; these are local-only sample actions.

## Publish a fully backed website (Supabase + Vercel)

**1 — Create a Supabase project:** Open https://supabase.com/dashboard, create a project in an appropriate region, and save the project URL and *publishable/anon* browser key (Settings → API Keys). In the **SQL Editor**, paste and run the entire [`supabase/schema.sql`](supabase/schema.sql) file. This sets up tables, policies and buckets.

**2 — Configure authentication:** In Supabase Authentication → Providers, enable Email. For volunteers, email confirmation is recommended. Under Authentication → URL Configuration, add your site's `https://YOUR-PROJECT.vercel.app` as Site URL and approved redirect URLs. Test signup confirmation. Volunteers must authenticate using an official `utexas.edu` or its subdomain email for database-level profile creation (admins are bootstrapped separately).

**3 — Configure environment variables:** Copy `.env.example` to `.env.local` and enter your values:

```sh
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

**Use only the publishable/anon key in `VITE_*`. Never use a service-role or secret key.** Vite exposes all `VITE_*` values to browsers by design.

Restart `npm run dev` to switch into live mode.

**4 — Create the super administrator:** Create and confirm an account using the live `/signup` page with a UT email (or, for a non-UT admin, create the account in Supabase Authentication dashboard). Then in Supabase SQL Editor run the **admin bootstrap** SQL at the bottom of `supabase/schema.sql`, replacing the placeholder with the *exact email* you own. Verify one row was affected. Sign out/in. Your admin account can now use `/admin`. The admin role comes from a database table that ordinary users cannot write to.

**5 — Host on Vercel:** Create a GitHub repository containing the project files (exclude `.env.local`, `node_modules`, and `dist`). Import that repository at https://vercel.com/new, select Vite, set the build command `npm run build` and output directory `dist`. Set both `VITE_SUPABASE_*` environment variables in Vercel project settings, and deploy. The included `vercel.json` enables client-side route refreshes.

**6 — Test access:** Before publicity, verify a public visitor can only see approved mentor profiles, can send an adult request without being able to read one, that a volunteer cannot approve themselves or open `/admin`, and that only your administrator can view requests and private résumés. Use test identities and fictional messages only. Follow the launch safety checklist below.

Your free Vercel subdomain works without purchasing a custom domain; if you buy one, add it in Vercel project settings and update the Supabase auth Site URL and redirect allow list.

### Making changes later

- **No code needed:** Edit homepage, mission and announcement; review volunteer profiles and requests in `/admin`.
- **Code changes:** Edit the files in `src/`, commit to the GitHub repository. Vercel deploys changes automatically.
- **Database changes:** Create reviewed, versioned SQL migrations. Do not overwrite production tables or disable RLS as a shortcut.

### What works, and what does not yet

Implemented: real account login, volunteer profile upsert (automatically returns to `pending` for edits), public directory of approved mentors, request submissions, administrator role check, adult-request moderation, website content editing, protected volunteer PDF résumé review (signed URL), optional photo upload, mobile responsive design.

Not included: automated emails, calendar integrations, secure in-app messaging, staff invitations from UI, password reset UI, CAPTCHA or production-grade anti-abuse/rate limiting, recurring audits, legal/privacy consent management, program scheduling or background checks. **A submitted request does not contact a volunteer or schedule a session.** Administrators can use the adult contact's `mailto:` action to follow up through their own email client.

## Important rollout and security checklist

Before real minors or their adults use the live site:

- [ ] Obtain formal review of UT Austin Youth Protection Program applicability and authorization to use UT identification/branding. This independent project does not claim UT endorsement.
- [ ] Obtain agreement from each partner school/program and designate supervising adults.
- [ ] Establish volunteer identity verification, screening, conduct rules, supervision, and mandatory-reporting procedures (if applicable).
- [ ] Review child privacy obligations such as COPPA, state privacy laws, FERPA implications, and parental consent rules with appropriate experts. The current privacy page is an explanatory placeholder, **not** a complete legal privacy policy.
- [ ] Implement bot controls (e.g. server-verified CAPTCHA and rate limiting) before opening anonymous request submission to the public. Supabase RLS alone does **not** prevent spam or large-scale writes.
- [ ] Establish deletion/retention policies and account access/deprovisioning routines; confirm Supabase region and backups.
- [ ] Audit database grants, RLS, storage policies, auth flows and website code. Check for email and text content placed in public profiles.
- [ ] Test signed résumé URL permissions, file uploads, abuse reporting and disclosures in an isolated staging project.
- [ ] Add real support contact, a complete privacy notice and terms of service before outreach.
- [ ] Do **not** directly message minors or book unsupervised sessions through the platform.

## Directory structure

```
index.html               HTML entry
START-HERE.md            Quick publishing instructions
docs/visual-preview.png  Design screenshot (visual reference)
visual-preview.html      Static visual reference
src/App.jsx              React pages, forms and administrative interface
src/backend.js           Supabase adapter with clearly labeled local demo fallback
src/data.js              Fictional profiles and defaults
src/styles.css           Design system and responsive styling
supabase/schema.sql      Database, RLS and storage policies
.env.example             Required environment variable names
vercel.json              SPA routing on Vercel
```

## Design and governance

Color palette is inspired by a burnt-orange collegiate aesthetic, without the use of UT marks/logos. The website is an independent student project with an explicit disclaimer. Names and bios in demo mode are fictional examples. Never enter real minors' identifying information.
