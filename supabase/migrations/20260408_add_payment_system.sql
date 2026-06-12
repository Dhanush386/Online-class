-- 1. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
    status TEXT DEFAULT 'approved', -- Trust-based automatic approval as requested
    transaction_id TEXT NOT NULL,
    payment_method TEXT DEFAULT 'UPI',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 3. Policies for payments
CREATE POLICY "Students can view their own payments"
ON public.payments FOR SELECT
TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own payments"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Admins/Organizers can view all payments"
ON public.payments FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('main_admin', 'organizer')
    )
);

-- 4. Function to extend student access
CREATE OR REPLACE FUNCTION public.extend_student_access(p_student_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.users
    SET access_expires_at = COALESCE(
        CASE 
            WHEN access_expires_at > NOW() THEN access_expires_at + INTERVAL '31 days'
            ELSE NOW() + INTERVAL '31 days'
        END,
        NOW() + INTERVAL '31 days'
    )
    WHERE id = p_student_id;
END;
$$;
