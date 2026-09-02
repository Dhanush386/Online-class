-- Create saved_code_snippets table
CREATE TABLE IF NOT EXISTS public.saved_code_snippets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_code_snippets ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own snippets" ON public.saved_code_snippets;
CREATE POLICY "Users can view own snippets" ON public.saved_code_snippets 
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own snippets" ON public.saved_code_snippets;
CREATE POLICY "Users can insert own snippets" ON public.saved_code_snippets 
FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own snippets" ON public.saved_code_snippets;
CREATE POLICY "Users can update own snippets" ON public.saved_code_snippets 
FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own snippets" ON public.saved_code_snippets;
CREATE POLICY "Users can delete own snippets" ON public.saved_code_snippets 
FOR DELETE USING (auth.uid() = user_id);
