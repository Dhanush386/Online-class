import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [isProfileComplete, setIsProfileComplete] = useState(true) // Default to true to avoid early redirect
    const [stats, setStats] = useState({ xp: 0, solved: 0, streak: 0, completedCourses: [] })
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
                    console.warn('Session replaced by another device.')
                    signOut()
                    // Use a query param to tell the login page why it happened
                    window.location.href = '/login?reason=replaced'
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
    }, [user, profile])

    async function fetchProfile(userId) {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, name, email, role, status, current_session_id, access_expires_at')
                .eq('id', userId)
                .maybeSingle()

            const finalProfile = data || {
                id: userId,
                name: (await supabase.auth.getUser()).data.user?.user_metadata?.name || 'New User',
                email: (await supabase.auth.getUser()).data.user?.email,
                role: (await supabase.auth.getUser()).data.user?.user_metadata?.role || 'student',
                status: (await supabase.auth.getUser()).data.user?.user_metadata?.role === 'student' ? 'pending' : 'approved',
                current_session_id: sessionIdRef.current
            }

            // Check if expired on load
            if (checkExpiry(finalProfile)) return

            // Update DB with current session ID if different
            if (data && data.current_session_id !== sessionIdRef.current) {
                await supabase
                    .from('users')
                    .update({ current_session_id: sessionIdRef.current })
                    .eq('id', userId)
                
                // Ensure local profile has the new session ID immediately
                finalProfile.current_session_id = sessionIdRef.current
            }

            setProfile(finalProfile)

            // Determine if profile is complete
            if (finalProfile.role === 'student') {
                const { data: spData } = await supabase
                    .from('student_profiles')
                    .select('student_id')
                    .eq('student_id', userId)
                    .maybeSingle()
                setIsProfileComplete(!!spData)
            } else {
                setIsProfileComplete(true)
            }
        } catch (err) {
            console.error('Error in fetchProfile:', err)
        } finally {
            setLoading(false)
        }
    }

    async function refreshProfileStatus() {
        if (!user) return
        if (profile?.role === 'student') {
            const { data } = await supabase
                .from('student_profiles')
                .select('student_id')
                .eq('student_id', user.id)
                .maybeSingle()
            setIsProfileComplete(!!data)
            loadAchievementStats(user.id)
        } else {
            setIsProfileComplete(true)
        }
    }

    async function loadAchievementStats(userId) {
        if (!userId) return
        try {
            // 1. Fetch coding submission stats
            const { data: codingSubs } = await supabase
                .from('coding_submissions')
                .select('score, status, created_at')
                .eq('student_id', userId)

            const codingXp = codingSubs?.filter(s => s.status === 'accepted').reduce((sum, s) => sum + (s.score || 0), 0) || 0
            const solvedCount = codingSubs?.filter(s => s.status === 'accepted').length || 0

            // 2. Fetch assessment stats
            const { data: assessSubs } = await supabase
                .from('assessment_submissions')
                .select('score, created_at')
                .eq('student_id', userId)
            
            const assessXp = assessSubs?.reduce((sum, s) => sum + (s.score || 0), 0) || 0
            const totalXp = codingXp + assessXp

            // 3. Fetch course completion
            const { data: progress } = await supabase
                .from('progress')
                .select('completed, courses(title)')
                .eq('student_id', userId)
                .eq('completed', true)
            
            const completedCourseTitles = progress?.map(p => p.courses?.title?.toLowerCase() || '') || []

            // 4. Calculate Streak
            const { data: watchedProgs } = await supabase
                .from('video_progress')
                .select('watched_at')
                .eq('student_id', userId)

            const activityDates = new Set([
                ...(codingSubs?.map(s => s.created_at.split('T')[0]) || []),
                ...(assessSubs?.map(s => s.created_at.split('T')[0]) || []),
                ...(watchedProgs?.map(s => s.watched_at.split('T')[0]) || [])
            ])

            const sortedDates = Array.from(activityDates).sort().reverse()
            let streakCount = 0
            if (sortedDates.length > 0) {
                const today = new Date().toISOString().split('T')[0]
                const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
                let current = (sortedDates[0] === today || sortedDates[0] === yesterday) ? sortedDates[0] : null
                
                if (current) {
                    streakCount = 1
                    for (let i = 1; i < sortedDates.length; i++) {
                        const prevDate = new Date(current)
                        prevDate.setDate(prevDate.getDate() - 1)
                        const expected = prevDate.toISOString().split('T')[0]
                        if (sortedDates[i] === expected) {
                            streakCount++
                            current = sortedDates[i]
                        } else break
                    }
                }
            }

            // 5. Calculate Rank Tier & Level
            const tiers = [
                { name: 'Iron', color: '#94a3b8', base: 0, step: 200 },
                { name: 'Bronze', color: '#b45309', base: 1000, step: 200 },
                { name: 'Silver', color: '#64748b', base: 2000, step: 300 },
                { name: 'Gold', color: '#f59e0b', base: 3500, step: 800 },
                { name: 'Diamond', color: '#a855f7', base: 7500, step: 1000 }
            ]

            let currentTier = tiers[0]
            for (let i = tiers.length - 1; i >= 0; i--) {
                if (totalXp >= tiers[i].base) {
                    currentTier = tiers[i]
                    break
                }
            }

            const xpInTier = totalXp - currentTier.base
            const levelNum = Math.min(5, Math.floor(xpInTier / currentTier.step) + 1)
            const romanLevels = ['I', 'II', 'III', 'IV', 'V']
            
            const rankName = `${currentTier.name} ${romanLevels[Math.max(0, levelNum - 1)]}`
            const rankColor = currentTier.color

            setStats({
                xp: totalXp,
                solved: solvedCount,
                streak: streakCount,
                completedCourses: completedCourseTitles,
                rankName,
                rankColor
            })
        } catch (err) {
            console.error('Error loading achievement stats:', err)
        }
    }

    // Load stats when profile is ready
    useEffect(() => {
        if (profile?.id && profile.role === 'student') {
            loadAchievementStats(profile.id)
        }
    }, [profile?.id, profile?.role])

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
        const cleanEmail = (email || '').trim().toLowerCase()
        const { data, error } = await supabase.auth.signInWithPassword({ 
            email: cleanEmail, 
            password 
        })
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
        isProfileComplete,
        refreshProfileStatus,
        stats,
        refreshStats: () => profile?.id && loadAchievementStats(profile.id)
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
