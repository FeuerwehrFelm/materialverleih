create table if not exists public.material_bookings (
  id text primary key,
  name text not null,
  material_name text not null,
  quantity int not null,
  unit text not null,
  start_date text not null,
  end_date text not null,
  booked_at text not null,
  created_at timestamptz default now()
);

alter table public.material_bookings enable row level security;

create policy if not exists "Anyone can read material_bookings"
  on public.material_bookings
  for select
  using (true);

create policy if not exists "Anyone can insert material_bookings"
  on public.material_bookings
  for insert
  with check (true);
