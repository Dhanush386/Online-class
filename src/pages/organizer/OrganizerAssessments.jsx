import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, ClipboardList, Trash2, Edit2, X, Save, AlertCircle, Calendar, BookOpen, ChevronRight, Clock, Eye, BarChart3, Download, CheckCircle2, XCircle, Search, Users } from 'lucide-react'

export default function OrganizerAssessments() {
    const { profile } = useAuth()
    const location = useLocation()
    const [courses, setCourses] = useState([])
    const [assessments, setAssessments] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [formData, setFormData] = useState({ title: '', course_id: '', type: 'daily', due_date: '', description: '', day_number: 1 })
    const [editingId, setEditingId] = useState(null)
    const [viewingMarks, setViewingMarks] = useState(null)
    const [marksData, setMarksData] = useState([])
    const [marksLoading, setMarksLoading] = useState(false)
    const [marksSearch, setMarksSearch] = useState('')

    const [groups, setGroups] = useState([])
    const [resourceAccess, setResourceAccess] = useState([])
    const [lockingResource, setLockingResource] = useState(null)

    useEffect(() => {
        if (profile?.id) {
            loadInitialData()
        }
    }, [profile])

    async function loadInitialData() {
        setLoading(true)
        
        let courseQuery = supabase.from('courses').select('id, title')
        if (profile?.role === 'sub_admin') {
            const { data: assignments } = await supabase
                .from('admin_course_assignments')
                .select('course_id')
                .eq('admin_id', profile.id)
            
            const assignedIds = (assignments || []).map(a => a.course_id)
            courseQuery = courseQuery.in('id', assignedIds)
        } else if (profile?.role === 'organizer') {
            courseQuery = courseQuery.eq('organizer_id', profile.id)
        }

        const [
            { data: courseData },
            { data: assessData },
            { data: groupData },
            { data: accessData }
        ] = await Promise.all([
            courseQuery,
            supabase.from('assessments').select('*, courses(title)').order('created_at', { ascending: false }),
            supabase.from('groups').select('*').eq('organizer_id', profile.id),
            supabase.from('resource_access').select('*').eq('resource_type', 'assessment')
        ])

        setCourses(courseData || [])
        setAssessments(assessData || [])
        setGroups(groupData || [])
        setResourceAccess(accessData || [])
        setLoading(false)
    }

    useEffect(() => {
        if (location.state?.courseId) {
            setFormData(prev => ({ 
                ...prev, 
                course_id: location.state.courseId,
                day_number: location.state.day || 1
            }))
            if (location.state.openModal) setShowModal(true)
        }
    }, [location.state])

    async function toggleResourceLock(groupId, resourceId) {
        const existing = resourceAccess.find(a => a.group_id === groupId && a.resource_id === resourceId)
        try {
            if (existing) {
                const { error } = await supabase.from('resource_access')
                    .update({ is_locked: !existing.is_locked })
                    .eq('resource_id', resourceId)
                    .eq('group_id', groupId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('resource_access')
                    .insert({
                        resource_id: resourceId,
                        resource_type: 'assessment',
                        group_id: groupId,
                        is_locked: true
                    })
                if (error) throw error
            }
            // Reload access data
            const { data } = await supabase.from('resource_access').select('*').eq('resource_type', 'assessment')
            setResourceAccess(data || [])
        } catch (err) {
            console.error('Error toggling lock:', err)
        }
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
                description: formData.description,
                day_number: parseInt(formData.day_number) || 1
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
            description: a.description || '',
            day_number: a.day_number || 1
        })
        setShowModal(true)
    }

    function resetForm() {
        setFormData({ title: '', course_id: '', type: 'daily', due_date: '', description: '', day_number: 1 })
        setEditingId(null)
        setError('')
    }

    async function loadMarks(assessment) {
        setViewingMarks(assessment)
        setMarksLoading(true)
        setMarksSearch('')
        try {
            const { data: subs } = await supabase
                .from('assessment_submissions')
                .select('*, users!assessment_submissions_student_id_fkey(name, email)')
                .eq('assessment_id', assessment.id)
                .order('created_at', { ascending: false })

            // Group by student — keep best attempt
            const bestByStudent = {}
            ;(subs || []).forEach(s => {
                if (!bestByStudent[s.student_id] || s.score > bestByStudent[s.student_id].score) {
                    bestByStudent[s.student_id] = s
                }
            })
            setMarksData(Object.values(bestByStudent))
        } catch (err) {
            console.error('Error loading marks:', err)
        } finally {
            setMarksLoading(false)
        }
    }

    const filteredMarks = marksData.filter(m => {
        if (!marksSearch) return true
        const q = marksSearch.toLowerCase()
        return m.users?.name?.toLowerCase().includes(q) || m.users?.email?.toLowerCase().includes(q)
    })

    const marksStats = {
        total: marksData.length,
        avgScore: marksData.length > 0 ? Math.round(marksData.reduce((sum, m) => sum + (m.total_questions > 0 ? (m.score / m.total_questions) * 100 : 0), 0) / marksData.length) : 0,
        passed: marksData.filter(m => m.total_questions > 0 && (m.score / m.total_questions) >= 0.5).length,
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
                                        <button onClick={() => setLockingResource(a)} title="Access Control" style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: '0.4rem' }}>
                                            <Clock size={16} />
                                        </button>
                                        <button onClick={() => openEdit(a)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem' }}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(a.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {resourceAccess.some(acc => acc.resource_id === a.id && acc.is_locked) && <Clock size={16} color="#ef4444" />}
                                    {a.title}
                                </h3>
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
                                <button
                                    onClick={() => loadMarks(a)}
                                    className="btn-primary"
                                    style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', marginTop: '0.75rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                                >
                                    <Eye size={16} /> View Student Marks
                                </button>
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

            {/* Access Control Modal */}
            {lockingResource && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card zoom-in" style={{ width: '100%', maxWidth: 450, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Access Control</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lockingResource.title}</p>
                            </div>
                            <button onClick={() => setLockingResource(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Toggle locks for specific groups. Locked resources are invisible/non-accessible to students in that group.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {groups.filter(g => g.course_id === lockingResource.course_id).length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        No groups/batches created for this course.
                                        {groups.length > 0 && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#f59e0b' }}>
                                                Note: Batches are course-specific. You have {groups.length} batch(es) in other courses.
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    groups.filter(g => g.course_id === lockingResource.course_id).map(g => {
                                        const access = resourceAccess.find(a => a.group_id === g.id && a.resource_id === lockingResource.id)
                                        const isLocked = access?.is_locked || false
                                        return (
                                            <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: isLocked ? '#fff1f2' : '#f0fdf4', borderRadius: 10, border: `1px solid ${isLocked ? '#fecaca' : '#bbf7d0'}` }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isLocked ? '#991b1b' : '#166534' }}>{g.name}</div>
                                                <button
                                                    onClick={() => toggleResourceLock(g.id, lockingResource.id)}
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
                            <button onClick={() => setLockingResource(null)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Done</button>
                        </div>
                    </div>
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
                                <label htmlFor="course-select" className="form-label">Course</label>
                                <select
                                    id="course-select"
                                    name="course_id"
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
                                <label htmlFor="assessment-title-input" className="form-label">Assessment Title</label>
                                <input
                                    id="assessment-title-input"
                                    name="title"
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Week 1 Quiz: Introduction"
                                    value={formData.title}
                                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <label htmlFor="day-number" className="form-label">Day Number</label>
                                    <input
                                        id="day-number"
                                        name="day_number"
                                        type="number"
                                        className="form-input"
                                        min="1"
                                        value={formData.day_number}
                                        onChange={e => setFormData(p => ({ ...p, day_number: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="assessment-type-select" className="form-label">Type</label>
                                    <select
                                        id="assessment-type-select"
                                        name="type"
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
                                    <label htmlFor="due-date-input" className="form-label">Due Date (optional)</label>
                                    <input
                                        id="due-date-input"
                                        name="due_date"
                                        type="date"
                                        className="form-input"
                                        value={formData.due_date}
                                        onChange={e => setFormData(p => ({ ...p, due_date: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label htmlFor="assessment-desc" className="form-label">Instructions / Description</label>
                                <textarea
                                    id="assessment-desc"
                                    name="description"
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

            {/* View Marks Modal */}
            {viewingMarks && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 800, padding: 0, overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        {/* Header */}
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <BarChart3 size={20} color="#6366f1" /> Student Marks
                                </h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{viewingMarks.title} — {viewingMarks.courses?.title}</p>
                            </div>
                            <button onClick={() => setViewingMarks(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Summary Stats */}
                        <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--card-border)', background: '#f8fafc' }}>
                            <div style={{ flex: 1, padding: '0.75rem', background: 'white', borderRadius: 10, border: '1px solid var(--card-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>{marksStats.total}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Submissions</div>
                            </div>
                            <div style={{ flex: 1, padding: '0.75rem', background: 'white', borderRadius: 10, border: '1px solid var(--card-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{marksStats.avgScore}%</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Avg Score</div>
                            </div>
                            <div style={{ flex: 1, padding: '0.75rem', background: 'white', borderRadius: 10, border: '1px solid var(--card-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{marksStats.passed}/{marksStats.total}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Passed (≥50%)</div>
                            </div>
                        </div>

                        {/* Search */}
                        <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--card-border)' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search students by name or email..."
                                    value={marksSearch}
                                    onChange={e => setMarksSearch(e.target.value)}
                                    style={{ paddingLeft: '2rem', fontSize: '0.8rem' }}
                                />
                            </div>
                        </div>

                        {/* Student List */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                            {marksLoading ? (
                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading submissions...</p>
                                </div>
                            ) : filteredMarks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem' }}>
                                    <Users size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{marksData.length === 0 ? 'No students have submitted this assessment yet.' : 'No results match your search.'}</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {/* Table Header */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '0.5rem 0.75rem', fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--card-border)' }}>
                                        <span>Student</span>
                                        <span style={{ textAlign: 'center' }}>Score</span>
                                        <span style={{ textAlign: 'center' }}>Percentage</span>
                                        <span style={{ textAlign: 'center' }}>Status</span>
                                    </div>
                                    {filteredMarks
                                        .sort((a, b) => b.score - a.score)
                                        .map((sub, idx) => {
                                            const pct = sub.total_questions > 0 ? Math.round((sub.score / sub.total_questions) * 100) : 0
                                            const passed = pct >= 50
                                            return (
                                                <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '0.75rem', borderRadius: 10, background: idx % 2 === 0 ? '#f8fafc' : 'white', alignItems: 'center', border: '1px solid transparent', transition: 'all 0.15s ease' }}
                                                    onMouseEnter={e => e.currentTarget.style.border = '1px solid #6366f130'}
                                                    onMouseLeave={e => e.currentTarget.style.border = '1px solid transparent'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: passed ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: passed ? '#059669' : '#dc2626', flexShrink: 0 }}>
                                                            {sub.users?.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{sub.users?.name || 'Unknown'}</div>
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{sub.users?.email}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                        {sub.score} / {sub.total_questions}
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.2rem 0.6rem', borderRadius: 6, background: pct >= 80 ? '#ecfdf5' : pct >= 50 ? '#fffbeb' : '#fef2f2', color: pct >= 80 ? '#059669' : pct >= 50 ? '#d97706' : '#dc2626', fontSize: '0.8rem', fontWeight: 700 }}>
                                                            {pct}%
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        {passed ? (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 600, color: '#059669' }}>
                                                                <CheckCircle2 size={14} /> Passed
                                                            </span>
                                                        ) : (
                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 600, color: '#dc2626' }}>
                                                                <XCircle size={14} /> Failed
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--card-border)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setViewingMarks(null)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
