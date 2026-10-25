# Cloud accounts (optional)

1. Create a free project at https://supabase.com.
2. SQL Editor → paste and run `supabase.sql`.
3. Authentication → Providers → Email: turn off "Confirm email" for instant sign-up.
4. Project Settings → API: copy the Project URL and the `anon` public key into `config.js`.
5. Commit and push; GitHub Pages redeploys. The `anon` key is public by design; row-level security restricts each user to their own row.

Without these values the app works locally, with no accounts.
