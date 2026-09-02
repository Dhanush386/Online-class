-- Add face_descriptor column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS face_descriptor JSONB;

-- Allow users to update their own face_descriptor if it's null (first-time registration)
DROP POLICY IF EXISTS "Users can update own face_descriptor" ON public.users;
CREATE POLICY "Users can update own face_descriptor" 
ON public.users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
