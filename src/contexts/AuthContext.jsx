import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../lib/supabase'
import { getTierForXP, getRankName } from '../constants/ranks'
import { loadXpConfig } from '../constants/xpRewards'

const AuthContext = createContext({})

function calculateCodingXp(codingSubs) {
    let xp = 0;
    if (!codingSubs) return xp;
    
    const uniqueChallenges = {};
    for (const sub of codingSubs) {
        if (sub.status === 'accepted') {
            if (!uniqueChallenges[sub.challenge_id] || sub.score > uniqueChallenges[sub.challenge_id]) {
                uniqueChallenges[sub.challenge_id] = sub.score;
            }
        }
    }
    for (const score of Object.values(uniqueChallenges)) xp += score;
    return xp;
}

function calculateStreak(sortedDates) {
    if (sortedDates.length === 0) return 0;
    let streakCount = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    let current = (sortedDates[0] === today || sortedDates[0] === yesterday) ? sortedDates[0] : null;
    
    if (current) {
        streakCount = 1;
        for (let i = 1; i < sortedDates.length; i++) {
            const prevDate = new Date(current);
            prevDate.setDate(prevDate.getDate() - 1);
            const expected = prevDate.toISOString().split('T')[0];
            if (sortedDates[i] === expected) { 
                streakCount++; 
                current = sortedDates[i]; 
            } else {
                break;
            }
        }
    }
    return streakCount;
}

async function signUp({ email, password, name, role }) {
    if (['organizer', 'main_admin', 'sub_admin'].includes(role)) {
        const { data: invite } = await supabase.from('organizer_invites').select('*').eq('email', email.toLowerCase()).single()
        if (!invite) throw new Error('Not authorized as organizer.')
    }
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role } } })
    if (error) throw error
    if (data.user && ['organizer', 'main_admin', 'sub_admin'].includes(role)) {
        await supabase.from('organizer_invites').delete().eq('email', email.toLowerCase())
    }
    return data
}

async function signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: (email || '').trim().toLowerCase(), password })
    if (error) throw error
    return data
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [isProfileComplete, setIsProfileComplete] = useState(true)
    const [stats, setStats] = useState({ xp: 0, coins: 0, solved: 0, streak: 0, completedCourses: [] })
    const [loading, setLoading] = useState(true)
    const [isExpired, setIsExpired] = useState(false)

    useEffect(() => {
        // Simple and robust initial check
        async function initAuth() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()
                
                if (error) {
                    console.warn('Initial session recovery failed:', error.message)
                    // If refresh token is invalid, clear everything cleanly
                    if (error.message?.includes('refresh_token') || error.message?.includes('not found')) {
                        await supabase.auth.signOut()
                    }
                }

                if (session?.user) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                } else {
                    // One-time retry for slow PWA storage (helpful on mobile)
                    await new Promise(r => setTimeout(r, 800))
                    const { data: { session: retry }, error: retryError } = await supabase.auth.getSession()
                    
                    if (retry?.user) {
                        setUser(retry.user)
                        await fetchProfile(retry.user.id)
                    } else {
                        if (retryError?.message?.includes('refresh_token')) {
                            localStorage.removeItem('supabase.auth.token')
                        }
                        setLoading(false)
                    }
                }
            } catch (err) {
                console.error('Auth init error:', err)
                setLoading(false)
            }
        }

        initAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                setUser(session.user)
                fetchProfile(session.user.id)
            } else {
                setUser(null)
                setProfile(null)
                setLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const checkExpiry = (prof) => {
        if (prof?.role !== 'student' || !prof?.access_expires_at) {
            setIsExpired(false)
            return false
        }
        const expiry = new Date(prof.access_expires_at)
        const expired = expiry < new Date()
        setIsExpired(expired)
        return expired
    }

    async function fetchProfile(userId) {
        if (!userId) return
        try {
            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle()

            if (data) {
                setProfile(data)
                checkExpiry(data)
                
                // Check if student profile is complete
                if (data.role === 'student') {
                    const { data: spData } = await supabase
                        .from('student_profiles')
                        .select('student_id')
                        .eq('student_id', userId)
                        .maybeSingle()
                    setIsProfileComplete(!!spData)
                    loadAchievementStats(userId)
                } else {
                    setIsProfileComplete(true)
                }
            }
        } catch (err) {
            console.error('fetchProfile error:', err)
        } finally {
            setLoading(false)
        }
    }

    async function loadAchievementStats(userId) {
        if (!userId) return
        try {
            const { data: userProfile } = await supabase.from('users').select('xp, coins').eq('id', userId).single()
            let totalXp = userProfile?.xp || 0
            const coins = userProfile?.coins || 0

            // Pre-load XP config for hooks
            loadXpConfig().catch(() => {})

            const { data: codingSubs } = await supabase.from('coding_submissions').select('challenge_id, score, status, created_at').eq('student_id', userId)
            
            // Calculate dynamic XP from coding submissions as a fallback for RLS issues
            const calculatedCodingXp = calculateCodingXp(codingSubs);

            const { data: assessSubs } = await supabase.from('assessment_submissions').select('created_at').eq('student_id', userId)

            const { data: progress } = await supabase.from('progress').select('completed, courses(title)').eq('student_id', userId).eq('completed', true)
            const completedCourseTitles = progress?.map(p => p.courses?.title?.toLowerCase() || '') || []

            const { data: watchedProgs } = await supabase.from('video_progress').select('watched_at').eq('student_id', userId)

            const { data: liveAtt } = await supabase.from('live_attendance').select('joined_at').eq('student_id', userId).eq('attendance_status', 'present')

            // Add 20 XP for every live classroom attendance (fallback for RLS)
            let dynamicTotalXp = calculatedCodingXp + (liveAtt ? liveAtt.length * 20 : 0);
            if (dynamicTotalXp > totalXp) {
                totalXp = dynamicTotalXp;
            }

            const activityDates = new Set([
                ...(codingSubs?.map(s => s.created_at?.split('T')[0]).filter(Boolean) || []),
                ...(assessSubs?.map(s => s.created_at?.split('T')[0]).filter(Boolean) || []),
                ...(watchedProgs?.map(s => s.watched_at?.split('T')[0]).filter(Boolean) || []),
                ...(liveAtt?.map(s => s.joined_at?.split('T')[0]).filter(Boolean) || [])
            ])

            const sortedDates = Array.from(activityDates).sort((a, b) => a.localeCompare(b)).reverse()
            const streakCount = calculateStreak(sortedDates)

            // Use shared rank constants — single source of truth
            const currentTier = getTierForXP(totalXp)
            const rankName    = getRankName(totalXp)

            const solvedCount = codingSubs?.filter(s => s.status === 'accepted').length || 0

            setStats({ xp: totalXp, coins, solved: solvedCount, streak: streakCount, completedCourses: completedCourseTitles, rankName, rankColor: currentTier.color })
        } catch (err) { console.error(err) }
    }

    const signOut = useCallback(async () => {
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
        setStats({ xp: 0, coins: 0, solved: 0, streak: 0, completedCourses: [] })
    }, [])

    const value = useMemo(() => ({
        user, profile, role: profile?.role, loading, signUp, signIn, signOut,
        fetchProfile, isProfileComplete, stats, isExpired,
        refreshStats: () => profile?.id && loadAchievementStats(profile.id),
        refreshProfileStatus: () => user?.id && fetchProfile(user.id)
    }), [user, profile, loading, isProfileComplete, stats, isExpired, signOut]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
}

export function useAuth() { return useContext(AuthContext) }
