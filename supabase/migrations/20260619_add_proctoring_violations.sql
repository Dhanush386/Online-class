-- 1. Create proctoring_sessions table
CREATE TABLE IF NOT EXISTS public.proctoring_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES public.coding_challenges(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ DEFAULT now() NOT NULL,
    end_time TIMESTAMPTZ,
    final_risk_score INTEGER DEFAULT 0 NOT NULL,
    total_violations INTEGER DEFAULT 0 NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL -- 'active', 'completed', 'flagged'
);

-- Enable RLS for proctoring_sessions
ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Create proctoring_violations table
CREATE TABLE IF NOT EXISTS public.proctoring_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.proctoring_sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    violation_type VARCHAR(50) NOT NULL, -- 'phone_detected', 'face_lost', 'multiple_faces', 'tab_switch'
    risk_score_increment INTEGER NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
    evidence_url TEXT
);

-- Enable RLS for proctoring_violations
ALTER TABLE public.proctoring_violations ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for proctoring_sessions
CREATE POLICY "Students can view their own sessions" ON public.proctoring_sessions
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own sessions" ON public.proctoring_sessions
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own sessions" ON public.proctoring_sessions
    FOR UPDATE USING (auth.uid() = student_id);

CREATE POLICY "Organizers can view all sessions" ON public.proctoring_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role IN ('organizer', 'main_admin', 'sub_admin')
        )
    );

-- 4. RLS Policies for proctoring_violations
CREATE POLICY "Students can view their own violations" ON public.proctoring_violations
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own violations" ON public.proctoring_violations
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Organizers can view all violations" ON public.proctoring_violations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND role IN ('organizer', 'main_admin', 'sub_admin')
        )
    );

-- 5. Create storage bucket for proctoring evidence
CREATE OR REPLACE FUNCTION public.get_proctoring_evidence_bucket() RETURNS text AS $$
BEGIN
  RETURN 'proctoring-evidence';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

INSERT INTO storage.buckets (id, name, public) 
VALUES (public.get_proctoring_evidence_bucket(), public.get_proctoring_evidence_bucket(), true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for proctoring-evidence storage bucket
CREATE POLICY "Public Select Access for Evidence" ON storage.objects
    FOR SELECT USING (bucket_id = public.get_proctoring_evidence_bucket());

CREATE POLICY "Authenticated Insert Access for Student Evidence" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = public.get_proctoring_evidence_bucket()
    );
