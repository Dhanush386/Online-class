import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
    ChevronRight, Trophy, CheckCircle2, Circle,
    ArrowRightCircle, Search, Filter, BookOpen,
    ChevronDown, GraduationCap, Layout
} from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'

export default function CodingPractice() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [challenges, setChallenges] = useState([])
    const [submissions, setSubmissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [groups, setGroups] = useState([])

    useEffect(() => {
        if (profile?.id) {
            loadData()
        }
    }, [profile])

    async function loadData() {
        setLoading(true)

        // Fetch enrolled course IDs first
        const { data: enrollments } = await supabase
            .from('enrollments')
            .select('course_id')
            .eq('student_id', profile.id)

        const enrolledIds = (enrollments || []).map(e => e.course_id)

        if (enrolledIds.length === 0) {
            setChallenges([])
            setSubmissions([])
            setLoading(false)
            return
        }

        const [
            { data: challengeData },
            { data: submissionData },
            { data: memberships },
            { data: locks },
            { data: groupsData }
        ] = await Promise.all([
            supabase.from('coding_challenges')
                .select('*, courses(title)')
                .in('course_id', enrolledIds)
                .order('created_at', { ascending: false }),
            supabase.from('coding_submissions').select('*').eq('student_id', profile.id),
            supabase.from('group_members').select('group_id').eq('student_id', profile.id),
            supabase.from('resource_access').select('*').eq('resource_type', 'coding').eq('is_locked', true),
            supabase.from('groups').select('*').in('course_id', enrolledIds)
        ])

        const userGroupIds = memberships?.map(m => m.group_id) || []
        const lockedCodingIds = locks?.filter(l => userGroupIds.includes(l.group_id)).map(l => l.resource_id) || []

        setGroups(groupsData || [])

        setChallenges((challengeData || []).filter(c => !lockedCodingIds.includes(c.id)))
        setSubmissions(submissionData || [])
        setLoading(false)
    }

    const getStatus = (challengeId) => {
        const sub = submissions.find(s => s.challenge_id === challengeId)
        if (!sub) return { label: 'UNSOLVED', color: '#94a3b8', solved: false }
        if (sub.status === 'accepted') return { label: 'SOLVED', color: '#10b981', solved: true }
        return { label: 'ATTEMPTED', color: '#f59e0b', solved: false }
    }

    const getMetrics = (challengeId, challengeXP, testCasesCount) => {
        const challengeSubmissions = submissions.filter(s => s.challenge_id === challengeId)
        if (challengeSubmissions.length === 0) return { tests: 0, score: 0, latest: '0/0' }

        // Use the best submission for the score
        const best = challengeSubmissions.reduce((prev, current) => (prev.score > current.score) ? prev : current)
        const latest = challengeSubmissions[challengeSubmissions.length - 1]

        return {
            tests: best.tests_passed || 0,
            score: best.score || 0,
            latestAttempt: `${latest.tests_passed}/${testCasesCount || 0}`,
            latestScore: `${latest.score}/${challengeXP}`
        }
    }

    const filtered = challenges.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.courses?.title?.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '2rem auto' }}></div>
            <p style={{ color: 'var(--text-muted)' }}>Loading coding adventures...</p>
        </div>
    )

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Breadcrumb Styled Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e40af', fontSize: '0.95rem', fontWeight: 600 }}>
                    <BookOpen size={16} />
                    <span>Operators & Conditional Statements</span>
                    <ChevronRight size={14} style={{ color: '#94a3b8' }} />
                    <span style={{ color: '#1e293b' }}>Coding Practice - 2C</span>
                </div>
            </div>

            {/* Table Header Section */}
            <div className="hide-mobile" style={{
                background: '#eef2ff',
                padding: '0.75rem 2rem',
                borderRadius: '8px 8px 0 0',
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
                alignItems: 'center',
                marginBottom: '1px'
            }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Question</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Difficulty</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Testcases Passed</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Score</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Status</div>
                <div style={{ width: 40 }}></div>
            </div>

            {/* Challenge Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                {filtered.map(c => {
                    const status = getStatus(c.id)
                    const tcCount = c.test_cases?.length || 0
                    const metrics = getMetrics(c.id, c.xp_reward || 15, tcCount)

                    return (
                        <div key={c.id} className="glass-card stack-mobile" style={{
                            padding: '1.5rem 2rem',
                            display: 'grid',
                            gridTemplateColumns: window.innerWidth <= 1024 ? '1fr' : '2fr 1fr 1fr 1fr 1fr auto',
                            alignItems: 'center',
                            gap: window.innerWidth <= 1024 ? '1rem' : '0',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                        }} onClick={() => navigate(`/student/coding/${c.id}`)}>

                            {/* Question Title */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e40af' }}>{c.title}</div>
                                {userGroupIds.length > 0 && (
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                        {memberships.filter(m => {
                                            const g = groups?.find(gr => gr.id === m.group_id && gr.course_id === c.course_id)
                                            return !!g
                                        }).map(m => {
                                            const g = groups?.find(gr => gr.id === m.group_id)
                                            return g ? <span key={g.id} style={{ fontSize: '0.65rem', padding: '0.05rem 0.4rem', background: '#dcfce7', color: '#15803d', borderRadius: 4, fontWeight: 700 }}>Batch: {g.name}</span> : null
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Mobile Info Row */}
                            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', width: '100%', borderBottom: window.innerWidth <= 1024 ? '1px solid #f1f5f9' : 'none', paddingBottom: window.innerWidth <= 1024 ? '1rem' : '0' }}>

                                {/* Difficulty */}
                                <div>
                                    <span style={{
                                        fontSize: '0.8rem',
                                        fontWeight: 600,
                                        color: c.difficulty === 'easy' ? '#10b981' : c.difficulty === 'medium' ? '#f59e0b' : '#ef4444'
                                    }}>
                                        {c.difficulty ? c.difficulty.charAt(0).toUpperCase() + c.difficulty.slice(1) : 'Easy'}
                                    </span>
                                </div>

                                {/* Status */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: status.color }}></div>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: status.color, letterSpacing: '0.05em' }}>
                                        {status.label}
                                    </span>
                                </div>
                            </div>

                            {/* Progress Metrics Group */}
                            <div style={{ display: 'flex', gap: '1.5rem', width: '100%', justifyContent: window.innerWidth <= 1024 ? 'space-between' : 'flex-start' }}>
                                {/* Test Cases Passed */}
                                <div style={{ flex: window.innerWidth <= 1024 ? 1 : 'unset' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.25rem' }} className="show-mobile">TEST CASES</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e40af' }}>
                                        {metrics.tests}<span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>/{tcCount}</span>
                                    </div>
                                    <div style={{ width: '80%', height: 3, background: '#e2e8f0', marginTop: '0.25rem', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ width: tcCount > 0 ? `${(metrics.tests / tcCount) * 100}%` : '0%', height: '100%', background: '#2563eb' }}></div>
                                    </div>
                                </div>

                                {/* Score */}
                                <div style={{ flex: window.innerWidth <= 1024 ? 1 : 'unset' }}>
                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.25rem' }} className="show-mobile">SCORE</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e40af' }}>
                                        {metrics.score}<span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>/{c.xp_reward || 15}</span>
                                    </div>
                                    <div style={{ width: '80%', height: 3, background: '#e2e8f0', marginTop: '0.25rem', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{ width: (c.xp_reward || 15) > 0 ? `${(metrics.score / (c.xp_reward || 15)) * 100}%` : '0%', height: '100%', background: '#2563eb' }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Arrow */}
                            <div style={{ color: '#3b82f6', display: window.innerWidth <= 1024 ? 'none' : 'block' }}>
                                <ArrowRightCircle size={24} />
                            </div>
                        </div>
                    )
                })}
            </div>

            {filtered.length === 0 && (
                <div style={{ padding: '5rem 2rem', textAlign: 'center', background: 'white', borderRadius: 16, marginTop: '1rem', border: '1px solid #e2e8f0' }}>
                    <Layout size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>No challenges found</h3>
                    <p style={{ color: '#64748b' }}>Try searching with a different term or check back later.</p>
                </div>
            )}
        </div>
    )
}
