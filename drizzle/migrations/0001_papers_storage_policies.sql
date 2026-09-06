CREATE POLICY "open read papers bucket" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'papers');
CREATE POLICY "open insert papers bucket" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'papers');
CREATE POLICY "open update papers bucket" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'papers');
CREATE POLICY "open delete papers bucket" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'papers');