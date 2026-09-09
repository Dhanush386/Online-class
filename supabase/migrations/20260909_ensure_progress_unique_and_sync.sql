-- Ensure progress table has proper columns, unique constraint, and RLS policies

-- 1. Add last_updated column if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='progress' AND column_name='last_updated') THEN
        ALTER TABLE public.progress ADD COLUMN last_updated TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 2. Clean up any duplicate progress rows keeping the latest / highest progress
DELETE FROM public.progress p1
WHERE p1.id IN (
    SELECT p.id FROM (
        SELECT id, 
               ROW_NUMBER() OVER (
                   PARTITION BY student_id, course_id 
                   ORDER BY completion_percentage DESC, created_at DESC
               ) as rn
        FROM public.progress
        WHERE student_id IS NOT NULL AND course_id IS NOT NULL
    ) p
    WHERE p.rn > 1
);

-- 3. Ensure UNIQUE constraint for upsert
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'progress_student_id_course_id_key'
    ) THEN
        ALTER TABLE public.progress 
        ADD CONSTRAINT progress_student_id_course_id_key UNIQUE (student_id, course_id);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        NULL;
    WHEN others THEN
        NULL;
END $$;

-- 4. Enable RLS and verify policies
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progress_all" ON public.progress;
DROP POLICY IF EXISTS "Students can view own progress" ON public.progress;
DROP POLICY IF EXISTS "Students can insert own progress" ON public.progress;
DROP POLICY IF EXISTS "Students can update own progress" ON public.progress;

CREATE POLICY "Students can view own progress" ON public.progress
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert own progress" ON public.progress
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own progress" ON public.progress
    FOR UPDATE USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

-- Organizers can view progress for their courses
DROP POLICY IF EXISTS "Organizers can view student progress" ON public.progress;
CREATE POLICY "Organizers can view student progress" ON public.progress
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
    );

-- Organizers can create/manage progress for enrollments
DROP POLICY IF EXISTS "Organizers can create initial progress for their enrollments" ON public.progress;
CREATE POLICY "Organizers can create initial progress for their enrollments" ON public.progress
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'organizer')
    );
