import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Trophy, Medal, Award, User, Search, TrendingUp, BookOpen, ChevronDown } from 'lucide-react'

const getRankInfo = (xp) => {
    const tiers = [
        { name: 'Iron', color: 'var(--text-muted)', base: 0, step: 200, bg: 'rgba(148,163,184,0.1)' },
        { name: 'Bronze', color: '#b45309', base: 1000, step: 200, bg: 'rgba(180,83,9,0.1)' },
        { name: 'Silver', color: 'var(--text-muted)', base: 2000, step: 300, bg: 'rgba(100,116,139,0.1)' },
        { name: 'Gold', color: '#f59e0b', base: 3500, step: 800, bg: 'rgba(245,158,11,0.1)' },
        { name: 'Diamond', color: '#a855f7', base: 7500, step: 1000, bg: 'rgba(168,85,247,0.1)' }
    ]

    let currentTier = tiers[0]
    for (let i = tiers.length - 1; i >= 0; i--) {
        if (xp >= tiers[i].base) {
            currentTier = tiers[i]
            break
        }
    }

    const xpInTier = xp - currentTier.base
    const levelNum = Math.min(5, Math.floor(xpInTier / currentTier.step) + 1)
    const romanLevels = ['I', 'II', 'III', 'IV', 'V']
    
    return { 
        rankName: `${currentTier.name} ${romanLevels[Math.max(0, levelNum - 1)]}`, 
        color: currentTier.color, 
        bg: currentTier.bg 
    }
}

const getRankBg = (rank) => {
    if (rank === 1) return 'rgba(245, 158, 11, 0.15)'
    if (rank === 2) return 'rgba(148, 163, 184, 0.15)'
    if (rank === 3) return 'rgba(180, 83, 9, 0.15)'
    return 'transparent'
}

const getRankColor = (rank) => {
    if (rank === 1) return '#fbbf24'
    if (rank === 2) return '#cbd5e1'
    if (rank === 3) return '#fb923c'
    return 'var(--text-muted)'
}

export default function Leaderboard() {
    const { profile } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const [courses, setCourses] = useState([])
    const [selectedCourseId, setSelectedCourseId] = useState(searchParams.get('courseId') || '')
    const [leaderboard, setLeaderboard] = useState([])
    const [loadingCourses, setLoadingCourses] = useState(true)
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(true)
    const [search, setSearch] = useState('')

    // 1. Fetch courses assigned to this student (or managed by this organizer)
    useEffect(() => {
        let isMounted = true

        async function fetchAssignedCourses() {
            if (!profile?.id) return
            try {
                setLoadingCourses(true)
                let userCourses = []

                if (profile.role === 'organizer') {
                    const { data, error } = await supabase
                        .from('courses')
                        .select('id, title')
                        .eq('organizer_id', profile.id)
                        .order('title', { ascending: true })
                    if (error) throw error
                    userCourses = data || []
                } else {
                    // For student: query assigned/enrolled courses
                    const { data, error } = await supabase
                        .from('enrollments')
                        .select('course_id, courses(id, title)')
                        .eq('student_id', profile.id)
                    if (error) throw error

                    const map = new Map()
                    ;(data || []).forEach(e => {
                        const c = e.courses
                        if (c?.id && !map.has(c.id)) {
                            map.set(c.id, { id: c.id, title: c.title })
                        }
                    })
                    userCourses = Array.from(map.values())
                }

                if (!isMounted) return
                setCourses(userCourses)

                const paramCourseId = searchParams.get('courseId')
                if (paramCourseId && userCourses.some(c => c.id === paramCourseId)) {
                    setSelectedCourseId(paramCourseId)
                } else if (userCourses.length > 0) {
                    setSelectedCourseId(prev => prev && userCourses.some(c => c.id === prev) ? prev : userCourses[0].id)
                } else {
                    setSelectedCourseId('')
                    setLoadingLeaderboard(false)
                }
            } catch (err) {
                console.error('Error fetching assigned courses for leaderboard:', err)
            } finally {
                if (isMounted) setLoadingCourses(false)
            }
        }

        fetchAssignedCourses()
        return () => { isMounted = false }
    }, [profile?.id, profile?.role, searchParams])

    // 2. Fetch Leaderboard for the selected assigned course only
    useEffect(() => {
        if (!selectedCourseId) {
            setLeaderboard([])
            setLoadingLeaderboard(false)
            return
        }

        let isMounted = true

        async function fetchCourseLeaderboard() {
            try {
                setLoadingLeaderboard(true)

                // 1. Try fast RPC get_course_leaderboard first (handles RLS cleanly)
                const { data: rpcData, error: rpcError } = await supabase
                    .rpc('get_course_leaderboard', { p_course_id: selectedCourseId })

                let rawStudents = []

                if (!rpcError && Array.isArray(rpcData)) {
                    rawStudents = rpcData
                } else {
                    // Fallback to direct table query
                    const { data: enrollments, error: enrollError } = await supabase
                        .from('enrollments')
                        .select('student_id')
                        .eq('course_id', selectedCourseId)

                    if (enrollError) throw enrollError

                    const studentIds = (enrollments || []).map(e => e.student_id).filter(Boolean)

                    if (studentIds.length > 0) {
                        const { data: students, error: studentsError } = await supabase
                            .from('users')
                            .select('id, name, avatar_url, xp')
                            .in('id', studentIds)

                        if (studentsError) throw studentsError
                        rawStudents = students || []
                    }
                }

                const sortedStudents = [...rawStudents].sort((a, b) => {
                    const xpA = a.xp || 0
                    const xpB = b.xp || 0
                    if (xpB !== xpA) return xpB - xpA
                    return (a.name || '').localeCompare(b.name || '')
                })

                const leaderboardData = sortedStudents.map((s, index) => ({
                    ...s,
                    xp: s.xp || 0,
                    rank: index + 1,
                    ...getRankInfo(s.xp || 0)
                }))

                if (isMounted) {
                    setLeaderboard(leaderboardData)
                }
            } catch (err) {
                console.error('Error fetching course leaderboard:', err)
            } finally {
                if (isMounted) setLoadingLeaderboard(false)
            }
        }

        fetchCourseLeaderboard()

        // Real-time listener for XP or enrollment changes
        const channel = supabase
            .channel(`course-lb-${selectedCourseId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchCourseLeaderboard())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments', filter: `course_id=eq.${selectedCourseId}` }, () => fetchCourseLeaderboard())
            .subscribe()

        return () => {
            isMounted = false
            supabase.removeChannel(channel)
        }
    }, [selectedCourseId])

    const selectedCourse = useMemo(() => {
        return courses.find(c => c.id === selectedCourseId)
    }, [courses, selectedCourseId])

    const handleCourseChange = (newCourseId) => {
        setSelectedCourseId(newCourseId)
        setSearchParams({ courseId: newCourseId })
    }

    const filteredLeaderboard = leaderboard.filter(s => 
        s.name?.toLowerCase().includes(search.toLowerCase())
    )

    const topThree = leaderboard.slice(0, 3)
    const others = filteredLeaderboard.slice(0, 50)
    const currentStudentIndex = leaderboard.findIndex(s => s.id === profile?.id)
    const currentStudentRank = currentStudentIndex >= 0 ? currentStudentIndex + 1 : null
    const currentStudentXP = currentStudentIndex >= 0 ? leaderboard[currentStudentIndex]?.xp : (profile?.xp || 0)

    const isLoading = loadingCourses || loadingLeaderboard

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.85rem', padding: '0.5rem 1.25rem', background: 'rgba(99,102,241,0.1)', borderRadius: '100px', color: 'var(--accent)', marginBottom: '1rem', border: '1px solid rgba(99,102,241,0.2)', position: 'relative' }}>
                    <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', position: 'relative' }}>
                        <div className="pulse-dot" style={{ position: 'absolute', inset: 0, background: '#10b981', borderRadius: '50%', opacity: 0.6 }}></div>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>COURSE RANKINGS</span>
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
                    Course <span className="gradient-text">Leaderboard</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto', lineHeight: 1.5 }}>
                    Real-time rankings among enrolled peers in your assigned course. Every challenge and lesson counts!
                </p>

                {/* Course Switcher / Assigned Course Badge */}
                {courses.length > 1 ? (
                    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.65rem',
                            background: 'white', padding: '0.5rem 1.2rem',
                            borderRadius: '16px', border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.04)'
                        }}>
                            <BookOpen size={18} color="#6366f1" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Course:</span>
                            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                                <select
                                    value={selectedCourseId}
                                    onChange={(e) => handleCourseChange(e.target.value)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#1e293b',
                                        fontWeight: 700,
                                        fontSize: '0.92rem',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        paddingRight: '1.25rem',
                                        appearance: 'none'
                                    }}
                                >
                                    {courses.map(c => (
                                        <option key={c.id} value={c.id} style={{ color: '#1e293b' }}>
                                            {c.title}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} color="#64748b" style={{ position: 'absolute', right: 0, pointerEvents: 'none' }} />
                            </div>
                        </div>
                    </div>
                ) : selectedCourse ? (
                    <div style={{ marginTop: '1.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#eff6ff', border: '1px solid #dbeafe', padding: '0.45rem 1.25rem', borderRadius: '100px', color: '#2563eb', fontWeight: 700, fontSize: '0.9rem' }}>
                        <BookOpen size={16} /> {selectedCourse.title}
                    </div>
                ) : null}

                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); opacity: 0.6; }
                        100% { transform: scale(3); opacity: 0; }
                    }
                    .pulse-dot { animation: pulse 2s infinite; }
                `}</style>
            </div>

            {/* Empty State when no course is assigned */}
            {!isLoading && courses.length === 0 && (
                <div className="glass-card" style={{ padding: '3.5rem 2rem', textAlign: 'center', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
                        <BookOpen size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>No Course Assigned Yet</h3>
                    <p style={{ color: '#64748b', maxWidth: '420px', margin: '0 auto', fontSize: '0.9rem', lineHeight: 1.5 }}>
                        You are not currently enrolled in an active course. Once an instructor assigns you to a course, your classmates and leaderboard will appear here.
                    </p>
                </div>
            )}

            {/* Current Standing in Assigned Course */}
            {profile?.role === 'student' && !isLoading && courses.length > 0 && (
                <div className="glass-card" style={{ padding: '1.25rem 1.75rem', marginBottom: '2.5rem', borderLeft: '4px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trophy size={24} color="var(--accent)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your Course Standing</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {currentStudentRank ? (
                                    <>
                                        Rank #{currentStudentRank} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>of {leaderboard.length} enrolled {leaderboard.length === 1 ? 'student' : 'students'}</span>
                                    </>
                                ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Not ranked in this course yet</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Course Experience</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)' }}>
                            {currentStudentXP.toLocaleString()} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>XP</span>
                        </div>
                    </div>
                </div>
            )}

            {isLoading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}><div className="spinner"></div></div>
            ) : courses.length > 0 && leaderboard.length === 0 ? (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                    <Trophy size={40} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>No peers enrolled yet</h3>
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>You are the first student in this course. Solve challenges and watch videos to set the pace!</p>
                </div>
            ) : courses.length > 0 && (
                <>
                    {/* Podium for top 3 in the assigned course */}
                    {topThree.length > 0 && (
                        <div className="podium-container" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2rem', marginBottom: '4rem', marginTop: '2rem', padding: '1rem', background: 'radial-gradient(circle at center, rgba(99,102,241,0.05) 0%, transparent 70%)' }}>
                            {/* 2nd Place */}
                            {topThree[1] && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.3s ease' }} className="podium-hover">
                                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                        <div style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid #94a3b8', padding: 2, boxShadow: '0 0 20px rgba(148,163,184,0.3)' }}>
                                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                                                {topThree[1]?.avatar_url ? <img src={topThree[1].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={45} style={{ margin: '15px auto', color: '#94a3b8' }} />}
                                            </div>
                                        </div>
                                        <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', background: '#94a3b8', color: 'white', padding: '2px 12px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 900, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>#2</div>
                                        <Medal size={24} color="#94a3b8" style={{ position: 'absolute', top: -15, right: -10 }} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{topThree[1]?.name || '---'}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{topThree[1]?.xp || 0} XP</div>
                                    </div>
                                </div>
                            )}

                            {/* 1st Place */}
                            {topThree[0] && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'scale(1.2) translateY(-20px)', zIndex: 5, transition: 'transform 0.3s ease' }} className="podium-hover">
                                    <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                                        <Trophy size={36} color="#f59e0b" style={{ position: 'absolute', top: -45, left: '50%', transform: 'translateX(-50%)', filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.5))' }} />
                                        <div style={{ width: 100, height: 100, borderRadius: '50%', border: '5px solid #f59e0b', padding: 3, boxShadow: '0 0 30px rgba(245,158,11,0.4)', background: 'rgba(255,255,255,0.05)' }}>
                                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                                                {topThree[0]?.avatar_url ? <img src={topThree[0].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={55} style={{ margin: '20px auto', color: '#f59e0b' }} />}
                                            </div>
                                        </div>
                                        <div style={{ position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: 'white', padding: '4px 16px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 900, boxShadow: '0 4px 15px rgba(245,158,11,0.3)' }}>#1</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{topThree[0]?.name || '---'}</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b' }}>{topThree[0]?.xp || 0} XP</div>
                                    </div>
                                </div>
                            )}

                            {/* 3rd Place */}
                            {topThree[2] && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.3s ease' }} className="podium-hover">
                                    <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                        <div style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid #b45309', padding: 2, boxShadow: '0 0 20px rgba(180,83,9,0.2)' }}>
                                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                                                {topThree[2]?.avatar_url ? <img src={topThree[2].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={45} style={{ margin: '15px auto', color: '#b45309' }} />}
                                            </div>
                                        </div>
                                        <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', background: '#b45309', color: 'white', padding: '2px 12px', borderRadius: 10, fontSize: '0.85rem', fontWeight: 900, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>#3</div>
                                        <Award size={24} color="#b45309" style={{ position: 'absolute', top: -15, left: -10 }} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{topThree[2]?.name || '---'}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#b45309' }}>{topThree[2]?.xp || 0} XP</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <style>{`
                        .podium-hover:hover { transform: translateY(-5px) !important; }
                        @media (max-width: 600px) {
                            .podium-container {
                                gap: 0.5rem !important;
                                transform: scale(0.85);
                                transform-origin: bottom center;
                            }
                        }
                    `}</style>

                    {/* Search & List */}
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', position: 'relative', flex: 1, maxWidth: '400px' }}>
                                <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '1rem' }} />
                                <input 
                                    type="text"
                                    placeholder="Search enrolled classmate..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ 
                                        width: '100%', 
                                        padding: '0.75rem 1rem 0.75rem 2.6rem', 
                                        borderRadius: 12, 
                                        border: '1px solid #e2e8f0', 
                                        background: 'white', 
                                        color: '#1e293b',
                                        outline: 'none', 
                                        fontSize: '0.88rem'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.82rem', fontWeight: 700 }}>
                                <TrendingUp size={16} color="var(--accent)" />
                                CLASS ACTIVITY
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {others.map((s) => {
                                const rank = s.rank
                                const isCurrentUser = s.id === profile?.id
                                return (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: isCurrentUser ? 'rgba(99,102,241,0.06)' : 'white', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', transition: 'background 0.2s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 min-content' }}>
                                            <div style={{ 
                                                width: 32, 
                                                height: 32, 
                                                borderRadius: '50%', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center', 
                                                fontSize: '0.85rem', 
                                                fontWeight: 800, 
                                                background: getRankBg(rank), 
                                                color: getRankColor(rank), 
                                                flexShrink: 0 
                                            }}>
                                                {rank}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                                <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9', flexShrink: 0 }}>
                                                    {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} style={{ margin: '8px auto', color: '#94a3b8' }} />}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                                                        {s.name} {isCurrentUser && <span style={{ fontSize: '0.7rem', color: 'var(--accent)', marginLeft: '0.5rem', fontWeight: 800, textTransform: 'uppercase' }}>(You)</span>}
                                                    </div>
                                                    <div style={{ 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '0.4rem', 
                                                        padding: '0.2rem 0.6rem', 
                                                        borderRadius: 100, 
                                                        background: s.bg, 
                                                        color: s.color, 
                                                        fontSize: '0.72rem', 
                                                        fontWeight: 700, 
                                                        textTransform: 'uppercase', 
                                                        marginTop: '0.25rem' 
                                                    }}>
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                                                        {s.rankName}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', textAlign: 'right' }}>
                                            {s.xp.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>XP</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
