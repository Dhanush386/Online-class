// ============================================================
// useLearningHealth — Calculates transparent health scores
//
// Formula:
//   healthScore = attendance×0.25 + quizAvg×0.30 + codingAvg×0.25 + progress×0.20
//
// Features:
// • Weighted formula (transparent to students)
// • Forgetting curve decay on mastery topics
// • Daily snapshot to learning_health_history
// • Weak topics detection
// • History for chart visualization
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const WEIGHTS = {
  attendance: 0.25,
  quiz: 0.3,
  coding: 0.25,
  progress: 0.2,
}

// Forgetting curve: score decays by decay_rate per day since last practice
function applyForgettingCurve(peakScore, daysSinceLastPractice, decayRate = 0.05) {
  const decayed = peakScore * Math.exp(-decayRate * daysSinceLastPractice)
  return Math.max(0, Math.round(decayed))
}

export default function useLearningHealth(courseId) {
  const { profile } = useAuth()
  const [healthScore, setHealthScore] = useState(0)
  const [breakdown, setBreakdown] = useState({ attendance: 0, quiz: 0, coding: 0, progress: 0 })
  const [history, setHistory] = useState([])
  const [weakTopics, setWeakTopics] = useState([])
  const [mastery, setMastery] = useState([])
  const [loading, setLoading] = useState(true)

  const calculateHealth = useCallback(async () => {
    if (!profile?.id || !courseId) return
    setLoading(true)

    try {
      // Parallel fetch all components
      const [
        { data: attendanceData },
        { data: quizData },
        { data: codingData },
        { data: progressData },
        { data: historyData },
        { data: masteryData },
      ] = await Promise.all([
        // Attendance: % of live classes attended
        supabase
          .from('live_attendance')
          .select('attendance_status, duration_seconds, video_id')
          .eq('student_id', profile.id),
        // Quiz: average score percentage
        supabase
          .from('assessment_submissions')
          .select('score, total_questions, assessment_id, assessments!inner(course_id)')
          .eq('student_id', profile.id)
          .eq('assessments.course_id', courseId),
        // Coding: % of challenges solved
        supabase
          .from('coding_submissions')
          .select('status, challenge_id, coding_challenges!inner(course_id)')
          .eq('student_id', profile.id)
          .eq('coding_challenges.course_id', courseId)
          .eq('status', 'accepted'),
        // Progress: week completion
        supabase
          .from('student_week_progress')
          .select('completion_percentage')
          .eq('student_id', profile.id)
          .eq('course_id', courseId),
        // History: last 14 days
        supabase
          .from('learning_health_history')
          .select('*')
          .eq('student_id', profile.id)
          .eq('course_id', courseId)
          .order('recorded_date', { ascending: false })
          .limit(14),
        // Mastery: all topics for this course
        supabase
          .from('learning_mastery')
          .select('*')
          .eq('student_id', profile.id)
          .eq('course_id', courseId),
      ])

      // Calculate attendance score (0-100)
      const totalClasses = (attendanceData || []).length
      const presentClasses = (attendanceData || []).filter(a =>
        a.attendance_status === 'present' && (a.duration_seconds || 0) > 300
      ).length
      const attendanceScore = totalClasses > 0
        ? Math.round((presentClasses / totalClasses) * 100)
        : 100 // no classes yet = perfect

      // Calculate quiz score (0-100): average percentage across all assessments
      const quizScores = (quizData || []).map(q =>
        q.total_questions > 0 ? Math.round((q.score / q.total_questions) * 100) : 0
      )
      const quizScore = quizScores.length > 0
        ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
        : 100

      // Calculate coding score (0-100): unique challenges solved / total
      const uniqueSolved = new Set((codingData || []).map(c => c.challenge_id)).size
      // Get total challenges for this course
      const { count: totalChallenges } = await supabase
        .from('coding_challenges')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId)
      const codingScore = totalChallenges > 0
        ? Math.round((uniqueSolved / totalChallenges) * 100)
        : 100

      // Calculate progress score (0-100): average week completion
      const weekPcts = (progressData || []).map(p => p.completion_percentage || 0)
      const progressScore = weekPcts.length > 0
        ? Math.round(weekPcts.reduce((a, b) => a + b, 0) / weekPcts.length)
        : 0

      // Weighted total
      const total = Math.round(
        attendanceScore * WEIGHTS.attendance +
        quizScore * WEIGHTS.quiz +
        codingScore * WEIGHTS.coding +
        progressScore * WEIGHTS.progress
      )

      const bd = {
        attendance: attendanceScore,
        quiz: quizScore,
        coding: codingScore,
        progress: progressScore,
      }

      setHealthScore(total)
      setBreakdown(bd)
      setHistory((historyData || []).reverse()) // oldest first for charts

      // Apply forgetting curve to mastery data
      const now = new Date()
      const adjustedMastery = (masteryData || []).map(m => {
        const daysSince = Math.max(0, (now - new Date(m.last_practiced)) / (1000 * 60 * 60 * 24))
        const effectiveScore = applyForgettingCurve(m.peak_score, daysSince, m.decay_rate || 0.05)
        return {
          ...m,
          effective_score: effectiveScore,
          days_since_practiced: Math.round(daysSince),
          needs_review: effectiveScore < m.peak_score * 0.7, // dropped >30% from peak
        }
      })

      setMastery(adjustedMastery)

      // Find weak topics (sorted by effective score ascending)
      const weak = adjustedMastery
        .filter(m => m.effective_score < 70 || m.needs_review)
        .sort((a, b) => a.effective_score - b.effective_score)
        .slice(0, 5)
      setWeakTopics(weak)

      // Save daily snapshot
      const today = new Date().toISOString().slice(0, 10)
      await supabase
        .from('learning_health_history')
        .upsert({
          student_id: profile.id,
          course_id: courseId,
          recorded_date: today,
          health_score: total,
          attendance_score: attendanceScore,
          quiz_score: quizScore,
          coding_score: codingScore,
          progress_score: progressScore,
          weak_topics: weak.map(w => w.topic),
        }, {
          onConflict: 'student_id,course_id,recorded_date',
        })
    } catch (err) {
      console.error('useLearningHealth: calculation failed:', err)
    } finally {
      setLoading(false)
    }
  }, [profile?.id, courseId])

  useEffect(() => {
    calculateHealth()
  }, [calculateHealth])

  return {
    healthScore,
    breakdown,
    history,
    weakTopics,
    mastery,
    loading,
    refreshHealth: calculateHealth,
    weights: WEIGHTS,
  }
}
