-- Create coding_discussions table
CREATE TABLE IF NOT EXISTS public.coding_discussions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.coding_challenges(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    code_snapshot TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed')),
    upvotes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create coding_discussion_replies table
CREATE TABLE IF NOT EXISTS public.coding_discussion_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id UUID NOT NULL REFERENCES public.coding_discussions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    is_organizer BOOLEAN NOT NULL DEFAULT FALSE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.coding_discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_discussion_replies ENABLE ROW LEVEL SECURITY;

-- Policies for coding_discussions

-- Anyone can view discussions for challenges they can access
CREATE POLICY "Anyone can view coding discussions" ON public.coding_discussions
FOR SELECT USING (auth.role() = 'authenticated');

-- Students can create discussions
CREATE POLICY "Students can create coding discussions" ON public.coding_discussions
FOR INSERT WITH CHECK (auth.uid() = student_id);

-- Students can update their own discussions
CREATE POLICY "Students can update their own discussions" ON public.coding_discussions
FOR UPDATE USING (auth.uid() = student_id);

-- Organizers can update any discussion
CREATE POLICY "Organizers can update all discussions" ON public.coding_discussions
FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('organizer', 'sub_admin', 'main_admin')));


-- Policies for coding_discussion_replies

-- Anyone can view replies
CREATE POLICY "Anyone can view coding discussion replies" ON public.coding_discussion_replies
FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated users can create replies
CREATE POLICY "Users can create discussion replies" ON public.coding_discussion_replies
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own replies
CREATE POLICY "Users can update their own replies" ON public.coding_discussion_replies
FOR UPDATE USING (auth.uid() = user_id);

-- Add triggers to update 'updated_at'
CREATE OR REPLACE FUNCTION update_discussion_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coding_discussions_updated_at
BEFORE UPDATE ON public.coding_discussions
FOR EACH ROW
EXECUTE FUNCTION update_discussion_updated_at_column();

CREATE TRIGGER update_coding_discussion_replies_updated_at
BEFORE UPDATE ON public.coding_discussion_replies
FOR EACH ROW
EXECUTE FUNCTION update_discussion_updated_at_column();
