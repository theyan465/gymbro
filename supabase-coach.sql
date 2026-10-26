-- Coach / client feature. Safe to re-run.
-- A client links to a coach by redeeming the coach's invite code and decides what the coach may see.
-- The coach never reads user_data directly: everything goes through the SECURITY DEFINER functions below,
-- which return only the sections the client shared (and only while the link is active).

create schema if not exists private;

-- ---------- profiles ----------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '' check (char_length(display_name) <= 60),
  is_coach boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles own" on public.profiles;
create policy "profiles own" on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.profiles (user_id, email, display_name)
select id, email, split_part(coalesce(email, ''), '@', 1) from auth.users on conflict (user_id) do nothing;

create or replace function private.handle_new_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, email, display_name) values (new.id, new.email, split_part(coalesce(new.email, ''), '@', 1)) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists gymbro_new_profile on auth.users;
create trigger gymbro_new_profile after insert on auth.users for each row execute function private.handle_new_profile();

-- ---------- links, invites ----------
create table if not exists public.coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  share_nutrition boolean not null default true,
  share_training boolean not null default true,
  share_body boolean not null default true,
  share_vitamins boolean not null default true,
  share_photos boolean not null default false,
  share_write boolean not null default false,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_by uuid,
  check (coach_id <> client_id)
);
alter table public.coach_links add column if not exists share_write boolean not null default false;
create unique index if not exists coach_links_one_active_per_client on public.coach_links (client_id) where status = 'active';
create index if not exists coach_links_coach_idx on public.coach_links (coach_id) where status = 'active';
alter table public.coach_links enable row level security;
drop policy if exists "links members read" on public.coach_links;
create policy "links members read" on public.coach_links for select to authenticated using (coach_id = auth.uid() or client_id = auth.uid());

create table if not exists public.coach_invites (
  code text primary key,
  coach_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
alter table public.coach_invites enable row level security;
drop policy if exists "invites coach read" on public.coach_invites;
drop policy if exists "invites coach delete" on public.coach_invites;
create policy "invites coach read" on public.coach_invites for select to authenticated using (coach_id = auth.uid());
create policy "invites coach delete" on public.coach_invites for delete to authenticated using (coach_id = auth.uid() and used_by is null);

-- ---------- plans and messages ----------
create table if not exists public.coach_plans (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_links(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('nutrition', 'training')),
  title text not null check (char_length(title) between 1 and 120),
  note text not null default '' check (char_length(note) <= 4000),
  payload jsonb not null check (octet_length(payload::text) < 200000),
  status text not null default 'sent' check (status in ('sent', 'applied', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index if not exists coach_plans_link_idx on public.coach_plans (link_id, created_at desc);
alter table public.coach_plans enable row level security;
drop policy if exists "plans members read" on public.coach_plans;
create policy "plans members read" on public.coach_plans for select to authenticated using (coach_id = auth.uid() or client_id = auth.uid());

create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_links(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  ref_date date,
  plan_id uuid references public.coach_plans(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists coach_messages_link_idx on public.coach_messages (link_id, created_at);
alter table public.coach_messages enable row level security;
drop policy if exists "messages members read" on public.coach_messages;
create policy "messages members read" on public.coach_messages for select to authenticated using (
  exists (select 1 from public.coach_links l where l.id = link_id and (l.coach_id = auth.uid() or l.client_id = auth.uid())));

-- entries a coach records for a client (offline sessions); the client's app merges them into the account data
create table if not exists public.coach_entries (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.coach_links(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('workout', 'meal', 'body')),
  payload jsonb not null check (octet_length(payload::text) < 50000),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
create index if not exists coach_entries_pending_idx on public.coach_entries (client_id) where applied_at is null;
create index if not exists coach_entries_link_idx on public.coach_entries (link_id, created_at desc);
alter table public.coach_entries enable row level security;
drop policy if exists "entries members read" on public.coach_entries;
create policy "entries members read" on public.coach_entries for select to authenticated using (coach_id = auth.uid() or client_id = auth.uid());

-- ---------- helpers (not exposed through the API) ----------
create or replace function private.filter_client_data(d jsonb, sn boolean, st boolean, sb boolean, sv boolean, sp boolean, p_days int) returns jsonb
language plpgsql stable as $$
declare cut text := to_char(current_date - p_days, 'YYYY-MM-DD'); o jsonb := '{}'::jsonb;
begin
  if d is null then return o; end if;
  if sn then
    o := o || jsonb_build_object(
      'meals', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(coalesce(d->'meals', '[]'::jsonb)) e where (e->>'date') >= cut),
      'goals', d->'goals', 'goalsRest', d->'goalsRest', 'dayType', coalesce(d->'dayType', '{}'::jsonb));
  end if;
  if st then
    o := o || jsonb_build_object(
      'workouts', (select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(coalesce(d->'workouts', '[]'::jsonb)) e where (e->>'date') >= cut),
      'exMuscle', coalesce(d->'exMuscle', '{}'::jsonb), 'templates', coalesce(d->'templates', '[]'::jsonb));
  end if;
  if sn or st then o := o || jsonb_build_object('trainDays', coalesce(d->'trainDays', '[]'::jsonb)); end if;
  if sb then
    o := o || jsonb_build_object('body', (select coalesce(jsonb_agg(case when sp then e else e - 'photos' end), '[]'::jsonb)
      from jsonb_array_elements(coalesce(d->'body', '[]'::jsonb)) e where (e->>'date') >= cut));
  end if;
  if sv then
    o := o || jsonb_build_object('vitamins', coalesce(d->'vitamins', '[]'::jsonb),
      'vitLog', (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(coalesce(d->'vitLog', '{}'::jsonb)) as t(k, v) where k >= cut));
  end if;
  return o;
end $$;

-- ---------- coach: invites ----------
create or replace function public.create_invite() returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c text;
begin
  if me is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles where user_id = me and is_coach) then raise exception 'coach mode is off'; end if;
  delete from public.coach_invites where coach_id = me and used_by is null and expires_at < now();
  if (select count(*) from public.coach_invites where coach_id = me and used_by is null) >= 20 then raise exception 'too many active invites'; end if;
  loop
    c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.coach_invites where code = c);
  end loop;
  insert into public.coach_invites (code, coach_id) values (c, me);
  return c;
end $$;

-- ---------- client: connect ----------
create or replace function public.peek_invite(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.coach_invites; n text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into i from public.coach_invites where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and used_by is null and expires_at > now();
  if not found or i.coach_id = auth.uid() then return jsonb_build_object('valid', false); end if;
  select coalesce(nullif(display_name, ''), email, 'Тренер') into n from public.profiles where user_id = i.coach_id;
  return jsonb_build_object('valid', true, 'coach_name', coalesce(n, 'Тренер'));
end $$;

create or replace function public.redeem_invite(p_code text, p_nutrition boolean, p_training boolean, p_body boolean, p_vitamins boolean, p_photos boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); i public.coach_invites; lid uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into i from public.coach_invites where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and used_by is null and expires_at > now() for update;
  if not found then raise exception 'invalid or expired code'; end if;
  if i.coach_id = me then raise exception 'cannot coach yourself'; end if;
  if exists (select 1 from public.coach_links where client_id = me and status = 'active') then raise exception 'you already have a coach'; end if;
  insert into public.coach_links (coach_id, client_id, share_nutrition, share_training, share_body, share_vitamins, share_photos)
    values (i.coach_id, me, coalesce(p_nutrition, true), coalesce(p_training, true), coalesce(p_body, true), coalesce(p_vitamins, true), coalesce(p_photos, false) and coalesce(p_body, true))
    returning id into lid;
  update public.coach_invites set used_by = me, used_at = now() where code = i.code;
  insert into public.coach_messages (link_id, sender_id, body) values (lid, me, 'Подключился к вам как подопечный.');
  return lid;
end $$;

create or replace function public.update_shares(p_link uuid, p_nutrition boolean, p_training boolean, p_body boolean, p_vitamins boolean, p_photos boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.coach_links set share_nutrition = p_nutrition, share_training = p_training, share_body = p_body, share_vitamins = p_vitamins, share_photos = (p_photos and p_body)
    where id = p_link and client_id = auth.uid() and status = 'active';
  if not found then raise exception 'link not found'; end if;
end $$;

create or replace function public.end_link(p_link uuid) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l public.coach_links;
begin
  select * into l from public.coach_links where id = p_link and status = 'active' and (coach_id = me or client_id = me);
  if not found then raise exception 'link not found'; end if;
  update public.coach_links set status = 'ended', ended_at = now(), ended_by = me where id = p_link;
  insert into public.coach_messages (link_id, sender_id, body) values (p_link, me, case when me = l.coach_id then 'Тренер завершил сотрудничество.' else 'Подопечный завершил сотрудничество.' end);
end $$;

-- ---------- reading ----------
create or replace function public.my_coach() returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); l public.coach_links;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select * into l from public.coach_links where client_id = me and status = 'active';
  if not found then return null; end if;
  return jsonb_build_object('link_id', l.id, 'coach_id', l.coach_id,
    'coach_name', coalesce((select nullif(display_name, '') from public.profiles where user_id = l.coach_id), (select email from public.profiles where user_id = l.coach_id), 'Тренер'),
    'since', l.created_at,
    'share', jsonb_build_object('nutrition', l.share_nutrition, 'training', l.share_training, 'body', l.share_body, 'vitamins', l.share_vitamins, 'photos', l.share_photos, 'write', l.share_write),
    'unread', (select count(*) from public.coach_messages m where m.link_id = l.id and m.sender_id <> me and m.read_at is null),
    'new_plans', (select count(*) from public.coach_plans p where p.link_id = l.id and p.status = 'sent'));
end $$;

create or replace function public.coach_clients(p_days int default 60, p_client uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); r jsonb; d int := least(greatest(coalesce(p_days, 60), 7), 400);
begin
  if me is null then raise exception 'not authenticated'; end if;
  select coalesce(jsonb_agg(item order by (item->>'name')), '[]'::jsonb) into r from (
    select jsonb_build_object(
      'link_id', l.id, 'client_id', l.client_id,
      'name', coalesce(nullif(p.display_name, ''), p.email, 'Подопечный'), 'email', p.email, 'since', l.created_at,
      'share', jsonb_build_object('nutrition', l.share_nutrition, 'training', l.share_training, 'body', l.share_body, 'vitamins', l.share_vitamins, 'photos', l.share_photos and l.share_body, 'write', l.share_write),
      'pending', (select count(*) from public.coach_entries e where e.link_id = l.id and e.applied_at is null),
      'updated_at', u.updated_at,
      'unread', (select count(*) from public.coach_messages m where m.link_id = l.id and m.sender_id <> me and m.read_at is null),
      'data', private.filter_client_data(u.data, l.share_nutrition, l.share_training, l.share_body, l.share_vitamins, l.share_photos, d)) as item
    from public.coach_links l
    left join public.profiles p on p.user_id = l.client_id
    left join public.user_data u on u.user_id = l.client_id
    where l.coach_id = me and l.status = 'active' and (p_client is null or l.client_id = p_client)
  ) s;
  return r;
end $$;

create or replace function public.unread_count() returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.coach_messages m join public.coach_links l on l.id = m.link_id
  where (l.coach_id = auth.uid() or l.client_id = auth.uid()) and m.sender_id <> auth.uid() and m.read_at is null
$$;

-- ---------- writing ----------
create or replace function public.send_message(p_link uuid, p_body text, p_ref_date date default null) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); mid uuid;
begin
  if not exists (select 1 from public.coach_links where id = p_link and status = 'active' and (coach_id = me or client_id = me)) then raise exception 'link not found'; end if;
  insert into public.coach_messages (link_id, sender_id, body, ref_date) values (p_link, me, btrim(p_body), p_ref_date) returning id into mid;
  return mid;
end $$;

create or replace function public.mark_read(p_link uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.coach_messages m set read_at = now()
   where m.link_id = p_link and m.sender_id <> auth.uid() and m.read_at is null
     and exists (select 1 from public.coach_links l where l.id = p_link and (l.coach_id = auth.uid() or l.client_id = auth.uid()));
end $$;

create or replace function public.send_plan(p_link uuid, p_kind text, p_title text, p_note text, p_payload jsonb) returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l public.coach_links; pid uuid;
begin
  select * into l from public.coach_links where id = p_link and coach_id = me and status = 'active';
  if not found then raise exception 'link not found'; end if;
  insert into public.coach_plans (link_id, coach_id, client_id, kind, title, note, payload) values (p_link, me, l.client_id, p_kind, btrim(p_title), coalesce(p_note, ''), p_payload) returning id into pid;
  insert into public.coach_messages (link_id, sender_id, body, plan_id)
    values (p_link, me, case p_kind when 'nutrition' then 'Новый план питания: ' else 'Новый план тренировок: ' end || btrim(p_title), pid);
  return pid;
end $$;

create or replace function public.respond_plan(p_plan uuid, p_status text) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); p public.coach_plans;
begin
  if p_status not in ('applied', 'declined') then raise exception 'bad status'; end if;
  select * into p from public.coach_plans where id = p_plan and client_id = me and status = 'sent';
  if not found then raise exception 'plan not found'; end if;
  update public.coach_plans set status = p_status, responded_at = now() where id = p_plan;
  insert into public.coach_messages (link_id, sender_id, body, plan_id)
    values (p.link_id, me, (case p_status when 'applied' then 'Принял план «' else 'Отклонил план «' end) || p.title || '»', p_plan);
end $$;

-- ---------- coach records for the client ----------
create or replace function public.set_write_access(p_link uuid, p_allow boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.coach_links set share_write = coalesce(p_allow, false) where id = p_link and client_id = auth.uid() and status = 'active';
  if not found then raise exception 'link not found'; end if;
end $$;

create or replace function public.coach_add_entries(p_link uuid, p_entries jsonb) returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l public.coach_links; e jsonb; n int := 0; k text;
begin
  select * into l from public.coach_links where id = p_link and coach_id = me and status = 'active';
  if not found then raise exception 'link not found'; end if;
  if not l.share_write then raise exception 'client has not allowed recording'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 or jsonb_array_length(p_entries) > 40 then raise exception 'bad entries'; end if;
  for e in select * from jsonb_array_elements(p_entries) loop
    k := e->>'kind';
    if k not in ('workout', 'meal', 'body') or jsonb_typeof(e->'data') <> 'object' then raise exception 'bad entry'; end if;
    insert into public.coach_entries (link_id, coach_id, client_id, kind, payload) values (p_link, me, l.client_id, k, e->'data');
    n := n + 1;
  end loop;
  insert into public.coach_messages (link_id, sender_id, body) values (p_link, me, 'Тренер записал за вас: ' || n || ' шт.');
  return n;
end $$;

create or replace function public.pending_entries() returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'kind', e.kind, 'data', e.payload, 'created_at', e.created_at) order by e.created_at), '[]'::jsonb)
  from public.coach_entries e where e.client_id = auth.uid() and e.applied_at is null
$$;

create or replace function public.ack_entries(p_ids uuid[]) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.coach_entries set applied_at = now() where client_id = auth.uid() and applied_at is null and id = any(p_ids);
end $$;

-- ---------- storage: a coach may read photos of clients who shared them ----------
drop policy if exists "photos coach select" on storage.objects;
create policy "photos coach select" on storage.objects for select to authenticated using (
  bucket_id = 'progress-photos' and exists (
    select 1 from public.coach_links l
    where l.coach_id = auth.uid() and l.status = 'active' and l.share_body and l.share_photos and l.client_id::text = (storage.foldername(name))[1]));

-- ---------- privileges ----------
revoke all on function private.filter_client_data(jsonb, boolean, boolean, boolean, boolean, boolean, int) from public, anon, authenticated;
revoke all on function public.create_invite() from public, anon;
revoke all on function public.peek_invite(text) from public, anon;
revoke all on function public.redeem_invite(text, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.update_shares(uuid, boolean, boolean, boolean, boolean, boolean) from public, anon;
revoke all on function public.end_link(uuid) from public, anon;
revoke all on function public.my_coach() from public, anon;
revoke all on function public.coach_clients(int, uuid) from public, anon;
revoke all on function public.unread_count() from public, anon;
revoke all on function public.send_message(uuid, text, date) from public, anon;
revoke all on function public.mark_read(uuid) from public, anon;
revoke all on function public.send_plan(uuid, text, text, text, jsonb) from public, anon;
revoke all on function public.respond_plan(uuid, text) from public, anon;
revoke all on function public.set_write_access(uuid, boolean) from public, anon;
revoke all on function public.coach_add_entries(uuid, jsonb) from public, anon;
revoke all on function public.pending_entries() from public, anon;
revoke all on function public.ack_entries(uuid[]) from public, anon;
grant execute on function public.create_invite() to authenticated;
grant execute on function public.peek_invite(text) to authenticated;
grant execute on function public.redeem_invite(text, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.update_shares(uuid, boolean, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.end_link(uuid) to authenticated;
grant execute on function public.my_coach() to authenticated;
grant execute on function public.coach_clients(int, uuid) to authenticated;
grant execute on function public.unread_count() to authenticated;
grant execute on function public.send_message(uuid, text, date) to authenticated;
grant execute on function public.mark_read(uuid) to authenticated;
grant execute on function public.send_plan(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.respond_plan(uuid, text) to authenticated;
grant execute on function public.set_write_access(uuid, boolean) to authenticated;
grant execute on function public.coach_add_entries(uuid, jsonb) to authenticated;
grant execute on function public.pending_entries() to authenticated;
grant execute on function public.ack_entries(uuid[]) to authenticated;
