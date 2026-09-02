-- Add DELETE policies for enrollments and progress tables

-- ENROLLMENTS
CREATE POLICY "Main admins can delete any enrollment" 
ON enrollments FOR DELETE 
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'main_admin'));

CREATE POLICY "Organizers can delete enrollments for their courses" 
ON enrollments FOR DELETE 
USING (EXISTS (SELECT 1 FROM courses WHERE id = enrollments.course_id AND organizer_id = auth.uid()));


-- PROGRESS
CREATE POLICY "Main admins can delete any progress" 
ON progress FOR DELETE 
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'main_admin'));

CREATE POLICY "Organizers can delete progress for their courses" 
ON progress FOR DELETE 
USING (EXISTS (SELECT 1 FROM courses WHERE id = progress.course_id AND organizer_id = auth.uid()));
