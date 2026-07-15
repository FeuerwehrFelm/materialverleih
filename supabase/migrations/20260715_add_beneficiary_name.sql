alter table public.material_bookings
  add column if not exists beneficiary_name text
  check (beneficiary_name is null or char_length(trim(beneficiary_name)) between 2 and 120);
