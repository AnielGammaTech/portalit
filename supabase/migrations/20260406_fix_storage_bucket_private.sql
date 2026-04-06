-- Make uploads bucket private (was public in initial schema)
UPDATE storage.buckets SET public = false WHERE id = 'uploads';

-- Replace overpermissive "Public read" with authenticated-only read
DROP POLICY IF EXISTS "Public read" ON storage.objects;
CREATE POLICY "Authenticated read uploads" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads' AND auth.uid() IS NOT NULL);
