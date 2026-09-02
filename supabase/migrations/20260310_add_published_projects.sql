-- Create published_projects table
CREATE TABLE IF NOT EXISTS public.published_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    html TEXT,
    css TEXT,
    js TEXT,
    views INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.published_projects ENABLE ROW LEVEL SECURITY;

-- Policies

-- 1. Anyone can view published projects (publicly accessible)
DROP POLICY IF EXISTS "Anyone can view published projects" ON public.published_projects;
CREATE POLICY "Anyone can view published projects" ON public.published_projects
FOR SELECT USING (true);

-- 2. Authenticated users can insert their own projects
DROP POLICY IF EXISTS "Users can insert own published projects" ON public.published_projects;
CREATE POLICY "Users can insert own published projects" ON public.published_projects
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their own projects (e.g., to update views, though typically we'd use an RPC for secure view counting, 
-- but for simplicity, we allow owners to update them, and maybe an RPC for public view increment if really needed, 
-- but actually anyone can SELECT. If we want public to update view count, we need an RPC or a trigger.)
DROP POLICY IF EXISTS "Users can update own published projects" ON public.published_projects;
CREATE POLICY "Users can update own published projects" ON public.published_projects
FOR UPDATE USING (auth.uid() = user_id);

-- 4. Users can delete their own projects
DROP POLICY IF EXISTS "Users can delete own published projects" ON public.published_projects;
CREATE POLICY "Users can delete own published projects" ON public.published_projects
FOR DELETE USING (auth.uid() = user_id);

-- RPC for securely incrementing view count by anyone
CREATE OR REPLACE FUNCTION increment_project_views(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.published_projects
    SET views = views + 1
    WHERE id = p_id;
END;
$$;
