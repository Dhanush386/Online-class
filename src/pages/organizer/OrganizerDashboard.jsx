import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    Users, Video, BookOpen, TrendingUp, Play, Clock, Code, Key,
    RefreshCw, ArrowRight, Radio, Calendar, ChevronRight, Zap, Plus
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { StatCard, GlassCard } from '../../design-system'

export default function OrganizerDashboard() {
    const { profile } = useAuth()
    const [stats, setStats] = useState({ students: 0, videos: 0, courses: 0, completion: 0, challenges: 0 })
    const [recentVideos, setRecentVideos] = useState([])
    const [recentChallenges, setRecentChallenges] = useState([])
    const [loading, setLoading] = useState(true)
    const [weeklyUploads, setWeeklyUploads] = useState([
        { name: 'Mon', uploads: 0 }, { name: 'Tue', uploads: 0 }, { name: 'Wed', uploads: 0 },
        { name: 'Thu', uploads: 0 }, { name: 'Fri', uploads: 0 }, { name: 'Sat', uploads: 0 }, { name: 'Sun', uploads: 0 }
    ])

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

            // Weekly uploads chart
            const now = new Date()
            const dayOfWeek = now.getDay()
            const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
            const monday = new Date(now.setDate(diff))
            monday.setHours(0, 0, 0, 0)

            const { data: allVideos } = await supabase
                .from('videos').select('created_at').gte('created_at', monday.toISOString())

            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            const counts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 }
            ;(allVideos || []).forEach(v => {
                const dayName = dayNames[new Date(v.created_at).getDay()]
                if (counts[dayName] !== undefined) counts[dayName]++
            })
            setWeeklyUploads([
                { name: 'Mon', uploads: counts.Mon }, { name: 'Tue', uploads: counts.Tue },
                { name: 'Wed', uploads: counts.Wed }, { name: 'Thu', uploads: counts.Thu },
                { name: 'Fri', uploads: counts.Fri }, { name: 'Sat', uploads: counts.Sat },
                { name: 'Sun', uploads: counts.Sun },
            ])
            setLoading(false)
        }

        if (profile) { load() }
    }, [profile])


    const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }
    const itemVariants = {
        hidden: { opacity: 0, y: 14 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
    }

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ maxWidth: 1280 }}>

            {/* ══════════════ HERO WELCOME ══════════════ */}
            <motion.div variants={itemVariants} style={{ marginBottom: '1.75rem' }}>
                <GlassCard
                    tilt3d
                    padding="1.5rem 2rem"
                    style={{
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(139,92,246,0.05) 50%, rgba(16,185,129,0.04) 100%)',
                        border: '1px solid rgba(99,102,241,0.15)',
                        position: 'relative', overflow: 'hidden',
                    }}
                >
                    <div aria-hidden style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)', pointerEvents: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                            </div>
                            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 2.5vw, 2rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '0.3rem' }}>
                                Welcome back, <span className="gradient-text">{profile?.name?.split(' ')[0]}</span> 👋
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                                Here's your teaching overview for today.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <Link to="/organizer/upload" style={{ textDecoration: 'none' }}>
                                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-primary" style={{ fontSize: '0.82rem', padding: '0.6rem 1.1rem', gap: '0.4rem' }}>
                                    <Radio size={15} /> Go Live
                                </motion.button>
                            </Link>
                            <Link to="/organizer/courses" style={{ textDecoration: 'none' }}>
                                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="btn-secondary" style={{ fontSize: '0.82rem', padding: '0.6rem 1.1rem', gap: '0.4rem' }}>
                                    <Plus size={15} /> New Course
                                </motion.button>
                            </Link>
                        </div>
                    </div>
                </GlassCard>
            </motion.div>

            {/* ══════════════ STATS ══════════════ */}
            <motion.div variants={itemVariants} className="stat-grid" style={{ marginBottom: '1.75rem' }}>
                <StatCard icon={Users}      label="Total Students"   value={stats.students}   color="primary" isLoading={loading} />
                <StatCard icon={Code}       label="Coding Practice"  value={stats.challenges} color="warning" isLoading={loading} />
                <StatCard icon={BookOpen}   label="Active Courses"   value={stats.courses}    color="success" isLoading={loading} />
                <StatCard icon={TrendingUp} label="Avg Completion"   value={stats.completion} color="violet"  suffix="%" isLoading={loading} />
            </motion.div>


            {/* ══════════════ CHART + RECENT ══════════════ */}
            <div className="dashboard-grid">
                {/* Chart */}
                <motion.div variants={itemVariants}>
                    <GlassCard padding="1.5rem">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                Video Uploads — This Week
                            </h3>
                            <Link to="/organizer/upload" style={{ fontSize: '0.75rem', color: 'var(--primary-500)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                Upload <ChevronRight size={13} />
                            </Link>
                        </div>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={weeklyUploads}>
                                <defs>
                                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(226,232,240,0.5)" vertical={false} />
                                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12, fontFamily: 'var(--font-body)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(255,255,255,0.95)',
                                        backdropFilter: 'blur(12px)',
                                        border: '1px solid rgba(226,232,240,0.7)',
                                        borderRadius: 12,
                                        color: 'var(--text-primary)',
                                        fontSize: '0.82rem',
                                        fontFamily: 'var(--font-body)',
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                                    }}
                                />
                                <Area type="monotone" dataKey="uploads" stroke="#6366f1" strokeWidth={2.5} fill="url(#chartGrad)" dot={{ r: 3, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </GlassCard>
                </motion.div>

                {/* Recent Content */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Recent Videos */}
                    <motion.div variants={itemVariants}>
                        <GlassCard padding="1.25rem">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Video size={15} color="var(--primary-500)" /> Recent Uploads
                                </h3>
                                <Link to="/organizer/upload" style={{ fontSize: '0.75rem', color: 'var(--primary-500)', textDecoration: 'none', fontWeight: 600 }}>View all</Link>
                            </div>
                            {recentVideos.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                                    <Video size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                                    <p style={{ fontSize: '0.82rem' }}>No videos uploaded yet</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {recentVideos.map(v => (
                                        <div key={v.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            padding: '0.65rem 0.75rem', borderRadius: 10,
                                            background: 'rgba(99,102,241,0.04)',
                                            border: '1px solid rgba(99,102,241,0.1)',
                                        }}>
                                            <div style={{ width: 34, height: 34, background: 'rgba(99,102,241,0.12)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Play size={14} color="#6366f1" />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: 2 }}>
                                                    <Clock size={10} /> {v.duration_minutes || '?'} min
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>

                    {/* Recent Challenges */}
                    <motion.div variants={itemVariants}>
                        <GlassCard padding="1.25rem">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Code size={15} color="#f59e0b" /> Latest Challenges
                                </h3>
                                <Link to="/organizer/coding" style={{ fontSize: '0.75rem', color: 'var(--primary-500)', textDecoration: 'none', fontWeight: 600 }}>View all</Link>
                            </div>
                            {recentChallenges.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)' }}>
                                    <Code size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                                    <p style={{ fontSize: '0.82rem' }}>No challenges created yet</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {recentChallenges.map(c => (
                                        <div key={c.id} style={{
                                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                                            padding: '0.65rem 0.75rem', borderRadius: 10,
                                            background: 'rgba(245,158,11,0.04)',
                                            border: '1px solid rgba(245,158,11,0.1)',
                                        }}>
                                            <div style={{ width: 34, height: 34, background: 'rgba(245,158,11,0.12)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.9rem' }}>
                                                {c.language === 'python' ? '🐍' : c.language === 'java' ? '☕' : '💻'}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                                                <div style={{ fontSize: '0.7rem', marginTop: 2 }}>
                                                    <span style={{
                                                        color: c.difficulty === 'easy' ? '#10b981' : c.difficulty === 'medium' ? '#f59e0b' : '#ef4444',
                                                        fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.04em',
                                                    }}>{c.difficulty}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </GlassCard>
                    </motion.div>
                </div>
            </div>
        </motion.div>
    )
}
