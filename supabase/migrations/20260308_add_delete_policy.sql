-- Allow organizers to delete user profiles from public.users
-- This will trigger cascade deletes on enrollments, progress, and submissions.
CREATE POLICY "Organizers can delete users" ON public.users 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'organizer'
  )
);
