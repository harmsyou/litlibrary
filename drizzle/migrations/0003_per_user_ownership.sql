-- 1. ownership columns (nullable for now; unowned rows are visible to nobody)
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.highlights ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.paper_topic_notes ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS papers_user_id_idx ON public.papers(user_id);
CREATE INDEX IF NOT EXISTS topics_user_id_idx ON public.topics(user_id);
CREATE INDEX IF NOT EXISTS highlights_user_id_idx ON public.highlights(user_id);
CREATE INDEX IF NOT EXISTS paper_topic_notes_user_id_idx ON public.paper_topic_notes(user_id);

-- 2. replace open policies with owner-scoped ones
DROP POLICY IF EXISTS "open papers" ON public.papers;
DROP POLICY IF EXISTS "open topics" ON public.topics;
DROP POLICY IF EXISTS "open highlights" ON public.highlights;
DROP POLICY IF EXISTS "open paper_topic_notes" ON public.paper_topic_notes;

CREATE POLICY "own papers" ON public.papers FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own topics" ON public.topics FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own highlights" ON public.highlights FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own paper_topic_notes" ON public.paper_topic_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. grants: authenticated + service_role only
REVOKE ALL ON public.papers FROM anon;
REVOKE ALL ON public.topics FROM anon;
REVOKE ALL ON public.highlights FROM anon;
REVOKE ALL ON public.paper_topic_notes FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.papers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlights TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_topic_notes TO authenticated;
GRANT ALL ON public.papers TO service_role;
GRANT ALL ON public.topics TO service_role;
GRANT ALL ON public.highlights TO service_role;
GRANT ALL ON public.paper_topic_notes TO service_role;

-- 4. storage: owner-scoped access to the papers bucket
DROP POLICY IF EXISTS "open read papers bucket" ON storage.objects;
DROP POLICY IF EXISTS "open insert papers bucket" ON storage.objects;
DROP POLICY IF EXISTS "open update papers bucket" ON storage.objects;
DROP POLICY IF EXISTS "open delete papers bucket" ON storage.objects;

CREATE POLICY "own papers files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'papers' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "own papers files read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'papers' AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.papers p WHERE p.file_path = storage.objects.name AND p.user_id = auth.uid())
    )
  );

CREATE POLICY "own papers files delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'papers' AND (
      split_part(name, '/', 1) = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.papers p WHERE p.file_path = storage.objects.name AND p.user_id = auth.uid())
    )
  );