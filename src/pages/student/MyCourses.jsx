import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { BookOpen, TrendingUp, Clock, ChevronRight } from 'lucide-react'

export default function MyCourses() {
    const { profile } = useAuth()
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            if (!profile?.id) return
            setLoading(true)

            try {
                const [enrollmentRes, progressRes] = await Promise.all([
                    supabase
                        .from('enrollments')
                        .select('course_id, enrolled_at, courses(id, title, description, start_date, end_date)')
                        .eq('student_id', profile.id),
                    supabase
                        .from('progress')
                        .select('course_id, completion_percentage, time_spent_minutes')
                        .eq('student_id', profile.id)
                ])

                const rawEnrollmentData = enrollmentRes.data || []
                const progressData = progressRes.data || []

                // Deduplicate enrollments
                const enrollmentData = []
                const seenIds = new Set()
                rawEnrollmentData.forEach(e => {
                    const cid = e.courses?.id
                    if (cid && !seenIds.has(cid)) {
                        seenIds.add(cid)
                        enrollmentData.push(e)
                    }
                })

                const mapped = enrollmentData.map(e => {
                    const prog = progressData.find(p => p.course_id === e.course_id)
                    return {
                        id: e.courses?.id,
                        title: e.courses?.title,
                        description: e.courses?.description,
                        startDate: e.courses?.start_date,
                        endDate: e.courses?.end_date,
                        completion: prog?.completion_percentage || 0,
                        timeSpent: prog?.time_spent_minutes || 0,
                        enrolledAt: e.enrolled_at,
                    }
                })
                setCourses(mapped)
            } catch (err) {
                console.error('Error loading courses:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [profile])

    const gradients = [
        'linear-gradient(135deg,#6366f1,#8b5cf6)',
        'linear-gradient(135deg,#10b981,#059669)',
        'linear-gradient(135deg,#f59e0b,#d97706)',
        'linear-gradient(135deg,#ec4899,#db2777)',
        'linear-gradient(135deg,#3b82f6,#2563eb)',
    ]

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>My Courses</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    {courses.length} course{courses.length !== 1 ? 's' : ''} enrolled
                </p>
            </div>

            {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : courses.length === 0 ? (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                    <BookOpen size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>You haven't enrolled in any courses yet</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {courses.map((course, i) => (
                        <Link
                            key={course.id}
                            to={`/student/courses/${course.id}`}
                            style={{ textDecoration: 'none' }}
                        >
                            <div className="glass-card" style={{ overflow: 'hidden', transition: 'all 0.2s ease', cursor: 'pointer' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 25px -5px rgba(0,0,0,0.1)' }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)' }}
                            >
                                {/* Banner */}
                                <div style={{ height: 100, background: gradients[i % gradients.length], position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                                    <BookOpen size={40} color="rgba(255,255,255,0.3)" />
                                    <div style={{ position: 'absolute', top: 12, right: 12 }}>
                                        <span className="badge" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.7rem', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                                            {course.completion}% Complete
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div style={{ padding: '1.25rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>{course.title}</h3>
                                    {(course.startDate || course.endDate) && (
                                        <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 700, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            <Clock size={12} />
                                            {new Date(course.startDate).toLocaleDateString()} - {new Date(course.endDate).toLocaleDateString()}
                                        </div>
                                    )}
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{course.description || 'No description provided'}</p>

                                    {/* Progress */}
                                    <div className="progress-bar-track" style={{ marginBottom: '0.5rem' }}>
                                        <div className="progress-bar-fill" style={{ width: `${course.completion}%`, background: gradients[i % gradients.length] }} />
                                    </div>

                                    {/* Footer stats */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.875rem' }}>
                                        <div style={{ display: 'flex', gap: '0.875rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <TrendingUp size={12} /> {course.completion}%
                                            </span>
                                        </div>
                                        <ChevronRight size={16} color="var(--text-muted)" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
