CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  synthesis_md text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO anon, authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open topics" ON public.topics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  authors text NOT NULL DEFAULT '',
  year int,
  abstract text NOT NULL DEFAULT '',
  file_path text NOT NULL,
  page_count int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.papers TO anon, authenticated;
GRANT ALL ON public.papers TO service_role;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open papers" ON public.papers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.paper_topic_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  content_md text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paper_id, topic_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.paper_topic_notes TO anon, authenticated;
GRANT ALL ON public.paper_topic_notes TO service_role;
ALTER TABLE public.paper_topic_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open paper_topic_notes" ON public.paper_topic_notes FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  page int NOT NULL,
  rects jsonb NOT NULL DEFAULT '[]'::jsonb,
  quote text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'amber',
  comment_md text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX highlights_paper_idx ON public.highlights(paper_id);
CREATE INDEX highlights_topic_idx ON public.highlights(topic_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlights TO anon, authenticated;
GRANT ALL ON public.highlights TO service_role;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open highlights" ON public.highlights FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);