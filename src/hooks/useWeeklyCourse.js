// ============================================================
// useWeeklyCourse — Hook for Course → Week → Day → Module structure
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { getEffectiveStartDate, getCourseWeekScheduleDate } from '../utils/dayAccessEngine'

const GRADE_THRESHOLDS = { 95: 'A+', 85: 'A', 70: 'B', 55: 'C', 40: 'D' }

function calculateGrade(pct) {
  for (const [threshold, grade] of Object.entries(GRADE_THRESHOLDS).sort((a, b) => b[0] - a[0])) {
    if (pct >= Number(threshold)) return grade
  }
  return 'F'
}

function buildWeeksFromSchedule(weeksMap, schedule, modules) {
  for (const s of schedule) {
    if (!weeksMap[s.week_number]) {
      weeksMap[s.week_number] = {
        weekNum: s.week_number,
        days: {},
      }
    }
    weeksMap[s.week_number].days[s.day_of_week] = {
      dayOfWeek: s.day_of_week,
      scheduleId: s.id,
      scheduleDate: s.schedule_date,
      startTime: s.start_time,
      endTime: s.end_time,
      title: s.title,
      description: s.description,
      isLive: s.is_live,
      isRevision: s.is_revision || s.day_of_week === 7,
      unlockDate: s.unlock_date,
      estimatedMinutes: s.estimated_minutes,
      modules: modules
        .filter(m => m.schedule_id === s.id)
        .sort((a, b) => a.module_order - b.module_order),
    }
  }
}

function buildWeeksFromContent(weeksMap, allContent) {
  for (const item of allContent) {
    const wk = item.week_number || Math.ceil((item.day_number || 1) / 7)
    const dow = item.day_of_week || (((item.day_number || 1) - 1) % 7) + 1

    if (!weeksMap[wk]) {
      weeksMap[wk] = { weekNum: wk, days: {} }
    }
    if (!weeksMap[wk].days[dow]) {
      weeksMap[wk].days[dow] = {
        dayOfWeek: dow,
        scheduleId: null,
        scheduleDate: null,
        startTime: null,
        endTime: null,
        title: null,
        description: null,
        isLive: false,
        isRevision: dow === 7,
        unlockDate: null,
        estimatedMinutes: 60,
        modules: [],
      }
    }

    // Only add content if not already in modules via learning_path_modules
    const existingIds = weeksMap[wk].days[dow].modules.map(m => m.reference_id)
    if (!existingIds.includes(item._refId)) {
      weeksMap[wk].days[dow].modules.push({
        id: `auto-${item._refId}`,
        module_type: item._type,
        reference_id: item._refId,
        module_order: weeksMap[wk].days[dow].modules.length,
        is_required: true,
        _content: item, // attach original content for rendering
      })
    }
  }
}

function fillMissingDays(weeksMap) {
  for (const weekNum of Object.keys(weeksMap)) {
    for (let d = 1; d <= 7; d++) {
      if (!weeksMap[weekNum].days[d]) {
        weeksMap[weekNum].days[d] = {
          dayOfWeek: d,
          scheduleId: null,
          scheduleDate: null,
          startTime: null,
          endTime: null,
          title: null,
          description: null,
          isLive: false,
          isRevision: d === 7,
          unlockDate: null,
          estimatedMinutes: 0,
          modules: [],
        }
      }
    }
  }
}

function ensureTwelveWeeks(weeksMap, totalWeeks = 12) {
  for (let w = 1; w <= totalWeeks; w++) {
    if (!weeksMap[w]) {
      weeksMap[w] = { weekNum: w, days: {} }
    }
    for (let d = 1; d <= 7; d++) {
      if (!weeksMap[w].days[d]) {
        weeksMap[w].days[d] = {
          dayOfWeek: d,
          scheduleId: null,
          scheduleDate: null,
          startTime: null,
          endTime: null,
          title: null,
          description: null,
          isLive: false,
          isRevision: d === 7,
          unlockDate: null,
          estimatedMinutes: 0,
          modules: [],
        }
      }
    }
  }
}

function getSessionType(s) {
  if (s.is_recorded) return 'video'
  if (s.video_url) return 'video'
  return 'live_class'
}

export default function useWeeklyCourse(courseId, initialEnrollmentDate = null) {
  const { profile } = useAuth()
  const [weeks, setWeeks] = useState([])
  const [weekProgress, setWeekProgress] = useState({})
  const [courseSettings, setCourseSettings] = useState({ sequential_unlock: true })
  const [enrolledDate, setEnrolledDate] = useState(initialEnrollmentDate || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (initialEnrollmentDate) {
      setEnrolledDate(initialEnrollmentDate)
    }
  }, [initialEnrollmentDate])

  // Load course structure + progress
  const loadCourse = useCallback(async () => {
    if (!courseId || !profile?.id) return
    setLoading(true)

    try {
      // Parallel fetch: schedule, modules, progress, course settings, content, enrollment
      const [
        { data: scheduleData },
        { data: modulesData },
        { data: progressData },
        { data: courseData },
        { data: sessions },
        { data: challenges },
        { data: assessments },
        { data: resources },
        { data: enrollData },
      ] = await Promise.all([
        supabase
          .from('weekly_schedule')
          .select('*')
          .eq('course_id', courseId)
          .order('week_number', { ascending: true })
          .order('day_of_week', { ascending: true }),
        supabase
          .from('learning_path_modules')
          .select('*, weekly_schedule!inner(course_id)')
          .eq('weekly_schedule.course_id', courseId)
          .order('module_order', { ascending: true }),
        supabase
          .from('student_week_progress')
          .select('*')
          .eq('student_id', profile.id)
          .eq('course_id', courseId),
        supabase
          .from('courses')
          .select('sequential_unlock, start_date, end_date, duration_weeks')
          .eq('id', courseId)
          .single(),
        supabase
          .from('videos')
          .select('id, title, week_number, day_of_week, schedule_id, scheduled_time, duration_minutes, video_url')
          .eq('course_id', courseId)
          .order('week_number', { ascending: true })
          .order('day_of_week', { ascending: true }),
        supabase
          .from('coding_challenges')
          .select('id, title, week_number, day_of_week, schedule_id, difficulty, xp_reward, language, topic')
          .eq('course_id', courseId)
          .order('week_number', { ascending: true })
          .order('day_of_week', { ascending: true }),
        supabase
          .from('assessments')
          .select('id, title, week_number, day_of_week, schedule_id, type, topic')
          .eq('course_id', courseId)
          .order('week_number', { ascending: true })
          .order('day_of_week', { ascending: true }),
        supabase
          .from('course_resources')
          .select('id, title, week_number, day_of_week, schedule_id, resource_type, file_url')
          .eq('course_id', courseId)
          .order('week_number', { ascending: true })
          .order('day_of_week', { ascending: true }),
        supabase
          .from('enrollments')
          .select('enrolled_at')
          .eq('student_id', profile.id)
          .eq('course_id', courseId)
          .maybeSingle(),
      ])

      if (enrollData?.enrolled_at) {
        setEnrolledDate(enrollData.enrolled_at)
      }

      setCourseSettings({
        sequential_unlock: courseData?.sequential_unlock ?? true,
        start_date: courseData?.start_date,
        end_date: courseData?.end_date,
      })

      // Build progress map
      const progressMap = {}
      for (const p of (progressData || [])) {
        progressMap[p.week_number] = p
      }
      setWeekProgress(progressMap)

      // If we have weekly_schedule data, use the structured approach
      const schedule = scheduleData || []
      const modules = modulesData || []

      // Build weeks from schedule if available, otherwise from content
      let weeksMap = {}

      if (schedule.length > 0) {
        buildWeeksFromSchedule(weeksMap, schedule, modules)
      }

      // Also build from content tables (for backward compatibility / unscheduled content)
      const allContent = [
        ...(sessions || []).map(s => ({
          ...s,
          _type: getSessionType(s),
          _refId: s.id,
        })),
        ...(challenges || []).map(c => ({ ...c, _type: 'coding', _refId: c.id })),
        ...(assessments || []).map(a => ({ ...a, _type: 'assessment', _refId: a.id })),
        ...(resources || []).map(r => ({ ...r, _type: 'resource', _refId: r.id })),
      ]

      buildWeeksFromContent(weeksMap, allContent)
      fillMissingDays(weeksMap)
      ensureTwelveWeeks(weeksMap, courseData?.duration_weeks || 12)

      // Convert to sorted array
      const weeksArr = Object.values(weeksMap)
        .sort((a, b) => a.weekNum - b.weekNum)
        .map(w => ({
          ...w,
          days: Object.values(w.days).sort((a, b) => a.dayOfWeek - b.dayOfWeek),
        }))

      setWeeks(weeksArr)
    } catch (err) {
      console.error('useWeeklyCourse: failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [courseId, profile?.id])

  useEffect(() => {
    loadCourse()
  }, [loadCourse])

  // Determine current week based on 6 PM joining cutoff and completed progress (highest completed + 1)
  const currentWeek = (() => {
    let dateWeek = 1
    const baseDate = courseSettings.start_date || enrolledDate || initialEnrollmentDate || profile?.created_at
    if (baseDate) {
      const effectiveStart = getEffectiveStartDate(baseDate)
      const now = new Date()
      const diffDays = Math.floor((now - effectiveStart) / (1000 * 60 * 60 * 24))
      dateWeek = Math.max(1, Math.min(12, Math.ceil((diffDays + 1) / 7)))
    }

    let highestCompleted = 0
    Object.entries(weekProgress).forEach(([wkStr, p]) => {
      const wkNum = Number(wkStr)
      if (p && p.completion_percentage >= 100) {
        highestCompleted = Math.max(highestCompleted, wkNum)
      }
    })

    return Math.max(dateWeek, highestCompleted + 1)
  })()

  // Check if a week is locked (adaptive unlock: ≥70% avg required)
  const isWeekLocked = useCallback((weekNum) => {
    if (!courseSettings.sequential_unlock) return false
    if (weekNum <= 1) return false

    const prevProgress = weekProgress[weekNum - 1]
    if (!prevProgress) return true
    return prevProgress.completion_percentage < 70
  }, [courseSettings.sequential_unlock, weekProgress])

  // Get modules for a specific day
  const getDayModules = useCallback((weekNum, dayOfWeek) => {
    const week = weeks.find(w => w.weekNum === weekNum)
    if (!week) return []
    const day = week.days.find(d => d.dayOfWeek === dayOfWeek)
    return day?.modules || []
  }, [weeks])

  // Get pending (incomplete) items for a week
  const pendingForWeek = useCallback((weekNum) => {
    const week = weeks.find(w => w.weekNum === weekNum)
    if (!week) return []
    return week.days.flatMap(d =>
      d.modules.filter(m => m.is_required && !m._completed)
    )
  }, [weeks])

  // Get grade for a week
  const getWeekGrade = useCallback((weekNum) => {
    const progress = weekProgress[weekNum]
    if (!progress) return null
    return progress.grade || calculateGrade(progress.completion_percentage)
  }, [weekProgress])

  // Calculate schedule date for a week+day continuing for 12 weeks with 6 PM joining rule
  const getScheduleDate = useCallback((weekNum, dayOfWeek) => {
    const baseDate = courseSettings.start_date || enrolledDate || initialEnrollmentDate || profile?.created_at || new Date()
    return getCourseWeekScheduleDate(baseDate, weekNum, dayOfWeek)
  }, [courseSettings.start_date, enrolledDate, initialEnrollmentDate, profile?.created_at])

  return {
    weeks,
    currentWeek,
    weekProgress,
    courseSettings,
    loading,
    isWeekLocked,
    getDayModules,
    pendingForWeek,
    getWeekGrade,
    getScheduleDate,
    refreshProgress: loadCourse,
  }
}
