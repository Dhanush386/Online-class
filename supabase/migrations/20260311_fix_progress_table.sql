-- Add last_updated column if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='progress' AND column_name='last_updated') THEN
        ALTER TABLE public.progress ADD COLUMN last_updated TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Enable RLS on progress table (just in case)
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

-- Ensure UNIQUE constraint for upsert
ALTER TABLE public.progress DROP CONSTRAINT IF EXISTS progress_student_id_course_id_key;
ALTER TABLE public.progress ADD CONSTRAINT progress_student_id_course_id_key UNIQUE (student_id, course_id);

-- Policies for Progress table
-- Allow students to view their own progress
DROP POLICY IF EXISTS "Students can view own progress" ON public.progress;
CREATE POLICY "Students can view own progress" ON public.progress FOR SELECT USING (auth.uid() = student_id);

-- Allow students to insert their own progress
DROP POLICY IF EXISTS "Students can insert own progress" ON public.progress;
CREATE POLICY "Students can insert own progress" ON public.progress FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Allow students to update their own progress
DROP POLICY IF EXISTS "Students can update own progress" ON public.progress;
CREATE POLICY "Students can update own progress" ON public.progress FOR UPDATE USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

-- Allow organizers to view progress for their courses
DROP POLICY IF EXISTS "Organizers can view student progress" ON public.progress;
CREATE POLICY "Organizers can view student progress" ON public.progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- Allow organizers to insert progress (already exists in some migrations but let's be sure)
DROP POLICY IF EXISTS "Organizers can create initial progress for their enrollments" ON public.progress;
CREATE POLICY "Organizers can create initial progress for their enrollments" ON public.progress FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'organizer')
);
