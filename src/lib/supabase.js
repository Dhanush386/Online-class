import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '')
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anon Key is missing! Check your environment variables.')
}

// Proactively sanitize stale/corrupted auth tokens before Supabase initialization
try {
    const rawToken = globalThis.localStorage?.getItem('learnova-auth-token')
    if (rawToken) {
        const parsed = JSON.parse(rawToken)
        if (!parsed || typeof parsed !== 'object' || (!parsed.access_token && !parsed.refresh_token)) {
            globalThis.localStorage?.removeItem('learnova-auth-token')
        }
    }
} catch {
    try { globalThis.localStorage?.removeItem('learnova-auth-token') } catch {}
}

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    {
        auth: {
            persistSession: isConfigured,
            autoRefreshToken: isConfigured,
            detectSessionInUrl: isConfigured,
            storageKey: 'learnova-auth-token',
            storage: globalThis.localStorage
        }
    }
)
