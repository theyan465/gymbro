-- Push reminders: subscriptions, de-duplication log, and the 5-minute scheduler. Safe to re-run.
-- Replace <ANON_KEY> and <CRON_SECRET> before running (do not commit real values to a public repo).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  tz text not null default 'UTC',
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subs" on public.push_subscriptions;
create policy "own push subs" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- one row per reminder per user per day; no policies: only the service role (the Edge Function) can use it
create table if not exists public.push_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  day date not null,
  primary key (user_id, key, day)
);
alter table public.push_log enable row level security;

select cron.schedule('gymbro-reminders', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://ukemrdfisuoqlxbozpej.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <ANON_KEY>', 'x-cron-secret', '<CRON_SECRET>'),
    body := '{}'::jsonb
  )
$$);
