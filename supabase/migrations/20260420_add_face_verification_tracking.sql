-- Add columns for daily facial verification tracking
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_face_verified_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_face_attempts INTEGER DEFAULT 0;

-- Update the existing update policy or add a new one to allow users to increment attempts and update verification date
CREATE POLICY "Users can update own face verification status" 
ON public.users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Function to reset daily_face_attempts if the last verification was on a different day
-- (This can be called from the frontend on load)
CREATE OR REPLACE FUNCTION public.check_reset_face_attempts(user_id_param UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users
    SET daily_face_attempts = 0
    WHERE id = user_id_param
    AND (last_face_verified_at IS NULL OR last_face_verified_at < CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
