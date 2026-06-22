-- Create AI Study Assistant Tables

-- 1. AI Recommendations
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    health_score INTEGER NOT NULL,
    health_score_breakdown JSONB NOT NULL,
    weak_topics JSONB NOT NULL,
    strong_topics JSONB NOT NULL,
    recommendation_text TEXT NOT NULL,
    action_items JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure a student only has one active recommendation at a time or just index it
-- Actually, the user suggested `student_id UNIQUE`. Let's add a unique constraint on student_id where status='active'
CREATE UNIQUE INDEX ai_recommendations_active_student_idx ON public.ai_recommendations (student_id) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own recommendations" ON public.ai_recommendations
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own recommendations" ON public.ai_recommendations
    FOR INSERT WITH CHECK (auth.uid() = student_id);
    
CREATE POLICY "Students can update their own recommendations" ON public.ai_recommendations
    FOR UPDATE USING (auth.uid() = student_id);

-- 2. AI Study Plans
CREATE TABLE IF NOT EXISTS public.ai_study_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    plan_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_study_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own study plans" ON public.ai_study_plans
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own study plans" ON public.ai_study_plans
    FOR INSERT WITH CHECK (auth.uid() = student_id);
    
CREATE POLICY "Students can update their own study plans" ON public.ai_study_plans
    FOR UPDATE USING (auth.uid() = student_id);

-- 3. AI Quizzes
CREATE TABLE IF NOT EXISTS public.ai_quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    questions JSONB NOT NULL,
    score INTEGER,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed'
    generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own quizzes" ON public.ai_quizzes
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own quizzes" ON public.ai_quizzes
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own quizzes" ON public.ai_quizzes
    FOR UPDATE USING (auth.uid() = student_id);
