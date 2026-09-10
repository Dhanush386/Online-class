import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../lib/supabase'
import { getTierForXP, getRankName } from '../constants/ranks'
import { loadXpConfig } from '../constants/xpRewards'
import { validatePassword, validateEmail, sanitizeEmail } from '../utils/security'

const AuthContext = createContext({})

// Session idle timeout: 30 minutes of inactivity forces automatic logout
const IDLE_TIMEOUT_MS = 30 * 60 * 1000

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

async function signUp({ email, password, name, role = 'student' }) {
    const cleanEmail = sanitizeEmail(email);
    if (!validateEmail(cleanEmail)) {
        throw new Error('Please provide a valid email address.');
    }

    const passCheck = validatePassword(password);
    if (!passCheck.isValid) {
        throw new Error(passCheck.message);
    }

    // Rate-limit account registration attempts
    try {
        const { data: limitCheck } = await supabase.rpc('check_rate_limit', {
            p_identifier: cleanEmail,
            p_action: 'register',
            p_max_attempts: 5,
            p_window_seconds: 3600
        });
        if (limitCheck && !limitCheck.allowed) {
            throw new Error(limitCheck.message || 'Too many registration requests. Please wait.');
        }
    } catch (limErr) {
        if (limErr.message?.includes('Too many')) throw limErr;
    }

    // Server-side invite verification for administrative roles
    if (['organizer', 'main_admin', 'sub_admin'].includes(role)) {
        const { data: inviteCheck } = await supabase.rpc('check_organizer_invite', { p_email: cleanEmail });
        if (!inviteCheck?.valid) {
            throw new Error('Not authorized: A valid administrator invitation is required to register for this role.');
        }
    }

    const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name: (name || '').trim(), role } }
    });

    if (error) throw error;
    return data;
}

async function verifyOtp({ email, token, type = 'signup' }) {
    const cleanEmail = sanitizeEmail(email);
    const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: (token || '').trim(),
        type
    });
    if (error) throw error;
    return data;
}

async function resendOtp({ email, type = 'signup' }) {
    const cleanEmail = sanitizeEmail(email);
    const { data, error } = await supabase.auth.resend({
        email: cleanEmail,
        type
    });
    if (error) throw error;
    return data;
}

async function signIn({ email, password }) {
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) {
        throw new Error('Email is required.');
    }

    // Check login rate limiting / lockouts
    const { data: limitCheck } = await supabase.rpc('check_rate_limit', {
        p_identifier: cleanEmail,
        p_action: 'login',
        p_max_attempts: 5,
        p_window_seconds: 900,
        p_lockout_seconds: 900
    });

    if (limitCheck && !limitCheck.allowed) {
        throw new Error(limitCheck.message || 'Too many failed login attempts. Access is locked for 15 minutes.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
    });

    if (error) {
        // Record failed attempt in audit log
        supabase.rpc('log_security_event', {
            p_event_type: 'login_failure',
            p_severity: 'warn',
            p_details: { email: cleanEmail, error: error.message }
        }).catch(() => {});
        throw error;
    }

    // Reset rate limiter on successful authentication
    supabase.rpc('record_successful_auth', {
        p_identifier: cleanEmail,
        p_action: 'login'
    }).catch(() => {});

    return data;
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [isProfileComplete, setIsProfileComplete] = useState(true)
    const [stats, setStats] = useState({ xp: 0, coins: 0, solved: 0, streak: 0, completedCourses: [] })
    const [loading, setLoading] = useState(true)
    const [isExpired, setIsExpired] = useState(false)
    const idleTimerRef = useRef(null)

    const clearAuthStorage = useCallback(() => {
        try {
            localStorage.removeItem('learnova-auth-token')
            localStorage.removeItem('supabase.auth.token')
            Object.keys(localStorage).forEach(key => {
                if (key.includes('auth-token') || key.startsWith('sb-')) {
                    localStorage.removeItem(key)
                }
            })
            sessionStorage.clear()
        } catch {
            // Ignore storage errors
        }
    }, [])

    const signOut = useCallback(async () => {
        try {
            await supabase.auth.signOut()
        } catch {}
        clearAuthStorage()
        setUser(null)
        setProfile(null)
        setStats({ xp: 0, coins: 0, solved: 0, streak: 0, completedCourses: [] })
        window.location.replace('/login')
    }, [clearAuthStorage])

    // Idle session timeout: Reset timer on user interaction
    const resetIdleTimer = useCallback(() => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        if (user) {
            idleTimerRef.current = setTimeout(() => {
                console.warn('Session expired due to 30 minutes of user inactivity.')
                signOut()
            }, IDLE_TIMEOUT_MS)
        }
    }, [user, signOut])

    useEffect(() => {
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
        const handleActivity = () => resetIdleTimer()

        events.forEach(evt => window.addEventListener(evt, handleActivity, { passive: true }))
        resetIdleTimer()

        return () => {
            events.forEach(evt => window.removeEventListener(evt, handleActivity))
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
        }
    }, [resetIdleTimer])

    useEffect(() => {
        async function initAuth() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()
                
                if (error) {
                    clearAuthStorage()
                    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
                    setUser(null)
                    setProfile(null)
                    setLoading(false)
                    return
                }

                // Check server-side token expiry timestamp
                if (session?.expires_at && session.expires_at * 1000 < Date.now()) {
                    console.warn('Session token expired server-side.')
                    clearAuthStorage()
                    setUser(null)
                    setProfile(null)
                    setLoading(false)
                    return
                }

                if (session?.user) {
                    setUser(session.user)
                    await fetchProfile(session.user.id)
                } else {
                    setUser(null)
                    setProfile(null)
                    setLoading(false)
                }
            } catch {
                clearAuthStorage()
                await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
                setUser(null)
                setProfile(null)
                setLoading(false)
            }
        }

        initAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                setUser(null)
                setProfile(null)
                setLoading(false)
            } else if (session?.user) {
                if (event === 'TOKEN_REFRESHED') {
                    setProfile(curr => {
                        if (!curr) fetchProfile(session.user.id, false)
                        return curr
                    })
                    return
                }

                setUser(prev => (prev?.id === session.user.id ? prev : session.user))
                if (event === 'USER_UPDATED') {
                    fetchProfile(session.user.id, false)
                } else {
                    setProfile(curr => {
                        if (!curr) setLoading(true)
                        return curr
                    })
                    fetchProfile(session.user.id, true)
                }
            }
        })

        return () => subscription.unsubscribe()
    }, [clearAuthStorage])

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

    async function fetchProfile(userId, updateLoading = true) {
        if (!userId) return
        try {
            const { data } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .maybeSingle()

            if (data) {
                setProfile(prev => {
                    if (
                        prev &&
                        prev.id === data.id &&
                        prev.role === data.role &&
                        prev.status === data.status &&
                        prev.name === data.name &&
                        prev.email === data.email &&
                        prev.xp === data.xp &&
                        prev.coins === data.coins &&
                        prev.access_expires_at === data.access_expires_at
                    ) {
                        return prev
                    }
                    return data
                })
                checkExpiry(data)
                
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
                return data
            } else {
                // SECURITY FIX: If public profile does not exist, NEVER perform client-side upsert
                // with arbitrary user metadata roles! Rely exclusively on database triggers.
                const authUser = (await supabase.auth.getUser())?.data?.user
                const safeReadOnlyProfile = {
                    id: userId,
                    email: authUser?.email,
                    name: authUser?.user_metadata?.name || 'User',
                    role: 'student', // default to least privilege
                    status: 'pending',
                    xp: 0,
                    coins: 0
                }
                setProfile(safeReadOnlyProfile)
                setIsProfileComplete(false)
                return safeReadOnlyProfile
            }
        } catch (err) {
            console.error('fetchProfile error:', err)
        } finally {
            if (updateLoading) {
                setLoading(false)
            }
        }
    }

    async function loadAchievementStats(userId) {
        if (!userId) return
        try {
            const { data: userProfile } = await supabase.from('users').select('xp, coins').eq('id', userId).single()
            let totalXp = userProfile?.xp || 0
            const coins = userProfile?.coins || 0

            loadXpConfig().catch(() => {})

            const { data: codingSubs } = await supabase.from('coding_submissions').select('challenge_id, score, status, created_at').eq('student_id', userId)
            const calculatedCodingXp = calculateCodingXp(codingSubs);

            const { data: assessSubs } = await supabase.from('assessment_submissions').select('created_at').eq('student_id', userId)
            const { data: progress } = await supabase.from('progress').select('completed, courses(title)').eq('student_id', userId).eq('completed', true)
            const completedCourseTitles = progress?.map(p => p.courses?.title?.toLowerCase() || '') || []

            const { data: watchedProgs } = await supabase.from('video_progress').select('watched_at').eq('student_id', userId)
            const { data: liveAtt } = await supabase.from('live_attendance').select('joined_at').eq('student_id', userId).eq('attendance_status', 'present')

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

            const currentTier = getTierForXP(totalXp)
            const rankName    = getRankName(totalXp)
            const solvedCount = codingSubs?.filter(s => s.status === 'accepted').length || 0

            setStats(prev => {
                if (
                    prev &&
                    prev.xp === totalXp &&
                    prev.coins === coins &&
                    prev.solved === solvedCount &&
                    prev.streak === streakCount &&
                    prev.rankName === rankName &&
                    prev.rankColor === currentTier.color &&
                    JSON.stringify(prev.completedCourses) === JSON.stringify(completedCourseTitles)
                ) {
                    return prev
                }
                return { xp: totalXp, coins, solved: solvedCount, streak: streakCount, completedCourses: completedCourseTitles, rankName, rankColor: currentTier.color }
            })
        } catch (err) { console.error(err) }
    }

    const value = useMemo(() => ({
        user, profile, role: profile?.role, loading, signUp, verifyOtp, resendOtp, signIn, signOut,
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
