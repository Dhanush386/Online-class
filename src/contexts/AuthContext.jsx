import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [browserSessionId] = useState(() => {
        let id = localStorage.getItem('online_class_session_uuid')
        if (!id) {
            id = crypto.randomUUID()
            localStorage.setItem('online_class_session_uuid', id)
        }
        return id
    })

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

    // Single session detection
    useEffect(() => {
        if (!user || !profile) return

        const channel = supabase
            .channel(`user-session-${user.id}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'users',
                filter: `id=eq.${user.id}`
            }, (payload) => {
                if (payload.new.current_session_id && payload.new.current_session_id !== browserSessionId) {
                    alert('Session Invalidation: You have been logged out because another system logged in using your account.')
                    signOut()
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, profile, browserSessionId])

    async function fetchProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single()

            if (error && error.code === 'PGRST116') {
                // User not found in public.users, try to recover from auth metadata
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const name = user.user_metadata?.name || 'New User'
                    const role = user.user_metadata?.role || 'student'
                    const { data: newProfile, error: insertError } = await supabase
                        .from('users')
                        .insert({ id: user.id, name, email: user.email, role, current_session_id: browserSessionId })
                        .select()
                        .single()

                    if (!insertError) {
                        setProfile(newProfile)
                        return
                    }
                }
            } else if (data) {
                // Update DB with current session ID if different
                if (data.current_session_id !== browserSessionId) {
                    await supabase
                        .from('users')
                        .update({ current_session_id: browserSessionId })
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
        // If registering as organizer, check if invited
        if (role === 'organizer') {
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
            await supabase.from('users').insert({
                id: data.user.id,
                name,
                email: email.toLowerCase(),
                role,
                status: role === 'student' ? 'pending' : 'approved'
            })

            // If organizer account created, remove the invite
            if (role === 'organizer') {
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
