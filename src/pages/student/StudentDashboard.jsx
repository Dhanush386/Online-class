import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar'
import 'react-circular-progressbar/dist/styles.css'
import { Clock, BookOpen, Trophy, Award, Video, Calendar, ExternalLink, Zap, Code as CodeIcon, ChevronRight, Rocket, Flame, FileText } from 'lucide-react'

export default function StudentDashboard() {
    const { profile } = useAuth()
    const [data, setData] = useState({ courses: 0, completion: 0, timeSpent: 0, badges: 3, rank: 1, topics: 0, xp: 0, solved: 0 })
    const [upcomingSessions, setUpcomingSessions] = useState([])
    const [latestChallenges, setLatestChallenges] = useState([])
    const [recentResources, setRecentResources] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            if (!profile?.id) return
            const [
                { data: enrollments },
                { data: progress },
                { data: sessions },
                { data: challenges },
                { data: submissions },
                { data: memberships },
                { data: locks },
                { data: resData }
            ] = await Promise.all([
                supabase.from('enrollments').select('course_id').eq('student_id', profile.id),
                supabase.from('progress').select('completion_percentage, time_spent_minutes').eq('student_id', profile.id),
                supabase.from('videos').select('id, title, scheduled_time, duration_minutes, video_url, courses(title)')
                    .gte('scheduled_time', new Date().toISOString())
                    .order('scheduled_time', { ascending: true })
                    .limit(3),
                supabase.from('coding_challenges').select('*, courses(title)').order('created_at', { ascending: false }),
                supabase.from('coding_submissions').select('score, status').eq('student_id', profile.id),
                supabase.from('group_members').select('group_id').eq('student_id', profile.id),
                supabase.from('resource_access').select('*').eq('is_locked', true),
                supabase.from('course_resources').select('*, courses(title)').in('course_id', (enrollments || []).map(e => e.course_id)).order('created_at', { ascending: false }).limit(3)
            ])

            const userGroupIds = memberships?.map(m => m.group_id) || []

            const lockedCodingIds = locks?.filter(l => userGroupIds.includes(l.group_id) && l.resource_type === 'coding').map(l => l.resource_id) || []
            const lockedMaterialIds = locks?.filter(l => userGroupIds.includes(l.group_id) && (l.resource_type === 'resource' || l.resource_type === 'other')).map(l => l.resource_id) || []

            const filteredChallenges = (challenges || [])
                .filter(c => !lockedCodingIds.includes(c.id))
                .slice(0, 3)

            const filteredMaterials = (resData || [])
                .filter(r => !lockedMaterialIds.includes(r.id))
                .slice(0, 3)

            const avgComp = progress?.length
                ? Math.round(progress.reduce((s, p) => s + (p.completion_percentage || 0), 0) / progress.length)
                : 0
            const totalTime = progress?.reduce((s, p) => s + (p.time_spent_minutes || 0), 0) || 0

            const totalXp = submissions?.filter(s => s.status === 'accepted').reduce((sum, s) => sum + (s.score || 0), 0) || 0
            const solvedCount = submissions?.filter(s => s.status === 'accepted').length || 0

            setData({
                courses: enrollments?.length || 0,
                completion: avgComp,
                timeSpent: totalTime,
                badges: 3, rank: 1,
                topics: enrollments?.length ? enrollments.length * 5 : 0,
                xp: totalXp,
                solved: solvedCount
            })
            setUpcomingSessions(sessions || [])
            setLatestChallenges(filteredChallenges)
            setRecentResources(filteredMaterials)
            setLoading(false)
        }
        load()
    }, [profile])

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
                    {upcomingSessions.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                            <Calendar size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                            <p style={{ fontSize: '0.85rem' }}>No upcoming sessions</p>
                        </div>
                    ) : upcomingSessions.map(s => {
                        const isNow = Math.abs(new Date() - new Date(s.scheduled_time)) < 3600000
                        return (
                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: 12, border: `1px solid ${isNow ? 'rgba(239,68,68,0.2)' : '#e2e8f0'}`, marginBottom: '0.75rem' }}>
                                <div style={{ width: 40, height: 40, background: isNow ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Video size={18} color={isNow ? '#f87171' : '#818cf8'} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                        {new Date(s.scheduled_time).toLocaleString()} · {s.duration_minutes || '?'} min
                                    </div>
                                </div>
                                {isNow ? (
                                    <a href={s.video_url} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem', textDecoration: 'none', background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
                                        🔴 Join
                                    </a>
                                ) : (
                                    <a href={s.video_url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.78rem', textDecoration: 'none' }}>
                                        <ExternalLink size={13} /> Join
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

                {/* Latest Challenges */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CodeIcon size={16} color="#6366f1" /> New Challenges
                        </h3>
                        <Link to="/student/coding" style={{ fontSize: '0.78rem', color: 'var(--accent-light)', textDecoration: 'none' }}>View all →</Link>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {latestChallenges.length === 0 ? (
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No challenges available</p>
                        ) : latestChallenges.map(c => (
                            <Link key={c.id} to={`/student/coding/${c.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', textDecoration: 'none' }}>
                                <div style={{ width: 32, height: 32, background: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', border: '1px solid #e2e8f0' }}>
                                    {c.language === 'python' ? '🐍' : c.language === 'java' ? '☕' : '💻'}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{c.difficulty.toUpperCase()}</div>
                                </div>
                                <ChevronRight size={14} color="#94a3b8" />
                            </Link>
                        ))}
                    </div>
                </div>

                {/* Achievements Card */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Award size={16} color="#f59e0b" /> Earned Badges
                        </h3>
                        <Link to="/student/achievements" style={{ fontSize: '0.78rem', color: 'var(--accent-light)', textDecoration: 'none' }}>View all →</Link>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', padding: '0.5rem 0' }}>
                        <div className="hexagon-container-mini" style={{ color: '#6366f1' }} title="Early Bird">
                            <div className="hexagon-mini">
                                <div className="hexagon-inner-mini">
                                    <Rocket size={16} />
                                </div>
                            </div>
                        </div>
                        <div className="hexagon-container-mini" style={{ color: '#ef4444' }} title="Fast Learner">
                            <div className="hexagon-mini">
                                <div className="hexagon-inner-mini">
                                    <Flame size={16} />
                                </div>
                            </div>
                        </div>
                        <div className="hexagon-container-mini" style={{ color: '#f59e0b' }} title="Quiz Master">
                            <div className="hexagon-mini">
                                <div className="hexagon-inner-mini">
                                    <Trophy size={16} />
                                </div>
                            </div>
                        </div>
                    </div>
                    <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                        You have earned **3 badges**!
                    </p>
                </div>

                {/* Study Materials Card */}
                <div className="glass-card" style={{ padding: '1.5rem', gridColumn: window.innerWidth > 1024 ? '1 / -1' : 'auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FileText size={16} color="#10b981" /> Recent Study Materials
                        </h3>
                        <Link to="/student/courses" style={{ fontSize: '0.78rem', color: 'var(--accent-light)', textDecoration: 'none' }}>View all via Courses →</Link>
                    </div>
                    {recentResources.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)' }}>
                            <FileText size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                            <p style={{ fontSize: '0.85rem' }}>No materials available yet</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                            {recentResources.map(r => (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                    <div style={{ width: 40, height: 40, background: r.resource_type === 'ppt' ? 'rgba(249,115,22,0.1)' : 'rgba(16,185,129,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FileText size={18} color={r.resource_type === 'ppt' ? '#f97316' : '#10b981'} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {r.day_number && <span style={{ color: '#6366f1', marginRight: '0.4rem' }}>Day {r.day_number}:</span>}
                                            {r.title}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{r.courses?.title}</div>
                                    </div>
                                    <a href={r.file_url} target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', textDecoration: 'none', gap: '0.3rem' }}>
                                        <ExternalLink size={12} /> View
                                    </a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
