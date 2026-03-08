import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { ClipboardList, Calendar, ChevronRight, Eye, Lock } from 'lucide-react'

const TABS = ['daily', 'weekly', 'final']
const TAB_LABELS = { daily: 'Daily Assessment', weekly: 'Weekly Assessment', final: 'Final Assessment' }
const TAB_COLORS = { daily: '#6366f1', weekly: '#f59e0b', final: '#10b981' }
const MAX_ATTEMPTS = 2

export default function Assessments() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [tab, setTab] = useState('daily')
    const [assessments, setAssessments] = useState({ daily: [], weekly: [], final: [] })
    const [submissions, setSubmissions] = useState({}) // { assessmentId: [sub1, sub2] }
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            // Fetch enrolled course IDs first
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('course_id')
                .eq('student_id', profile.id)

            const enrolledIds = (enrollments || []).map(e => e.course_id)

            if (enrolledIds.length === 0) {
                setAssessments({ daily: [], weekly: [], final: [] })
                setLoading(false)
                return
            }

            const [
                { data: assessData },
                { data: subData },
                { data: memberships },
                { data: locks }
            ] = await Promise.all([
                supabase.from('assessments')
                    .select('*, courses(title)')
                    .in('course_id', enrolledIds)
                    .order('due_date', { ascending: true }),
                supabase.from('assessment_submissions').select('*').eq('student_id', profile.id),
                supabase.from('group_members').select('group_id').eq('student_id', profile.id),
                supabase.from('resource_access').select('*').eq('resource_type', 'assessment').eq('is_locked', true)
            ])

            const userGroupIds = memberships?.map(m => m.group_id) || []
            const lockedAssessIds = locks?.filter(l => userGroupIds.includes(l.group_id)).map(l => l.resource_id) || []

            const grouped = { daily: [], weekly: [], final: [] }
                ; (assessData || [])
                    .filter(a => !lockedAssessIds.includes(a.id))
                    .forEach(a => { if (grouped[a.type]) grouped[a.type].push(a) })
            setAssessments(grouped)

            // Group submissions by assessment_id
            const subMap = {}
                ; (subData || []).forEach(s => {
                    if (!subMap[s.assessment_id]) subMap[s.assessment_id] = []
                    subMap[s.assessment_id].push(s)
                })
            setSubmissions(subMap)
            setLoading(false)
        }
        load()
    }, [profile])

    const items = assessments[tab]

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Assessments</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Track your daily, weekly, and final evaluations</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', background: '#f1f5f9', padding: '0.375rem', borderRadius: 12, border: '1px solid var(--card-border)', width: 'fit-content' }}>
                {TABS.map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: '0.625rem 1.25rem',
                            borderRadius: 9,
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            transition: 'all 0.2s ease',
                            background: tab === t ? `${TAB_COLORS[t]}20` : 'transparent',
                            color: tab === t ? TAB_COLORS[t] : 'var(--text-secondary)',
                            boxShadow: tab === t ? `0 0 0 1px ${TAB_COLORS[t]}40` : 'none',
                        }}
                    >
                        {TAB_LABELS[t]}
                    </button>
                ))}
            </div>

            {/* Cards */}
            {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading assessments...</p>
            ) : items.length === 0 ? (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                    <ClipboardList size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                    <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>No {tab} assessments yet</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Your organizer will publish assessments soon</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {items.map(a => {
                        const isOverdue = a.due_date && new Date(a.due_date) < new Date()
                        const color = TAB_COLORS[tab]
                        const attemptCount = (submissions[a.id] || []).length
                        const isExhausted = attemptCount >= MAX_ATTEMPTS
                        const bestScore = isExhausted
                            ? Math.max(...(submissions[a.id] || []).map(s => s.score))
                            : null

                        return (
                            <div key={a.id} className="glass-card" style={{ padding: '1.5rem', transition: 'all 0.2s ease', opacity: isExhausted ? 0.9 : 1 }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(0,0,0,0.08)' }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)' }}
                            >
                                {/* Type badge + status */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <span className="badge" style={{ background: `${color}20`, color }}>
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </span>
                                    {isExhausted
                                        ? <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={10} /> No Attempts Left</span>
                                        : isOverdue
                                            ? <span className="badge badge-danger">Overdue</span>
                                            : <span className="badge badge-success">Active</span>
                                    }
                                </div>

                                {/* Title */}
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{a.title}</h3>
                                {a.description && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>{a.description}</p>}

                                {/* Meta */}
                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                                    {a.courses?.title && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <ClipboardList size={11} /> {a.courses.title}
                                        </span>
                                    )}
                                    {a.due_date && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                            <Calendar size={11} /> Due {new Date(a.due_date).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>

                                {/* Attempt counter */}
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                                        <span>Attempts used</span>
                                        <span style={{ fontWeight: 700, color: isExhausted ? '#dc2626' : color }}>{attemptCount} / {MAX_ATTEMPTS}</span>
                                    </div>
                                    <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                        <div style={{ width: `${(attemptCount / MAX_ATTEMPTS) * 100}%`, height: '100%', background: isExhausted ? '#ef4444' : color, transition: 'width 0.3s' }} />
                                    </div>
                                    {isExhausted && bestScore !== null && (
                                        <p style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, marginTop: '0.4rem' }}>Best score: {bestScore} correct</p>
                                    )}
                                </div>

                                {/* CTA */}
                                {isExhausted ? (
                                    <button
                                        onClick={() => navigate(`/student/assessments/${a.id}/review`)}
                                        className="btn-secondary"
                                        style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}
                                    >
                                        <Eye size={15} /> Review Attempts
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate(`/student/assessments/${a.id}/take`)}
                                        className="btn-primary"
                                        style={{ width: '100%', justifyContent: 'center', background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 4px 15px ${color}25` }}
                                    >
                                        {attemptCount > 0 ? 'Retry Assessment' : 'Start Assessment'} <ChevronRight size={15} />
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
