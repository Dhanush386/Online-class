import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [browserSessionId] = useState(() => {
        let id = localStorage.getItem('online_class_session_uuid')
        if (!id) {
            id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
            localStorage.setItem('online_class_session_uuid', id)
        }
        return id
    })

    // Use a ref to store the stable session ID to avoid dependency cycle in useEffect
    // but keep the state for the initial value consistency.
    const sessionIdRef = useRef(browserSessionId)
    useEffect(() => { sessionIdRef.current = browserSessionId }, [browserSessionId])

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null)
            if (session?.user) fetchProfile(session.user.id)
            else setLoading(false)
        })

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            if (session?.user) fetchProfile(session.user.id)
            else {
                setProfile(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const checkExpiry = (prof) => {
        if (!prof || prof.role !== 'student' || !prof.access_expires_at) return false
        const expiry = new Date(prof.access_expires_at)
        if (expiry < new Date()) {
            alert('Access Expired: Your account access period has ended. Please contact your organizer.')
            signOut()
            return true
        }
        return false
    }

    // Single session and Expiry detection
    useEffect(() => {
        if (!user || !profile) return

        // Periodic expiry check
        const expiryCheck = setInterval(() => {
            checkExpiry(profile)
        }, 30000)

        const channel = supabase
            .channel(`user-session-${user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'users',
                filter: `id=eq.${user.id}`
            }, (payload) => {
                // Check session ID
                if (payload.new.current_session_id && payload.new.current_session_id !== sessionIdRef.current) {
                    alert('Session Invalidation: You have been logged out because another system logged in using your account.')
                    signOut()
                    return
                }
                
                // Reactive Profile Update
                setProfile(payload.new)
                
                // Check expiry
                checkExpiry(payload.new)
            })
            .subscribe()

        return () => {
            clearInterval(expiryCheck)
            supabase.removeChannel(channel)
        }
    }, [user, profile]) // Removed browserSessionId to fix React warning, using ref instead

    async function fetchProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, name, email, role, status, current_session_id, access_expires_at')
                .eq('id', userId)
                .maybeSingle()

            if (error) {
                console.error('Profile fetch error:', error.code, error.message, error.status)

                // 406 often means schema cache issue or "Accept" header mismatch (PostgREST)
                if (error.status === 406) {
                    console.warn('Supabase returned 406. This usually requires a Schema Cache refresh in Supabase Dashboard.')
                }

                if (error.code === 'PGRST116') {
                    // User not found in public.users, try to recover from auth metadata
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user) {
                        // Profile not found - Create it
                        const name = user.user_metadata?.name || 'New User'
                        const role = localStorage.getItem('onboarding_role') || 'student' // Use onboarding_role if set, otherwise default
                        const newProfile = { id: user.id, name, email: user.email, role, current_session_id: browserSessionId }

                        console.log('Creating/Updating profile via upsert:', newProfile)
                        const { error: upsertError } = await supabase
                            .from('users')
                            .upsert(newProfile, { onConflict: 'id' })

                        if (!upsertError) {
                            setProfile(newProfile)
                            return
                        } else {
                            console.error('Profile upsert failed:', upsertError)
                        }
                    }
                }
            } else if (data) {
                // Check if expired on load
                if (checkExpiry(data)) return

                // Update DB with current session ID if different
                if (data.current_session_id !== sessionIdRef.current) {
                    await supabase
                        .from('users')
                        .update({ current_session_id: sessionIdRef.current })
                        .eq('id', userId)
                }
            }

            setProfile(data)
        } catch (err) {
            console.error('Error in fetchProfile:', err)
        } finally {
            setLoading(false)
        }
    }

    async function signUp({ email, password, name, role }) {
        // If registering as organizer or admin role, check if invited
        if (role === 'organizer' || role === 'main_admin' || role === 'sub_admin') {
            const { data: invite, error: inviteError } = await supabase
                .from('organizer_invites')
                .select('*')
                .eq('email', email.toLowerCase())
                .single()

            if (inviteError || !invite) {
                throw new Error('This email is not authorized as an organizer. Please sign up as a student or contact an administrator.')
            }
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name, role } }
        })
        if (error) throw error

        if (data.user) {
            // If admin account created, remove the invite
            if (role === 'organizer' || role === 'main_admin' || role === 'sub_admin') {
                await supabase.from('organizer_invites').delete().eq('email', email.toLowerCase())
            }
        }
        return data
    }

    async function signIn({ email, password }) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        return data
    }

    async function signOut() {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
    }

    const value = {
        user,
        profile,
        role: profile?.role,
        loading,
        signUp,
        signIn,
        signOut,
        fetchProfile,
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}
