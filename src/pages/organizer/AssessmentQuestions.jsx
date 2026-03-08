import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Edit2, X, Save, AlertCircle, ChevronLeft, HelpCircle, CheckCircle2 } from 'lucide-react'

export default function AssessmentQuestions() {
    const { assessmentId } = useParams()
    const [assessment, setAssessment] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const [formData, setFormData] = useState({
        question_text: '',
        options: ['', '', '', ''],
        correct_answer: ''
    })
    const [editingId, setEditingId] = useState(null)

    useEffect(() => {
        if (assessmentId) {
            loadData()
        }
    }, [assessmentId])

    async function loadData() {
        setLoading(true)
        const [{ data: assessData }, { data: questData }] = await Promise.all([
            supabase.from('assessments').select('*, courses(title)').eq('id', assessmentId).single(),
            supabase.from('questions').select('*').eq('assessment_id', assessmentId).order('created_at', { ascending: true })
        ])

        setAssessment(assessData)
        setQuestions(questData || [])
        setLoading(false)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (formData.options.some(opt => !opt.trim())) { setError('All options are required'); return }
        if (!formData.correct_answer) { setError('Please select a correct answer'); return }

        setSaving(true)
        setError('')

        try {
            const payload = {
                assessment_id: assessmentId,
                question_text: formData.question_text,
                options: formData.options,
                correct_answer: formData.correct_answer
            }

            if (editingId) {
                const { error } = await supabase.from('questions').update(payload).eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('questions').insert(payload)
                if (error) throw error
            }

            setShowModal(false)
            resetForm()
            loadData()
        } catch (err) {
            setError(err.message || 'Failed to save question')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this question?')) return
        const { error } = await supabase.from('questions').delete().eq('id', id)
        if (!error) {
            setQuestions(questions.filter(q => q.id !== id))
        } else {
            alert('Error deleting: ' + error.message)
        }
    }

    function openEdit(q) {
        setEditingId(q.id)
        setFormData({
            question_text: q.question_text,
            options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
            correct_answer: q.correct_answer
        })
        setShowModal(true)
    }

    function resetForm() {
        setFormData({ question_text: '', options: ['', '', '', ''], correct_answer: '' })
        setEditingId(null)
        setError('')
    }

    if (loading && !assessment) return <div style={{ padding: '2rem' }}>Loading assessment...</div>

    return (
        <div className="animate-fade-in">
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <Link to="/organizer/assessments" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6366f1', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    <ChevronLeft size={16} /> Back to Assessments
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{assessment?.title}</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            {assessment?.courses?.title} • {questions.length} Questions
                        </p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setShowModal(true) }}
                        className="btn-primary"
                        style={{ gap: '0.5rem' }}
                    >
                        <Plus size={18} /> Add Question
                    </button>
                </div>
            </div>

            {/* Questions List */}
            {questions.length === 0 ? (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                    <HelpCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.2, display: 'block' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Questions Yet</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Start building your quiz by adding the first question.</p>
                    <button onClick={() => setShowModal(true)} className="btn-secondary">
                        <Plus size={18} /> Add Multiple Choice Question
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {questions.map((q, idx) => (
                        <div key={q.id} className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ width: 28, height: 28, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: '#64748b' }}>
                                        {idx + 1}
                                    </div>
                                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>{q.question_text}</h4>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem', alignSelf: 'flex-start' }}>
                                    <button onClick={() => openEdit(q)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem' }}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(q.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginLeft: '2.75rem' }}>
                                {q.options.map((opt, i) => {
                                    const isCorrect = opt === q.correct_answer
                                    return (
                                        <div key={i} style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: 10,
                                            background: isCorrect ? '#ecfdf5' : '#f8fafc',
                                            border: `1px solid ${isCorrect ? '#10b98140' : '#e2e8f0'}`,
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            color: isCorrect ? '#065f46' : 'var(--text-primary)'
                                        }}>
                                            <div style={{ width: 18, height: 18, background: isCorrect ? '#10b981' : '#cbd5e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                                                {isCorrect ? <CheckCircle2 size={12} /> : String.fromCharCode(65 + i)}
                                            </div>
                                            {opt}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 600, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {editingId ? 'Edit Question' : 'New Question'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                            {error && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 10, marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
                                    <AlertCircle size={18} /> {error}
                                </div>
                            )}

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Question Text</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    placeholder="Enter the question..."
                                    value={formData.question_text}
                                    onChange={e => setFormData(p => ({ ...p, question_text: e.target.value }))}
                                    required
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Options (Choose one as correct)</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {formData.options.map((opt, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ flexShrink: 0 }}>
                                                <input
                                                    type="radio"
                                                    name="correct_answer"
                                                    checked={formData.correct_answer === opt && opt !== ''}
                                                    onChange={() => setFormData(p => ({ ...p, correct_answer: opt }))}
                                                    disabled={!opt.trim()}
                                                    style={{ width: 18, height: 18, cursor: opt.trim() ? 'pointer' : 'default' }}
                                                />
                                            </div>
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                                value={opt}
                                                onChange={e => {
                                                    const newOpts = [...formData.options]
                                                    const oldVal = newOpts[i]
                                                    newOpts[i] = e.target.value
                                                    setFormData(p => ({
                                                        ...p,
                                                        options: newOpts,
                                                        correct_answer: p.correct_answer === oldVal ? e.target.value : p.correct_answer
                                                    }))
                                                }}
                                                required
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
                                    {saving ? 'Saving...' : (editingId ? <><Save size={18} /> Update</> : <><Plus size={18} /> Add Question</>)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
