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
    const [course, setCourse] = useState(null)
    const [sessions, setSessions] = useState([])
    const [challenges, setChallenges] = useState([])
    const [assessments, setAssessments] = useState({ daily: [], weekly: [], final: [] })
    const [submissions, setSubmissions] = useState({}) // { assessmentId: [sub, ...] }
    const [progress, setProgress] = useState(null)
    const [courseResources, setCourseResources] = useState([])
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
                { data: locks },
                { data: resData }
            ] = await Promise.all([
                supabase.from('courses').select('*').eq('id', courseId).single(),
                supabase.from('videos').select('*').eq('course_id', courseId).order('scheduled_time', { ascending: true }),
                supabase.from('progress').select('*').eq('student_id', profile.id).eq('course_id', courseId).single(),
                supabase.from('coding_challenges').select('*').eq('course_id', courseId),
                supabase.from('assessments').select('*').eq('course_id', courseId).order('due_date', { ascending: true }),
                supabase.from('assessment_submissions').select('*').eq('student_id', profile.id),
                supabase.from('group_members').select('group_id').eq('student_id', profile.id),
                supabase.from('resource_access').select('*').eq('is_locked', true),
                supabase.from('course_resources').select('*').eq('course_id', courseId).order('created_at', { ascending: false })
            ])

            const userGroupIds = memberships?.map(m => m.group_id) || []
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

    const completedIds = progress ? [progress.video_id] : []

    const isLive = (t) => t && Math.abs(new Date() - new Date(t)) < 3600000
    const isUpcoming = (t) => t && new Date(t) > new Date() && !isLive(t)
    const isRecorded = (v) => v && v.video_url && v.video_url.includes('supabase.co/storage')

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
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: '#f1f5f9', padding: '0.375rem', borderRadius: 12, border: '1px solid var(--card-border)', width: 'fit-content' }}>
                {[
                    { id: 'sessions', label: `Sessions (${sessions.length})`, icon: <Video size={14} /> },
                    { id: 'coding', label: `Coding (${challenges.length})`, icon: <Code size={14} /> },
                    { id: 'assessments', label: `Assessments`, icon: <ClipboardList size={14} /> },
                    { id: 'resources', label: `Resources (${courseResources.length})`, icon: <FileText size={14} /> }
                ].map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        padding: '0.5rem 1rem', borderRadius: 9, border: 'none', cursor: 'pointer',
                        fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s ease',
                        background: activeTab === t.id ? 'white' : 'transparent',
                        color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: activeTab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                    }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Sessions Tab */}
            {activeTab === 'sessions' && (
                <div className="glass-card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Video size={16} color="#818cf8" />
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Course Sessions ({sessions.length})</h3>
                    </div>

                    {sessions.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Video size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                            <p>No sessions scheduled yet</p>
                        </div>
                    ) : (
                        <div style={{ padding: '1rem' }}>
                            {sessions.map((s, i) => {
                                const live = isLive(s.scheduled_time)
                                const upcoming = isUpcoming(s.scheduled_time)
                                const done = completedIds.includes(s.id)
                                const recorded = isRecorded(s)
                                return (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: 12, marginBottom: '0.5rem', background: live ? 'rgba(239,68,68,0.06)' : activeVideo?.id === s.id ? 'rgba(99,102,241,0.06)' : '#f8fafc', border: `1px solid ${live ? 'rgba(239,68,68,0.2)' : activeVideo?.id === s.id ? 'var(--accent-light)' : done ? 'rgba(16,185,129,0.2)' : '#e2e8f0'}` }}>
                                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: live ? 'rgba(239,68,68,0.15)' : done ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            {done ? <CheckCircle size={16} color="#10b981" /> : live ? <Zap size={16} color="#f87171" /> : <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#818cf8' }}>{i + 1}</span>}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
                                                {!recorded && s.scheduled_time && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} />{new Date(s.scheduled_time).toLocaleString()}</span>}
                                                {recorded && <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#10b981', fontWeight: 600 }}>Recorded</span>}
                                                {s.duration_minutes && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={11} />{s.duration_minutes} min</span>}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            {live && <span className="badge badge-danger">🔴 LIVE NOW</span>}
                                            {upcoming && <span className="badge badge-warning">Upcoming</span>}
                                            {done && <span className="badge badge-success">Completed</span>}
                                            {recorded ? (
                                                <button onClick={() => { setActiveVideo(s); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem', gap: '0.4rem' }}>
                                                    <Play size={13} fill="white" /> Watch
                                                </button>
                                            ) : s.video_url && (
                                                <a href={s.video_url} target="_blank" rel="noreferrer" className={live ? 'btn-primary' : 'btn-secondary'} style={{ textDecoration: 'none', padding: '0.4rem 0.9rem', fontSize: '0.78rem', background: live ? 'linear-gradient(135deg,#ef4444,#dc2626)' : undefined }}>
                                                    <ExternalLink size={13} /> {live ? 'Join Now' : 'Join'}
                                                </a>
                                            )}
                                            {!done && !upcoming && !live && (
                                                <button onClick={() => markComplete(s.id)} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>✓ Done</button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Coding Tab */}
            {activeTab === 'coding' && (
                <div className="glass-card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Zap size={16} color="#f59e0b" />
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Coding Practice ({challenges.length})</h3>
                    </div>
                    {challenges.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Zap size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                            <p>No coding challenges for this course yet</p>
                        </div>
                    ) : (
                        <div style={{ padding: '1rem' }}>
                            {challenges.map(c => (
                                <Link key={c.id} to={`/student/coding/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', borderRadius: 12, marginBottom: '0.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', textDecoration: 'none', transition: 'all 0.2s ease' }}
                                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent-light)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                    onMouseOut={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: '0.9rem' }}>{c.language === 'python' ? '🐍' : c.language === 'java' ? '☕' : '💻'}</span>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{c.title}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '0.2rem' }}>
                                            <span>{c.language?.toUpperCase()}</span>
                                            <span>{c.xp_reward} XP</span>
                                            <span style={{ color: c.difficulty === 'easy' ? '#10b981' : c.difficulty === 'medium' ? '#f59e0b' : '#ef4444', fontWeight: 600 }}>{c.difficulty?.toUpperCase()}</span>
                                        </div>
                                    </div>
                                    <button className="btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem' }}>Solve →</button>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Assessments Tab */}
            {activeTab === 'assessments' && (
                <div>
                    {Object.values(assessments).every(a => !a.length) ? (
                        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <ClipboardList size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                            <p>No assessments for this course yet</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', alignItems: 'start' }}>
                            {[
                                { type: 'daily', label: 'Daily Assessments', color: '#6366f1', bg: 'rgba(99,102,241,0.07)', border: 'rgba(99,102,241,0.2)' },
                                { type: 'weekly', label: 'Weekly Assessments', color: '#f59e0b', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.2)' },
                                { type: 'final', label: 'Final Assessments', color: '#10b981', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.2)' },
                            ].map(({ type, label, color, bg, border }) => (
                                <div key={type} className="glass-card" style={{ overflow: 'hidden', border: `1px solid ${border}` }}>
                                    {/* Column Header */}
                                    <div style={{ padding: '0.875rem 1rem', background: bg, borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <ClipboardList size={15} color={color} />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{label}</span>
                                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 600, background: color + '22', color, padding: '0.15rem 0.5rem', borderRadius: 20 }}>
                                            {assessments[type]?.length || 0}
                                        </span>
                                    </div>

                                    {/* Items */}
                                    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                        {!assessments[type]?.length ? (
                                            <div style={{ padding: '1.5rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                                No {type} assessments yet
                                            </div>
                                        ) : assessments[type].map(a => {
                                            const attemptCount = (submissions[a.id] || []).length
                                            const displayCount = Math.min(attemptCount, MAX_ATTEMPTS)
                                            const isExhausted = attemptCount >= MAX_ATTEMPTS
                                            return (
                                                <div key={a.id} style={{ padding: '0.875rem', borderRadius: 10, background: isExhausted ? '#fef2f2' : '#f8fafc', border: `1px solid ${isExhausted ? '#fecaca' : '#e2e8f0'}` }}>
                                                    {/* Title */}
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>{a.title}</div>
                                                    {a.due_date && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3, marginBottom: '0.6rem' }}>
                                                            <Calendar size={9} /> Due {new Date(a.due_date).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                    {/* Progress bar */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                                                        <div style={{ flex: 1, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                                                            <div style={{ width: `${(displayCount / MAX_ATTEMPTS) * 100}%`, height: '100%', background: isExhausted ? '#ef4444' : color, borderRadius: 2, transition: 'width 0.4s ease' }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isExhausted ? '#dc2626' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>{displayCount}/{MAX_ATTEMPTS}</span>
                                                    </div>
                                                    {/* Button */}
                                                    {isExhausted ? (
                                                        <button onClick={() => navigate(`/student/assessments/${a.id}/review`)} style={{ width: '100%', padding: '0.45rem', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                                            <Eye size={12} /> Review Attempts
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => navigate(`/student/assessments/${a.id}/take`)} style={{ width: '100%', padding: '0.45rem', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: 'white', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                                                            {attemptCount > 0 ? '↺ Retry' : '▶ Start Assessment'}
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'resources' && (
                <div className="animate-fade-in">
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                        <FileText size={16} color="#10b981" />
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Study Materials ({courseResources.length})</h3>
                    </div>

                    <div style={{ padding: '1.5rem', background: 'white', borderBottomLeftRadius: 16, borderBottomRightRadius: 16, border: '1px solid var(--card-border)', borderTop: 'none' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                            {courseResources.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    <FileText size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                                    <p>No study materials uploaded yet</p>
                                </div>
                            ) : courseResources.map(r => (
                                <div key={r.id} className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{ width: 36, height: 36, background: r.resource_type === 'ppt' ? 'rgba(249,115,22,0.1)' : 'rgba(16,185,129,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <FileText size={18} color={r.resource_type === 'ppt' ? '#f97316' : '#10b981'} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{r.resource_type.toUpperCase()}</div>
                                        </div>
                                    </div>
                                    {r.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.description}</p>}
                                    <a href={r.file_url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ width: '100%', justifyContent: 'center', gap: '0.4rem', marginTop: 'auto', padding: '0.5rem', fontSize: '0.78rem' }}>
                                        <ExternalLink size={14} /> View Material
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
