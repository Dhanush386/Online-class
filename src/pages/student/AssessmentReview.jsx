import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, CheckCircle2, XCircle, Clock, Code as CodeIcon } from 'lucide-react'
import CodeEditor from '../../components/CodeEditor'
import useXpAward from '../../hooks/useXpAward'
import { getQuizEventType } from '../../constants/xpRewards'
export default function AssessmentReview() {
    const { assessmentId } = useParams()
    const { profile } = useAuth()
    const navigate = useNavigate()
    const { awardXp, toastMessage } = useXpAward()

    const [assessment, setAssessment] = useState(null)
    const [questions, setQuestions] = useState([])
    const [submissions, setSubmissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeAttempt, setActiveAttempt] = useState(0)

    useEffect(() => {
        async function loadData() {
            setLoading(true)
            const [{ data: assess }, { data: qData }, { data: subData }] = await Promise.all([
                supabase.from('assessments').select('*, courses(title)').eq('id', assessmentId).single(),
                supabase.from('questions').select('*').eq('assessment_id', assessmentId).order('created_at', { ascending: true }),
                supabase.from('assessment_submissions').select('*')
                    .eq('assessment_id', assessmentId)
                    .eq('student_id', profile.id)
                    .order('created_at', { ascending: true })
            ])
            setAssessment(assess)
            setQuestions(qData || [])
            setSubmissions(subData || [])
            setLoading(false)
        }

        if (assessmentId) loadData()
    }, [assessmentId, profile.id])

    // Backfill XP for submissions that happened before XP was deployed
    useEffect(() => {
        async function backfillXp() {
            if (!profile?.id || !assessmentId || submissions.length === 0 || !assessment) return

            // Check if XP was already awarded for any attempt of this assessment
            const { data: existing } = await supabase
                .from('xp_events')
                .select('id')
                .eq('student_id', profile.id)
                .in('event_type', ['quiz_high', 'quiz_mid', 'quiz_low'])
                .eq('reference_id', assessmentId)
                .limit(1)

            if (existing && existing.length > 0) return // already awarded

            // Award based on best attempt score
            const bestSub = submissions.reduce((best, s) =>
                (s.score / s.total_questions) > (best.score / best.total_questions) ? s : best
            , submissions[0])

            const scorePercent = Math.round((bestSub.score / bestSub.total_questions) * 100)
            const xpEventType = getQuizEventType(scorePercent)

            await awardXp({
                eventType: xpEventType,
                referenceId: assessmentId,
                courseId: assessment.course_id || null,
                moduleType: 'quiz',
                reason: `${assessment.title} — ${scorePercent}%`,
                isFirstAttempt: true,
                metadata: { score: bestSub.score, total: bestSub.total_questions, percentage: scorePercent, backfilled: true }
            })
        }
        backfillXp()
    }, [submissions, assessment, profile?.id, assessmentId])

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading review...</div>

    const currentSub = submissions[activeAttempt]
    const answersMap = {}
    if (currentSub?.answers) {
        currentSub.answers.forEach(a => {
            answersMap[a.question_id] = a
        })
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: 820, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <button onClick={() => navigate(`/student/courses/${assessment?.course_id}`, { state: { tab: 'assessments' } })} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.85rem', padding: 0 }}>
                    <ChevronLeft size={16} /> Back to Course
                </button>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Review: {assessment?.title}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Read-only review of your submitted attempts
                </p>
            </div>

            {/* Attempt Selector */}
            {submissions.length > 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                    {submissions.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => setActiveAttempt(i)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: 8,
                                border: `2px solid ${activeAttempt === i ? '#6366f1' : '#e2e8f0'}`,
                                background: activeAttempt === i ? '#6366f108' : 'white',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '0.875rem',
                                color: activeAttempt === i ? '#6366f1' : 'var(--text-secondary)'
                            }}
                        >
                            Attempt {i + 1} — {s.score}/{s.total_questions} ✓
                        </button>
                    ))}
                </div>
            )}

            {/* Score Card */}
            {currentSub && (
                <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '2rem' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#6366f1' }}>{currentSub.score} / {currentSub.total_questions}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Correct Answers</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#10b981' }}>
                            {Math.round((currentSub.score / currentSub.total_questions) * 100)}%
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score</div>
                    </div>
                    <div style={{ flexGrow: 1 }} />
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {new Date(currentSub.created_at).toLocaleString()}
                    </div>
                </div>
            )}

            {/* Questions Review */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {questions.filter(q => answersMap[q.id]).map((q, idx) => {
                    const answer = answersMap[q.id]
                    const selected = answer?.selected_option || '' // Can be string or array
                    const isCorrect = answer?.is_correct === true
                    const wasAnswered = Array.isArray(selected) ? selected.length > 0 : !!selected
                    let borderColor = 'var(--text-muted)'
                    let statusIcon = <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Unanswered</span>
                    if (wasAnswered) {
                        if (isCorrect) {
                            borderColor = '#10b981'
                            statusIcon = <CheckCircle2 size={20} color="#10b981" />
                        } else {
                            borderColor = '#ef4444'
                            statusIcon = <XCircle size={20} color="#ef4444" />
                        }
                    }

                    return (
                        <div key={q.id} className="glass-card" style={{
                            padding: '1.5rem',
                            borderLeft: `3px solid ${borderColor}`
                        }}>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                                    {idx + 1}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                        {q.question_text}
                                    </h3>
                                    {q.image_url && (
                                        <div style={{ marginTop: '1rem' }}>
                                            <img src={q.image_url} alt="Question Reference" style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', border: '1px solid var(--card-border)', objectFit: 'contain' }} />
                                        </div>
                                    )}
                                    {q.question_type === 'code_mcq' && q.code_snippet && (
                                        <div style={{ marginTop: '1.25rem', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                                            <div style={{ background: '#1e293b', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <CodeIcon size={14} color="#94a3b8" />
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>
                                                        {q.snippet_title || 'Code Snippet'}
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    {q.code_language}
                                                </span>
                                            </div>
                                            <div style={{ background: '#0f172a', overflowX: 'auto' }}>
                                                <div style={{ minWidth: '100%', width: 'max-content' }}>
                                                    <CodeEditor
                                                        value={q.code_snippet}
                                                        language={q.code_language}
                                                        readOnly={true}
                                                        theme="dark"
                                                        style={{ height: 'auto', minHeight: 120, padding: 0 }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                                    {statusIcon}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                                {q.options.map((opt, i) => {
                                    let isThisCorrect = false
                                    try {
                                        if (q.correct_answer?.startsWith('[') && q.correct_answer?.endsWith(']')) {
                                            isThisCorrect = JSON.parse(q.correct_answer).includes(opt)
                                        } else {
                                            isThisCorrect = opt === q.correct_answer
                                        }
                                    } catch (e) {
                                        console.error('Error parsing correct_answer:', e)
                                        isThisCorrect = opt === q.correct_answer
                                    }

                                    const isThisSelected = Array.isArray(selected) ? selected.includes(opt) : opt === selected
                                    let bg = 'var(--card-bg)', border = 'var(--card-border)', textColor = 'var(--text-primary)'

                                    if (isThisCorrect) { bg = 'rgba(16, 185, 129, 0.1)'; border = 'rgba(16, 185, 129, 0.2)'; textColor = 'var(--success)' }
                                    else if (isThisSelected && !isThisCorrect) { bg = 'rgba(239, 68, 68, 0.1)'; border = 'rgba(239, 68, 68, 0.2)'; textColor = 'var(--danger)' }

                                    let iconBg = '#cbd5e1'
                                    let iconContent = String.fromCodePoint(65 + i)
                                    if (isThisCorrect) {
                                        iconBg = '#10b981'
                                        iconContent = <CheckCircle2 size={12} />
                                    } else if (isThisSelected) {
                                        iconBg = '#ef4444'
                                        iconContent = <XCircle size={12} />
                                    }

                                    return (
                                        <div key={opt} style={{ padding: '0.85rem 1rem', borderRadius: 10, background: bg, border: `1px solid ${border}`, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.85rem', color: textColor }}>
                                            <div style={{ width: 20, height: 20, background: iconBg, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem', flexShrink: 0 }}>
                                                {iconContent}
                                            </div>
                                            {opt}
                                            {isThisSelected && !isThisCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>Your answer</span>}
                                            {isThisCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>{isThisSelected ? 'Your correct answer' : 'Correct'}</span>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* XP Toast */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 99999,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                    padding: '0.85rem 1.75rem',
                    borderRadius: '999px',
                    fontSize: '1rem',
                    fontWeight: 700,
                    boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    whiteSpace: 'nowrap'
                }}>
                    <span style={{ fontSize: '1.4rem' }}>⚡</span>
                    <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800 }}>{toastMessage.text}</div>
                        {toastMessage.reason && <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.1rem' }}>{toastMessage.reason}</div>}
                    </div>
                </div>
            )}
        </div>
    )
}
