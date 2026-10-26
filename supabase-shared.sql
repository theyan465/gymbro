-- Shared exercises & foods, readable by every signed-in user. Safe to re-run.

create table if not exists public.shared_exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  name_key text not null unique,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.shared_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  name_key text not null unique,
  kcal numeric not null check (kcal between 0 and 950),
  p numeric not null check (p between 0 and 100),
  f numeric not null check (f between 0 and 100),
  c numeric not null check (c between 0 and 100),
  barcode text unique,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.shared_exercises enable row level security;
alter table public.shared_foods enable row level security;

drop policy if exists "ex read" on public.shared_exercises;
drop policy if exists "ex insert" on public.shared_exercises;
drop policy if exists "ex delete own" on public.shared_exercises;
create policy "ex read" on public.shared_exercises for select to authenticated using (true);
create policy "ex insert" on public.shared_exercises for insert to authenticated with check (created_by = auth.uid());
create policy "ex delete own" on public.shared_exercises for delete to authenticated using (created_by = auth.uid());

drop policy if exists "food read" on public.shared_foods;
drop policy if exists "food insert" on public.shared_foods;
drop policy if exists "food delete own" on public.shared_foods;
create policy "food read" on public.shared_foods for select to authenticated using (true);
create policy "food insert" on public.shared_foods for insert to authenticated with check (created_by = auth.uid());
create policy "food delete own" on public.shared_foods for delete to authenticated using (created_by = auth.uid());

-- Starter exercises
insert into public.shared_exercises (name, name_key, created_by)
select n, lower(n), null from unnest(array[
  'Жим лёжа','Жим лёжа на наклонной скамье','Жим гантелей лёжа','Жим гантелей на наклонной скамье','Разводка гантелей','Отжимания','Отжимания на брусьях',
  'Присед со штангой','Фронтальный присед','Жим ногами','Выпады','Болгарские сплит-приседы','Разгибания ног','Сгибания ног','Румынская тяга','Ягодичный мостик','Подъём на носки',
  'Становая тяга','Тяга штанги в наклоне','Тяга гантели одной рукой','Тяга верхнего блока','Тяга нижнего блока','Подтягивания','Гиперэкстензия',
  'Жим стоя','Жим гантелей сидя','Махи гантелей в стороны','Махи в наклоне','Тяга к подбородку','Шраги',
  'Подъём штанги на бицепс','Подъём гантелей на бицепс','Молотки','Французский жим','Разгибания на трицепс на блоке',
  'Скручивания','Подъём ног в висе','Планка'
]) as n
on conflict (name_key) do nothing;

-- Shared dishes and serving sizes (safe to re-run)
alter table public.shared_foods add column if not exists serving numeric check (serving is null or serving between 1 and 5000);
alter table public.shared_foods add column if not exists dish jsonb check (dish is null or (jsonb_typeof(dish) = 'object' and pg_column_size(dish) < 20000));
create index if not exists shared_foods_created_idx on public.shared_foods (created_at desc);
