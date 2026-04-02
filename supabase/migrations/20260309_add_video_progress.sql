-- Create video_progress table to track individual watched videos
CREATE TABLE IF NOT EXISTS public.video_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    watched_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, video_id)
);

-- Enable RLS on video_progress
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;

-- Policies for video_progress
DROP POLICY IF EXISTS "Students can view own video progress" ON public.video_progress;
CREATE POLICY "Students can view own video progress" ON public.video_progress FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own video progress" ON public.video_progress;
CREATE POLICY "Students can insert own video progress" ON public.video_progress FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Organizers can view student video progress" ON public.video_progress;
CREATE POLICY "Organizers can view student video progress" ON public.video_progress FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- Fix progress table constraints (drop potential duplicates first)
-- Ensure only one progress row per student per course
ALTER TABLE public.progress DROP CONSTRAINT IF EXISTS progress_student_id_course_id_key;
ALTER TABLE public.progress ADD CONSTRAINT progress_student_id_course_id_key UNIQUE (student_id, course_id);
