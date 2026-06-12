-- 1. Create the storage bucket for study materials
INSERT INTO storage.buckets (id, name, public) 
VALUES ('study-materials', 'study-materials', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Set up RLS policies for the bucket
-- Allow authenticated organizers and admins to UPLOAD files
CREATE POLICY "Organizers can upload study materials" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id = 'study-materials' AND 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('organizer', 'main_admin', 'sub_admin')
  )
);

-- Allow authenticated organizers and admins to DELETE their own uploads (or any if admin)
CREATE POLICY "Organizers can delete study materials" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
  bucket_id = 'study-materials' AND 
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('organizer', 'main_admin', 'sub_admin')
  )
);

-- Allow everyone (including students) to READ study materials
CREATE POLICY "Public read access for study materials" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'study-materials');

-- 3. Reload schema cache
NOTIFY pgrst, 'reload schema';
