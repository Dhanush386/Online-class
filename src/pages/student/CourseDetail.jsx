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
            {/* Day Accordion List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
                {Array.from({ length: daysCount }, (_, i) => i + 1).map(day => {
                    const status = getDayStatus(day)
                    const isActive = selectedDay === day

                    // Filter content for this day to calculate topic count
                    const daySessions = sessions.filter(s => (s.day_number || 1) === day)
                    const dayChallenges = challenges.filter(c => (c.day_number || 1) === day)
                    const dayAssessmentsCount = assessments.daily.filter(a => (a.day_number || 1) === day).length +
                        assessments.weekly.filter(a => (a.day_number || 1) === day).length +
                        assessments.final.filter(a => (a.day_number || 1) === day).length
                    const dayResources = courseResources.filter(r => (r.day_number || 1) === day)

                    const topicCount = daySessions.length + dayChallenges.length + dayAssessmentsCount + dayResources.length

                    return (
                        <div key={day} className="glass-card" style={{ overflow: 'hidden', border: isActive ? '1px solid var(--accent-light)' : '1px solid var(--card-border)', transition: 'all 0.3s ease' }}>
                            {/* Accordion Header */}
                            <div
                                onClick={() => setSelectedDay(isActive ? null : day)}
                                style={{
                                    padding: '1.25rem 1.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    background: isActive ? 'rgba(99,102,241,0.03)' : 'transparent',
                                    userSelect: 'none'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {isActive ? <ChevronRight size={20} style={{ transform: 'rotate(90deg)', transition: 'transform 0.3s ease', color: 'var(--accent-light)' }} /> : <ChevronRight size={20} style={{ transition: 'transform 0.3s ease', color: 'var(--text-muted)' }} />}
                                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isActive ? 'var(--accent-light)' : 'var(--text-primary)' }}>Day {day}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-muted)' }} />
                                        {topicCount} Topics
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {status.locked && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, background: '#fef2f2', padding: '0.25rem 0.6rem', borderRadius: 20 }}>
                                            <Lock size={12} /> Locked
                                        </div>
                                    )}
                                    {!status.locked && topicCount === 0 && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Empty</span>
                                    )}
                                </div>
                            </div>

                            {/* Accordion Body */}
                            {isActive && (
                                <div className="animate-fade-in" style={{ padding: '0 1.5rem 1.5rem', borderTop: '1px solid var(--card-border)' }}>
                                    <div style={{ paddingTop: '1.5rem' }}>
                                        {status.locked ? (
                                            <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
                                                <Lock size={32} color="#94a3b8" style={{ marginBottom: '1rem' }} />
                                                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Content Locked</h4>
                                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{status.reason || "This day's content is not yet available."}</p>
                                            </div>
                                        ) : topicCount === 0 ? (
                                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                                <Calendar size={32} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No content uploaded for this day yet.</p>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                                {/* Day Sessions */}
                                                {daySessions.length > 0 && (
                                                    <section>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                            <Video size={16} color="#6366f1" />
                                                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Live Class & Videos</h4>
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                            {daySessions.map(s => {
                                                                const live = isLive(s.scheduled_time)
                                                                const recorded = isRecorded(s)
                                                                return (
                                                                    <div key={s.id} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: live ? 'rgba(239,68,68,0.03)' : 'white' }}>
                                                                        <div style={{ width: 36, height: 36, borderRadius: 10, background: live ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                            {live ? <Zap size={18} color="#f87171" /> : <Play size={18} color="#818cf8" />}
                                                                        </div>
                                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</div>
                                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                                                {recorded ? 'Recorded Lesson' : s.scheduled_time ? new Date(s.scheduled_time).toLocaleString() : 'TBA'}
                                                                            </div>
                                                                        </div>
                                                                        {recorded ? (
                                                                            <button onClick={() => { setActiveVideo(s); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Watch</button>
                                                                        ) : s.video_url && (
                                                                            <a href={s.video_url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', textDecoration: 'none' }}>Join</a>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </section>
                                                )}

                                                {/* Day Coding Challenges */}
                                                {dayChallenges.length > 0 && (
                                                    <section>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                            <Code size={16} color="#f59e0b" />
                                                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Coding Practice</h4>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                                                            {dayChallenges.map(c => (
                                                                <Link key={c.id} to={`/student/coding/${c.id}`} className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', textDecoration: 'none' }}>
                                                                    <div style={{ fontSize: '1.25rem' }}>{c.language === 'python' ? '🐍' : '💻'}</div>
                                                                    <div style={{ flex: 1 }}>
                                                                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</div>
                                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{c.difficulty.toUpperCase()} • {c.xp_reward} XP</div>
                                                                    </div>
                                                                    <ChevronRight size={14} color="var(--text-muted)" />
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}

                                                {/* Day Assessments */}
                                                {(assessments.daily.filter(a => (a.day_number || 1) === day).length > 0 ||
                                                    assessments.weekly.filter(a => (a.day_number || 1) === day).length > 0 ||
                                                    assessments.final.filter(a => (a.day_number || 1) === day).length > 0) && (
                                                        <section>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                                <ClipboardList size={16} color="#10b981" />
                                                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Assessments</h4>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                {['daily', 'weekly', 'final'].map(type =>
                                                                    assessments[type].filter(a => (a.day_number || 1) === day).map(a => {
                                                                        const attempts = (submissions[a.id] || []).length
                                                                        return (
                                                                            <div key={a.id} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: `4px solid ${ASSESS_COLORS[type]}` }}>
                                                                                <div>
                                                                                    <div style={{ fontSize: '0.65rem', fontWeight: 800, color: ASSESS_COLORS[type], textTransform: 'uppercase' }}>{type}</div>
                                                                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{a.title}</div>
                                                                                </div>
                                                                                <button onClick={() => navigate(`/student/assessments/${a.id}/take`)} className="btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>
                                                                                    {attempts > 0 ? 'Retry' : 'Start'}
                                                                                </button>
                                                                            </div>
                                                                        )
                                                                    })
                                                                )}
                                                            </div>
                                                        </section>
                                                    )}

                                                {/* Day Resources */}
                                                {dayResources.length > 0 && (
                                                    <section>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                            <FileText size={16} color="#64748b" />
                                                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Study Materials</h4>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '0.75rem' }}>
                                                            {dayResources.map(r => (
                                                                <div key={r.id} className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#f8fafc' }}>
                                                                    <FileText size={16} color={r.resource_type === 'ppt' ? '#f97316' : '#10b981'} />
                                                                    <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                                                                    <a href={r.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-light)' }}><ExternalLink size={14} /></a>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
