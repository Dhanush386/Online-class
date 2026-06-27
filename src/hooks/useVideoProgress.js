// ============================================================
// useVideoProgress — Anti-cheat video progress tracking
//
// Features:
// • Blocks seeking beyond maxPosition (watched frontier)
// • Tracks total_watch_time (actual time spent watching)
// • Detects playback speed > 2x (reduces XP)
// • Awards XP only when watched_percentage >= 95%
//   AND total_watch_time >= 80% of video duration
// • Persists to video_progress every 10s
// ============================================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PERSIST_INTERVAL_MS = 10000   // save every 10 seconds
const SEEK_TOLERANCE = 3            // allow 3s forward tolerance (normal playback buffer)
const COMPLETION_THRESHOLD = 95     // % of video that must be watched
const MIN_WATCH_TIME_RATIO = 0.8    // must spend at least 80% of video duration watching
const MAX_ALLOWED_SPEED = 2.0       // max playback speed for full XP
const SPEED_PENALTY_FACTOR = 0.5    // reduce XP by 50% if speed exceeded 2x

export default function useVideoProgress(videoId, durationSeconds) {
  const { profile } = useAuth()
  const [maxPosition, setMaxPosition] = useState(0)
  const [watchedPercentage, setWatchedPercentage] = useState(0)
  const [totalWatchTime, setTotalWatchTime] = useState(0)
  const [maxPlaybackSpeed, setMaxPlaybackSpeed] = useState(1.0)
  const [isComplete, setIsComplete] = useState(false)

  const lastSaveRef = useRef(0)
  const lastTickRef = useRef(Date.now())
  const maxPosRef = useRef(0)
  const totalTimeRef = useRef(0)
  const maxSpeedRef = useRef(1.0)

  // Load existing progress on mount
  useEffect(() => {
    if (!videoId || !profile?.id) return

    async function load() {
      const { data } = await supabase
        .from('video_progress')
        .select('max_position, watched_percentage, total_watch_time, max_playback_speed, completed')
        .eq('video_id', videoId)
        .eq('student_id', profile.id)
        .single()

      if (data) {
        setMaxPosition(data.max_position || 0)
        maxPosRef.current = data.max_position || 0
        setWatchedPercentage(data.watched_percentage || 0)
        setTotalWatchTime(data.total_watch_time || 0)
        totalTimeRef.current = data.total_watch_time || 0
        setMaxPlaybackSpeed(data.max_playback_speed || 1.0)
        maxSpeedRef.current = data.max_playback_speed || 1.0
        setIsComplete(data.completed || false)
      }
    }
    load()
  }, [videoId, profile?.id])

  /**
   * Called by ReactPlayer's onProgress callback.
   * @param {{ playedSeconds: number, played: number }} state
   * @param {number} [playbackRate] - current playback speed
   */
  const onProgress = useCallback((state, playbackRate = 1.0) => {
    if (!durationSeconds || durationSeconds <= 0) return

    const currentPos = state.playedSeconds || 0
    const now = Date.now()
    const elapsed = (now - lastTickRef.current) / 1000
    lastTickRef.current = now

    // Track playback speed
    if (playbackRate > maxSpeedRef.current) {
      maxSpeedRef.current = playbackRate
      setMaxPlaybackSpeed(playbackRate)
    }

    // Only advance maxPosition if player is near the frontier
    // This prevents seek-ahead from counting as watched
    if (currentPos <= maxPosRef.current + SEEK_TOLERANCE) {
      if (currentPos > maxPosRef.current) {
        maxPosRef.current = currentPos
        setMaxPosition(currentPos)
      }

      // Only count watch time when playing normally (near frontier)
      if (elapsed > 0 && elapsed < 5) { // ignore huge gaps (tab switch, pause)
        totalTimeRef.current += elapsed
        setTotalWatchTime(Math.round(totalTimeRef.current))
      }
    }
    // If currentPos is far ahead of maxPosition, player tried to seek ahead — ignore it

    // Calculate watched percentage
    const pct = Math.min(100, Math.round((maxPosRef.current / durationSeconds) * 100))
    setWatchedPercentage(pct)

    // Check completion
    const watchTimeOk = totalTimeRef.current >= durationSeconds * MIN_WATCH_TIME_RATIO
    const pctOk = pct >= COMPLETION_THRESHOLD

    if (pctOk && watchTimeOk) {
      setIsComplete(true)
    }

    // Persist periodically
    if (now - lastSaveRef.current > PERSIST_INTERVAL_MS) {
      lastSaveRef.current = now
      persistProgress(pct, pctOk && watchTimeOk)
    }
  }, [durationSeconds, videoId, profile?.id])

  /**
   * Called when user attempts to seek.
   * Returns the clamped position (prevents seeking beyond maxPosition).
   * @param {number} seekTarget - where the user wants to seek to
   * @returns {number} - allowed position
   */
  const onSeek = useCallback((seekTarget) => {
    // Allow seeking backward (re-watching is fine)
    if (seekTarget <= maxPosRef.current) return seekTarget

    // Block seeking forward beyond watched portion + small tolerance
    const allowed = maxPosRef.current + SEEK_TOLERANCE
    return Math.min(seekTarget, allowed)
  }, [])

  /**
   * Whether XP can be awarded for this video.
   */
  const canAwardXp = isComplete

  /**
   * Whether speed penalty applies (used > 2x speed).
   */
  const hasSpeedPenalty = maxPlaybackSpeed > MAX_ALLOWED_SPEED

  /**
   * Speed penalty multiplier for XP calculation.
   */
  const speedMultiplier = hasSpeedPenalty ? SPEED_PENALTY_FACTOR : 1.0

  // Persist to database
  const persistProgress = useCallback(async (pct, completed) => {
    if (!videoId || !profile?.id) return

    await supabase
      .from('video_progress')
      .upsert({
        video_id: videoId,
        student_id: profile.id,
        max_position: Math.round(maxPosRef.current),
        watched_percentage: pct,
        total_watch_time: Math.round(totalTimeRef.current),
        max_playback_speed: maxSpeedRef.current,
        completed: completed || false,
        watched_at: new Date().toISOString(),
      }, {
        onConflict: 'video_id,student_id',
      })
  }, [videoId, profile?.id])

  // Final save on unmount
  useEffect(() => {
    return () => {
      if (videoId && profile?.id) {
        const pct = durationSeconds > 0
          ? Math.min(100, Math.round((maxPosRef.current / durationSeconds) * 100))
          : 0
        const complete = pct >= COMPLETION_THRESHOLD &&
          totalTimeRef.current >= (durationSeconds || 0) * MIN_WATCH_TIME_RATIO
        persistProgress(pct, complete)
      }
    }
  }, [videoId, profile?.id, durationSeconds, persistProgress])

  return {
    onProgress,
    onSeek,
    maxPosition,
    watchedPercentage,
    totalWatchTime,
    maxPlaybackSpeed,
    isComplete,
    canAwardXp,
    hasSpeedPenalty,
    speedMultiplier,
    persistProgress,
  }
}
