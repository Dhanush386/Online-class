-- ============ SUPPORT MESSAGES ============
CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    organizer_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Null if for all organizers or first responder
    message TEXT NOT NULL,
    is_from_student BOOLEAN NOT NULL DEFAULT TRUE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Policies for Students
DROP POLICY IF EXISTS "Students can view own messages" ON public.support_messages;
CREATE POLICY "Students can view own messages" ON public.support_messages
FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can send messages" ON public.support_messages;
CREATE POLICY "Students can send messages" ON public.support_messages
FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Policies for Organizers
DROP POLICY IF EXISTS "Organizers can view all messages" ON public.support_messages;
CREATE POLICY "Organizers can view all messages" ON public.support_messages
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'organizer')
);

DROP POLICY IF EXISTS "Organizers can respond to messages" ON public.support_messages;
CREATE POLICY "Organizers can respond to messages" ON public.support_messages
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'organizer')
);

DROP POLICY IF EXISTS "Organizers can mark messages as read" ON public.support_messages;
CREATE POLICY "Organizers can mark messages as read" ON public.support_messages
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'organizer')
);
