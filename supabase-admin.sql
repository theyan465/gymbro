-- Admins, access code for sign-ups, and admin rights on the shared tables. Safe to re-run.
-- Replace YOUR_EMAIL and YOUR_ACCESS_CODE before running. Do not commit real values to a public repo.

create table if not exists public.admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table public.admins enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

insert into public.admins (user_id) select id from auth.users where email = 'YOUR_EMAIL' on conflict do nothing;

create table if not exists public.app_config (key text primary key, value text not null);
alter table public.app_config enable row level security;
drop policy if exists "cfg admin" on public.app_config;
create policy "cfg admin" on public.app_config for all to authenticated using (public.is_admin()) with check (public.is_admin());
insert into public.app_config (key, value) values ('invite_code', 'YOUR_ACCESS_CODE') on conflict (key) do nothing;

create or replace function public.check_invite_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'invite_code', '') is distinct from
     (select value from public.app_config where key = 'invite_code') then
    raise exception 'invalid invite code';
  end if;
  return new;
end $$;
drop trigger if exists check_invite_code on auth.users;
create trigger check_invite_code before insert on auth.users for each row execute function public.check_invite_code();

drop policy if exists "food admin delete" on public.shared_foods;
drop policy if exists "food admin update" on public.shared_foods;
drop policy if exists "ex admin delete" on public.shared_exercises;
create policy "food admin delete" on public.shared_foods for delete to authenticated using (public.is_admin());
create policy "food admin update" on public.shared_foods for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "ex admin delete" on public.shared_exercises for delete to authenticated using (public.is_admin());
