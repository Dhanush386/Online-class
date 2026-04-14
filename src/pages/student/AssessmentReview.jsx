import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, CheckCircle2, XCircle, Clock } from 'lucide-react'

export default function AssessmentReview() {
    const { assessmentId } = useParams()
    const { profile } = useAuth()
    const navigate = useNavigate()

    const [assessment, setAssessment] = useState(null)
    const [questions, setQuestions] = useState([])
    const [submissions, setSubmissions] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeAttempt, setActiveAttempt] = useState(0)

    useEffect(() => {
        if (assessmentId) loadData()
    }, [assessmentId])

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
                <button onClick={() => navigate(`/student/courses/${assessment?.course_id}`, { state: { tab: 'assessments' } })} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem', padding: 0 }}>
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
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

                    return (
                        <div key={q.id} className="glass-card" style={{
                            padding: '1.5rem',
                            borderLeft: `3px solid ${!wasAnswered ? '#94a3b8' : isCorrect ? '#10b981' : '#ef4444'}`
                        }}>
                            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#64748b', flexShrink: 0 }}>
                                    {idx + 1}
                                </div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                                    {q.question_text}
                                </h3>
                                <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                                    {!wasAnswered
                                        ? <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Unanswered</span>
                                        : isCorrect
                                            ? <CheckCircle2 size={20} color="#10b981" />
                                            : <XCircle size={20} color="#ef4444" />
                                    }
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {q.options.map((opt, i) => {
                                    let isThisCorrect = false
                                    try {
                                        if (q.correct_answer?.startsWith('[') && q.correct_answer?.endsWith(']')) {
                                            isThisCorrect = JSON.parse(q.correct_answer).includes(opt)
                                        } else {
                                            isThisCorrect = opt === q.correct_answer
                                        }
                                    } catch (e) {
                                        isThisCorrect = opt === q.correct_answer
                                    }

                                    const isThisSelected = Array.isArray(selected) ? selected.includes(opt) : opt === selected
                                    let bg = '#f8fafc', border = '#e2e8f0', textColor = 'var(--text-primary)'

                                    if (isThisCorrect) { bg = '#ecfdf5'; border = '#10b98140'; textColor = '#065f46' }
                                    else if (isThisSelected && !isThisCorrect) { bg = '#fef2f2'; border = '#ef444440'; textColor = '#991b1b' }

                                    return (
                                        <div key={i} style={{ padding: '0.75rem 1rem', borderRadius: 10, background: bg, border: `1px solid ${border}`, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.75rem', color: textColor }}>
                                            <div style={{ width: 20, height: 20, background: isThisCorrect ? '#10b981' : isThisSelected ? '#ef4444' : '#cbd5e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.7rem', flexShrink: 0 }}>
                                                {isThisCorrect ? <CheckCircle2 size={12} /> : isThisSelected ? <XCircle size={12} /> : String.fromCharCode(65 + i)}
                                            </div>
                                            {opt}
                                            {isThisSelected && !isThisCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>Your answer</span>}
                                            {isThisCorrect && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Correct</span>}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
