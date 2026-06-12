-- Allow organizers to assign courses (insert into enrollments)
CREATE POLICY "Organizers can enroll students in their courses" 
ON public.enrollments FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'organizer'
  )
);

-- Allow organizers to initialize progress records
CREATE POLICY "Organizers can create initial progress for their enrollments" 
ON public.progress FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'organizer'
  )
);
