-- Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('open', 'closed', 'resolved')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add ticket_id to support_messages
ALTER TABLE public.support_messages 
ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Students can see their own tickets
CREATE POLICY "Students can view their own tickets" ON public.support_tickets
FOR SELECT USING (auth.uid() = student_id);

-- Students can create tickets
CREATE POLICY "Students can create tickets" ON public.support_tickets
FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Organizers can see all tickets
CREATE POLICY "Organizers can view all tickets" ON public.support_tickets
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'organizer')
);

-- Organizers can update ticket status
CREATE POLICY "Organizers can update ticket status" ON public.support_tickets
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'organizer')
);

-- Ensure updated_at refreshes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
