-- =============================================================================
-- Storage buckets and policies
--
--   vehicle-photos      public read (listing photos, public inspection sheets);
--                       staff write. Object names are random UUID paths.
--   vehicle-internal    private; staff only (auction sheets, purchase docs).
--   customer-documents  private; path = {customer_id}/{document_id}/{file}.
--                       Staff with access to the customer can read/upload;
--                       the customer can read an object only when a documents
--                       row for that exact path is shared with them.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('vehicle-photos', 'vehicle-photos', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('vehicle-internal', 'vehicle-internal', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('customer-documents', 'customer-documents', false, 10485760,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- vehicle-photos: public bucket, so reads bypass RLS; writes are staff only.
create policy "vehicle-photos: staff insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-photos' and (select public.is_staff()));
create policy "vehicle-photos: staff update" on storage.objects
  for update to authenticated
  using (bucket_id = 'vehicle-photos' and (select public.is_staff()));
create policy "vehicle-photos: staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-photos' and (select public.is_staff()));

-- vehicle-internal: staff only for every operation.
create policy "vehicle-internal: staff read" on storage.objects
  for select to authenticated
  using (bucket_id = 'vehicle-internal' and (select public.is_staff()));
create policy "vehicle-internal: staff insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vehicle-internal' and (select public.is_staff()));
create policy "vehicle-internal: staff delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'vehicle-internal' and (select public.is_staff()));

-- customer-documents
create policy "customer-documents: staff read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'customer-documents'
    and public.can_access_customer(public.try_uuid((storage.foldername(name))[1]))
  );
create policy "customer-documents: customer read shared" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'customer-documents'
    and exists (
      select 1 from public.documents d
      where d.storage_path = name
        and d.customer_id = (select public.current_customer_id())
        and d.shared_with_customer
        and d.deleted_at is null
    )
  );
create policy "customer-documents: staff upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'customer-documents'
    and public.can_access_customer(public.try_uuid((storage.foldername(name))[1]))
  );
-- Files are removed only by an admin (documents are otherwise soft-deleted).
create policy "customer-documents: admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'customer-documents' and (select public.is_admin()));
