import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Users, Video, BookOpen, TrendingUp, Play, Clock, Calendar, Code } from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const chartData = [
    { name: 'Mon', uploads: 2 }, { name: 'Tue', uploads: 4 },
    { name: 'Wed', uploads: 3 }, { name: 'Thu', uploads: 5 },
    { name: 'Fri', uploads: 6 }, { name: 'Sat', uploads: 2 }, { name: 'Sun', uploads: 4 },
]

export default function OrganizerDashboard() {
    const { profile } = useAuth()
    const [stats, setStats] = useState({ students: 0, videos: 0, courses: 0, completion: 0, challenges: 0 })
    const [recentVideos, setRecentVideos] = useState([])
    const [recentChallenges, setRecentChallenges] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const [
                { count: videoCount },
                { count: courseCount },
                { count: studentCount },
                { data: videos },
                { count: challengeCount },
                { data: challenges }
            ] = await Promise.all([
                supabase.from('videos').select('*', { count: 'exact', head: true }),
                supabase.from('courses').select('*', { count: 'exact', head: true }).eq('organizer_id', profile?.id),
                supabase.from('enrollments').select('*', { count: 'exact', head: true }),
                supabase.from('videos').select('id, title, scheduled_time, duration_minutes, courses(title)').order('created_at', { ascending: false }).limit(5),
                supabase.from('coding_challenges').select('*', { count: 'exact', head: true }),
                supabase.from('coding_challenges').select('id, title, language, difficulty').order('created_at', { ascending: false }).limit(5)
            ])
            const { data: prog } = await supabase.from('progress').select('completion_percentage')
            const avg = prog?.length ? Math.round(prog.reduce((s, p) => s + (p.completion_percentage || 0), 0) / prog.length) : 0
            setStats({
                students: studentCount || 0,
                videos: videoCount || 0,
                courses: courseCount || 0,
                completion: avg,
                challenges: challengeCount || 0
            })
            setRecentVideos(videos || [])
            setRecentChallenges(challenges || [])
            setLoading(false)
        }
        if (profile) load()
    }, [profile])

    const statCards = [
        { label: 'Total Students', value: stats.students, icon: Users, color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
        { label: 'Coding Practice', value: stats.challenges, icon: Code, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
        { label: 'Active Courses', value: stats.courses, icon: BookOpen, color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
        { label: 'Avg Completion', value: `${stats.completion}%`, icon: TrendingUp, color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
    ]

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Welcome back, <span className="gradient-text">{profile?.name?.split(' ')[0]}</span> 👋
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Here's your teaching overview for today
                </p>
            </div>

            {/* Stat Cards */}
            <div className="stat-grid">
                {statCards.map(({ label, value, icon: Icon, color, bg }) => (
                    <div key={label} className="stat-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{ width: 44, height: 44, background: bg, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={22} color={color} />
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.5rem', borderRadius: 6 }}>↑ Live</span>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{loading ? '—' : value}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{label}</div>
                    </div>
                ))}
            </div>

            {/* Chart + Recent */}
            <div className="dashboard-grid">
                {/* Chart */}
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Video Uploads — This Week</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, color: '#1e293b', fontSize: '0.85rem' }} />
                            <Area type="monotone" dataKey="uploads" stroke="#6366f1" strokeWidth={2} fill="url(#grad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Recent Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Recent Videos */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Recent Uploads</h3>
                        {recentVideos.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                                <Video size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                                <p style={{ fontSize: '0.85rem' }}>No videos uploaded yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {recentVideos.map(v => (
                                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                        <div style={{ width: 36, height: 36, background: 'rgba(99,102,241,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Play size={16} color="#818cf8" />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                                <Clock size={11} /> {v.duration_minutes || '?'} min
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Challenges */}
                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Latest Coding Questions</h3>
                        {recentChallenges.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                                <Code size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                                <p style={{ fontSize: '0.85rem' }}>No challenges created yet</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {recentChallenges.map(c => (
                                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                                        <div style={{ width: 36, height: 36, background: 'rgba(245,158,11,0.15)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.9rem' }}>
                                            {c.language === 'python' ? '🐍' : c.language === 'java' ? '☕' : '💻'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                                                <span style={{ color: c.difficulty === 'easy' ? '#10b981' : c.difficulty === 'medium' ? '#f59e0b' : '#ef4444' }}>{c.difficulty.toUpperCase()}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
