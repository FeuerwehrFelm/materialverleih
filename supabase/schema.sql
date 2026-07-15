create table public.material_bookings (
  id text primary key,
  name text not null check (char_length(trim(name)) between 2 and 120),
  beneficiary_name text check (beneficiary_name is null or char_length(trim(beneficiary_name)) between 2 and 120),
  material_name text not null,
  quantity integer not null check (quantity > 0),
  unit text not null,
  start_date text not null,
  end_date text not null,
  booked_at text not null,
  created_at timestamptz not null default now()
);

alter table public.material_bookings enable row level security;

create policy "Materialbuchungen öffentlich lesen"
  on public.material_bookings
  for select
  to anon
  using (true);

create policy "Materialbuchungen öffentlich anlegen"
  on public.material_bookings
  for insert
  to anon
  with check (
    quantity > 0
    and material_name in (
      'Bierzeltgarnitur',
      'Kinder-Bierzeltgarnitur',
      'Stehtisch',
      'Pavillon'
    )
  );

create policy "Zukünftige Materialbuchungen löschen"
  on public.material_bookings
  for delete
  to anon
  using (
    start_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and start_date > current_date::text
  );

grant select, insert, delete on public.material_bookings to anon;
