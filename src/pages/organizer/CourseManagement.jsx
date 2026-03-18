import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, BookOpen, Trash2, Edit2, X, Save, AlertCircle, FileText, Upload, Link as LinkIcon, Globe, Clock, Calendar } from 'lucide-react'
import { toLocalInput, toISOWithOffset } from '../../lib/dateUtils'

export default function CourseManagement() {
    const { profile } = useAuth()
    const navigate = useNavigate()
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [formData, setFormData] = useState({ title: '', description: '', start_date: '', end_date: '', organizer_id: '' })
    const [editingId, setEditingId] = useState(null)
    const [showResourceModal, setShowResourceModal] = useState(false)
    const [currentCourse, setCurrentCourse] = useState(null)
    const [resources, setResources] = useState([])
    const [loadingResources, setLoadingResources] = useState(false)
    const [resourceForm, setResourceForm] = useState({ title: '', description: '', file_url: '', resource_type: 'pdf', day_number: 1, file: null })
    const [organizers, setOrganizers] = useState([])

    useEffect(() => {
        if (profile?.id) {
            loadCourses()
            if (profile.role === 'main_admin') {
                fetchOrganizers()
            }
        }
    }, [profile])

    async function fetchOrganizers() {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('role', 'organizer')
            .order('name')
        if (!error) setOrganizers(data || [])
    }

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
            start_date: toISOWithOffset(formData.start_date),
            end_date: toISOWithOffset(formData.end_date),
            organizer_id: formData.organizer_id || profile.id
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
            setFormData({ title: '', description: '', start_date: '', end_date: '', organizer_id: '' })
            setEditingId(null)
            loadCourses()
        } catch (err) {
            setError(err.message || 'Failed to save course')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure? This will PERMANENTLY delete the course and ALL associated materials, enrollments, and sessions. This action cannot be undone.')) return

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
            start_date: toLocalInput(course.start_date),
            end_date: toLocalInput(course.end_date),
            organizer_id: course.organizer_id || ''
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
        setSaving(true)
        setError('')

        try {
            let finalUrl = resourceForm.file_url

            // If a file is selected, upload it first
            if (resourceForm.file) {
                const file = resourceForm.file
                const fileExt = file.name.split('.').pop()
                const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
                const filePath = `${currentCourse.id}/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('study-materials')
                    .upload(filePath, file)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('study-materials')
                    .getPublicUrl(filePath)
                
                finalUrl = publicUrl
            }

            if (!finalUrl) throw new Error('Please provide a URL or upload a file')

            const { error } = await supabase.from('course_resources').insert({
                title: resourceForm.title,
                description: resourceForm.description,
                file_url: finalUrl,
                resource_type: resourceForm.resource_type,
                day_number: resourceForm.day_number,
                course_id: currentCourse.id
            })

            if (error) throw error

            setResourceForm({ title: '', description: '', file_url: '', resource_type: 'pdf', day_number: (parseInt(resourceForm.day_number) || 1) + 1, file: null })
            openResources(currentCourse)
        } catch (err) {
            alert('Failed to add resource: ' + err.message)
            setError(err.message)
        } finally {
            setSaving(false)
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
                    onClick={() => { setEditingId(null); setFormData({ title: '', description: '', start_date: '', end_date: '', organizer_id: profile.id }); setShowModal(true) }}
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
                                        <label htmlFor="resource-title" className="form-label">Material Title</label>
                                        <input
                                            id="resource-title"
                                            name="title"
                                            type="text"
                                            className="form-input"
                                            placeholder="e.g. Introduction PPT"
                                            value={resourceForm.title}
                                            onChange={e => setResourceForm(p => ({ ...p, title: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="resource-type" className="form-label">Type</label>
                                        <select
                                            id="resource-type"
                                            name="resource_type"
                                            className="form-input"
                                            value={resourceForm.resource_type}
                                            onChange={e => setResourceForm(p => ({ ...p, resource_type: e.target.value }))}
                                        >
                                            <option value="pdf">PDF Document</option>
                                            <option value="ppt">PowerPoint</option>
                                            <option value="other">Other Link</option>
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <label className="form-label" style={{ marginBottom: 0 }}>Add via File or URL</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setResourceForm(p => ({ ...p, file: null }))}
                                                    style={{ fontSize: '0.7rem', background: 'none', border: 'none', color: !resourceForm.file ? '#6366f1' : 'var(--text-muted)', fontWeight: !resourceForm.file ? 700 : 500, cursor: 'pointer' }}
                                                >URL</button>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>|</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => document.getElementById('file-upload-input').click()}
                                                    style={{ fontSize: '0.7rem', background: 'none', border: 'none', color: resourceForm.file ? '#6366f1' : 'var(--text-muted)', fontWeight: resourceForm.file ? 700 : 500, cursor: 'pointer' }}
                                                >Desktop Upload</button>
                                            </div>
                                        </div>

                                        {resourceForm.file ? (
                                            <div style={{ padding: '0.75rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                    <Upload size={14} color="#6366f1" />
                                                    <span style={{ fontWeight: 600 }}>{resourceForm.file.name}</span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({(resourceForm.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                                </div>
                                                <button type="button" onClick={() => setResourceForm(p => ({ ...p, file: null }))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                                            </div>
                                        ) : (
                                            <input
                                                id="resource-link"
                                                name="file_url"
                                                type="url"
                                                className="form-input"
                                                placeholder="https://..."
                                                value={resourceForm.file_url}
                                                onChange={e => setResourceForm(p => ({ ...p, file_url: e.target.value }))}
                                                required={!resourceForm.file}
                                            />
                                        )}
                                        <input 
                                            id="file-upload-input"
                                            type="file" 
                                            style={{ display: 'none' }} 
                                            accept=".pdf,.ppt,.pptx"
                                            onChange={(e) => {
                                                const file = e.target.files[0]
                                                if (file) {
                                                    setResourceForm(p => ({ 
                                                        ...p, 
                                                        file,
                                                        title: p.title || file.name.replace(/\.[^/.]+$/, ""),
                                                        resource_type: file.name.endsWith('.pdf') ? 'pdf' : (file.name.includes('.ppt') ? 'ppt' : 'other')
                                                    }))
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label htmlFor="resource-day" className="form-label">Day / Session Number</label>
                                    <input
                                        id="resource-day"
                                        name="day_number"
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
                                <label htmlFor="course-title" className="form-label">Course Title</label>
                                <input
                                    id="course-title"
                                    name="title"
                                    type="text"
                                    className="form-input"
                                    placeholder="e.g. Full Stack Web Development"
                                    value={formData.title}
                                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                                    required
                                />
                            </div>

                            {profile?.role === 'main_admin' && (
                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label htmlFor="organizer-select" className="form-label">Assign Organizer</label>
                                    <select
                                        id="organizer-select"
                                        className="form-input"
                                        value={formData.organizer_id}
                                        onChange={e => setFormData(p => ({ ...p, organizer_id: e.target.value }))}
                                        required
                                    >
                                        <option value="">Select an Organizer</option>
                                        <option value={profile.id}>{profile.name} (Main Admin)</option>
                                        {organizers.map(org => (
                                            <option key={org.id} value={org.id}>{org.name} ({org.email})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label htmlFor="course-desc" className="form-label">Description</label>
                                <textarea
                                    id="course-desc"
                                    name="description"
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
                                    <label htmlFor="start-date" className="form-label">Start Date</label>
                                    <input
                                        id="start-date"
                                        name="start_date"
                                        type="datetime-local"
                                        className="form-input"
                                        value={formData.start_date}
                                        onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="end-date" className="form-label">End Date</label>
                                    <input
                                        id="end-date"
                                        name="end_date"
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
