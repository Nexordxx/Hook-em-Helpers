# Hook'Em Helpers — START HERE

**What you have:** the complete source code of a responsive mentorship website. It works in fictional-data demo mode when no database is attached and supports a real Supabase database, protected admin access, and Vercel hosting after configuration.

**If you just want to see how it looks:** open `docs/visual-preview.png` (design reference) or `visual-preview.html` (HTML design reference).

**To run a functional local demo:** open a terminal in the project folder, run `npm install` and `npm run dev`, and visit `http://localhost:5173`. Select **Demo admin** to review fictional mentor signups and requests. Changes persist in your browser.

**To turn it into a live website:**

1. Create a Supabase project at https://supabase.com.
2. Open Supabase SQL Editor and run `supabase/schema.sql`.
3. Get its Project URL and **publishable/anon** key. Create `.env.local` from `.env.example` and fill those values, then restart `npm run dev`.
4. Create your account on the site. To become the administrator, run the administrator-role SQL explained at the bottom of `supabase/schema.sql` with your own email address. Sign out and back in.
5. Upload the project to a GitHub repository you own (do **not** upload `.env.local`). Import it into Vercel. Set the same two `VITE_SUPABASE_*` environment variables in Vercel and deploy. Use `npm run build` and publish the `dist` folder.
6. Add the public website URL to Supabase Auth's Site URL and allowed redirect URLs. Test signup, login, mentor approval, request review and private file restrictions with fictional data only.

**Important limitation:** The software can be deployed, but real use with minors is NOT approved solely because the site is live. See the safety checklist at the bottom of `README.md` before accepting real submissions. There is no automatic scheduling or email sending, and administrators must review their request queue manually.

**Owner control:** The Supabase, Vercel and GitHub accounts belong to you. The website content editor lives under `/admin`. More complex changes can be made in `src/` and deployed through GitHub.
