ALTER TABLE public.papers
  ADD COLUMN IF NOT EXISTS field text,
  ADD COLUMN IF NOT EXISTS question text,
  ADD COLUMN IF NOT EXISTS standing text,
  ADD COLUMN IF NOT EXISTS standing_reason text,
  ADD COLUMN IF NOT EXISTS position text,
  ADD COLUMN IF NOT EXISTS position_reason text,
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS analysis_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS analyzed_at timestamptz;