-- =============================================
-- LEARNOVA Learning Journey Engine
-- Migration: 20260627_learning_journey_engine.sql
--
-- This migration transforms Learnova from a flat
-- day-number system into a Course → Week → Day → Modules
-- learning engine with:
--   • DB-driven XP config (no redeployment)
--   • Calendar-based weekly schedule
--   • Ordered learning path modules
--   • Unified XP/coin events
--   • Per-week progress + grades
--   • Learning mastery tracking
--   • Health score history
--   • Daily goals
--   • Anti-cheat video progress
--   • Adaptive week unlock
-- =============================================

-- ============================================================
-- 1. XP_CONFIG — Admin-editable XP/coin values per event type
-- ============================================================
CREATE TABLE IF NOT EXISTS public.xp_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT UNIQUE NOT NULL,
    xp_amount INTEGER NOT NULL DEFAULT 0,
    coin_amount INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    description TEXT,
    -- Multiplier configuration
    streak_multiplier REAL DEFAULT 1.0,
    first_attempt_multiplier REAL DEFAULT 1.0,
    difficulty_multipliers JSONB DEFAULT '{"easy": 1.0, "medium": 1.3, "hard": 1.8}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default XP configuration
INSERT INTO public.xp_config (event_type, xp_amount, coin_amount, streak_multiplier, first_attempt_multiplier, description) VALUES
    ('live_class_full',      50, 10, 1.2, 1.0, 'Live class with ≥80% attendance duration'),
    ('live_class_partial',   10,  0, 1.0, 1.0, 'Live class with 30–79% attendance duration'),
    ('recorded_video',       30,  5, 1.0, 1.0, 'Recorded video watched ≥95% (anti-cheat verified)'),
    ('quiz_high',            25,  5, 1.1, 1.0, 'Quiz score 80–100%'),
    ('quiz_mid',             15,  2, 1.0, 1.0, 'Quiz score 50–79%'),
    ('quiz_low',              5,  0, 1.0, 1.0, 'Quiz score below 50%'),
    ('coding_solve',         50, 10, 1.2, 1.5, 'Coding challenge solved (accepted)'),
    ('coding_all_tests',     20,  5, 1.0, 1.0, 'All test cases passed on a challenge'),
    ('coding_first_attempt', 15,  3, 1.0, 1.0, 'Challenge solved on first submission'),
    ('daily_streak',         10,  2, 1.0, 1.0, 'Daily learning activity streak'),
    ('weekly_bonus',        100, 25, 1.0, 1.0, 'All required items in a week completed'),
    ('daily_goal',           20,  5, 1.0, 1.0, 'Daily goal completed'),
    ('attendance_badge',     10,  5, 1.0, 1.0, 'Consistent attendance achievement')
ON CONFLICT (event_type) DO NOTHING;


-- ============================================================
-- 2. WEEKLY_SCHEDULE — Central schedule node with real dates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weekly_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL DEFAULT 1,
    day_of_week INTEGER NOT NULL DEFAULT 1,  -- 1=Monday .. 7=Sunday
    schedule_date DATE,                       -- actual calendar date (e.g. 2026-07-28)
    start_time TIME,                          -- e.g. 10:00
    end_time TIME,                            -- e.g. 11:30
    title TEXT,                               -- e.g. "SQL Joins Deep Dive"
    description TEXT,
    is_live BOOLEAN DEFAULT false,            -- whether a live class is scheduled this slot
    is_revision BOOLEAN DEFAULT false,        -- true for Sunday revision slots
    unlock_date TIMESTAMPTZ,                  -- when students can access this day's content
    estimated_minutes INTEGER DEFAULT 60,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(course_id, week_number, day_of_week)
);


-- ============================================================
-- 3. LEARNING_PATH_MODULES — Ordered content per schedule day
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_path_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES public.weekly_schedule(id) ON DELETE CASCADE,
    module_type TEXT NOT NULL CHECK (module_type IN (
        'video', 'live_class', 'assessment', 'coding', 'resource', 'assignment', 'notes'
    )),
    reference_id UUID NOT NULL,               -- FK to the actual content row (video/assessment/etc.)
    module_order INTEGER NOT NULL DEFAULT 0,   -- for drag-and-drop reordering
    is_required BOOLEAN DEFAULT true,          -- required for week completion?
    xp_reward INTEGER DEFAULT 0,              -- override XP (0 = use xp_config default)
    coin_reward INTEGER DEFAULT 0,            -- override coins
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- 4. ADD COLUMNS TO EXISTING CONTENT TABLES
-- ============================================================

-- Videos
ALTER TABLE public.videos
    ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS day_of_week INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.weekly_schedule(id) ON DELETE SET NULL;

-- Assessments
ALTER TABLE public.assessments
    ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS day_of_week INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.weekly_schedule(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS topic TEXT;  -- for learning_mastery integration

-- Coding Challenges
ALTER TABLE public.coding_challenges
    ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS day_of_week INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.weekly_schedule(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS topic TEXT;  -- for learning_mastery integration

-- Course Resources
ALTER TABLE public.course_resources
    ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS day_of_week INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS schedule_id UUID REFERENCES public.weekly_schedule(id) ON DELETE SET NULL;


-- ============================================================
-- 5. BACKFILL day_number → week_number + day_of_week
-- ============================================================
UPDATE public.videos SET
    week_number = CEIL(COALESCE(day_number, 1)::NUMERIC / 7),
    day_of_week = ((COALESCE(day_number, 1) - 1) % 7) + 1
WHERE week_number = 1 AND day_of_week = 1 AND COALESCE(day_number, 1) > 1;

UPDATE public.assessments SET
    week_number = CEIL(COALESCE(day_number, 1)::NUMERIC / 7),
    day_of_week = ((COALESCE(day_number, 1) - 1) % 7) + 1
WHERE week_number = 1 AND day_of_week = 1 AND COALESCE(day_number, 1) > 1;

UPDATE public.coding_challenges SET
    week_number = CEIL(COALESCE(day_number, 1)::NUMERIC / 7),
    day_of_week = ((COALESCE(day_number, 1) - 1) % 7) + 1
WHERE week_number = 1 AND day_of_week = 1 AND COALESCE(day_number, 1) > 1;

-- course_resources may not have day_number — use default
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'course_resources' AND column_name = 'day_number'
    ) THEN
        EXECUTE '
            UPDATE public.course_resources SET
                week_number = CEIL(COALESCE(day_number, 1)::NUMERIC / 7),
                day_of_week = ((COALESCE(day_number, 1) - 1) % 7) + 1
            WHERE week_number = 1 AND day_of_week = 1 AND COALESCE(day_number, 1) > 1
        ';
    END IF;
END $$;


-- ============================================================
-- 6. COURSES — sequential_unlock toggle
-- ============================================================
ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS sequential_unlock BOOLEAN DEFAULT true;


-- ============================================================
-- 7. USERS — coins column
-- ============================================================
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;


-- ============================================================
-- 8. XP_EVENTS — single source of truth for all rewards
-- ============================================================
CREATE TABLE IF NOT EXISTS public.xp_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
    schedule_id UUID REFERENCES public.weekly_schedule(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    module_type TEXT,                -- 'video','quiz','coding','live_class','streak','weekly','daily_goal'
    reference_id UUID,              -- ID of the video/assessment/challenge
    xp_amount INTEGER NOT NULL DEFAULT 0,
    coin_amount INTEGER NOT NULL DEFAULT 0,
    badge_id UUID,                  -- optional: badge awarded with this event
    reason TEXT,                    -- human-readable: "SQL Joins Part 2 — Week 4 Monday"
    metadata JSONB DEFAULT '{}',    -- { score: 85, watched_pct: 97, multiplier: 1.5, tests_passed: 5 }
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, event_type, reference_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_xp_events_student ON public.xp_events (student_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_student_date ON public.xp_events (student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_xp_events_course ON public.xp_events (course_id);


-- ============================================================
-- 9. STUDENT_WEEK_PROGRESS — per-week tracking + grade
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_week_progress (
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    total_items INTEGER DEFAULT 0,
    completed_items INTEGER DEFAULT 0,
    completion_percentage INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    coins_earned INTEGER DEFAULT 0,
    grade TEXT DEFAULT 'F' CHECK (grade IN ('A+', 'A', 'B', 'C', 'D', 'F')),
    bonus_awarded BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (student_id, course_id, week_number)
);


-- ============================================================
-- 10. LEARNING_HEALTH_HISTORY — daily health scores for AI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_health_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
    health_score INTEGER DEFAULT 0 CHECK (health_score BETWEEN 0 AND 100),
    -- Component breakdown (transparent formula)
    attendance_score INTEGER DEFAULT 0,   -- 25% weight
    quiz_score INTEGER DEFAULT 0,         -- 30% weight
    coding_score INTEGER DEFAULT 0,       -- 25% weight
    progress_score INTEGER DEFAULT 0,     -- 20% weight
    -- AI insights
    weak_topics JSONB DEFAULT '[]',       -- ["SQL Joins", "Binary Trees"]
    ai_recommendation TEXT,
    UNIQUE(student_id, course_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_health_student_date
    ON public.learning_health_history (student_id, recorded_date DESC);


-- ============================================================
-- 11. LEARNING_MASTERY — per-topic mastery tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.learning_mastery (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    average_score INTEGER DEFAULT 0,
    mastery_level TEXT DEFAULT 'beginner'
        CHECK (mastery_level IN ('beginner', 'learning', 'proficient', 'mastered')),
    last_practiced TIMESTAMPTZ DEFAULT now(),
    -- For forgetting curve calculation
    peak_score INTEGER DEFAULT 0,         -- highest score ever achieved
    decay_rate REAL DEFAULT 0.05,         -- per-day decay factor
    UNIQUE(student_id, course_id, topic)
);


-- ============================================================
-- 12. DAILY_GOALS — daily activity targets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    goal_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_activities INTEGER DEFAULT 3,   -- e.g. complete 3 modules
    completed_activities INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    xp_awarded BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, goal_date)
);


-- ============================================================
-- 13. ENHANCED VIDEO_PROGRESS — anti-cheat fields
-- ============================================================
ALTER TABLE public.video_progress
    ADD COLUMN IF NOT EXISTS max_position REAL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS watched_percentage INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_watch_time INTEGER DEFAULT 0,  -- seconds actually spent watching
    ADD COLUMN IF NOT EXISTS max_playback_speed REAL DEFAULT 1.0, -- highest speed used
    ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;


-- ============================================================
-- 14. UPDATED calculate_student_xp() — reads from xp_events
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_student_xp(p_student_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(SUM(xp_amount), 0)::INTEGER
    FROM public.xp_events
    WHERE student_id = p_student_id;
$$;

-- Calculate total coins from xp_events
CREATE OR REPLACE FUNCTION public.calculate_student_coins(p_student_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(SUM(coin_amount), 0)::INTEGER
    FROM public.xp_events
    WHERE student_id = p_student_id;
$$;


-- ============================================================
-- 15. TRIGGER: xp_events → update users.xp + users.coins
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_sync_user_xp_coins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_student_id := OLD.student_id;
    ELSE
        v_student_id := NEW.student_id;
    END IF;

    UPDATE public.users
    SET xp = public.calculate_student_xp(v_student_id),
        coins = public.calculate_student_coins(v_student_id)
    WHERE id = v_student_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS on_xp_event_change ON public.xp_events;
CREATE TRIGGER on_xp_event_change
    AFTER INSERT OR UPDATE OR DELETE ON public.xp_events
    FOR EACH ROW EXECUTE FUNCTION public.trigger_sync_user_xp_coins();


-- ============================================================
-- 16. GRADE CALCULATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_week_grade(p_percentage INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_percentage >= 95 THEN RETURN 'A+';
    ELSIF p_percentage >= 85 THEN RETURN 'A';
    ELSIF p_percentage >= 70 THEN RETURN 'B';
    ELSIF p_percentage >= 55 THEN RETURN 'C';
    ELSIF p_percentage >= 40 THEN RETURN 'D';
    ELSE RETURN 'F';
    END IF;
END;
$$;


-- ============================================================
-- 17. MASTERY LEVEL CALCULATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_mastery_level(p_avg_score INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_avg_score >= 90 THEN RETURN 'mastered';
    ELSIF p_avg_score >= 70 THEN RETURN 'proficient';
    ELSIF p_avg_score >= 40 THEN RETURN 'learning';
    ELSE RETURN 'beginner';
    END IF;
END;
$$;


-- ============================================================
-- 18. BACKFILL xp_events FROM EXISTING DATA
-- ============================================================

-- 18a. Backfill from coding_submissions (accepted only, best score per challenge)
INSERT INTO public.xp_events (student_id, event_type, module_type, reference_id, xp_amount, reason, metadata, created_at)
SELECT
    cs.student_id,
    'coding_solve',
    'coding',
    cs.challenge_id,
    cs.max_score,
    'Backfill: coding challenge solved',
    jsonb_build_object('score', cs.max_score, 'backfill', true),
    cs.latest_at
FROM (
    SELECT
        student_id,
        challenge_id,
        MAX(score) as max_score,
        MAX(created_at) as latest_at
    FROM public.coding_submissions
    WHERE status = 'accepted'
    GROUP BY student_id, challenge_id
) cs
ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;

-- 18b. Backfill from assessment_submissions (best score per assessment)
INSERT INTO public.xp_events (student_id, event_type, module_type, reference_id, xp_amount, reason, metadata, created_at)
SELECT
    ass.student_id,
    CASE
        WHEN (ass.max_score::REAL / NULLIF(ass.total_q, 0) * 100) >= 80 THEN 'quiz_high'
        WHEN (ass.max_score::REAL / NULLIF(ass.total_q, 0) * 100) >= 50 THEN 'quiz_mid'
        ELSE 'quiz_low'
    END,
    'quiz',
    ass.assessment_id,
    ass.max_score,
    'Backfill: assessment completed',
    jsonb_build_object('score', ass.max_score, 'total_questions', ass.total_q, 'backfill', true),
    ass.latest_at
FROM (
    SELECT
        student_id,
        assessment_id,
        MAX(score) as max_score,
        MAX(total_questions) as total_q,
        MAX(created_at) as latest_at
    FROM public.assessment_submissions
    GROUP BY student_id, assessment_id
) ass
ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;

-- 18c. Backfill from live_attendance (present only)
INSERT INTO public.xp_events (student_id, event_type, module_type, reference_id, xp_amount, coin_amount, reason, metadata, created_at)
SELECT
    la.student_id,
    CASE
        WHEN la.duration_seconds >= 2400 THEN 'live_class_full'    -- ≥40 min (80% of 50min)
        WHEN la.duration_seconds >= 900  THEN 'live_class_partial' -- ≥15 min
        ELSE 'live_class_partial'
    END,
    'live_class',
    la.video_id,
    CASE
        WHEN la.duration_seconds >= 2400 THEN 50
        WHEN la.duration_seconds >= 900  THEN 10
        ELSE 0
    END,
    CASE WHEN la.duration_seconds >= 2400 THEN 10 ELSE 0 END,
    'Backfill: live class attendance',
    jsonb_build_object('duration_seconds', la.duration_seconds, 'status', la.attendance_status, 'backfill', true),
    la.joined_at
FROM public.live_attendance la
WHERE la.attendance_status = 'present'
ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;

-- 18d. Backfill from video_progress (watched videos → recorded_video XP)
INSERT INTO public.xp_events (student_id, event_type, module_type, reference_id, xp_amount, coin_amount, reason, metadata, created_at)
SELECT
    vp.student_id,
    'recorded_video',
    'video',
    vp.video_id,
    30,
    5,
    'Backfill: recorded video watched',
    jsonb_build_object('backfill', true),
    vp.watched_at
FROM public.video_progress vp
ON CONFLICT (student_id, event_type, reference_id) DO NOTHING;


-- ============================================================
-- 19. RESYNC users.xp and users.coins FROM xp_events
-- ============================================================
UPDATE public.users u
SET
    xp = COALESCE((SELECT SUM(xp_amount) FROM public.xp_events WHERE student_id = u.id), 0),
    coins = COALESCE((SELECT SUM(coin_amount) FROM public.xp_events WHERE student_id = u.id), 0)
WHERE u.role = 'student';


-- ============================================================
-- 20. ROW LEVEL SECURITY
-- ============================================================

-- xp_config: everyone reads, only organizers manage
ALTER TABLE public.xp_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read xp config" ON public.xp_config;
CREATE POLICY "Anyone can read xp config" ON public.xp_config FOR SELECT USING (true);
DROP POLICY IF EXISTS "Organizers can manage xp config" ON public.xp_config;
CREATE POLICY "Organizers can manage xp config" ON public.xp_config FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('organizer', 'main_admin'))
);

-- weekly_schedule: everyone reads, organizers manage
ALTER TABLE public.weekly_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view weekly schedule" ON public.weekly_schedule;
CREATE POLICY "Anyone can view weekly schedule" ON public.weekly_schedule FOR SELECT USING (true);
DROP POLICY IF EXISTS "Organizers can manage weekly schedule" ON public.weekly_schedule;
CREATE POLICY "Organizers can manage weekly schedule" ON public.weekly_schedule FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- learning_path_modules: everyone reads, organizers manage
ALTER TABLE public.learning_path_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view learning path" ON public.learning_path_modules;
CREATE POLICY "Anyone can view learning path" ON public.learning_path_modules FOR SELECT USING (true);
DROP POLICY IF EXISTS "Organizers can manage learning path" ON public.learning_path_modules;
CREATE POLICY "Organizers can manage learning path" ON public.learning_path_modules FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.weekly_schedule ws
        JOIN public.courses c ON c.id = ws.course_id
        WHERE ws.id = schedule_id AND c.organizer_id = auth.uid()
    )
);

-- xp_events: students see own, organizers see their courses
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can view own xp events" ON public.xp_events;
CREATE POLICY "Students can view own xp events" ON public.xp_events FOR SELECT USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Students can insert own xp events" ON public.xp_events;
CREATE POLICY "Students can insert own xp events" ON public.xp_events FOR INSERT WITH CHECK (auth.uid() = student_id);
DROP POLICY IF EXISTS "Organizers can view course xp events" ON public.xp_events;
CREATE POLICY "Organizers can view course xp events" ON public.xp_events FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- student_week_progress: students see own, organizers see courses
ALTER TABLE public.student_week_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can manage own week progress" ON public.student_week_progress;
CREATE POLICY "Students can manage own week progress" ON public.student_week_progress FOR ALL USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Organizers can view week progress" ON public.student_week_progress;
CREATE POLICY "Organizers can view week progress" ON public.student_week_progress FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- learning_health_history: students see own
ALTER TABLE public.learning_health_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can manage own health history" ON public.learning_health_history;
CREATE POLICY "Students can manage own health history" ON public.learning_health_history FOR ALL USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Organizers can view health history" ON public.learning_health_history;
CREATE POLICY "Organizers can view health history" ON public.learning_health_history FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- learning_mastery: students see own
ALTER TABLE public.learning_mastery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can manage own mastery" ON public.learning_mastery;
CREATE POLICY "Students can manage own mastery" ON public.learning_mastery FOR ALL USING (auth.uid() = student_id);
DROP POLICY IF EXISTS "Organizers can view mastery" ON public.learning_mastery;
CREATE POLICY "Organizers can view mastery" ON public.learning_mastery FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND organizer_id = auth.uid())
);

-- daily_goals: students manage own
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can manage own daily goals" ON public.daily_goals;
CREATE POLICY "Students can manage own daily goals" ON public.daily_goals FOR ALL USING (auth.uid() = student_id);
