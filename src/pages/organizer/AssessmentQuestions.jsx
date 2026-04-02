import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Edit2, X, Save, AlertCircle, ChevronLeft, HelpCircle, CheckCircle2, Clock } from 'lucide-react'

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
    const [groups, setGroups] = useState([])
    const [resourceAccess, setResourceAccess] = useState([])
    const [showLockModal, setShowLockModal] = useState(false)

    useEffect(() => {
        if (assessmentId) {
            loadData()
        }
    }, [assessmentId])

    async function loadData() {
        const [
            { data: assessData },
            { data: questData },
            { data: groupData },
            { data: accessData }
        ] = await Promise.all([
            supabase.from('assessments').select('*, courses(title)').eq('id', assessmentId).single(),
            supabase.from('questions').select('*').eq('assessment_id', assessmentId).order('created_at', { ascending: true }),
            supabase.from('groups').select('*').in('course_id', [assessmentId]), // This is wrong, need courseId from assessmentId
            supabase.from('resource_access').select('*').eq('resource_id', assessmentId).eq('resource_type', 'assessment')
        ])

        // Correction: Need to get course_id first or use a join
        const { data: aData } = await supabase.from('assessments').select('course_id').eq('id', assessmentId).single()
        if (aData) {
            const { data: gData } = await supabase.from('groups').select('*').eq('course_id', aData.course_id)
            setGroups(gData || [])
        }

        setAssessment(assessData)
        setQuestions(questData || [])
        setResourceAccess(accessData || [])
        setLoading(false)
    }

    async function toggleResourceLock(groupId) {
        const existing = resourceAccess.find(a => a.group_id === groupId && a.resource_id === assessmentId)
        try {
            if (existing) {
                const { error } = await supabase.from('resource_access')
                    .update({ is_locked: !existing.is_locked })
                    .eq('resource_id', assessmentId)
                    .eq('group_id', groupId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('resource_access')
                    .insert({
                        resource_id: assessmentId,
                        resource_type: 'assessment',
                        group_id: groupId,
                        is_locked: true
                    })
                if (error) throw error
            }
            // Reload access data
            const { data } = await supabase.from('resource_access').select('*').eq('resource_id', assessmentId).eq('resource_type', 'assessment')
            setResourceAccess(data || [])
        } catch (err) {
            console.error('Error toggling lock:', err)
        }
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
                    <button
                        onClick={() => setShowLockModal(true)}
                        className="btn-secondary"
                        style={{ gap: '0.5rem', marginLeft: '0.75rem' }}
                    >
                        <Clock size={18} /> Access Control
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
                                <label htmlFor="question-text" className="form-label">Question Text</label>
                                <textarea
                                    id="question-text"
                                    name="question_text"
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
                                <label htmlFor="opt-0-radio" className="form-label">Options (Choose one as correct)</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {formData.options.map((opt, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ flexShrink: 0 }}>
                                                <input
                                                    id={`opt-${i}-radio`}
                                                    type="radio"
                                                    name="correct_answer"
                                                    checked={formData.correct_answer === opt && opt !== ''}
                                                    onChange={() => setFormData(p => ({ ...p, correct_answer: opt }))}
                                                    disabled={!opt.trim()}
                                                    style={{ width: 18, height: 18, cursor: opt.trim() ? 'pointer' : 'default' }}
                                                />
                                            </div>
                                            <input
                                                id={`opt-${i}-text`}
                                                name={`option_${i}`}
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
            {/* Access Control Modal */}
            {showLockModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card zoom-in" style={{ width: '100%', maxWidth: 450, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Access Control</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{assessment?.title}</p>
                            </div>
                            <button onClick={() => setShowLockModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Toggle locks for specific groups. Locked resources are invisible/non-accessible to students in that group.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {groups.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        No groups created for this course.
                                    </div>
                                ) : (
                                    groups.map(g => {
                                        const access = resourceAccess.find(a => a.group_id === g.id && a.resource_id === assessmentId)
                                        const isLocked = access?.is_locked || false
                                        return (
                                            <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: isLocked ? '#fff1f2' : '#f0fdf4', borderRadius: 10, border: `1px solid ${isLocked ? '#fecaca' : '#bbf7d0'}` }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isLocked ? '#991b1b' : '#166534' }}>{g.name}</div>
                                                <button
                                                    onClick={() => toggleResourceLock(g.id)}
                                                    className={isLocked ? "btn-primary" : "btn-secondary"}
                                                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', background: isLocked ? '#ef4444' : 'white' }}
                                                >
                                                    {isLocked ? 'Unlock' : 'Lock'}
                                                </button>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                        <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid var(--card-border)', textAlign: 'right' }}>
                            <button onClick={() => setShowLockModal(false)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
