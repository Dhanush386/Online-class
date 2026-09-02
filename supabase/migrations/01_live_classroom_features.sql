-- =============================================
-- Live Classroom Enhancement Features
-- Run this in the Supabase SQL Editor
-- =============================================

-- ============ LIVE POLLS ============
CREATE TABLE IF NOT EXISTS public.live_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of strings e.g., ["Option A", "Option B"]
  correct_option TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.live_poll_votes (
  poll_id UUID REFERENCES public.live_polls(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL,
  voted_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (poll_id, student_id)
);

-- ============ CLASS FAQS (Saved from Q&A) ============
CREATE TABLE IF NOT EXISTS public.class_faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  saved_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ LIVE CLASS NOTES (Autosaved) ============
CREATE TABLE IF NOT EXISTS public.live_class_notes (
  video_id UUID PRIMARY KEY REFERENCES public.videos(id) ON DELETE CASCADE,
  content TEXT DEFAULT '',
  updated_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE public.live_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_class_notes ENABLE ROW LEVEL SECURITY;

-- Live Polls
DROP POLICY IF EXISTS "Anyone can view live polls" ON public.live_polls;
CREATE POLICY "Anyone can view live polls" ON public.live_polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Organizers can manage live polls" ON public.live_polls;
CREATE POLICY "Organizers can manage live polls" ON public.live_polls FOR ALL USING (
  EXISTS (SELECT 1 FROM public.videos v JOIN public.courses c ON v.course_id = c.id WHERE v.id = video_id AND c.organizer_id = auth.uid())
);

-- Live Poll Votes
DROP POLICY IF EXISTS "Students can insert own votes" ON public.live_poll_votes;
CREATE POLICY "Students can insert own votes" ON public.live_poll_votes FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Anyone can view poll votes" ON public.live_poll_votes;
CREATE POLICY "Anyone can view poll votes" ON public.live_poll_votes FOR SELECT USING (true);

-- Class FAQs
DROP POLICY IF EXISTS "Anyone can view class faqs" ON public.class_faqs;
CREATE POLICY "Anyone can view class faqs" ON public.class_faqs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Organizers can manage class faqs" ON public.class_faqs;
CREATE POLICY "Organizers can manage class faqs" ON public.class_faqs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.videos v JOIN public.courses c ON v.course_id = c.id WHERE v.id = video_id AND c.organizer_id = auth.uid())
);

-- Live Class Notes
DROP POLICY IF EXISTS "Anyone can view class notes" ON public.live_class_notes;
CREATE POLICY "Anyone can view class notes" ON public.live_class_notes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Organizers can manage class notes" ON public.live_class_notes;
CREATE POLICY "Organizers can manage class notes" ON public.live_class_notes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.videos v JOIN public.courses c ON v.course_id = c.id WHERE v.id = video_id AND c.organizer_id = auth.uid())
);

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_live_polls_video_id ON public.live_polls(video_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.live_poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_notes_video_id ON public.live_class_notes(video_id);
CREATE INDEX IF NOT EXISTS idx_faqs_video_id ON public.class_faqs(video_id);
