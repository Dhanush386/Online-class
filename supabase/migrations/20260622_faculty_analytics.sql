-- Create a secure view for Course Analytics aggregation
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
                    (SELECT COUNT(*) FROM public.live_attendance WHERE course_id = c.id AND attendance_status = 'present') as present_count
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

-- Create view for At-Risk Students
CREATE OR REPLACE VIEW public.at_risk_students_view AS
SELECT
    ps.id AS session_id,
    ps.student_id,
    u.name AS student_name,
    ps.final_risk_score,
    a.course_id,
    a.title AS assessment_title,
    c.organizer_id,
    c.title AS course_title,
    ps.start_time AS created_at
FROM public.proctoring_sessions ps
JOIN public.users u ON ps.student_id = u.id
JOIN public.assessments a ON ps.assessment_id = a.id
JOIN public.courses c ON a.course_id = c.id
WHERE ps.final_risk_score >= 70;

-- Note: Views run with the permissions of the user invoking them, unless declared SECURITY DEFINER.
-- Since these views only SELECT, we must ensure users can only see their own course data via RLS on the underlying tables, 
-- OR we can filter it directly in the React query (`.eq('organizer_id', profile.id)`).
