-- Create Student Notes table
CREATE TABLE IF NOT EXISTS public.student_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Students can view their own notes" ON public.student_notes
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own notes" ON public.student_notes
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own notes" ON public.student_notes
    FOR UPDATE USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can delete their own notes" ON public.student_notes
    FOR DELETE USING (auth.uid() = student_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_student_notes_updated_at
    BEFORE UPDATE ON public.student_notes
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
