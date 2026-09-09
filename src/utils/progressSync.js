import { supabase } from '../lib/supabase'

/**
 * Calculates the unified completion percentage for a course.
 * Every curriculum task (video/session, coding challenge, assessment) counts towards 100%.
 */
export function calculateCourseProgress(vids = [], chls = [], assessData = [], vpData = [], codingSubsData = [], subData = []) {
    const totalSessions = (vids || []).length
    const totalCoding = (chls || []).length
    const totalAssessments = (assessData || []).length

    const completedSessions = (vids || []).filter(v => (vpData || []).some(vp => vp.video_id === v.id)).length
    const completedCoding = (chls || []).filter(c => (codingSubsData || []).some(s => s.challenge_id === c.id && s.status === 'accepted')).length
    const completedAssess = (assessData || []).filter(a => (subData || []).some(s => s.assessment_id === a.id)).length

    const totalTopics = totalSessions + totalCoding + totalAssessments
    const completedTopics = completedSessions + completedCoding + completedAssess

    const percentage = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0

    return {
        percentage,
        totalTopics,
        completedTopics,
        totalSessions,
        completedSessions,
        totalCoding,
        completedCoding,
        totalAssessments,
        completedAssess
    }
}

/**
 * Robustly syncs the completion percentage to public.progress in Supabase.
 * Tries UPDATE first to avoid constraint/onConflict errors, then UPSERT, then INSERT fallback.
 */
export async function saveProgressRecord(studentId, courseId, percentage) {
    if (!studentId || !courseId) return

    try {
        // 1. Try update first (works immediately when row exists, without requiring a UNIQUE constraint)
        let { data: updated, error: updateErr } = await supabase
            .from('progress')
            .update({
                completion_percentage: percentage,
                last_updated: new Date().toISOString()
            })
            .eq('student_id', studentId)
            .eq('course_id', courseId)
            .select()

        // If 'last_updated' column is missing in older DB schemas, retry without it
        if (updateErr && updateErr.message?.includes('last_updated')) {
            const retry = await supabase
                .from('progress')
                .update({ completion_percentage: percentage })
                .eq('student_id', studentId)
                .eq('course_id', courseId)
                .select()
            updated = retry.data
            updateErr = retry.error
        }

        if (!updateErr && updated && updated.length > 0) {
            return
        }

        // 2. If update didn't affect any rows, try upsert
        const { error: upsertErr } = await supabase
            .from('progress')
            .upsert({
                student_id: studentId,
                course_id: courseId,
                completion_percentage: percentage,
                last_updated: new Date().toISOString()
            }, { onConflict: 'student_id,course_id' })

        if (!upsertErr) return

        // 3. Fallback: plain insert if upsert failed
        const { error: insertErr } = await supabase
            .from('progress')
            .insert({
                student_id: studentId,
                course_id: courseId,
                completion_percentage: percentage,
                last_updated: new Date().toISOString()
            })

        if (insertErr && insertErr.message?.includes('last_updated')) {
            await supabase
                .from('progress')
                .insert({
                    student_id: studentId,
                    course_id: courseId,
                    completion_percentage: percentage
                })
        }
    } catch (err) {
        console.error('Error saving progress record:', err)
    }
}
