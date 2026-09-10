CREATE TABLE public.scratch_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content_md TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX scratch_notes_user_id_idx ON public.scratch_notes (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scratch_notes TO authenticated;
GRANT ALL ON public.scratch_notes TO service_role;

ALTER TABLE public.scratch_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can select their scratch notes" ON public.scratch_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners can insert their scratch notes" ON public.scratch_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can update their scratch notes" ON public.scratch_notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners can delete their scratch notes" ON public.scratch_notes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);