import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Fetches enrolled courses for a student.
 * Deduplicates and filters out not-yet-started courses.
 *
 * @param {string|null} studentId
 */
export function useCourses(studentId) {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!studentId) return

    setLoading(true)
    supabase
      .from('enrollments')
      .select('course_id, courses(id, title, description, created_at)')
      .eq('student_id', studentId)
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }

        // Deduplicate and filter not-yet-started courses
        const seen = new Set()
        const unique = (data || []).filter(e => {
          if (!e.courses) return false
          if (seen.has(e.course_id)) return false
          seen.add(e.course_id)
          return true
        })

        setCourses(unique.map(e => e.courses))
        setLoading(false)
      })
  }, [studentId])

  return { courses, loading, error }
}
