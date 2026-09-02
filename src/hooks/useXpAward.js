// ============================================================
// useXpAward — Hook for awarding XP + coins with multipliers,
// toast notifications, and duplicate prevention.
// ============================================================

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { calculateReward, loadXpConfig } from '../constants/xpRewards'

export default function useXpAward() {
  const { profile, refreshStats } = useAuth()
  const [todaysXp, setTodaysXp] = useState([])
  const [toastMessage, setToastMessage] = useState(null)

  // Load today's XP events on mount
  useEffect(() => {
    if (!profile?.id) return
    loadTodaysXp()
  }, [profile?.id])

  const loadTodaysXp = useCallback(async () => {
    if (!profile?.id) return

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('xp_events')
      .select('*')
      .eq('student_id', profile.id)
      .gte('created_at', today.toISOString())
      .order('created_at', { ascending: false })

    setTodaysXp(data || [])
  }, [profile?.id])

  /**
   * Award XP to the current student.
   *
   * @param {object} params
   * @param {string} params.eventType      - e.g. 'coding_solve', 'recorded_video', 'quiz_high'
   * @param {string} params.referenceId    - ID of the video/assessment/challenge
   * @param {string} [params.courseId]      - associated course
   * @param {string} [params.scheduleId]   - associated weekly_schedule entry
   * @param {string} [params.moduleType]   - 'video','quiz','coding','live_class'
   * @param {string} [params.reason]       - human-readable reason string
   * @param {object} [params.metadata]     - extra data { score, watched_pct, etc. }
   * @param {boolean} [params.isFirstAttempt]
   * @param {number}  [params.streakDays]
   * @param {string}  [params.difficulty]  - 'easy' | 'medium' | 'hard'
   *
   * @returns {Promise<{ awarded: boolean, xp: number, coins: number, reason?: string }>}
   */
  const awardXp = useCallback(async (params) => {
    if (!profile?.id) return { awarded: false, reason: 'not_logged_in' }

    const {
      eventType,
      referenceId,
      courseId,
      scheduleId,
      moduleType,
      reason,
      metadata = {},
      isFirstAttempt = false,
      streakDays = 0,
      difficulty,
    } = params

    // Ensure XP config is loaded
    await loadXpConfig()

    // Calculate reward with multipliers
    const reward = calculateReward(eventType, {
      isFirstAttempt,
      streakDays,
      difficulty,
    })

    if (reward.xp === 0 && reward.coins === 0) {
      return { awarded: false, reason: 'zero_reward' }
    }

    // Build metadata with multiplier info
    const fullMetadata = {
      ...metadata,
      multipliers: reward.multiplierBreakdown,
      base_xp: reward.xp,
    }

    // Upsert into xp_events (unique constraint prevents duplicates)
    const { error } = await supabase
      .from('xp_events')
      .upsert({
        student_id: profile.id,
        event_type: eventType,
        reference_id: referenceId,
        course_id: courseId || null,
        schedule_id: scheduleId || null,
        module_type: moduleType || null,
        xp_amount: reward.xp,
        coin_amount: reward.coins,
        reason: reason || `${eventType} reward`,
        metadata: fullMetadata,
      }, {
        onConflict: 'student_id,event_type,reference_id',
        ignoreDuplicates: true,
      })

    if (error) {
      // Unique violation = already awarded
      if (error.code === '23505') {
        return { awarded: false, reason: 'duplicate' }
      }
      console.error('useXpAward: insert failed:', error)
      return { awarded: false, reason: error.message }
    }

    // Show toast
    showXpToast(reward.xp, reward.coins, reason, reward.multiplierBreakdown)

    // Refresh stats (AuthContext)
    if (refreshStats) {
      try { await refreshStats() } catch { /* silent */ }
    }

    // Update daily goal progress
    await updateDailyGoal()

    // Refresh today's timeline
    await loadTodaysXp()

    // Update learning mastery if this is a quiz/coding event
    if (metadata.topic && (moduleType === 'quiz' || moduleType === 'coding')) {
      await updateMastery(courseId, metadata.topic, metadata.score || reward.xp)
    }

    return { awarded: true, xp: reward.xp, coins: reward.coins }
  }, [profile?.id, refreshStats, loadTodaysXp])

  // Update learning_mastery for a topic
  const updateMastery = useCallback(async (courseId, topic, score) => {
    if (!profile?.id || !courseId || !topic) return

    // Fetch current mastery
    const { data: existing } = await supabase
      .from('learning_mastery')
      .select('*')
      .eq('student_id', profile.id)
      .eq('course_id', courseId)
      .eq('topic', topic)
      .single()

    if (existing) {
      const newAttempts = existing.attempts + 1
      const newTotalScore = existing.total_score + score
      const newAvg = Math.round(newTotalScore / newAttempts)

      await supabase
        .from('learning_mastery')
        .update({
          attempts: newAttempts,
          total_score: newTotalScore,
          average_score: newAvg,
          peak_score: Math.max(existing.peak_score, score),
          mastery_level: getMasteryLevel(newAvg),
          last_practiced: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('learning_mastery')
        .insert({
          student_id: profile.id,
          course_id: courseId,
          topic,
          attempts: 1,
          total_score: score,
          average_score: score,
          peak_score: score,
          mastery_level: getMasteryLevel(score),
          last_practiced: new Date().toISOString(),
        })
    }
  }, [profile?.id])

  // Update daily goal progress
  const updateDailyGoal = useCallback(async () => {
    if (!profile?.id) return

    const today = new Date().toISOString().slice(0, 10)

    // Get or create today's goal
    const { data: goal } = await supabase
      .from('daily_goals')
      .select('*')
      .eq('student_id', profile.id)
      .eq('goal_date', today)
      .single()

    if (goal) {
      const newCompleted = goal.completed_activities + 1
      const isCompleted = newCompleted >= goal.target_activities

      await supabase
        .from('daily_goals')
        .update({
          completed_activities: newCompleted,
          is_completed: isCompleted,
        })
        .eq('id', goal.id)

      // Award daily goal XP if just completed
      if (isCompleted && !goal.is_completed && !goal.xp_awarded) {
        // Recursive call — but with a different event_type so no infinite loop
        const reward = calculateReward('daily_goal', {})
        await supabase
          .from('xp_events')
          .upsert({
            student_id: profile.id,
            event_type: 'daily_goal',
            reference_id: goal.id,
            xp_amount: reward.xp,
            coin_amount: reward.coins,
            reason: `Daily goal completed (${today})`,
            metadata: { goal_date: today, target: goal.target_activities },
          }, {
            onConflict: 'student_id,event_type,reference_id',
            ignoreDuplicates: true,
          })

        await supabase
          .from('daily_goals')
          .update({ xp_awarded: true })
          .eq('id', goal.id)

        showXpToast(reward.xp, reward.coins, '🎯 Daily Goal Completed!', {})
      }
    } else {
      // Create today's goal
      await supabase
        .from('daily_goals')
        .insert({
          student_id: profile.id,
          goal_date: today,
          target_activities: 3,
          completed_activities: 1,
        })
    }
  }, [profile?.id])

  // Toast notification display
  const showXpToast = (xp, coins, reason, multipliers) => {
    const parts = []
    if (xp > 0) parts.push(`+${xp} XP`)
    if (coins > 0) parts.push(`+${coins} 🪙`)

    let multiplierText = ''
    if (multipliers.firstAttempt) multiplierText += ` (×${multipliers.firstAttempt} First Attempt!)`
    if (multipliers.streak) multiplierText += ` (×${multipliers.streak} Streak!)`
    if (multipliers.difficulty) multiplierText += ` (×${multipliers.difficulty} Difficulty)`

    setToastMessage({
      text: parts.join('  •  ') + multiplierText,
      reason,
      timestamp: Date.now(),
    })

    // Auto-clear after 4 seconds
    setTimeout(() => setToastMessage(null), 4000)
  }

  // XP timeline summary for today
  const xpTimeline = (() => {
    const total = todaysXp.reduce((sum, e) => sum + e.xp_amount, 0)
    const totalCoins = todaysXp.reduce((sum, e) => sum + e.coin_amount, 0)
    const breakdown = {}
    for (const e of todaysXp) {
      const key = e.module_type || e.event_type
      breakdown[key] = (breakdown[key] || 0) + e.xp_amount
    }
    return { total, totalCoins, breakdown, events: todaysXp }
  })()

  return {
    awardXp,
    todaysXp,
    xpTimeline,
    toastMessage,
    refreshTodaysXp: loadTodaysXp,
  }
}

function getMasteryLevel(avg) {
  if (avg >= 90) return 'mastered'
  if (avg >= 70) return 'proficient'
  if (avg >= 40) return 'learning'
  return 'beginner'
}
