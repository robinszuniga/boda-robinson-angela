-- =============================================================
-- 0004 · Storage: bucket privado para contratos, cotizaciones e inspiración
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 20971520)
on conflict (id) do nothing;

create policy documentos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and (select public.is_couple()));

create policy documentos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (select public.is_couple()));

create policy documentos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and (select public.is_couple()))
  with check (bucket_id = 'documentos' and (select public.is_couple()));

create policy documentos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and (select public.is_couple()));
