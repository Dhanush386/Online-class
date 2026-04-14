import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import { Clock, BookOpen, Trophy, Award, Video, Calendar, ExternalLink, Zap, Code as CodeIcon, ChevronRight, Rocket, Flame, FileText, Plus, Layout, Globe } from 'lucide-react'
import { subscribeToPush, checkPushSubscription } from '../../utils/pushService'

export default function StudentDashboard() {
    const { profile, stats } = useAuth()
    const [data, setData] = useState({ courses: 0, completion: 0, timeSpent: 0, topics: 0 })
    const [upcomingSessions, setUpcomingSessions] = useState([])
    const [isCheckingSub, setIsCheckingSub] = useState(true)
    const [isSubscribed, setIsSubscribed] = useState(false)

    useEffect(() => {
        fetchDashboardData()
        checkSubscription()
    }, [profile])

    async function checkSubscription() {
        try {
            const sub = await checkPushSubscription()
            setIsSubscribed(sub)
        } catch (err) {
            console.error('Error checking subscription:', err)
        } finally {
            setIsCheckingSub(false)
        }
    }

    async function handleEnableNotifications() {
        try {
            const sub = await subscribeToPush(profile.id)
            if (sub) {
                setIsSubscribed(true)
                alert('Notifications enabled! You will now receive alerts even when the app is closed.')
            }
        } catch (err) {
            console.error('Error enabling notifications:', err)
            alert('Failed to enable notifications. Please ensure you allow permissions in your browser.')
        }
    }

    async function fetchDashboardData() {
        const { data: rawEnrollments } = await supabase
            .from('enrollments')
            .select('course_id, courses(start_date)')
            .eq('student_id', profile.id)

        // Deduplicate enrollments to fix duplicate course cards
        const enrollments = []
        const uniqueCourseIds = new Set()
            ; (rawEnrollments || []).forEach(e => {
                if (!e.courses) return // Skip orphaned enrollments
                const startDate = e.courses?.start_date
                const hasStarted = !startDate || new Date(startDate) <= new Date()

                if (hasStarted && !uniqueCourseIds.has(e.course_id)) {
                    uniqueCourseIds.add(e.course_id)
                    enrollments.push(e)
                }
            })

        const enrolledCourseIds = Array.from(uniqueCourseIds)

        const [
            { data: progress },
            { data: sessions },
            { data: memberships },
            { data: locksDay }
        ] = await Promise.all([
            supabase.from('progress').select('completion_percentage, time_spent_minutes').eq('student_id', profile.id),
            enrolledCourseIds.length > 0
                ? supabase.from('videos').select('*, courses(title)')
                    .in('course_id', enrolledCourseIds)
                    .gte('scheduled_time', new Date(Date.now() - 3600000 * 4).toISOString()) // Show sessions from last 4 hours
                    .order('scheduled_time', { ascending: true })
                    .limit(3)
                : Promise.resolve({ data: [] }),
            supabase.from('group_members').select('group_id').eq('student_id', profile.id),
            supabase.from('day_access').select('*')
        ])

        const userGroupIds = memberships?.map(m => m.group_id) || []
        const now = new Date()

        const isDayLocked = (courseId, dayNum) => {
            if (!dayNum) return false
            const access = (locksDay || []).find(a => a.course_id === courseId && a.day_number === dayNum && userGroupIds.includes(a.group_id))
            if (!access) return false
            if (access.is_locked) return true
            if (access.open_time && new Date(access.open_time) > now) return true
            return false
        }

        const filteredSessions = (sessions || [])
            .filter(s => !isDayLocked(s.course_id, s.day_number))
            .slice(0, 3)

        const avgComp = progress?.length
            ? Math.round(progress.reduce((s, p) => s + (p.completion_percentage || 0), 0) / progress.length)
            : 0
        const totalTime = progress?.reduce((s, p) => s + (p.time_spent_minutes || 0), 0) || 0

        setData({
            courses: enrollments?.length || 0,
            completion: avgComp,
            timeSpent: totalTime,
            topics: enrollments?.length ? enrollments.length * 5 : 0,
        })
        setUpcomingSessions(filteredSessions)
        // setLoading(false) // setLoading is not defined in the provided snippet
    }

    return (
        <div className="animate-fade-in">
            <style>{`
                .hexagon-container-mini {
                    width: 44px;
                    height: 50px;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .hexagon-mini {
                    width: 100%;
                    height: 100%;
                    background: currentColor;
                    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .hexagon-inner-mini {
                    width: 85%;
                    height: 85%;
                    background: white;
                    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            `}</style>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Hello, <span className="gradient-text" style={{ background: 'linear-gradient(135deg,#10b981,#6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{profile?.name?.split(' ')[0]}</span> 👋
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Keep up the great work on your learning journey!</p>
            </div>

            <div className="dashboard-grid" style={{ alignItems: 'stretch', gridTemplateColumns: window.innerWidth <= 1024 ? '1fr' : '1fr 1fr' }}>

                {/* Upcoming Sessions */}
                <div className="glass-card" style={{ padding: '1.5rem', gridColumn: window.innerWidth > 1024 ? '1 / -1' : 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Zap size={16} color="#f59e0b" /> Upcoming Live Sessions
                        </h3>
                        <Link to="/student/schedule" style={{ fontSize: '0.78rem', color: 'var(--accent-light)', textDecoration: 'none' }}>View all →</Link>
                    </div>
                    {!isCheckingSub && !isSubscribed && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                            <button
                                onClick={handleEnableNotifications}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.6rem',
                                    padding: '0.5rem 0.8rem', borderRadius: 10, background: '#f0fdf4',
                                    border: '1px solid #10b981', color: '#166534', fontSize: '0.8rem',
                                    fontWeight: 600, cursor: 'pointer'
                                }}
                            >
                                <Globe size={14} />
                                Enable Notifications
                            </button>
                        </div>
                    )}
                    {upcomingSessions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                            <Calendar size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                            <p style={{ fontSize: '0.85rem' }}>No upcoming sessions</p>
                        </div>
                    ) : upcomingSessions.map(s => {
                        const schedTime = new Date(s.scheduled_time)
                        const durationMs = (s.duration_minutes || 60) * 60000
                        const endTime = new Date(schedTime.getTime() + durationMs)
                        const now = new Date()
                        const isNow = now >= schedTime && now < endTime
                        const isPast = now >= endTime
                        const isFuture = now < schedTime

                        return (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: isNow ? 'rgba(239,68,68,0.03)' : '#f8fafc', borderRadius: 12, border: `1px solid ${isNow ? 'rgba(239,68,68,0.2)' : '#e2e8f0'}`, marginBottom: '0.75rem' }}>
                                <div style={{ width: 40, height: 40, background: isNow ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Video size={18} color={isNow ? '#f87171' : '#818cf8'} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                        {new Date(s.scheduled_time).toLocaleString()} · {s.duration_minutes || '?'} min
                                    </div>
                                </div>
                                {isPast ? (
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, padding: '0.4rem 0.9rem' }}>Ended</span>
                                ) : isFuture ? (
                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, padding: '0.4rem 0.9rem' }}>Upcoming</span>
                                ) : (
                                    <a href={s.video_url} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem', textDecoration: 'none', background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                                        🔴 Join
                                    </a>
                                )}
                            </div>
                        )
                    })}
                </div>


                {/* Circular Progress Card */}
                <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 220 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.25rem' }}>Overall Progress</p>
                    <div style={{ width: 150, height: 150, position: 'relative' }}>
                        <CircularProgressbar
                            value={data.completion}
                            text={`${data.completion}%`}
                            styles={buildStyles({
                                textSize: '18px',
                                textColor: '#f1f5f9',
                                pathColor: `url(#progressGrad)`,
                                trailColor: '#f1f5f9',
                                pathTransitionDuration: 1,
                            })}
                        />
                        <svg style={{ height: 0, position: 'absolute' }}>
                            <defs>
                                <linearGradient id="progressGrad" gradientTransform="rotate(90)">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#a855f7" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Course Completion</p>
                    <Link to="/student/courses" style={{ marginTop: '0.75rem', textDecoration: 'none' }}>
                        <span className="badge badge-success">{data.courses} Course{data.courses !== 1 ? 's' : ''} Enrolled</span>
                    </Link>
                </div>


                {/* Rank & Leaderboard Card */}
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Trophy size={16} color={stats.rankColor} /> Global Rank
                        </h3>
                        <Link to="/student/leaderboard" style={{ fontSize: '0.78rem', color: 'var(--accent-light)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                            View Leaderboard <ChevronRight size={14} />
                        </Link>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '0.5rem 0' }}>
                        <div style={{ 
                            width: 80, 
                            height: 80, 
                            borderRadius: '50%', 
                            background: `${stats.rankColor}15`, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: `2px solid ${stats.rankColor}40`,
                            boxShadow: `0 0 20px ${stats.rankColor}20`
                        }}>
                            <Trophy size={40} color={stats.rankColor} fill={`${stats.rankColor}40`} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: stats.rankColor, textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>{stats.rankName}</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.4rem' }}>{stats.xp.toLocaleString()} Total XP</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.75rem' }}>
                                <div style={{ height: 6, width: 100, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                    {(() => {
                                        const tiers = [
                                            { name: 'Iron', base: 0, step: 200 },
                                            { name: 'Bronze', base: 1000, step: 200 },
                                            { name: 'Silver', base: 2000, step: 300 },
                                            { name: 'Gold', base: 3500, step: 800 },
                                            { name: 'Diamond', base: 7500, step: 1000 }
                                        ]
                                        const t = tiers.find(tier => stats.rankName?.startsWith(tier.name)) || tiers[0]
                                        const xpInTier = stats.xp - t.base
                                        const progress = (xpInTier % t.step) / t.step * 100
                                        return <div style={{ height: '100%', width: `${Math.min(100, progress)}%`, background: stats.rankColor || '#94a3b8', borderRadius: 3 }} />
                                    })()}
                                </div>
                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)' }}>Progress</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Achievements Card */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Award size={16} color="#f59e0b" /> Career Badges
                        </h3>
                        <Link to="/student/achievements" style={{ fontSize: '0.78rem', color: 'var(--accent-light)', textDecoration: 'none' }}>View all →</Link>
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', padding: '0.5rem 0' }}>
                        {/* Rank Badge */}
                        <div style={{ textAlign: 'center' }}>
                            <div className="hexagon-container-mini" style={{ color: stats.rankColor || '#94a3b8', margin: '0 auto' }} title={`Rank: ${stats.rankName || 'Iron I'}`}>
                                <div className="hexagon-mini">
                                    <div className="hexagon-inner-mini">
                                        <Trophy size={16} />
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.65rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-secondary)' }}>{(stats.rankName || 'Iron').split(' ')[0]}</div>
                        </div>

                        {/* Problems Badge */}
                        {(() => {
                            const thresholds = [5, 10, 20, 30, 40, 50, 75, 100, 125, 150, 175, 200]
                            const highest = thresholds.reverse().find(t => stats.problemsSolved >= t) || 0
                            return (
                                <div style={{ textAlign: 'center' }}>
                                    <div className="hexagon-container-mini" style={{ color: '#6366f1', opacity: highest > 0 ? 1 : 0.3, margin: '0 auto' }} title={`${highest} Problems Solved`}>
                                        <div className="hexagon-mini">
                                            <div className="hexagon-inner-mini">
                                                <CodeIcon size={16} />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-secondary)' }}>{highest} Solved</div>
                                </div>
                            )
                        })()}

                        {/* Streak Badge */}
                        {(() => {
                            const thresholds = [3, 7, 14, 21, 30, 45, 60, 90, 120, 150, 180, 240, 300, 365]
                            const highest = thresholds.reverse().find(t => stats.streak >= t) || 0
                            return (
                                <div style={{ textAlign: 'center' }}>
                                    <div className="hexagon-container-mini" style={{ color: '#f97316', opacity: highest > 0 ? 1 : 0.3, margin: '0 auto' }} title={`${highest}-Day Streak`}>
                                        <div className="hexagon-mini">
                                            <div className="hexagon-inner-mini">
                                                <Flame size={16} />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, marginTop: '0.4rem', color: 'var(--text-secondary)' }}>Day {highest}</div>
                                </div>
                            )
                        })()}
                    </div>
                    <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                        Unlock more by completing courses!
                    </p>
                </div>

            </div>
        </div>
    )
}
