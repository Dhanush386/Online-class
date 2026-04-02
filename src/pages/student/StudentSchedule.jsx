import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Calendar, Clock, ExternalLink, Video, Zap } from 'lucide-react'

export default function StudentSchedule() {
    const { profile } = useAuth()
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('upcoming') // 'upcoming' | 'past' | 'all'

    useEffect(() => {
        async function load() {
            setLoading(true)
            // Fetch enrolled course IDs
            const { data: rawEnrollments } = await supabase
                .from('enrollments')
                .select('course_id')
                .eq('student_id', profile.id)

            const enrolledIds = [...new Set((rawEnrollments || []).map(e => e.course_id))]

            if (enrolledIds.length === 0) {
                setSessions([])
                setLoading(false)
                return
            }

            const [
                { data: vids },
                { data: memberships },
                { data: locksDay }
            ] = await Promise.all([
                supabase.from('videos')
                    .select('*, courses(title, start_date)')
                    .in('course_id', enrolledIds)
                    .order('scheduled_time', { ascending: true }),
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

            const filteredByDay = (vids || []).filter(v => {
                const hasStarted = !v.courses?.start_date || new Date(v.courses.start_date) <= now
                return hasStarted && !isDayLocked(v.course_id, v.day_number)
            })

            setSessions(filteredByDay)
            setLoading(false)
        }
        load()
    }, [profile])

    const now = new Date()
    const filtered = sessions.filter(s => {
        if (!s.scheduled_time) return filter === 'all'
        const t = new Date(s.scheduled_time)
        if (filter === 'upcoming') return t >= now || Math.abs(now - t) < 3600000
        if (filter === 'past') return t < now && Math.abs(now - t) >= 3600000
        return true
    })

    const isLive = (t) => t && Math.abs(now - new Date(t)) < 3600000 && new Date(t) <= now
    const formatDate = (t) => {
        if (!t) return 'TBD'
        const d = new Date(t)
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    }
    const formatTime = (t) => {
        if (!t) return ''
        return new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }

    // Group by date
    const byDate = {}
    filtered.forEach(s => {
        const key = s.scheduled_time ? formatDate(s.scheduled_time) : 'No Date'
        if (!byDate[key]) byDate[key] = []
        byDate[key].push(s)
    })

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Class Schedule</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>All your scheduled live sessions</p>
                </div>
                {/* Filter */}
                <div style={{ display: 'flex', gap: '0.4rem', background: '#f1f5f9', padding: '0.3rem', borderRadius: 10, border: '1px solid var(--card-border)' }}>
                    {['upcoming', 'past', 'all'].map(f => (
                        <button key={f} onClick={() => setFilter(f)} style={{
                            padding: '0.4rem 0.9rem', borderRadius: 7, border: 'none', cursor: 'pointer',
                            fontSize: '0.8rem', fontWeight: 600, transition: 'all 0.2s',
                            background: filter === f ? 'rgba(99,102,241,0.2)' : 'transparent',
                            color: filter === f ? '#818cf8' : 'var(--text-muted)',
                        }}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading schedule...</p>
            ) : filtered.length === 0 ? (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                    <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>No {filter} sessions</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {Object.entries(byDate).map(([date, sessionList]) => (
                        <div key={date}>
                            {/* Date header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
                                <div style={{ padding: '0.3rem 0.875rem', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700, color: '#818cf8' }}>
                                    {date}
                                </div>
                                <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                            </div>

                            {/* Session cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                                {sessionList.map(s => {
                                    const live = isLive(s.scheduled_time)
                                    return (
                                        <div key={s.id} className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', border: live ? '1px solid rgba(239,68,68,0.2)' : undefined, background: live ? 'rgba(239,68,68,0.04)' : '#ffffff' }}>
                                            {/* Time column */}
                                            <div style={{ textAlign: 'center', minWidth: 70 }}>
                                                <div style={{ fontSize: '1rem', fontWeight: 700, color: live ? '#f87171' : 'var(--text-primary)' }}>{formatTime(s.scheduled_time)}</div>
                                                {s.duration_minutes && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{s.duration_minutes} min</div>}
                                            </div>
                                            {/* Divider */}
                                            <div style={{ width: 2, height: 40, background: live ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.25)', borderRadius: 2, flexShrink: 0 }} />
                                            {/* Icon */}
                                            <div style={{ width: 40, height: 40, background: live ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {live ? <Zap size={18} color="#f87171" /> : <Video size={18} color="#818cf8" />}
                                            </div>
                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.title}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{s.courses?.title}</div>
                                            </div>
                                            {/* Status + Join */}
                                            <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexShrink: 0 }}>
                                                {live && <span className="badge badge-danger">🔴 LIVE</span>}
                                                {s.video_url && (
                                                    <a
                                                        href={s.video_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className={live ? 'btn-primary' : 'btn-secondary'}
                                                        style={{ textDecoration: 'none', padding: '0.45rem 1rem', fontSize: '0.8rem', background: live ? 'linear-gradient(135deg,#ef4444,#dc2626)' : undefined }}
                                                    >
                                                        <ExternalLink size={13} /> {live ? 'Join Now' : 'Join'}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
