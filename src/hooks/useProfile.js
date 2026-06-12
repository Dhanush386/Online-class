import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Only select columns we actually use — avoids over-fetching
const PROFILE_FIELDS = 'id, name, email, role, status, avatar_url, xp, access_expires_at, created_at'

/**
 * Fetches a user profile by userId.
 * Returns { profile, loading, error, refresh }
 *
 * @param {string|null} userId
 */
export function useProfile(userId) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchProfile = useCallback(async () => {
    if (!userId) { setLoading(false); return }

    setLoading(true)
    const { data, error: err } = await supabase
      .from('users')
      .select(PROFILE_FIELDS)
      .eq('id', userId)
      .maybeSingle()

    if (err) setError(err.message)
    else setProfile(data)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return { profile, loading, error, refresh: fetchProfile }
}
