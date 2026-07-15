create policy "Zukünftige Materialbuchungen löschen"
  on public.material_bookings
  for delete
  to anon
  using (
    start_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and start_date > current_date::text
  );

grant delete on public.material_bookings to anon;
