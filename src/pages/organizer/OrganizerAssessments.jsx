import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, ClipboardList, Trash2, Edit2, X, Save, AlertCircle, Calendar, BookOpen, ChevronRight } from 'lucide-react'

export default function OrganizerAssessments() {
    const { profile } = useAuth()
    const [courses, setCourses] = useState([])
    const [assessments, setAssessments] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [formData, setFormData] = useState({ title: '', course_id: '', type: 'daily', due_date: '', description: '' })
    const [editingId, setEditingId] = useState(null)

    useEffect(() => {
        if (profile?.id) {
            loadInitialData()
        }
    }, [profile])

    async function loadInitialData() {
        setLoading(true)
        const [{ data: courseData }, { data: assessData }] = await Promise.all([
            supabase.from('courses').select('id, title').eq('organizer_id', profile.id),
            supabase.from('assessments').select('*, courses(title)').order('created_at', { ascending: false })
        ])

        setCourses(courseData || [])
        // Filter assessments to only show those belonging to organizer's courses
        // (RLS handles this on backend, but we filter if needed for UI)
        setAssessments(assessData || [])
        setLoading(false)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.course_id) { setError('Please select a course'); return }

        setSaving(true)
        setError('')

        try {
            const payload = {
                title: formData.title,
                course_id: formData.course_id,
                type: formData.type,
                due_date: formData.due_date || null,
                description: formData.description
            }

            if (editingId) {
                const { error } = await supabase.from('assessments').update(payload).eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('assessments').insert(payload)
                if (error) throw error
            }

            setShowModal(false)
            resetForm()
            loadInitialData()
        } catch (err) {
            setError(err.message || 'Failed to save assessment')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this assessment? All associated questions will also be removed.')) return
        const { error } = await supabase.from('assessments').delete().eq('id', id)
        if (!error) {
            setAssessments(assessments.filter(a => a.id !== id))
        } else {
            alert('Error deleting: ' + error.message)
        }
    }

    function openEdit(a) {
        setEditingId(a.id)
        setFormData({
            title: a.title,
            course_id: a.course_id,
            type: a.type,
            due_date: a.due_date ? a.due_date.split('T')[0] : '',
            description: a.description || ''
        })
        setShowModal(true)
    }

    function resetForm() {
        setFormData({ title: '', course_id: '', type: 'daily', due_date: '', description: '' })
        setEditingId(null)
        setError('')
    }

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Assessment Management</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Create quizzes and evaluations for your students</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true) }}
                    className="btn-primary"
                    style={{ gap: '0.5rem' }}
                >
                    <Plus size={18} /> Create Assessment
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading assessments...</p>
                </div>
            ) : assessments.length === 0 ? (
                <div className="glass-card" style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <ClipboardList size={32} color="#94a3b8" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Assessments Found</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 1.5rem' }}>Start by creating an assessment header, then add questions to it.</p>
                    <button onClick={() => setShowModal(true)} className="btn-secondary">
                        <Plus size={18} /> Create Your First Assessment
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                    {assessments.map(a => (
                        <div key={a.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '1.5rem', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <span className={`badge ${a.type === 'final' ? 'badge-success' : a.type === 'weekly' ? 'badge-warning' : 'badge-info'}`}>
                                        {a.type.toUpperCase()}
                                    </span>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <button onClick={() => openEdit(a)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem' }}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{a.title}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    <BookOpen size={14} /> {a.courses?.title || 'Unknown Course'}
                                </div>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                                    {a.description || 'No description provided.'}
                                </p>

                                <Link
                                    to={`/organizer/assessments/${a.id}/questions`}
                                    className="btn-secondary"
                                    style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                                >
                                    Manage Questions <ChevronRight size={16} />
                                </Link>
                            </div>
                            <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--card-border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Calendar size={12} /> {a.due_date ? new Date(a.due_date).toLocaleDateString() : 'No due date'}
                                </span>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366f1' }}>Quiz</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 500, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {editingId ? 'Edit Assessment' : 'Create Assessment'}
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

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label">Course</label>
                                <select
                                    className="form-input"
                                    value={formData.course_id}
                                    onChange={e => setFormData(p => ({ ...p, course_id: e.target.value }))}
                                    required
                                >
                                    <option value="">Select Course</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label">Assessment Title</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Week 1 Quiz: Introduction"
                                    value={formData.title}
                                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <label className="form-label">Type</label>
                                    <select
                                        className="form-input"
                                        value={formData.type}
                                        onChange={e => setFormData(p => ({ ...p, type: e.target.value }))}
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="final">Final</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Due Date (optional)</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={formData.due_date}
                                        onChange={e => setFormData(p => ({ ...p, due_date: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Instructions / Description</label>
                                <textarea
                                    className="form-input"
                                    rows={3}
                                    placeholder="Any notes for students..."
                                    value={formData.description}
                                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
                                    {saving ? 'Saving...' : (editingId ? <><Save size={18} /> Save Changes</> : <><Plus size={18} /> Create</>)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
