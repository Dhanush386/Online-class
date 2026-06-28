// ============================================================
// XP Rewards Configuration — Client-side mirror of xp_config
// Fetches from Supabase, caches in sessionStorage.
// Falls back to hardcoded defaults if offline.
// ============================================================

import { supabase } from '../lib/supabase'

const CACHE_KEY = 'learnova-xp-config'
const CACHE_DURATION_MS = 30 * 60 * 1000 // 30 minutes

// Hardcoded fallbacks (matches seed data in migration)
const DEFAULTS = {
  live_class_full:      { xp: 50,  coins: 10, streak_multiplier: 1.2, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  live_class_partial:   { xp: 10,  coins: 0,  streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  recorded_video:       { xp: 30,  coins: 5,  streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  quiz_high:            { xp: 25,  coins: 5,  streak_multiplier: 1.1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  quiz_mid:             { xp: 15,  coins: 2,  streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  quiz_low:             { xp: 5,   coins: 0,  streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  coding_solve:         { xp: 50,  coins: 10, streak_multiplier: 1.2, first_attempt_multiplier: 1.5, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  coding_all_tests:     { xp: 20,  coins: 5,  streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  coding_first_attempt: { xp: 15,  coins: 3,  streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  daily_streak:         { xp: 10,  coins: 2,  streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  weekly_bonus:         { xp: 100, coins: 25, streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  daily_goal:           { xp: 20,  coins: 5,  streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
  attendance_badge:     { xp: 25,  coins: 5,  streak_multiplier: 1, first_attempt_multiplier: 1, difficulty_multipliers: { easy: 1, medium: 1.3, hard: 1.8 } },
}

let _configCache = null
let _cacheTimestamp = 0

/**
 * Load XP config from Supabase (or cache).
 * Call this once on app init (e.g. in AuthContext).
 */
export async function loadXpConfig() {
  // Check memory cache
  if (_configCache && Date.now() - _cacheTimestamp < CACHE_DURATION_MS) {
    return _configCache
  }

  // Check sessionStorage cache
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      if (Date.now() - timestamp < CACHE_DURATION_MS) {
        _configCache = data
        _cacheTimestamp = timestamp
        return data
      }
    }
  } catch { /* ignore parse errors */ }

  // Fetch from Supabase
  try {
    const { data, error } = await supabase
      .from('xp_config')
      .select('*')
      .eq('enabled', true)

    if (error) throw error

    const config = {}
    for (const row of (data || [])) {
      config[row.event_type] = {
        xp: row.xp_amount,
        coins: row.coin_amount,
        streak_multiplier: row.streak_multiplier || 1.0,
        first_attempt_multiplier: row.first_attempt_multiplier || 1.0,
        difficulty_multipliers: row.difficulty_multipliers || { easy: 1, medium: 1.3, hard: 1.8 },
      }
    }

    _configCache = config
    _cacheTimestamp = Date.now()

    // Persist to sessionStorage
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: config, timestamp: _cacheTimestamp }))
    } catch { /* storage full — ignore */ }

    return config
  } catch (err) {
    console.warn('Failed to load xp_config from Supabase, using defaults:', err.message)
    _configCache = DEFAULTS
    _cacheTimestamp = Date.now()
    return DEFAULTS
  }
}

/**
 * Get the base XP amount for an event type.
 */
export function getXpAmount(eventType) {
  const config = _configCache || DEFAULTS
  return config[eventType]?.xp ?? 0
}

/**
 * Get the base coin amount for an event type.
 */
export function getCoinAmount(eventType) {
  const config = _configCache || DEFAULTS
  return config[eventType]?.coins ?? 0
}

/**
 * Calculate the final XP with multipliers applied.
 * @param {string} eventType - e.g. 'coding_solve'
 * @param {object} opts
 * @param {boolean} [opts.isFirstAttempt] - first attempt bonus
 * @param {number}  [opts.streakDays] - current streak length (multiplier if > 3)
 * @param {string}  [opts.difficulty] - 'easy' | 'medium' | 'hard'
 * @returns {{ xp: number, coins: number, multiplierBreakdown: object }}
 */
export function calculateReward(eventType, opts = {}) {
  const config = (_configCache || DEFAULTS)[eventType]
  if (!config) return { xp: 0, coins: 0, multiplierBreakdown: {} }

  let baseXp = config.xp
  let baseCoins = config.coins
  const breakdown = {}

  // Difficulty multiplier
  if (opts.difficulty && config.difficulty_multipliers) {
    const diffMult = config.difficulty_multipliers[opts.difficulty] || 1.0
    if (diffMult !== 1.0) {
      baseXp = Math.round(baseXp * diffMult)
      baseCoins = Math.round(baseCoins * diffMult)
      breakdown.difficulty = diffMult
    }
  }

  // First attempt multiplier
  if (opts.isFirstAttempt && config.first_attempt_multiplier > 1.0) {
    baseXp = Math.round(baseXp * config.first_attempt_multiplier)
    breakdown.firstAttempt = config.first_attempt_multiplier
  }

  // Streak multiplier (only applies if streak > 3 days)
  if (opts.streakDays && opts.streakDays >= 3 && config.streak_multiplier > 1.0) {
    baseXp = Math.round(baseXp * config.streak_multiplier)
    breakdown.streak = config.streak_multiplier
  }

  return { xp: baseXp, coins: baseCoins, multiplierBreakdown: breakdown }
}

/**
 * Get the quiz event type based on score percentage.
 */
export function getQuizEventType(scorePercent) {
  if (scorePercent >= 80) return 'quiz_high'
  if (scorePercent >= 50) return 'quiz_mid'
  return 'quiz_low'
}

/**
 * Day-of-week helpers.
 */
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function getDayName(dayOfWeek) {
  return DAY_NAMES[(dayOfWeek - 1)] || 'Unknown'
}

export function getDayShort(dayOfWeek) {
  return DAY_SHORT[(dayOfWeek - 1)] || '?'
}
