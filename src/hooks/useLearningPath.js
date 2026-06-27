// ============================================================
// useLearningPath — Manages learning_path_modules CRUD
// Used by organizer pages to link content to schedule days
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function useLearningPath(scheduleId) {
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(false)

  const loadModules = useCallback(async () => {
    if (!scheduleId) return
    setLoading(true)
    const { data } = await supabase
      .from('learning_path_modules')
      .select('*')
      .eq('schedule_id', scheduleId)
      .order('module_order', { ascending: true })
    setModules(data || [])
    setLoading(false)
  }, [scheduleId])

  useEffect(() => {
    loadModules()
  }, [loadModules])

  const addModule = useCallback(async ({ moduleType, referenceId, isRequired = true, xpReward = 0, coinReward = 0 }) => {
    if (!scheduleId) return null

    const nextOrder = modules.length
    const { data, error } = await supabase
      .from('learning_path_modules')
      .insert({
        schedule_id: scheduleId,
        module_type: moduleType,
        reference_id: referenceId,
        module_order: nextOrder,
        is_required: isRequired,
        xp_reward: xpReward,
        coin_reward: coinReward,
      })
      .select()
      .single()

    if (error) {
      console.error('useLearningPath: addModule failed:', error)
      return null
    }

    setModules(prev => [...prev, data])
    return data
  }, [scheduleId, modules.length])

  const removeModule = useCallback(async (moduleId) => {
    const { error } = await supabase
      .from('learning_path_modules')
      .delete()
      .eq('id', moduleId)

    if (!error) {
      setModules(prev => prev.filter(m => m.id !== moduleId))
    }
  }, [])

  const reorderModules = useCallback(async (orderedIds) => {
    // Update module_order for each id
    const updates = orderedIds.map((id, idx) => ({ id, module_order: idx }))

    for (const { id, module_order } of updates) {
      await supabase
        .from('learning_path_modules')
        .update({ module_order })
        .eq('id', id)
    }

    setModules(prev => {
      const byId = {}
      prev.forEach(m => { byId[m.id] = m })
      return orderedIds.map((id, idx) => ({ ...byId[id], module_order: idx }))
    })
  }, [])

  /**
   * Ensure a schedule entry exists for a given course/week/day,
   * then add a module to it. Used by organizer content forms.
   */
  const ensureScheduleAndAddModule = useCallback(async ({
    courseId, weekNumber, dayOfWeek, moduleType, referenceId, title,
  }) => {
    // Check if weekly_schedule entry exists
    let { data: existing } = await supabase
      .from('weekly_schedule')
      .select('id')
      .eq('course_id', courseId)
      .eq('week_number', weekNumber)
      .eq('day_of_week', dayOfWeek)
      .single()

    let scheduleEntryId = existing?.id

    if (!scheduleEntryId) {
      // Create the schedule entry
      const { data: newEntry, error } = await supabase
        .from('weekly_schedule')
        .insert({
          course_id: courseId,
          week_number: weekNumber,
          day_of_week: dayOfWeek,
          title: title || null,
          is_revision: dayOfWeek === 7,
        })
        .select('id')
        .single()

      if (error) {
        console.error('useLearningPath: failed to create schedule entry:', error)
        return null
      }
      scheduleEntryId = newEntry.id
    }

    // Now add the module
    const { data: mod } = await supabase
      .from('learning_path_modules')
      .insert({
        schedule_id: scheduleEntryId,
        module_type: moduleType,
        reference_id: referenceId,
        module_order: 0,
        is_required: true,
      })
      .select()
      .single()

    return { scheduleId: scheduleEntryId, module: mod }
  }, [])

  return {
    modules,
    loading,
    addModule,
    removeModule,
    reorderModules,
    ensureScheduleAndAddModule,
    refreshModules: loadModules,
  }
}
