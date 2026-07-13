
CREATE POLICY "documents_read_member" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_org_member((split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "documents_insert_editor" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.has_org_role((split_part(name, '/', 1))::uuid, ARRAY['owner','admin','editor']::public.org_role[])
  );

CREATE POLICY "documents_update_editor" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.has_org_role((split_part(name, '/', 1))::uuid, ARRAY['owner','admin','editor']::public.org_role[])
  );

CREATE POLICY "documents_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.has_org_role((split_part(name, '/', 1))::uuid, ARRAY['owner','admin']::public.org_role[])
  );
