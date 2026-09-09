import { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { ClipboardList, Calendar, ChevronRight, Eye, Lock, Monitor, Clock } from 'lucide-react'
import { useDeviceType } from '../../hooks/useDeviceType'
import { calculateAccessibleDay, isItemUnlocked } from '../../utils/dayAccessEngine'

const TABS = ['daily', 'weekly', 'final']
const TAB_LABELS = { daily: 'Daily Assessment', weekly: 'Weekly Assessment', final: 'Final Assessment' }
const TAB_COLORS = { daily: '#6366f1', weekly: '#f59e0b', final: '#10b981' }
const MAX_ATTEMPTS = 1

function AssessmentCard({ a, tab, submissions, navigate }) {
    const isNotOpenYet = a.open_time && new Date(a.open_time) > new Date()
    const color = TAB_COLORS[tab]
    const attemptCount = (submissions[a.id] || []).length
    const isExhausted = attemptCount >= MAX_ATTEMPTS
    const bestScore = isExhausted
        ? Math.max(...(submissions[a.id] || []).map(s => s.score))
        : null

    let statusBadge;
    if (isExhausted) {
        statusBadge = <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={10} /> No Attempts Left</span>
    } else if (a.isLocked) {
        statusBadge = <span className="badge" style={{ background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}><Lock size={10} /> Locked</span>
    } else if (isNotOpenYet) {
        statusBadge = <span className="badge" style={{ background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> Opens Soon</span>
    } else {
        statusBadge = <span className="badge badge-success">Active</span>
    }

    let ctaButton;
    if (isExhausted) {
        ctaButton = (
            <button
                onClick={() => navigate(`/student/assessments/${a.id}/review`)}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}
            >
                <Eye size={15} /> Review Attempts
            </button>
        )
    } else if (a.isLocked) {
        ctaButton = (
            <button
                onClick={() => alert(a.lockReason)}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', opacity: 0.7, gap: '0.5rem' }}
            >
                <Lock size={15} /> Locked
            </button>
        )
    } else if (isNotOpenYet) {
        ctaButton = (
            <button
                disabled
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', opacity: 0.7, cursor: 'not-allowed', gap: '0.5rem' }}
            >
                <Clock size={15} /> Opens {new Date(a.open_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </button>
        )
    } else {
        ctaButton = (
            <button
                onClick={() => navigate(`/student/assessments/${a.id}/take`)}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 4px 15px ${color}25` }}
            >
                {attemptCount > 0 ? 'Retry Assessment' : 'Start Assessment'} <ChevronRight size={15} />
            </button>
        )
    }

    return (
        <div className="glass-card" style={{ padding: '1.5rem', transition: 'all 0.2s ease', opacity: isExhausted ? 0.9 : 1 }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 20px -5px rgba(0,0,0,0.08)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--card-shadow)' }}
        >
            {/* Type badge + status */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <span className="badge" style={{ background: `${color}20`, color }}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </span>
                {statusBadge}
            </div>

            {/* Title */}
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{a.title}</h3>
            {a.description && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1rem' }}>{a.description}</p>}

            {/* Meta */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                {a.courses?.title && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <ClipboardList size={11} /> {a.courses.title}
                    </span>
                )}
                {a.duration && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} /> {a.duration} mins
                    </span>
                )}
                {a.open_time && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Calendar size={11} /> Opens {new Date(a.open_time).toLocaleDateString()}
                    </span>
                )}
            </div>

            {/* Attempt counter */}
            <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    <span>Attempts used</span>
                    <span style={{ fontWeight: 700, color: isExhausted ? '#dc2626' : color }}>{attemptCount} / {MAX_ATTEMPTS}</span>
                </div>
                <div style={{ height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${(attemptCount / MAX_ATTEMPTS) * 100}%`, height: '100%', background: isExhausted ? '#ef4444' : color, transition: 'width 0.3s' }} />
                </div>
                {isExhausted && bestScore !== null && (
                    <p style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 600, marginTop: '0.4rem' }}>Best score: {bestScore} correct</p>
                )}
            </div>

            {/* CTA */}
            {ctaButton}
        </div>
    )
}

AssessmentCard.propTypes = {
    a: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        open_time: PropTypes.string,
        duration: PropTypes.number,
        title: PropTypes.string.isRequired,
        description: PropTypes.string,
        isLocked: PropTypes.bool,
        lockReason: PropTypes.string,
        courses: PropTypes.shape({
            title: PropTypes.string,
        }),
    }).isRequired,
    tab: PropTypes.string.isRequired,
    submissions: PropTypes.object.isRequired,
    navigate: PropTypes.func.isRequired,
};

export default function Assessments() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [tab, setTab] = useState('daily')
    const [assessments, setAssessments] = useState({ daily: [], weekly: [], final: [] })
    const [submissions, setSubmissions] = useState({}) // { assessmentId: [sub1, sub2] }
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            // Fetch enrolled course IDs & enrolled_at first
            const { data: rawEnrollments } = await supabase
                .from('enrollments')
                .select('course_id, enrolled_at')
                .eq('student_id', profile.id)

            const enrollMap = {}
            for (const e of (rawEnrollments || [])) {
                enrollMap[e.course_id] = e.enrolled_at
            }

            const enrolledIds = [...new Set((rawEnrollments || []).map(e => e.course_id))]

            if (enrolledIds.length === 0) {
                setAssessments({ daily: [], weekly: [], final: [] })
                setLoading(false)
                return
            }

            const [
                { data: assessData },
                { data: subData },
                { data: memberships },
                { data: locks },
                { data: locksDay }
            ] = await Promise.all([
                supabase.from('assessments')
                    .select('*, courses(title, start_date)')
                    .in('course_id', enrolledIds)
                    .order('created_at', { ascending: false }),
                supabase.from('assessment_submissions').select('*').eq('student_id', profile.id),
                supabase.from('group_members').select('group_id').eq('student_id', profile.id),
                supabase.from('resource_access').select('*').eq('resource_type', 'assessment').eq('is_locked', true),
                supabase.from('day_access').select('*')
            ])

            const userGroupIds = memberships?.map(m => m.group_id) || []
            const lockedAssessIds = locks?.filter(l => userGroupIds.includes(l.group_id)).map(l => l.resource_id) || []

            const grouped = { daily: [], weekly: [], final: [] }
            
            for (const a of (assessData || [])) {
                const enrolledAt = enrollMap[a.course_id] || profile?.created_at || new Date()
                const accessibleDay = calculateAccessibleDay(enrolledAt)
                const { isLocked, reason } = isItemUnlocked({
                    item: a,
                    type: 'assessment',
                    accessibleDay,
                    lockedAssessIds,
                    groupDayAccess: locksDay
                })
                a.isLocked = isLocked
                a.lockReason = reason || ''

                if (grouped[a.type]) {
                    grouped[a.type].push(a);
                } 
            }
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

    const { isMobile, isTablet } = useDeviceType()
    const items = assessments[tab]

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Assessments</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Track your daily, weekly, and final evaluations</p>
            </div>

            {(isMobile || isTablet) && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.85rem 1rem',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: 12,
                    marginBottom: '1.5rem',
                    color: '#c7d2fe',
                    fontSize: '0.85rem',
                    lineHeight: 1.4,
                }}>
                    <Monitor size={20} style={{ color: '#818cf8', flexShrink: 0 }} />
                    <div>
                        <strong style={{ color: '#ffffff' }}>Laptop or Desktop Required:</strong> AI proctored assessments and fullscreen exams must be taken on a laptop or desktop computer.
                    </div>
                </div>
            )}

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
            {(() => {
                if (loading) {
                    return <p style={{ color: 'var(--text-muted)' }}>Loading assessments...</p>
                }
                if (items.length === 0) {
                    return (
                        <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                            <ClipboardList size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>No {tab} assessments yet</p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Your organizer will publish assessments soon</p>
                        </div>
                    )
                }
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {items.map(a => <AssessmentCard key={a.id} a={a} tab={tab} submissions={submissions} navigate={navigate} />)}
                </div>
                )
            })()}
        </div>
    )
}
