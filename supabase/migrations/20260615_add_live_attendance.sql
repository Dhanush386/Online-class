-- Create live_attendance table
CREATE TABLE IF NOT EXISTS public.live_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT now(),
    left_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    attendance_status TEXT DEFAULT 'insufficient_time' CHECK (attendance_status IN ('insufficient_time', 'present', 'absent')),
    streak_awarded BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, video_id)
);

-- Enable RLS
ALTER TABLE public.live_attendance ENABLE ROW LEVEL SECURITY;

-- Policies for live_attendance
DROP POLICY IF EXISTS "Students can view own attendance" ON public.live_attendance;
CREATE POLICY "Students can view own attendance" ON public.live_attendance FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can insert own attendance" ON public.live_attendance;
CREATE POLICY "Students can insert own attendance" ON public.live_attendance FOR INSERT WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update own attendance" ON public.live_attendance;
CREATE POLICY "Students can update own attendance" ON public.live_attendance FOR UPDATE USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Organizers can view attendance" ON public.live_attendance;
CREATE POLICY "Organizers can view attendance" ON public.live_attendance FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

DROP POLICY IF EXISTS "Organizers can insert attendance" ON public.live_attendance;
CREATE POLICY "Organizers can insert attendance" ON public.live_attendance FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

DROP POLICY IF EXISTS "Organizers can update attendance" ON public.live_attendance;
CREATE POLICY "Organizers can update attendance" ON public.live_attendance FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);
