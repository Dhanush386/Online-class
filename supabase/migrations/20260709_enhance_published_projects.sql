-- Add new columns for advanced publishing workflow
ALTER TABLE public.published_projects
ADD COLUMN slug TEXT UNIQUE,
ADD COLUMN subdomain TEXT UNIQUE,
ADD COLUMN custom_domain TEXT UNIQUE,
ADD COLUMN visibility TEXT DEFAULT 'public',
ADD COLUMN status TEXT DEFAULT 'active',
ADD COLUMN framework TEXT DEFAULT 'html-css-js',
ADD COLUMN build_command TEXT,
ADD COLUMN output_directory TEXT,
ADD COLUMN published_url TEXT,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN last_deployed_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN unique_visitors INT DEFAULT 0,
ADD COLUMN forks INT DEFAULT 0,
ADD COLUMN likes INT DEFAULT 0,
ADD COLUMN downloads INT DEFAULT 0;

-- Function to check if a slug is available and not a reserved word
CREATE OR REPLACE FUNCTION public.check_slug_availability(p_slug TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    is_taken BOOLEAN;
    reserved_words TEXT[] := ARRAY[
        'www', 'api', 'admin', 'mail', 'docs', 'dashboard', 'login', 
        'signup', 'support', 'blog', 'cdn', 'ftp', 'smtp', 'student', 
        'organizer', 'teacher', 'root', 'help', 'status', 'assets',
        'learnovas', 'learnova', 'app', 'dev', 'test', 'staging'
    ];
BEGIN
    -- Check if it's a reserved word
    IF p_slug = ANY(reserved_words) THEN
        RETURN FALSE;
    END IF;

    -- Check if it already exists
    SELECT EXISTS(
        SELECT 1 FROM public.published_projects WHERE slug = p_slug
    ) INTO is_taken;

    RETURN NOT is_taken;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
