import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, BookOpen, Trash2, Edit2, X, Save, AlertCircle, FileText, Upload, Link as LinkIcon, Globe } from 'lucide-react'

export default function CourseManagement() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [formData, setFormData] = useState({ title: '', description: '', start_date: '', end_date: '' })
    const [editingId, setEditingId] = useState(null)
    const [showResourceModal, setShowResourceModal] = useState(false)
    const [currentCourse, setCurrentCourse] = useState(null)
    const [resources, setResources] = useState([])
    const [loadingResources, setLoadingResources] = useState(false)
    const [resourceForm, setResourceForm] = useState({ title: '', description: '', file_url: '', resource_type: 'pdf', day_number: 1 })

    useEffect(() => {
        if (profile?.id) loadCourses()
    }, [profile])

    async function loadCourses() {
        setLoading(true)
        let query = supabase.from('courses').select('*')
        
        if (profile?.role === 'sub_admin') {
            const { data: assignments } = await supabase
                .from('admin_course_assignments')
                .select('course_id')
                .eq('admin_id', profile.id)
            
            const assignedIds = (assignments || []).map(a => a.course_id)
            query = query.in('id', assignedIds)
        } else if (profile?.role === 'organizer') {
            query = query.eq('organizer_id', profile.id)
        }
        // main_admin sees all

        const { data, error } = await query.order('created_at', { ascending: false })

        if (!error) setCourses(data || [])
        setLoading(false)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        setSaving(true)
        setError('')

        const payload = {
            title: formData.title,
            description: formData.description,
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            organizer_id: profile.id
        }

        try {
            if (editingId) {
                const { error } = await supabase.from('courses').update(payload).eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('courses').insert(payload)
                if (error) throw error
            }

            setShowModal(false)
            setFormData({ title: '', description: '', start_date: '', end_date: '' })
            setEditingId(null)
            loadCourses()
        } catch (err) {
            setError(err.message || 'Failed to save course')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure? This will not delete the videos/sessions associated but they will lose their reference.')) return

        const { error } = await supabase.from('courses').delete().eq('id', id)
        if (!error) {
            setCourses(courses.filter(c => c.id !== id))
        } else {
            alert('Failed to delete course: ' + error.message)
        }
    }

    function openEdit(course) {
        setEditingId(course.id)
        setFormData({
            title: course.title,
            description: course.description || '',
            start_date: course.start_date ? new Date(new Date(course.start_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '',
            end_date: course.end_date ? new Date(new Date(course.end_date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
        })
        setShowModal(true)
    }

    async function openResources(course) {
        setCurrentCourse(course)
        setShowResourceModal(true)
        setLoadingResources(true)
        const { data, error } = await supabase
            .from('course_resources')
            .select('*')
            .eq('course_id', course.id)
            .order('created_at', { ascending: false })

        if (!error) setResources(data || [])
        setLoadingResources(false)
    }

    async function handleResourceSubmit(e) {
        e.preventDefault()
        const { error } = await supabase.from('course_resources').insert({
            ...resourceForm,
            course_id: currentCourse.id
        })

        if (!error) {
            setResourceForm({ title: '', description: '', file_url: '', resource_type: 'pdf', day_number: (parseInt(resourceForm.day_number) || 1) + 1 })
            openResources(currentCourse)
        } else {
            alert('Failed to add resource: ' + error.message)
        }
    }

    async function deleteResource(id) {
        if (!confirm('Remove this resource?')) return
        const { error } = await supabase.from('course_resources').delete().eq('id', id)
        if (!error) {
            setResources(resources.filter(r => r.id !== id))
        }
    }

    return (
        <div className="animate-fade-in">
            <div className="stack-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Course Management</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Create and manage your educational programs</p>
                </div>
                <button
                    onClick={() => { setEditingId(null); setFormData({ title: '', description: '', start_date: '', end_date: '' }); setShowModal(true) }}
                    className="btn-primary"
                    style={{ gap: '0.5rem', display: profile?.role === 'sub_admin' ? 'none' : 'flex' }}
                >
                    <Plus size={18} /> Create Course
                </button>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading your courses...</p>
                </div>
            ) : courses.length === 0 ? (
                <div className="glass-card" style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <BookOpen size={32} color="#94a3b8" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Courses Yet</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 1.5rem' }}>Start by creating your first course. You'll be able to schedule live classes under each course.</p>
                    <button onClick={() => setShowModal(true)} className="btn-secondary">
                        <Plus size={18} /> Add Your First Course
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {courses.map(course => (
                        <div key={course.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '1.5rem', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ width: 40, height: 40, background: 'rgba(99,102,241,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <BookOpen size={20} color="#6366f1" />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.25rem', visibility: profile?.role === 'sub_admin' ? 'hidden' : 'visible' }}>
                                        <button onClick={() => openEdit(course)} style={{ p: '0.4rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }} title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        <button onClick={() => handleDelete(course.id)} style={{ p: '0.4rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{course.title}</h3>
                                {(course.start_date || course.end_date) && (
                                    <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f97316', fontSize: '0.75rem', fontWeight: 600 }}>
                                        <Clock size={14} />
                                        <span>
                                            {course.start_date ? new Date(course.start_date).toLocaleDateString() : '...'} - {course.end_date ? new Date(course.end_date).toLocaleDateString() : '...'}
                                        </span>
                                    </div>
                                )}
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {course.description || 'No description provided.'}
                                </p>
                            </div>
                            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--card-border)', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    Created {new Date(course.created_at).toLocaleDateString()}
                                </span>
                                <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Course</span>
                                <button onClick={() => navigate(`/student/courses/${course.id}`)} className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', gap: '0.4rem' }}>
                                    <Globe size={14} /> Open Portal
                                </button>
                                <button onClick={() => openResources(course)} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', gap: '0.4rem' }}>
                                    <FileText size={14} /> Materials
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Resources Modal */}
            {showResourceModal && currentCourse && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 600, padding: 0, overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Study Materials</h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{currentCourse.title}</p>
                            </div>
                            <button onClick={() => setShowResourceModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem', flex: 1, overflowY: 'auto' }}>
                            <form onSubmit={handleResourceSubmit} style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Material Title</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="e.g. Introduction PPT"
                                            value={resourceForm.title}
                                            onChange={e => setResourceForm(p => ({ ...p, title: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Type</label>
                                        <select
                                            className="form-input"
                                            value={resourceForm.resource_type}
                                            onChange={e => setResourceForm(p => ({ ...p, resource_type: e.target.value }))}
                                        >
                                            <option value="pdf">PDF Document</option>
                                            <option value="ppt">PowerPoint</option>
                                            <option value="other">Other Link</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">File/Link URL</label>
                                        <input
                                            type="url"
                                            className="form-input"
                                            placeholder="https://..."
                                            value={resourceForm.file_url}
                                            onChange={e => setResourceForm(p => ({ ...p, file_url: e.target.value }))}
                                            required
                                        />
                                    </div>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Day / Session Number</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="e.g. 1"
                                        min="1"
                                        value={resourceForm.day_number}
                                        onChange={e => setResourceForm(p => ({ ...p, day_number: e.target.value }))}
                                        required
                                    />
                                </div>
                                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', gridColumn: '1 / -1' }}>
                                    <Plus size={16} /> Add Material
                                </button>
                            </form>

                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Existing Materials (Grouped by Day)</h4>
                            {loadingResources ? (
                                <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Loading...</p>
                            ) : resources.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No materials uploaded yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    {Array.from(new Set(resources.map(r => r.day_number || 1))).sort((a, b) => a - b).map(day => (
                                        <div key={day}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={12} /> Day {day}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {resources.filter(r => (r.day_number || 1) === day).map(r => (
                                                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                                                        <div style={{ width: 36, height: 36, background: r.resource_type === 'ppt' ? '#fff7ed' : '#f0fdf4', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {r.resource_type === 'ppt' ? <FileText size={18} color="#f97316" /> : <FileText size={18} color="#22c55e" />}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                                                            <a href={r.file_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.7rem', color: '#6366f1', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <LinkIcon size={10} /> View Link
                                                            </a>
                                                        </div>
                                                        <button onClick={() => deleteResource(r.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
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
                                {editingId ? 'Edit Course' : 'Create New Course'}
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
                                <label className="form-label">Course Title</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Full Stack Web Development"
                                    value={formData.title}
                                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                                    required
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-input"
                                    rows={4}
                                    placeholder="Briefly describe what this course covers..."
                                    value={formData.description}
                                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label className="form-label">Start Date</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={formData.start_date}
                                        onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="form-label">End Date</label>
                                    <input
                                        type="datetime-local"
                                        className="form-input"
                                        value={formData.end_date}
                                        onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
                                    {saving ? 'Saving...' : (editingId ? <><Save size={18} /> Save Changes</> : <><Plus size={18} /> Create Course</>)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
