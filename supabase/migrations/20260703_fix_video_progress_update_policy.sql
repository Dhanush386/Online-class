-- Add UPDATE policy for video_progress so students can update their own progress
-- This was missing and caused the completion logic to fail silently.

DROP POLICY IF EXISTS "Students can update own video progress" ON public.video_progress;
CREATE POLICY "Students can update own video progress" ON public.video_progress
    FOR UPDATE
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);
