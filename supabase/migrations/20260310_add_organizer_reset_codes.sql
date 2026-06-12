-- Create organizer_reset_codes table
CREATE TABLE IF NOT EXISTS public.organizer_reset_codes (
    organizer_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.organizer_reset_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Organizers can see their own code
DROP POLICY IF EXISTS "Organizers can view own reset code" ON public.organizer_reset_codes;
CREATE POLICY "Organizers can view own reset code" ON public.organizer_reset_codes 
FOR SELECT USING (auth.uid() = organizer_id);

-- Policy: Organizers can update their own code
DROP POLICY IF EXISTS "Organizers can update own reset code" ON public.organizer_reset_codes;
CREATE POLICY "Organizers can update own reset code" ON public.organizer_reset_codes 
FOR UPDATE USING (auth.uid() = organizer_id);

-- Policy: Organizers can insert their own code
DROP POLICY IF EXISTS "Organizers can insert own reset code" ON public.organizer_reset_codes;
CREATE POLICY "Organizers can insert own reset code" ON public.organizer_reset_codes 
FOR INSERT WITH CHECK (auth.uid() = organizer_id);

-- Function to generate a random 6-digit code
CREATE OR REPLACE FUNCTION generate_6_digit_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    new_code TEXT;
    is_unique BOOLEAN := false;
BEGIN
    WHILE NOT is_unique LOOP
        new_code := lpad(floor(random() * 1000000)::text, 6, '0');
        
        IF NOT EXISTS (SELECT 1 FROM public.organizer_reset_codes WHERE code = new_code) THEN
            is_unique := true;
        END IF;
    END LOOP;
    RETURN new_code;
END;
$$;

-- RPC: reset_student_password
-- Security definer so it can bypass RLS and update auth.users
CREATE OR REPLACE FUNCTION public.reset_student_password(
    p_email TEXT,
    p_reset_code TEXT,
    p_new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_organizer_id UUID;
    v_new_code TEXT;
BEGIN
    -- 1. Verify the reset code exists and get the organizer
    SELECT organizer_id INTO v_organizer_id
    FROM public.organizer_reset_codes
    WHERE code = p_reset_code;

    IF v_organizer_id IS NULL THEN
        -- Invalid code
        RETURN FALSE;
    END IF;

    -- 2. Find the user by email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE email = p_email;

    IF v_user_id IS NULL THEN
        -- User not found
        RETURN FALSE;
    END IF;

    -- 3. Update the user's password using pgcrypto
    UPDATE auth.users
    SET encrypted_password = crypt(p_new_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;

    -- 4. Generate a new code for the organizer to invalidate the old one
    v_new_code := public.generate_6_digit_code();
    
    UPDATE public.organizer_reset_codes
    SET code = v_new_code,
        updated_at = now()
    WHERE organizer_id = v_organizer_id;

    RETURN TRUE;
END;
$$;
