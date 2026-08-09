# Supabase project setup — Phase A handoff

This is the one part of the migration I can't do for you: creating the
Supabase project itself requires an account, which I'm not able to sign up
for on your behalf. Everything else in this file is copy/paste.

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) and sign up / log in (free tier is fine for a pilot).
2. Click **New project**. Pick any name (e.g. `level-up-athletics`), a strong database password (save it somewhere — you likely won't need it again since we'll use the dashboard/SQL editor, but it's needed for direct DB access later if you ever want it), and a region close to you.
3. Wait for provisioning to finish (a minute or two).

## 2. Run the migrations, in order

In the left sidebar, open **SQL Editor**. For each file below, open it from this repo, paste the full contents into a new query, and click **Run**. Do them in this exact order — later files depend on tables/functions from earlier ones:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls_policies.sql`
3. `supabase/migrations/0003_views.sql`
4. `supabase/migrations/0004_functions.sql`
5. `supabase/seed.sql`

If any step errors, stop and send me the exact error message rather than continuing — a few of these (noted in `0003_views.sql`) have a documented fallback if your project's Postgres version doesn't support something.

## 3. Enable magic-link auth

1. Left sidebar → **Authentication** → **Providers**. Confirm **Email** is enabled (it is by default).
2. **Authentication** → **URL Configuration**:
   - **Site URL**: `https://lvl-up-athletics.com` (the site's custom domain — check Settings > Pages in GitHub for the exact URL if this hasn't been set up yet, or if it's still on the default `github.io` address).
   - **Redirect URLs**: add the same URL again here (Supabase needs it in both places). If you're migrating from the old `github.io` URL, keep both listed until you've confirmed sign-in works on the new domain, then remove the old one.
3. Leave "Confirm email" / OTP settings at their defaults for now — the app will use `signInWithOtp` (a magic link, not a password), so no separate email/password confirmation flow is needed.

**Heads up on email sending:** Supabase's built-in email sender has fairly low rate limits and isn't meant for production traffic — fine for testing this yourself, but before inviting real families, it's worth connecting a custom SMTP provider (Resend, Postmark, etc. — both have generous free tiers) under **Authentication → Providers → Email → SMTP Settings**. Flagging this now so it's not a surprise later; not required to proceed with Phase B.

## 4. Get the connection details I need

Left sidebar → **Project Settings** → **API**. Copy:

- **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
- **anon public** key (long string starting with `eyJ...`)

These are both safe to use in public client-side code — no secrets here, since Row Level Security (already set up by the migrations above) is what actually protects the data, not keeping this key private.

## 5. Hand it back

Send me the Project URL and anon key (paste them directly in chat is fine) once steps 1-4 are done, and I'll start Phase B — wiring up sign-in, the athlete profile switcher, and migrating the first screens off local storage.

---

*Why you're doing this step instead of me: creating third-party accounts is outside what I can do on your behalf. Everything after this handoff — writing the code that talks to your project — is back to me.*
