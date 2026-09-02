-- 1. Update existing payments table
ALTER TABLE public.payments ALTER COLUMN status SET DEFAULT 'pending';

-- 2. Create a trigger function to extend access upon approval
CREATE OR REPLACE FUNCTION public.handle_payment_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only extend access if status changed to 'approved'
    IF (NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved')) THEN
        PERFORM public.extend_student_access(NEW.student_id);
    END IF;
    RETURN NEW;
END;
$$;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS on_payment_status_update ON public.payments;
CREATE TRIGGER on_payment_status_update
    AFTER UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payment_approval();

-- 4. Ensure organizers/admins can update payment status
CREATE POLICY "Organizers can update payment status"
ON public.payments FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() AND role IN ('main_admin', 'organizer')
    )
);
