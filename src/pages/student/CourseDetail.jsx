import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Video, Clock, ExternalLink, Calendar, CheckCircle, Zap, Play, X, ClipboardList, Code, ChevronRight, Eye, Lock, FileText } from 'lucide-react'
import ReactPlayer from 'react-player'

const MAX_ATTEMPTS = 2
const ASSESS_COLORS = { daily: '#6366f1', weekly: '#f59e0b', final: '#10b981' }

export default function CourseDetail() {
    const { courseId } = useParams()
    const { profile } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    // Helper utilities
    const isLive = (t) => t && Math.abs(new Date() - new Date(t)) < 3600000
    const isUpcoming = (t) => t && new Date(t) > new Date() && !isLive(t)
    const isRecorded = (vid) => vid && vid.video_url && vid.video_url.includes('supabase.co/storage')
    const toLocalISO = (date) => {
        if (!date) return ''
        const d = new Date(date)
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    }

    const [course, setCourse] = useState(null)
    const [sessions, setSessions] = useState([])
    const [challenges, setChallenges] = useState([])
    const [assessments, setAssessments] = useState({ daily: [], weekly: [], final: [] })
    const [submissions, setSubmissions] = useState({}) // { assessmentId: [sub, ...] }
    const [progress, setProgress] = useState(null)
    const completedIds = progress ? [progress.video_id] : []
    const [courseResources, setCourseResources] = useState([])
    const [dayAccess, setDayAccess] = useState([])
    const [selectedDay, setSelectedDay] = useState(1)
    const [loading, setLoading] = useState(true)
    const [activeVideo, setActiveVideo] = useState(null)
    const [activeTab, setActiveTab] = useState(location.state?.tab || 'sessions')

    useEffect(() => {
        async function load() {
            if (!profile?.id || !courseId) return
            const [
                { data: crs },
                { data: vids },
                { data: prog },
                { data: chls },
                { data: assessData },
                { data: subData },
                { data: memberships },
                { data: dayAccessData },
                { data: locks },
                { data: resData }
            ] = await Promise.all([
                supabase.from('courses').select('*').eq('id', courseId).single(),
                supabase.from('videos').select('*').eq('course_id', courseId).order('day_number', { ascending: true }),
                supabase.from('progress').select('*').eq('student_id', profile.id).eq('course_id', courseId).single(),
                supabase.from('coding_challenges').select('*').eq('course_id', courseId).order('day_number', { ascending: true }),
                supabase.from('assessments').select('*').eq('course_id', courseId).order('day_number', { ascending: true }),
                supabase.from('assessment_submissions').select('*').eq('student_id', profile.id),
                supabase.from('group_members').select('group_id').eq('student_id', profile.id),
                supabase.from('day_access').select('*').eq('course_id', courseId),
                supabase.from('resource_access').select('*').eq('is_locked', true),
                supabase.from('course_resources').select('*').eq('course_id', courseId).order('day_number', { ascending: true })
            ])

            const allContentDays = [
                ...(vids || []).map(v => v.day_number),
                ...(chls || []).map(c => c.day_number),
                ...(assessData || []).map(a => a.day_number),
                ...(resData || []).map(r => r.day_number)
            ].filter(d => d !== null && d !== undefined)

            const max = Math.max(1, ...allContentDays)
            // No need for setMaxDay state if we just use it to build the day list, but let's see

            const userGroupIds = memberships?.map(m => m.group_id) || []
            const groupDayAccess = (dayAccessData || []).filter(da => userGroupIds.includes(da.group_id))
            setDayAccess(groupDayAccess)

            const lockedCodingIds = locks?.filter(l => userGroupIds.includes(l.group_id) && l.resource_type === 'coding').map(l => l.resource_id) || []
            const lockedAssessIds = locks?.filter(l => userGroupIds.includes(l.group_id) && l.resource_type === 'assessment').map(l => l.resource_id) || []
            const lockedMaterialIds = locks?.filter(l => userGroupIds.includes(l.group_id) && (l.resource_type === 'resource' || l.resource_type === 'other')).map(l => l.resource_id) || []

            setCourse(crs)
            setSessions(vids || [])
            setProgress(prog)
            setChallenges((chls || []).filter(c => !lockedCodingIds.includes(c.id)))
            setCourseResources((resData || []).filter(r => !lockedMaterialIds.includes(r.id)))

            const grouped = { daily: [], weekly: [], final: [] }
                ; (assessData || [])
                    .filter(a => !lockedAssessIds.includes(a.id))
                    .forEach(a => { if (grouped[a.type]) grouped[a.type].push(a) })
            setAssessments(grouped)

            const subMap = {}
                ; (subData || []).forEach(s => {
                    if (!subMap[s.assessment_id]) subMap[s.assessment_id] = []
                    subMap[s.assessment_id].push(s)
                })
            setSubmissions(subMap)
            setLoading(false)
        }
        load()
    }, [courseId, profile])

    async function updateOverallProgress() {
        if (!profile?.id || !courseId) return

        const totalSessions = sessions.length
        const totalCoding = challenges.length
        const totalAssessments = assessments.daily.length + assessments.weekly.length + assessments.final.length

        // Progress components
        const completedSessions = sessions.filter(s => completedIds.includes(s.id)).length
        const completedCoding = challenges.filter(c => (submissions[c.id] || []).some(s => s.status === 'accepted')).length
        // For assessments, we count if they have at least one submission
        let completedAssess = 0
        Object.values(assessments).flat().forEach(a => {
            if ((submissions[a.id] || []).length > 0) completedAssess++
        })

        const sessionPct = totalSessions > 0 ? (completedSessions / totalSessions) : 0
        const codingPct = totalCoding > 0 ? (completedCoding / totalCoding) : 0
        const assessPct = totalAssessments > 0 ? (completedAssess / totalAssessments) : 0

        // Balanced average (1/3 each)
        // If a category doesn't exist (total is 0), we ignore it and re-weight the others
        let activeCategories = 0
        let sumPct = 0
        if (totalSessions > 0) { activeCategories++; sumPct += sessionPct }
        if (totalCoding > 0) { activeCategories++; sumPct += codingPct }
        if (totalAssessments > 0) { activeCategories++; sumPct += assessPct }

        const finalPct = activeCategories > 0 ? Math.round((sumPct / activeCategories) * 100) : 0

        await supabase.from('progress').upsert({
            student_id: profile.id,
            course_id: courseId,
            completion_percentage: finalPct,
            last_updated: new Date().toISOString()
        }, { onConflict: 'student_id, course_id' })

        setProgress(p => ({ ...(p || {}), completion_percentage: finalPct }))
    }

    async function markComplete(sessionId) {
        // Optimistically update
        const newCompletedIds = [...completedIds, sessionId]

        const totalSessions = sessions.length
        const completedSessionsCount = newCompletedIds.length
        const totalCoding = challenges.length
        const totalAssessments = assessments.daily.length + assessments.weekly.length + assessments.final.length

        // Calculate based on the NEW state
        const sessionPct = totalSessions > 0 ? (completedSessionsCount / totalSessions) : 0
        // ... rest stays same but for simplicity we reuse the weighted logic

        // Actually, let's just update the table record which tracks the specific video_id for backward compatibility
        // but our NEW logic will use counts from other tables.

        await supabase.from('progress').upsert({
            student_id: profile.id,
            course_id: courseId,
            video_id: sessionId, // Keep for legacy logic
            completed: true
        }, { onConflict: 'student_id, course_id' })

        updateOverallProgress()
    }

    const getDayStatus = (dayNum) => {
        const access = dayAccess.find(a => a.day_number === dayNum)
        if (!access) return { locked: false, reason: '' } // Default to open if no specific batch rule? Or maybe default to locked?

        if (access.is_locked) return { locked: true, reason: 'Locked by Instructor' }

        if (access.open_time && new Date(access.open_time) > new Date()) {
            return { locked: true, reason: `Opens at ${new Date(access.open_time).toLocaleString()}` }
        }

        if (access.close_time && new Date(access.close_time) < new Date()) {
            return { locked: true, reason: 'Access Period Ended' }
        }

        return { locked: false, reason: '' }
    }

    const daysCount = Math.max(1, ...[
        ...sessions.map(s => s.day_number),
        ...challenges.map(c => c.day_number),
        ...Object.values(assessments).flat().map(a => a.day_number),
        ...courseResources.map(r => r.day_number)
    ].filter(d => d !== null))


    if (loading) return <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Loading...</div>

    return (
        <div className="animate-fade-in">
            {/* Player Modal / Inline Player */}
            {activeVideo && (
                <div style={{ marginBottom: '2rem' }} className="animate-fade-in">
                    <div className="glass-card" style={{ padding: '1rem', background: '#000', borderRadius: 16, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', marginBottom: '0.5rem' }}>
                            <h2 style={{ color: 'white', fontSize: '1rem', fontWeight: 600 }}>{activeVideo.title}</h2>
                            <button onClick={() => setActiveVideo(null)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer', color: 'white' }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 12, overflow: 'hidden' }}>
                            <ReactPlayer
                                url={activeVideo.video_url}
                                controls
                                width="100%"
                                height="100%"
                                style={{ position: 'absolute', top: 0, left: 0 }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{course?.title}</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{course?.description}</p>
                    </div>
                    {(course?.start_date || course?.end_date) && (
                        <div style={{ textAlign: 'right', background: 'rgba(99,102,241,0.05)', padding: '0.75rem 1.25rem', borderRadius: 12, border: '1px solid rgba(99,102,241,0.1)' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Course Timeline</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={14} color="#6366f1" />
                                {course.start_date ? new Date(course.start_date).toLocaleDateString() : 'TBA'} - {course.end_date ? new Date(course.end_date).toLocaleDateString() : 'TBA'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress banner */}
            {progress && (
                <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Your Progress</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-light)' }}>{progress.completion_percentage}%</span>
                        </div>
                        <div className="progress-bar-track">
                            <div className="progress-bar-fill" style={{ width: `${progress.completion_percentage}%` }} />
                        </div>
                    </div>
                </div>
            )}
            {/* Day Selector */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Select Day</div>
                <div style={{ display: 'flex', gap: '0.625rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }} className="hide-scrollbar">
                    {Array.from({ length: daysCount }, (_, i) => i + 1).map(day => {
                        const status = getDayStatus(day)
                        const isActive = selectedDay === day
                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                style={{
                                    minWidth: 80,
                                    padding: '0.75rem 1rem',
                                    borderRadius: 14,
                                    border: isActive ? '2px solid var(--accent-light)' : '1px solid var(--card-border)',
                                    background: isActive ? 'white' : status.locked ? '#f1f5f9' : 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: isActive ? '0 4px 12px rgba(99,102,241,0.15)' : 'none',
                                    opacity: status.locked && !isActive ? 0.6 : 1,
                                    transform: isActive ? 'scale(1.05)' : 'none'
                                }}
                            >
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isActive ? '#6366f1' : 'var(--text-muted)' }}>DAY</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: isActive ? '#6366f1' : 'var(--text-primary)' }}>{day}</span>
                                {status.locked && <Lock size={12} color="#94a3b8" />}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Selected Day Content */}
            {(() => {
                const dayStatus = getDayStatus(selectedDay)
                if (dayStatus.locked) {
                    return (
                        <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', border: '1px dashed #cbd5e1' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
                                <Lock size={32} color="#ef4444" />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Day {selectedDay} is Locked</h3>
                            <p style={{ color: 'var(--text-secondary)', maxWidth: 400 }}>{dayStatus.reason || "This content hasn't been released yet or is restricted by your instructor."}</p>
                            <button onClick={() => setSelectedDay(1)} className="btn-secondary" style={{ marginTop: '1rem' }}>Go to Available Days</button>
                        </div>
                    )
                }

                const daySessions = sessions.filter(s => (s.day_number || 1) === selectedDay)
                const dayChallenges = challenges.filter(c => (c.day_number || 1) === selectedDay)
                const dayAssessments = {
                    daily: assessments.daily.filter(a => (a.day_number || 1) === selectedDay),
                    weekly: assessments.weekly.filter(a => (a.day_number || 1) === selectedDay),
                    final: assessments.final.filter(a => (a.day_number || 1) === selectedDay)
                }
                const dayResources = courseResources.filter(r => (r.day_number || 1) === selectedDay)

                const hasContent = daySessions.length > 0 || dayChallenges.length > 0 || Object.values(dayAssessments).some(a => a.length > 0) || dayResources.length > 0

                if (!hasContent) {
                    return (
                        <div className="glass-card" style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                            <p>No content has been added for Day {selectedDay} yet.</p>
                        </div>
                    )
                }

                return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {/* Live/Recorded Sessions */}
                        {daySessions.length > 0 && (
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Video size={18} color="#6366f1" />
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Live Class & Videos</h3>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {daySessions.map((s, i) => {
                                        const live = isLive(s.scheduled_time)
                                        const upcoming = isUpcoming(s.scheduled_time)
                                        const done = completedIds.includes(s.id)
                                        const recorded = isRecorded(s)
                                        return (
                                            <div key={s.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', background: live ? 'rgba(239,68,68,0.06)' : activeVideo?.id === s.id ? 'rgba(99,102,241,0.06)' : 'white', border: `1px solid ${live ? 'rgba(239,68,68,0.2)' : activeVideo?.id === s.id ? 'var(--accent-light)' : '#e2e8f0'}` }}>
                                                <div style={{ width: 44, height: 44, borderRadius: 12, background: live ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {live ? <Zap size={20} color="#f87171" className="animate-pulse" /> : <Play size={20} color="#818cf8" />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.25rem' }}>
                                                        {!recorded && s.scheduled_time && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />{new Date(s.scheduled_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>}
                                                        {recorded && <span style={{ color: '#10b981', fontWeight: 600 }}>● Recorded Lesson</span>}
                                                        {s.duration_minutes && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} />{s.duration_minutes} min</span>}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    {live && <span style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 800, padding: '0.25rem 0.5rem', borderRadius: 6, letterSpacing: '0.05em' }}>LIVE</span>}
                                                    {recorded ? (
                                                        <button onClick={() => { setActiveVideo(s); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="btn-primary" style={{ padding: '0.5rem 1.25rem' }}>Watch</button>
                                                    ) : s.video_url && (
                                                        <a href={s.video_url} target="_blank" rel="noreferrer" className={live ? 'btn-primary' : 'btn-secondary'} style={{ textDecoration: 'none', padding: '0.5rem 1.25rem', background: live ? 'linear-gradient(135deg,#ef4444,#dc2626)' : undefined }}>
                                                            {live ? 'Join Now' : 'Link'}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Coding Challenges */}
                        {dayChallenges.length > 0 && (
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Code size={18} color="#f59e0b" />
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Coding Practice</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                                    {dayChallenges.map(c => (
                                        <Link key={c.id} to={`/student/coding/${c.id}`} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.25rem', textDecoration: 'none', transition: 'all 0.2s ease', border: '1px solid #e2e8f0', background: 'white' }}
                                            onMouseOver={e => { e.currentTarget.style.borderColor = '#f59e0b'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                            onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}>
                                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(245,158,11,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <span style={{ fontSize: '1.5rem' }}>{c.language === 'python' ? '🐍' : c.language === 'java' ? '☕' : '💻'}</span>
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
                                                    <span style={{ color: c.difficulty === 'easy' ? '#10b981' : c.difficulty === 'medium' ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{c.difficulty?.toUpperCase()}</span>
                                                    <span>• {c.xp_reward} XP</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} color="#94a3b8" />
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Assessments */}
                        {Object.values(dayAssessments).some(a => a.length > 0) && (
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <ClipboardList size={18} color="#10b981" />
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Quizzes & Assessments</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                    {Object.entries(dayAssessments).map(([type, list]) =>
                                        list.map(a => {
                                            const color = ASSESS_COLORS[type]
                                            const attempts = (submissions[a.id] || []).length
                                            const exhausted = attempts >= MAX_ATTEMPTS
                                            return (
                                                <div key={a.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: `1px solid ${exhausted ? '#e2e8f0' : color + '33'}` }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{type} Quiz</div>
                                                        {exhausted && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '0.1rem 0.4rem', borderRadius: 4 }}>Completed</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <div style={{ flex: 1, height: 4, background: '#f1f5f9', borderRadius: 2 }}>
                                                            <div style={{ width: `${(Math.min(attempts, MAX_ATTEMPTS) / MAX_ATTEMPTS) * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{attempts}/{MAX_ATTEMPTS}</span>
                                                    </div>
                                                    {exhausted ? (
                                                        <button onClick={() => navigate(`/student/assessments/${a.id}/review`)} className="btn-secondary" style={{ width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}>View Results</button>
                                                    ) : (
                                                        <button onClick={() => navigate(`/student/assessments/${a.id}/take`)} className="btn-primary" style={{ width: '100%', background: color, border: 'none', fontSize: '0.75rem', padding: '0.5rem' }}>{attempts > 0 ? 'Retry' : 'Start'}</button>
                                                    )}
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </section>
                        )}

                        {/* Resources */}
                        {dayResources.length > 0 && (
                            <section>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <FileText size={18} color="#64748b" />
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Study Materials</h3>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                    {dayResources.map(r => (
                                        <div key={r.id} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'white', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <FileText size={20} color={r.resource_type === 'ppt' ? '#f97316' : '#10b981'} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{r.resource_type.toUpperCase()}</div>
                                            </div>
                                            <a href={r.file_url} target="_blank" rel="noreferrer" title="View Material" style={{ color: '#6366f1' }}>
                                                <ExternalLink size={18} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )
            })()}
        </div>
    )
}
