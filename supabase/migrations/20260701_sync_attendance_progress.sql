-- ============================================================
-- Learnova LXP Learning Journey & Reward Engine Migration
-- Date: 2026-07-01
-- ============================================================

-- 1. Create LXP ENUM Types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type_enum') THEN
        CREATE TYPE public.activity_type_enum AS ENUM ('VIDEO', 'LIVE', 'QUIZ', 'CODING', 'ASSIGNMENT', 'RESOURCE', 'NOTES');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
        CREATE TYPE public.attendance_status_enum AS ENUM ('insufficient_time', 'present', 'absent', 'recovered');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'completed_from_enum') THEN
        CREATE TYPE public.completed_from_enum AS ENUM ('LIVE_CLASS', 'RECORDED_VIDEO', 'MANUAL', 'ADMIN', 'AI', 'IMPORT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_category_enum') THEN
        CREATE TYPE public.notification_category_enum AS ENUM ('academic', 'gamification', 'system', 'social', 'ai');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unlock_reason_enum') THEN
        CREATE TYPE public.unlock_reason_enum AS ENUM ('NORMAL_PROGRESS', 'EARLY_UNLOCK', 'ADMIN', 'AI', 'SPECIAL_EVENT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'milestone_type_enum') THEN
        CREATE TYPE public.milestone_type_enum AS ENUM ('ORIENTATION', 'MID_SEMESTER', 'PROJECT', 'HACKATHON', 'FINAL_EXAM', 'CERTIFICATE', 'PLACEMENT_READY', 'GRADUATION');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_type_enum') THEN
        CREATE TYPE public.device_type_enum AS ENUM ('WEB', 'ANDROID', 'IOS', 'TABLET');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'browser_enum') THEN
        CREATE TYPE public.browser_enum AS ENUM ('CHROME', 'EDGE', 'FIREFOX', 'SAFARI', 'OTHER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_job_type_enum') THEN
        CREATE TYPE public.ai_job_type_enum AS ENUM ('SUMMARY', 'QUIZ', 'STUDY_PLAN', 'FLASHCARDS', 'ROADMAP');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_status_enum') THEN
        CREATE TYPE public.activity_status_enum AS ENUM ('STARTED', 'COMPLETED', 'ABANDONED', 'FAILED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'time_of_day_enum') THEN
        CREATE TYPE public.time_of_day_enum AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty_enum') THEN
        CREATE TYPE public.difficulty_enum AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommendation_status_enum') THEN
        CREATE TYPE public.recommendation_status_enum AS ENUM ('NEW', 'VIEWED', 'ACCEPTED', 'DISMISSED');
    END IF;
END
$$;

-- 1.5 Helper function for attendance status
CREATE OR REPLACE FUNCTION public.get_attendance_present() RETURNS text AS $$
BEGIN
  RETURN 'present';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_notification_academic() RETURNS text AS $$
BEGIN RETURN 'academic'; END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_activity_started() RETURNS text AS $$
BEGIN RETURN 'STARTED'; END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_status_pending() RETURNS text AS $$
BEGIN RETURN 'pending'; END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_event_live_class_full() RETURNS text AS $$
BEGIN RETURN 'live_class_full'; END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_event_weekly_champion() RETURNS text AS $$
BEGIN RETURN 'weekly_champion'; END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.get_tg_op_delete() RETURNS text AS $$
BEGIN RETURN 'DELETE'; END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop Dependent View First to avoid column alter type dependency errors
DROP VIEW IF EXISTS public.course_analytics_view;

-- 2. Alter Existing live_attendance Table
ALTER TABLE public.live_attendance DROP CONSTRAINT IF EXISTS live_attendance_attendance_status_check;
ALTER TABLE public.live_attendance ALTER COLUMN attendance_status DROP DEFAULT;
ALTER TABLE public.live_attendance ALTER COLUMN attendance_status TYPE public.attendance_status_enum USING attendance_status::public.attendance_status_enum;
ALTER TABLE public.live_attendance ALTER COLUMN attendance_status SET DEFAULT 'insufficient_time'::public.attendance_status_enum;

ALTER TABLE public.live_attendance
    ADD COLUMN IF NOT EXISTS recovery_deadline TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS recovery_progress INTEGER DEFAULT 0 CHECK (recovery_progress BETWEEN 0 AND 100),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Recreate Dependent View
CREATE OR REPLACE VIEW public.course_analytics_view AS
SELECT
    c.id AS course_id,
    c.title AS course_title,
    c.organizer_id,
    
    -- Completion %
    COALESCE(
        (SELECT AVG(completion_percentage) FROM public.progress WHERE course_id = c.id),
        0
    ) AS avg_completion_percentage,
    
    -- Attendance %
    COALESCE(
        (
            WITH course_stats AS (
                SELECT 
                    (SELECT COUNT(*) FROM public.enrollments WHERE course_id = c.id) as total_students,
                    (SELECT COUNT(*) FROM public.videos WHERE course_id = c.id) as total_videos,
                    (SELECT COUNT(*) FROM public.live_attendance WHERE course_id = c.id AND attendance_status::text = public.get_attendance_present()) as present_count
            )
            SELECT CASE 
                WHEN total_students > 0 AND total_videos > 0 THEN (present_count::float / (total_students * total_videos)) * 100
                ELSE 0 
            END
            FROM course_stats
        ), 0
    ) AS avg_attendance_percentage,
    
    -- Average Score (Assessment)
    COALESCE(
        (
            SELECT AVG(score::float / NULLIF(total_questions, 0) * 100)
            FROM public.assessment_submissions
            WHERE assessment_id IN (SELECT id FROM public.assessments WHERE course_id = c.id)
        ), 0
    ) AS avg_score_percentage,
    
    -- Live + Recorded Hours
    COALESCE(
        (SELECT SUM(duration_minutes) FROM public.videos WHERE course_id = c.id),
        0
    ) / 60.0 AS total_hours,
    
    -- High Risk Students (Score >= 70)
    (
        SELECT COUNT(DISTINCT ps.student_id)
        FROM public.proctoring_sessions ps
        JOIN public.assessments a ON ps.assessment_id = a.id
        WHERE a.course_id = c.id AND ps.final_risk_score >= 70
    ) AS high_risk_student_count,

    -- Enrolled students count
    (SELECT COUNT(*) FROM public.enrollments WHERE course_id = c.id) AS student_count
    
FROM public.courses c;

-- 3. Alter Existing video_progress Table
ALTER TABLE public.video_progress
    ADD COLUMN IF NOT EXISTS completed_from public.completed_from_enum,
    ADD COLUMN IF NOT EXISTS xp_awarded BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 4. Alter Existing xp_events Table
ALTER TABLE public.xp_events
    ADD COLUMN IF NOT EXISTS base_xp INTEGER,
    ADD COLUMN IF NOT EXISTS xp_multiplier NUMERIC DEFAULT 1.0,
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS source_id UUID;

-- 5. Alter Existing student_week_progress Table
ALTER TABLE public.student_week_progress
    ADD COLUMN IF NOT EXISTS attendance_percentage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quiz_percentage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS coding_percentage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS assignment_percentage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ai_summary TEXT,
    ADD COLUMN IF NOT EXISTS ai_provider TEXT,
    ADD COLUMN IF NOT EXISTS ai_model TEXT,
    ADD COLUMN IF NOT EXISTS ai_version TEXT,
    ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS unlock_reason public.unlock_reason_enum DEFAULT 'NORMAL_PROGRESS'::public.unlock_reason_enum,
    ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 100,
    ADD COLUMN IF NOT EXISTS recommendation_status public.recommendation_status_enum DEFAULT 'NEW'::public.recommendation_status_enum,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- 6. Create Master learning_path Table
CREATE TABLE IF NOT EXISTS public.learning_path (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    semester_number INTEGER DEFAULT 1,
    week_number INTEGER NOT NULL,
    day_number INTEGER NOT NULL,
    time_of_day public.time_of_day_enum DEFAULT 'MORNING'::public.time_of_day_enum,
    topic TEXT NOT NULL,
    activity_type public.activity_type_enum,
    activity_id UUID NOT NULL,
    sort_order INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 0,
    coin_reward INTEGER DEFAULT 0,
    estimated_minutes INTEGER DEFAULT 0,
    difficulty public.difficulty_enum DEFAULT 'BEGINNER'::public.difficulty_enum,
    is_required BOOLEAN DEFAULT true,
    depends_on_activity_id UUID REFERENCES public.learning_path(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(course_id, week_number, day_number, time_of_day, sort_order)
);

-- Enable RLS for learning_path
ALTER TABLE public.learning_path ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view learning path" ON public.learning_path;
CREATE POLICY "Anyone can view learning path" ON public.learning_path FOR SELECT USING (true);
DROP POLICY IF EXISTS "Organizers can manage learning path" ON public.learning_path;
CREATE POLICY "Organizers can manage learning path" ON public.learning_path FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- 7. Create semester_calendar Table
CREATE TABLE IF NOT EXISTS public.semester_calendar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    semester_number INTEGER DEFAULT 1,
    week_number INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,
    is_holiday BOOLEAN DEFAULT false,
    holiday_reason TEXT,
    is_exam_week BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(course_id, semester_number, week_number)
);

-- Enable RLS for semester_calendar
ALTER TABLE public.semester_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view calendar" ON public.semester_calendar;
CREATE POLICY "Anyone can view calendar" ON public.semester_calendar FOR SELECT USING (true);
DROP POLICY IF EXISTS "Organizers can manage calendar" ON public.semester_calendar;
CREATE POLICY "Organizers can manage calendar" ON public.semester_calendar FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- 8. Create student_activity_state Table
CREATE TABLE IF NOT EXISTS public.student_activity_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    activity_id UUID NOT NULL,
    activity_type public.activity_type_enum,
    status public.activity_status_enum DEFAULT public.get_activity_started()::public.activity_status_enum,
    resume_position NUMERIC DEFAULT 0,
    last_opened TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, activity_id)
);

-- Enable RLS for student_activity_state
ALTER TABLE public.student_activity_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can manage own activity state" ON public.student_activity_state;
CREATE POLICY "Students can manage own activity state" ON public.student_activity_state FOR ALL USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Organizers can view student activity state" ON public.student_activity_state;
CREATE POLICY "Organizers can view student activity state" ON public.student_activity_state FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- 9. Create student_topic_progress Table
CREATE TABLE IF NOT EXISTS public.student_topic_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    completion_percentage INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    health_score INTEGER DEFAULT 100,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, course_id, topic)
);

-- Enable RLS for student_topic_progress
ALTER TABLE public.student_topic_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view own topic progress" ON public.student_topic_progress;
CREATE POLICY "Students can view own topic progress" ON public.student_topic_progress FOR SELECT USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Organizers can view student topic progress" ON public.student_topic_progress;
CREATE POLICY "Organizers can view student topic progress" ON public.student_topic_progress FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- 10. Create student_daily_progress Table
CREATE TABLE IF NOT EXISTS public.student_daily_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    day_number INTEGER NOT NULL,
    tasks_total INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    completion_percentage INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    coins_earned INTEGER DEFAULT 0,
    study_minutes INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    streak_broken BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, course_id, week_number, day_number)
);

-- Enable RLS for student_daily_progress
ALTER TABLE public.student_daily_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view own daily progress" ON public.student_daily_progress;
CREATE POLICY "Students can view own daily progress" ON public.student_daily_progress FOR SELECT USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Organizers can view student daily progress" ON public.student_daily_progress;
CREATE POLICY "Organizers can view student daily progress" ON public.student_daily_progress FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- 11. Create student_semester_progress Table
CREATE TABLE IF NOT EXISTS public.student_semester_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    semester_number INTEGER DEFAULT 1,
    completion_percentage INTEGER DEFAULT 0,
    completed_weeks INTEGER DEFAULT 0,
    completed_topics INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    coins_earned INTEGER DEFAULT 0,
    attendance_percentage INTEGER DEFAULT 0,
    coding_percentage INTEGER DEFAULT 0,
    assessment_percentage INTEGER DEFAULT 0,
    health_score INTEGER DEFAULT 100,
    rank_index INTEGER,
    placement_readiness_score INTEGER DEFAULT 0 CHECK (placement_readiness_score BETWEEN 0 AND 100),
    expected_completion_date DATE,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, course_id, semester_number)
);

-- Enable RLS for student_semester_progress
ALTER TABLE public.student_semester_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view own semester progress" ON public.student_semester_progress;
CREATE POLICY "Students can view own semester progress" ON public.student_semester_progress FOR SELECT USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Organizers can view student semester progress" ON public.student_semester_progress;
CREATE POLICY "Organizers can view student semester progress" ON public.student_semester_progress FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- 12. Create student_ai_history Table
CREATE TABLE IF NOT EXISTS public.student_ai_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    week_number INTEGER,
    ai_summary TEXT,
    ai_provider TEXT,
    ai_model TEXT,
    ai_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for student_ai_history
ALTER TABLE public.student_ai_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view own AI history" ON public.student_ai_history;
CREATE POLICY "Students can view own AI history" ON public.student_ai_history FOR SELECT USING (auth.uid() = student_id);

-- 13. Create system_events Table
CREATE TABLE IF NOT EXISTS public.system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for system_events (only organizers/system can read all)
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Organizers can view system events" ON public.system_events;
CREATE POLICY "Organizers can view system events" ON public.system_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'organizer')
);

-- 14. Create activity_attempts Table
CREATE TABLE IF NOT EXISTS public.activity_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    week_number INTEGER,
    day_number INTEGER,
    activity_type public.activity_type_enum,
    activity_id UUID NOT NULL,
    device public.device_type_enum,
    browser public.browser_enum,
    ip_hash TEXT,
    attempt_number INTEGER DEFAULT 1,
    status public.activity_status_enum DEFAULT public.get_activity_started()::public.activity_status_enum,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for activity_attempts
ALTER TABLE public.activity_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can manage own attempts" ON public.activity_attempts;
CREATE POLICY "Students can manage own attempts" ON public.activity_attempts FOR ALL USING (auth.uid() = student_id);

-- 15. Create semester_milestones Table
CREATE TABLE IF NOT EXISTS public.semester_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    milestone_type public.milestone_type_enum,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(course_id, week_number, milestone_type)
);

-- Enable RLS for semester_milestones
ALTER TABLE public.semester_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view milestones" ON public.semester_milestones;
CREATE POLICY "Anyone can view milestones" ON public.semester_milestones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Organizers can manage milestones" ON public.semester_milestones;
CREATE POLICY "Organizers can manage milestones" ON public.semester_milestones FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- 16. Create ai_generation_queue Table
CREATE TABLE IF NOT EXISTS public.ai_generation_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    week_number INTEGER,
    job_type public.ai_job_type_enum,
    priority INTEGER DEFAULT 0,
    status TEXT DEFAULT public.get_status_pending() CHECK (status IN (public.get_status_pending(), 'processing', 'completed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- Enable RLS for ai_generation_queue
ALTER TABLE public.ai_generation_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view own jobs" ON public.ai_generation_queue;
CREATE POLICY "Students can view own jobs" ON public.ai_generation_queue FOR SELECT USING (auth.uid() = student_id);

-- 17. Alter notifications Table
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_category_check;
ALTER TABLE public.notifications
    ADD COLUMN IF NOT EXISTS category public.notification_category_enum,
    ADD COLUMN IF NOT EXISTS icon TEXT,
    ADD COLUMN IF NOT EXISTS color TEXT,
    ADD COLUMN IF NOT EXISTS priority TEXT CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW'));

-- ============================================================
-- 18. TRIGGERS & FUNCTIONS DEFINITION
-- ============================================================

-- Function: Trigger to write custom notification when an XP Event is inserted
CREATE OR REPLACE FUNCTION public.trigger_xp_event_to_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_icon TEXT;
    v_color TEXT;
    v_category public.notification_category_enum;
BEGIN
    -- Map XP event type to notification properties
    IF NEW.event_type = public.get_event_live_class_full() OR NEW.event_type = 'live_class_partial' THEN
        v_icon := 'attendance';
        v_color := '#ef4444';
        v_category := public.get_notification_academic()::public.notification_category_enum;
    ELSIF NEW.event_type = 'recorded_video' THEN
        v_icon := 'video';
        v_color := '#9333ea';
        v_category := public.get_notification_academic()::public.notification_category_enum;
    ELSIF NEW.event_type = 'weekly_bonus' OR NEW.event_type = public.get_event_weekly_champion() OR NEW.event_type = 'daily_streak' THEN
        v_icon := 'achievement';
        v_color := '#f59e0b';
        v_category := 'gamification'::public.notification_category_enum;
    ELSE
        v_icon := 'star';
        v_color := '#6366f1';
        v_category := 'system'::public.notification_category_enum;
    END IF;

    INSERT INTO public.notifications (
        title, message, type, target, sender_id, category, icon, color, priority
    ) VALUES (
        'XP Awarded! +' || NEW.xp_amount || ' XP',
        COALESCE(NEW.reason, NEW.event_type || ' completed successfully'),
        'info',
        'students',
        NEW.student_id,
        v_category,
        v_icon,
        v_color,
        'LOW'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_xp_event_added ON public.xp_events;
CREATE TRIGGER on_xp_event_added
    AFTER INSERT ON public.xp_events
    FOR EACH ROW EXECUTE FUNCTION public.trigger_xp_event_to_notification();


-- Function: Trigger on live_attendance to upsert video_progress and insert XP
CREATE OR REPLACE FUNCTION public.trigger_sync_attendance_to_video_progress()
RETURNS TRIGGER AS $$
DECLARE
    v_course_id UUID;
    v_schedule_id UUID;
    v_title TEXT;
    v_xp INTEGER := 50;
    v_coins INTEGER := 10;
    v_multiplier NUMERIC := 1.0;
BEGIN
    -- Set recovery deadline if insert
    IF TG_OP = 'INSERT' THEN
        DECLARE
            v_recovery_days INTEGER := 7;
        BEGIN
            SELECT xp_amount INTO v_recovery_days FROM public.xp_config WHERE event_type = 'recovery_days';
            NEW.recovery_deadline := now() + (COALESCE(v_recovery_days, 7) * INTERVAL '1 day');
        EXCEPTION WHEN OTHERS THEN
            NEW.recovery_deadline := now() + INTERVAL '7 days';
        END;
    END IF;

    -- Sync when status becomes present or recovered
    IF (NEW.attendance_status::text = public.get_attendance_present() OR NEW.attendance_status::text = 'recovered') 
       AND (OLD.attendance_status IS DISTINCT FROM NEW.attendance_status OR TG_OP = 'INSERT') THEN
        
        -- Get details
        SELECT course_id, schedule_id, title INTO v_course_id, v_schedule_id, v_title FROM public.videos WHERE id = NEW.video_id;

        -- Upsert video progress
        INSERT INTO public.video_progress (
            student_id, video_id, course_id, completed, watched_percentage, completed_from, watched_at, xp_awarded
        ) VALUES (
            NEW.student_id, NEW.video_id, v_course_id, true, 100, 
            CASE WHEN NEW.attendance_status::text = public.get_attendance_present() THEN 'LIVE_CLASS'::public.completed_from_enum ELSE 'MANUAL'::public.completed_from_enum END,
            now(), true
        )
        ON CONFLICT (student_id, video_id)
        DO UPDATE SET
            completed = true,
            watched_percentage = 100,
            completed_from = EXCLUDED.completed_from,
            watched_at = now(),
            xp_awarded = true;

        -- Read dynamic rewards from xp_config
        BEGIN
            IF NEW.attendance_status::text = public.get_attendance_present() THEN
                SELECT xp_amount, coin_amount, streak_multiplier INTO v_xp, v_coins, v_multiplier 
                FROM public.xp_config WHERE event_type = public.get_event_live_class_full();
            ELSE
                -- Recovered awards 50% XP
                SELECT xp_amount, coin_amount, streak_multiplier INTO v_xp, v_coins, v_multiplier 
                FROM public.xp_config WHERE event_type = public.get_event_live_class_full();
                v_multiplier := v_multiplier * 0.5;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- fallback defaults
            v_xp := 50; v_coins := 10; v_multiplier := 1.0;
        END;

        -- Write facts to xp_events
        INSERT INTO public.xp_events (
            student_id, course_id, schedule_id, event_type, module_type, reference_id, 
            base_xp, xp_multiplier, xp_amount, coin_amount, reason, source_id
        ) VALUES (
            NEW.student_id, v_course_id, v_schedule_id, 
            CASE WHEN NEW.attendance_status::text = public.get_attendance_present() THEN 'ATTENDANCE' ELSE 'ATTENDANCE_RECOVERY' END,
            'live_class', NEW.video_id, v_xp, v_multiplier, ROUND(v_xp * v_multiplier)::INTEGER, v_coins,
            CASE WHEN NEW.attendance_status::text = public.get_attendance_present() THEN 'Attended Live Class: ' ELSE 'Recovered Attendance: ' END || COALESCE(v_title, ''),
            NEW.id
        )
        ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_live_attendance_present ON public.live_attendance;
CREATE TRIGGER on_live_attendance_present
    BEFORE INSERT OR UPDATE ON public.live_attendance
    FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_attendance_to_video_progress();


-- Function: Trigger on video_progress to award XP for recorded views
-- Function: Trigger on video_progress to award XP for recorded views
CREATE OR REPLACE FUNCTION public.trigger_video_progress_xp()
RETURNS TRIGGER AS $$
DECLARE
    v_schedule_id UUID;
    v_title TEXT;
    v_xp INTEGER := 30;
    v_coins INTEGER := 5;
    v_multiplier NUMERIC := 1.0;
BEGIN
    IF NEW.completed AND NOT NEW.xp_awarded THEN
        -- Mark as awarded
        NEW.xp_awarded := true;

        -- Fetch video info
        SELECT schedule_id, title INTO v_schedule_id, v_title FROM public.videos WHERE id = NEW.video_id;

        -- Get config
        BEGIN
            SELECT xp_amount, coin_amount, streak_multiplier INTO v_xp, v_coins, v_multiplier 
            FROM public.xp_config WHERE event_type = 'recorded_video';
        EXCEPTION WHEN OTHERS THEN
            v_xp := 30; v_coins := 5; v_multiplier := 1.0;
        END;

        -- Insert event
        INSERT INTO public.xp_events (
            student_id, course_id, schedule_id, event_type, module_type, reference_id, 
            base_xp, xp_multiplier, xp_amount, coin_amount, reason, source_id
        ) VALUES (
            NEW.student_id, NEW.course_id, v_schedule_id, 'VIDEO_COMPLETION', 'video', NEW.video_id,
            v_xp, v_multiplier, ROUND(v_xp * v_multiplier)::INTEGER, v_coins,
            'Watched Recorded Video: ' || COALESCE(v_title, ''),
            NEW.id
        )
        ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_video_progress_completed ON public.video_progress;
CREATE TRIGGER on_video_progress_completed
    BEFORE INSERT OR UPDATE ON public.video_progress
    FOR EACH ROW EXECUTE FUNCTION public.trigger_video_progress_xp();


-- Function: Core mastery & sub-percentages calculation trigger
CREATE OR REPLACE FUNCTION public.refresh_student_week_progress(
    p_student_id UUID,
    p_course_id UUID,
    p_week_number INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_total_items INTEGER := 0;
    v_completed_items INTEGER := 0;
    v_completion_percentage INTEGER := 0;
    
    v_total_live INTEGER := 0;
    v_completed_live INTEGER := 0;
    v_total_quiz INTEGER := 0;
    v_completed_quiz INTEGER := 0;
    v_total_coding INTEGER := 0;
    v_completed_coding INTEGER := 0;
    v_total_assign INTEGER := 0;
    v_completed_assign INTEGER := 0;
    
    v_xp_earned INTEGER := 0;
    v_coins_earned INTEGER := 0;
    v_grade TEXT := 'F';
    v_health INTEGER := 100;
    v_already_completed TIMESTAMPTZ;
BEGIN
    -- 1. Gather all activity counts for sub-percentages
    -- Videos (Recorded + Live)
    SELECT COALESCE(COUNT(*), 0) INTO v_total_live 
    FROM public.videos WHERE course_id = p_course_id AND week_number = p_week_number;
    
    SELECT COALESCE(COUNT(*), 0) INTO v_completed_live
    FROM public.video_progress vp JOIN public.videos v ON vp.video_id = v.id
    WHERE vp.student_id = p_student_id AND vp.course_id = p_course_id AND v.week_number = p_week_number AND vp.completed = true;

    -- Quizzes
    SELECT COALESCE(COUNT(*), 0) INTO v_total_quiz
    FROM public.assessments WHERE course_id = p_course_id AND week_number = p_week_number;

    SELECT COALESCE(COUNT(DISTINCT asub.assessment_id), 0) INTO v_completed_quiz
    FROM public.assessment_submissions asub JOIN public.assessments a ON asub.assessment_id = a.id
    WHERE asub.student_id = p_student_id AND a.course_id = p_course_id AND a.week_number = p_week_number;

    -- Coding
    SELECT COALESCE(COUNT(*), 0) INTO v_total_coding
    FROM public.coding_challenges WHERE course_id = p_course_id AND week_number = p_week_number;

    SELECT COALESCE(COUNT(DISTINCT cs.challenge_id), 0) INTO v_completed_coding
    FROM public.coding_submissions cs JOIN public.coding_challenges cc ON cs.challenge_id = cc.id
    WHERE cs.student_id = p_student_id AND cc.course_id = p_course_id AND cc.week_number = p_week_number AND cs.status = 'accepted';

    -- 2. Aggregate totals
    v_total_items := v_total_live + v_total_quiz + v_total_coding + v_total_assign;
    v_completed_items := v_completed_live + v_completed_quiz + v_completed_coding + v_completed_assign;

    IF v_total_items = 0 THEN
        RETURN;
    END IF;

    v_completion_percentage := LEAST(100, ROUND((v_completed_items::NUMERIC / v_total_items::NUMERIC) * 100))::INTEGER;
    v_grade := public.calculate_week_grade(v_completion_percentage);

    -- Calculate Health Score formula
    -- Health = (Attendance * 25%) + (Video * 20%) + (Coding * 25%) + (Quiz * 20%) + (Consistency * 10%)
    DECLARE
        v_att_p NUMERIC := CASE WHEN v_total_live > 0 THEN (v_completed_live::NUMERIC / v_total_live::NUMERIC) * 100 ELSE 100 END;
        v_cod_p NUMERIC := CASE WHEN v_total_coding > 0 THEN (v_completed_coding::NUMERIC / v_total_coding::NUMERIC) * 100 ELSE 100 END;
        v_qiz_p NUMERIC := CASE WHEN v_total_quiz > 0 THEN (v_completed_quiz::NUMERIC / v_total_quiz::NUMERIC) * 100 ELSE 100 END;
    BEGIN
        v_health := ROUND((v_att_p * 0.25) + (v_att_p * 0.20) + (v_cod_p * 0.25) + (v_qiz_p * 0.20) + 10)::INTEGER;
    END;

    -- Fetch sums of XP/Coins from this week
    SELECT COALESCE(SUM(xp_amount), 0), COALESCE(SUM(coin_amount), 0)
    INTO v_xp_earned, v_coins_earned
    FROM public.xp_events
    WHERE student_id = p_student_id AND course_id = p_course_id
      AND (
          reference_id IN (SELECT id FROM public.videos WHERE course_id = p_course_id AND week_number = p_week_number) OR
          reference_id IN (SELECT id FROM public.assessments WHERE course_id = p_course_id AND week_number = p_week_number) OR
          reference_id IN (SELECT id FROM public.coding_challenges WHERE course_id = p_course_id AND week_number = p_week_number)
      );

    -- Fetch already completed timestamptz
    SELECT completed_at INTO v_already_completed
    FROM public.student_week_progress
    WHERE student_id = p_student_id AND course_id = p_course_id AND week_number = p_week_number;

    -- Upsert Student Week Progress
    INSERT INTO public.student_week_progress (
        student_id, course_id, week_number, total_items, completed_items, completion_percentage, 
        attendance_percentage, quiz_percentage, coding_percentage, assignment_percentage,
        xp_earned, coins_earned, grade, health_score, completed_at
    ) VALUES (
        p_student_id, p_course_id, p_week_number, v_total_items, v_completed_items, v_completion_percentage,
        CASE WHEN v_total_live > 0 THEN ROUND((v_completed_live::NUMERIC/v_total_live::NUMERIC)*100)::INTEGER ELSE 0 END,
        CASE WHEN v_total_quiz > 0 THEN ROUND((v_completed_quiz::NUMERIC/v_total_quiz::NUMERIC)*100)::INTEGER ELSE 0 END,
        CASE WHEN v_total_coding > 0 THEN ROUND((v_completed_coding::NUMERIC/v_total_coding::NUMERIC)*100)::INTEGER ELSE 0 END,
        0, v_xp_earned, v_coins_earned, v_grade, v_health,
        CASE WHEN v_completion_percentage = 100 THEN COALESCE(v_already_completed, now()) ELSE NULL END
    )
    ON CONFLICT (student_id, course_id, week_number)
    DO UPDATE SET
        total_items = EXCLUDED.total_items,
        completed_items = EXCLUDED.completed_items,
        completion_percentage = EXCLUDED.completion_percentage,
        attendance_percentage = EXCLUDED.attendance_percentage,
        quiz_percentage = EXCLUDED.quiz_percentage,
        coding_percentage = EXCLUDED.coding_percentage,
        xp_earned = EXCLUDED.xp_earned,
        coins_earned = EXCLUDED.coins_earned,
        grade = EXCLUDED.grade,
        health_score = EXCLUDED.health_score,
        completed_at = EXCLUDED.completed_at;

    -- Standard completion check
    IF v_completion_percentage = 100 AND v_already_completed IS NULL THEN
        DECLARE
            v_event_type TEXT := 'weekly_bonus';
            v_xp_reward INTEGER := 100;
            v_coin_reward INTEGER := 25;
        BEGIN
            -- If perfect score across all metrics, award Weekly Champion!
            IF v_completed_live = v_total_live AND v_completed_quiz = v_total_quiz AND v_completed_coding = v_total_coding THEN
                v_event_type := public.get_event_weekly_champion();
            END IF;

            -- Load values from config
            SELECT xp_amount, coin_amount INTO v_xp_reward, v_coin_reward 
            FROM public.xp_config WHERE event_type = v_event_type;

            INSERT INTO public.xp_events (
                student_id, course_id, event_type, module_type, reference_id, 
                base_xp, xp_multiplier, xp_amount, coin_amount, reason
            ) VALUES (
                p_student_id, p_course_id, v_event_type, 'weekly', 
                CAST(md5(p_student_id::TEXT || '-' || p_course_id::TEXT || '-week-' || p_week_number::TEXT) AS UUID),
                v_xp_reward, 1.0, v_xp_reward, v_coin_reward, 
                CASE WHEN v_event_type = public.get_event_weekly_champion() THEN '🏆 Weekly Champion! ' ELSE 'Completed Week ' END || p_week_number || ' Tasks'
            )
            ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;

            -- Queue AI Summary Job
            INSERT INTO public.ai_generation_queue (
                student_id, course_id, week_number, job_type, priority, status
            ) VALUES (
                p_student_id, p_course_id, p_week_number, 'SUMMARY'::public.ai_job_type_enum, 2, public.get_status_pending()
            );
        END;
    END IF;

    -- Update Semester Progress bridging
    PERFORM public.refresh_student_semester_progress(p_student_id, p_course_id);
END;
$$ LANGUAGE plpgsql;


-- Function: Refresh student semester progress
CREATE OR REPLACE FUNCTION public.refresh_student_semester_progress(
    p_student_id UUID,
    p_course_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_total_weeks INTEGER := 12;
    v_completed_weeks INTEGER := 0;
    v_avg_completion INTEGER := 0;
    v_xp INTEGER := 0;
    v_coins INTEGER := 0;
    v_health INTEGER := 100;
BEGIN
    SELECT COALESCE(duration_weeks, 12) INTO v_total_weeks FROM public.courses WHERE id = p_course_id;

    SELECT COUNT(*), COALESCE(AVG(completion_percentage), 0)::INTEGER, COALESCE(SUM(xp_earned), 0), COALESCE(SUM(coins_earned), 0), COALESCE(AVG(health_score), 100)::INTEGER
    INTO v_completed_weeks, v_avg_completion, v_xp, v_coins, v_health
    FROM public.student_week_progress
    WHERE student_id = p_student_id AND course_id = p_course_id AND completion_percentage = 100;

    INSERT INTO public.student_semester_progress (
        student_id, course_id, semester_number, completion_percentage, completed_weeks, xp_earned, coins_earned, health_score, last_activity_at
    ) VALUES (
        p_student_id, p_course_id, 1, v_avg_completion, v_completed_weeks, v_xp, v_coins, v_health, now()
    )
    ON CONFLICT (student_id, course_id, semester_number)
    DO UPDATE SET
        completion_percentage = EXCLUDED.completion_percentage,
        completed_weeks = EXCLUDED.completed_weeks,
        xp_earned = EXCLUDED.xp_earned,
        coins_earned = EXCLUDED.coins_earned,
        health_score = EXCLUDED.health_score,
        last_activity_at = now();
END;
$$ LANGUAGE plpgsql;


-- Function: Trigger to refresh progress on video progress changes
CREATE OR REPLACE FUNCTION public.trigger_refresh_progress_video()
RETURNS TRIGGER AS $$
DECLARE
    v_week INTEGER;
    v_student_id UUID;
    v_course_id UUID;
    v_video_id UUID;
BEGIN
    IF TG_OP = public.get_tg_op_delete() THEN
        v_student_id := OLD.student_id;
        v_course_id := OLD.course_id;
        v_video_id := OLD.video_id;
    ELSE
        v_student_id := NEW.student_id;
        v_course_id := NEW.course_id;
        v_video_id := NEW.video_id;
    END IF;

    SELECT week_number INTO v_week FROM public.videos WHERE id = v_video_id;
    IF v_week IS NOT NULL THEN
        PERFORM public.refresh_student_week_progress(v_student_id, v_course_id, v_week);
    END IF;
    
    IF TG_OP = public.get_tg_op_delete() THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_video_progress_ref ON public.video_progress;
CREATE TRIGGER on_video_progress_ref
    AFTER INSERT OR UPDATE OR DELETE ON public.video_progress
    FOR EACH ROW EXECUTE FUNCTION public.trigger_refresh_progress_video();


-- Function: Trigger to refresh progress on coding challenge changes
CREATE OR REPLACE FUNCTION public.trigger_refresh_progress_coding()
RETURNS TRIGGER AS $$
DECLARE
    v_week INTEGER;
    v_course_id UUID;
    v_challenge_id UUID;
    v_student_id UUID;
BEGIN
    IF TG_OP = public.get_tg_op_delete() THEN
        v_student_id := OLD.student_id;
        v_challenge_id := OLD.challenge_id;
    ELSE
        v_student_id := NEW.student_id;
        v_challenge_id := NEW.challenge_id;
    END IF;

    SELECT week_number, course_id INTO v_week, v_course_id FROM public.coding_challenges WHERE id = v_challenge_id;
    IF v_week IS NOT NULL AND v_course_id IS NOT NULL THEN
        PERFORM public.refresh_student_week_progress(v_student_id, v_course_id, v_week);
    END IF;
    
    IF TG_OP = public.get_tg_op_delete() THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_coding_submission_ref ON public.coding_submissions;
CREATE TRIGGER on_coding_submission_ref
    AFTER INSERT OR UPDATE OR DELETE ON public.coding_submissions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_refresh_progress_coding();


-- Function: Trigger to refresh progress on assessment changes
CREATE OR REPLACE FUNCTION public.trigger_refresh_progress_assessment()
RETURNS TRIGGER AS $$
DECLARE
    v_week INTEGER;
    v_course_id UUID;
    v_assessment_id UUID;
    v_student_id UUID;
BEGIN
    IF TG_OP = public.get_tg_op_delete() THEN
        v_student_id := OLD.student_id;
        v_assessment_id := OLD.assessment_id;
    ELSE
        v_student_id := NEW.student_id;
        v_assessment_id := NEW.assessment_id;
    END IF;

    SELECT week_number, course_id INTO v_week, v_course_id FROM public.assessments WHERE id = v_assessment_id;
    IF v_week IS NOT NULL AND v_course_id IS NOT NULL THEN
        PERFORM public.refresh_student_week_progress(v_student_id, v_course_id, v_week);
    END IF;
    
    IF TG_OP = public.get_tg_op_delete() THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_assessment_submission_ref ON public.assessment_submissions;
CREATE TRIGGER on_assessment_submission_ref
    AFTER INSERT OR UPDATE OR DELETE ON public.assessment_submissions
    FOR EACH ROW EXECUTE FUNCTION public.trigger_refresh_progress_assessment();
