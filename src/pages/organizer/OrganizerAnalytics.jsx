import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { BarChart2, TrendingUp, Users, Video, Clock, BookOpen, AlertTriangle } from 'lucide-react'

export default function OrganizerAnalytics() {
    const { profile } = useAuth()
    const [loading, setLoading] = useState(true)
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalClasses: 0,
        avgAttendance: 0,
        totalHours: 0
    })

    useEffect(() => {
        if (profile?.id) loadAnalytics()
    }, [profile])

    async function loadAnalytics() {
        setLoading(true)
        try {
            // Get courses
            const { data: courses } = await supabase
                .from('courses')
                .select('id')
                .eq('organizer_id', profile.id)
            
            const courseIds = (courses || []).map(c => c.id)

            if (courseIds.length > 0) {
                // Get enrollments
                const { count: studentCount } = await supabase
                    .from('enrollments')
                    .select('*', { count: 'exact', head: true })
                    .in('course_id', courseIds)

                // Get videos/classes
                const { data: videos } = await supabase
                    .from('videos')
                    .select('id, duration_seconds')
                    .in('course_id', courseIds)

                const totalClasses = videos?.length || 0
                const totalHours = Math.round((videos || []).reduce((acc, v) => acc + (v.duration_seconds || 0), 0) / 3600)

                setStats({
                    totalStudents: studentCount || 0,
                    totalClasses,
                    avgAttendance: 85, // Placeholder for trend
                    totalHours
                })
            }
        } catch (err) {
            console.error('Failed to load analytics', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Analytics Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Track attendance trends, student engagement, and recording statistics.
                </p>
            </div>

            {/* Top Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <StatCard icon={Users} title="Total Students" value={stats.totalStudents} color="#4f46e5" bg="rgba(79,70,229,0.1)" trend="+12%" />
                <StatCard icon={Video} title="Live Classes" value={stats.totalClasses} color="#10b981" bg="rgba(16,185,129,0.1)" trend="+5%" />
                <StatCard icon={BarChart2} title="Avg Attendance" value={`${stats.avgAttendance}%`} color="#f59e0b" bg="rgba(245,158,11,0.1)" trend="-2%" trendDown />
                <StatCard icon={Clock} title="Hours Recorded" value={`${stats.totalHours}h`} color="#8b5cf6" bg="rgba(139,92,246,0.1)" trend="+18%" />
            </div>

            {/* Placeholder Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', minHeight: 300, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(79,70,229,0.1)', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><TrendingUp size={16}/></div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Attendance Trends</h3>
                    </div>
                    <div style={{ flex: 1, border: '2px dashed var(--card-border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        [ Attendance Chart Placeholder ]
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '1.5rem', minHeight: 300, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.5rem' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BookOpen size={16}/></div>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Student Engagement</h3>
                    </div>
                    <div style={{ flex: 1, border: '2px dashed var(--card-border)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        [ Engagement Chart Placeholder ]
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ icon: Icon, title, value, color, bg, trend, trendDown }) {
    return (
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={24} />
                </div>
                {trend && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: trendDown ? '#ef4444' : '#10b981', background: trendDown ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', padding: '0.25rem 0.5rem', borderRadius: 999 }}>
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
            </div>
        </div>
    )
}
