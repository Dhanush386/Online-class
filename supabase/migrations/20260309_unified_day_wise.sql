-- Add day_number to videos (sessions/live classes)
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS day_number INTEGER DEFAULT 1;

-- Add day_number to coding challenges
ALTER TABLE public.coding_challenges ADD COLUMN IF NOT EXISTS day_number INTEGER DEFAULT 1;

-- Add day_number to assessments
ALTER TABLE public.assessments ADD COLUMN IF NOT EXISTS day_number INTEGER DEFAULT 1;

-- Create day_access table for batch-level day scheduling and locking
CREATE TABLE IF NOT EXISTS public.day_access (
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    open_time TIMESTAMPTZ,
    close_time TIMESTAMPTZ,
    is_locked BOOLEAN DEFAULT false,
    PRIMARY KEY (course_id, day_number, group_id)
);

-- Enable RLS on day_access
ALTER TABLE public.day_access ENABLE ROW LEVEL SECURITY;

-- Policies for day_access
DROP POLICY IF EXISTS "Organizers can manage day access" ON public.day_access;
CREATE POLICY "Organizers can manage day access" ON public.day_access FOR ALL USING (EXISTS (SELECT 1 FROM public.courses WHERE id = day_access.course_id AND organizer_id = auth.uid()));

DROP POLICY IF EXISTS "Students can see day access for their group" ON public.day_access;
CREATE POLICY "Students can see day access for their group" ON public.day_access FOR SELECT USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = day_access.group_id AND student_id = auth.uid()));
