import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Video, Link, Calendar, Clock, FolderOpen, CheckCircle, AlertCircle, Plus, Upload, PlayCircle, Radio, ArrowLeft, X } from 'lucide-react'
import { toISOWithOffset } from '../../lib/dateUtils'
import { useLocation, useNavigate } from 'react-router-dom'

export default function ScheduleLiveClass() {
    const { profile } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const [courses, setCourses] = useState([])
    const [mode, setMode] = useState('live') // 'live', 'upload', or 'link'
    const [form, setForm] = useState({
        course_id: '', title: '', description: '',
        meeting_url: '', scheduled_time: '', end_time: '', duration_minutes: '',
        week_number: 1, day_of_week: 1, slide_url: ''
    })
    const [selectedFile, setSelectedFile] = useState(null)
    const [selectedSlideFile, setSelectedSlideFile] = useState(null)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    async function loadCourses() {
        let query = supabase.from('courses').select('id, title')
        
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
        
        const { data } = await query
        setCourses(data || [])
    }

    useEffect(() => {
        if (profile?.id) loadCourses()
    }, [profile])

    useEffect(() => {
        if (location.state?.courseId) {
            setForm(prev => ({ 
                ...prev, 
                course_id: location.state.courseId,
                week_number: location.state.week || 1,
                day_of_week: location.state.day || 1
            }))
        }
    }, [location.state])

    async function uploadVideoFile(file) {
        if (!file) throw new Error('Please select a video file')
        const fileExt = file.name.split('.').pop()
        const fileName = `${crypto.randomUUID().split("-")[0]}.${fileExt}`
        const filePath = `${profile.id}/${fileName}`
        const { error } = await supabase.storage.from('videos').upload(filePath, file, { cacheControl: '3600', upsert: false })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(filePath)
        return publicUrl
    }

    async function uploadSlideFile(file) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${crypto.randomUUID().split("-")[0]}.${fileExt}`
        const filePath = `${profile.id}/slides/${fileName}`
        const { error } = await supabase.storage.from('study-materials').upload(filePath, file, { cacheControl: '3600', upsert: false })
        if (error) throw new Error(`Slide upload failed: ${error.message}`)
        const { data: { publicUrl } } = supabase.storage.from('study-materials').getPublicUrl(filePath)
        return publicUrl
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.course_id) { setError('Please select a course'); return }
        setSaving(true)
        setError('')
        try {
            let finalUrl = form.meeting_url
            if (mode === 'upload') finalUrl = await uploadVideoFile(selectedFile)

            let durationMins = Number.parseInt(form.duration_minutes) || null
            if (mode === 'live' && form.scheduled_time && form.end_time) {
                const start = new Date(form.scheduled_time)
                const end = new Date(form.end_time)
                const diff = Math.round((end - start) / 60000)
                if (diff > 0) durationMins = diff
            }

            let finalSlideUrl = form.slide_url
            if (selectedSlideFile) finalSlideUrl = await uploadSlideFile(selectedSlideFile)

            const { error: dbErr } = await supabase.from('videos').insert({
                course_id: form.course_id,
                title: form.title,
                description: form.description,
                video_url: finalUrl,
                scheduled_time: form.scheduled_time ? toISOWithOffset(form.scheduled_time) : null,
                duration_minutes: durationMins,
                week_number: Number.parseInt(form.week_number) || 1,
                day_of_week: Number.parseInt(form.day_of_week) || 1,
                slide_url: finalSlideUrl || null
            })
            if (dbErr) throw dbErr

            setSuccess(true)
            setForm({ course_id: '', title: '', description: '', meeting_url: '', scheduled_time: '', end_time: '', duration_minutes: '', week_number: 1, day_of_week: 1, slide_url: '' })
            setSelectedFile(null)
            setSelectedSlideFile(null)
            setTimeout(() => setSuccess(false), 4000)
        } catch (err) {
            setError(err.message || 'Failed to save content')
        } finally {
            setSaving(false)
        }
    }

    const meetingPlatforms = [
        { name: 'Google Meet', prefix: 'https://meet.google.com/', color: '#4285f4' },
        { name: 'Zoom', prefix: 'https://zoom.us/', color: '#2D8CFF' },
        { name: 'Teams', prefix: 'https://teams.microsoft.com/', color: '#6264A7' },
    ]

    const renderModeButton = (type, Icon, label) => {
        const isActive = mode === type
        return (
            <button
                type="button"
                onClick={() => setMode(type)}
                style={{ flex: '1 1 140px', padding: '0.6rem', border: 'none', borderRadius: 9, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', background: isActive ? 'var(--accent)' : 'transparent', color: isActive ? 'white' : 'var(--text-secondary)', boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.2)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
                <Icon size={16} /> {label}
            </button>
        )
    }

    const renderMediaFields = () => {
        if (mode === 'live') {
            return (
                <div>
                    <label htmlFor="meeting-link" className="form-label">Meeting Link</label>
                    <div style={{ position: 'relative' }}>
                        <Link size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input id="meeting-link" name="meeting_url" type="url" className="form-input" placeholder="https://meet.google.com/abc-defg-hij" value={form.meeting_url} onChange={e => setForm(p => ({ ...p, meeting_url: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required />
                    </div>
                </div>
            )
        }
        if (mode === 'upload') {
            return (
                <div>
                    <label htmlFor="file-upload" className="form-label">Video File (Supabase Storage)</label>
                    <button type="button" style={{ width: '100%', border: '2px dashed var(--card-border)', borderRadius: 12, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', display: 'block' }} onClick={() => document.getElementById('file-upload').click()}>
                        <input id="file-upload" type="file" accept="video/*" onChange={e => setSelectedFile(e.target.files[0])} style={{ display: 'none' }} />
                        <PlayCircle size={32} color="#6366f1" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFile ? selectedFile.name : 'Click to select or drag video file'}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Recommended: MP4, Max: 100MB</div>
                    </button>
                </div>
            )
        }
        return (
            <div>
                <label htmlFor="external-link" className="form-label">Google Drive or External Video Link</label>
                <div style={{ position: 'relative' }}>
                    <Link size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input id="external-link" name="meeting_url" type="url" className="form-input" placeholder="Paste Google Drive shared link here..." value={form.meeting_url} onChange={e => setForm(p => ({ ...p, meeting_url: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required />
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>💡 Tip: For Google Drive, make sure the link sharing is set to "Anyone with the link can view".</p>
            </div>
        )
    }

    const durationDiff = form.scheduled_time && form.end_time ? Math.round((new Date(form.end_time) - new Date(form.scheduled_time)) / 60000) : 0;

    const renderScheduleFields = () => {
        if (mode === 'live') {
            return (
                <>
                    <div>
                        <label htmlFor="start-time" className="form-label">Start Time</label>
                        <div style={{ position: 'relative' }}>
                            <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input id="start-time" name="scheduled_time" type="datetime-local" className="form-input" value={form.scheduled_time} onChange={e => setForm(p => ({ ...p, scheduled_time: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="end-time" className="form-label">End Time</label>
                        <div style={{ position: 'relative' }}>
                            <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input id="end-time" name="end_time" type="datetime-local" className="form-input" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required min={form.scheduled_time || undefined} />
                        </div>
                        {durationDiff > 0 && <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600, marginTop: '0.35rem' }}>⏱ {durationDiff} min duration</div>}
                    </div>
                </>
            )
        }
        return (
            <>
                <div>
                    <label htmlFor="open-time-video" className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={14} /> Open / Scheduled Time <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <div style={{ position: 'relative' }}>
                        <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input id="open-time-video" name="scheduled_time" type="datetime-local" className="form-input" value={form.scheduled_time} onChange={e => setForm(p => ({ ...p, scheduled_time: e.target.value }))} style={{ paddingLeft: '2.5rem' }} />
                    </div>
                </div>
                <div>
                    <label htmlFor="duration" className="form-label">Duration (minutes) <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                    <div style={{ position: 'relative' }}>
                        <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input id="duration" name="duration_minutes" type="number" min="1" className="form-input" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} style={{ paddingLeft: '2.5rem' }} />
                    </div>
                </div>
            </>
        )
    }

    return (
        <div className="animate-fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button 
                    onClick={() => navigate('/organizer/courses')}
                    style={{ background: '#f1f5f9', border: 'none', width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
                    className="hover-scale"
                    title="Back to Courses"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Content Creator</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Upload recorded videos or schedule live sessions
                    </p>
                </div>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', flexWrap: 'wrap', background: 'rgba(255,255,255,0.05)', padding: '0.35rem', borderRadius: 12, marginBottom: '2rem', gap: '0.35rem' }}>
                {renderModeButton('live', Radio, 'Live Class')}
                {renderModeButton('upload', Upload, 'Upload Video')}
                {renderModeButton('link', Link, 'Google Drive/Link')}
            </div>

            {success && (
                <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem 1.25rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 12, marginBottom: '1.5rem', color: '#059669', fontSize: '0.9rem', fontWeight: 500 }}>
                    <CheckCircle size={20} /> {mode === 'live' ? 'Live class scheduled' : 'Video uploaded'} successfully!
                </div>
            )}
            {error && (
                <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #ef4444', borderRadius: 12, marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.9rem', fontWeight: 500 }}>
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            {mode === 'live' && (
                <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    {meetingPlatforms.map(p => (
                        <button
                            key={p.name}
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, meeting_url: p.prefix }))}
                            style={{ padding: '0.45rem 1rem', borderRadius: 999, border: `1px solid ${p.color}25`, background: `${p.color}08`, color: p.color, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            {p.name}
                        </button>
                    ))}
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Quick fill prefix ↑</span>
                </div>
            )}

            <div className="glass-card" style={{ padding: '2rem' }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>

                    {/* Course */}
                    <div>
                        <label htmlFor="course-select" className="form-label">Course</label>
                        <div style={{ position: 'relative' }}>
                            <FolderOpen size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                            <select id="course-select" name="course_id" className="form-input" value={form.course_id} onChange={e => setForm(p => ({ ...p, course_id: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required>
                                <option value="">Select a course...</option>
                                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label htmlFor="session-title" className="form-label">{mode === 'live' ? 'Session Title' : 'Video Title'}</label>
                        <div style={{ position: 'relative' }}>
                            <Video size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input id="session-title" name="title" type="text" className="form-input" placeholder={mode === 'live' ? 'e.g. Week 3 — React State Management' : 'e.g. Introduction to Next.js'} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required />
                        </div>
                    </div>

                    {/* Meeting URL or File Upload */}
                    {renderMediaFields()}

                    {/* Description */}
                    <div>
                        <label htmlFor="description" className="form-label">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                        <textarea id="description" name="description" className="form-input" rows={3} placeholder="Topics covered in this content..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical', minHeight: 80 }} />
                    </div>

                    {/* Slide URL */}
                    <div>
                        <label htmlFor="slide-url" className="form-label">Slide URL (PPT/PDF) <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Link size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    id="slide-url"
                                    name="slide_url"
                                    type="url"
                                    className="form-input"
                                    placeholder="Paste URL or upload a file..."
                                    value={form.slide_url}
                                    onChange={e => setForm(p => ({ ...p, slide_url: e.target.value }))}
                                    style={{ paddingLeft: '2.5rem' }}
                                    disabled={!!selectedSlideFile}
                                />
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>OR</span>
                            <button
                                type="button"
                                onClick={() => document.getElementById('slide-upload').click()}
                                style={{ padding: '0 1rem', height: 42, background: selectedSlideFile ? '#ecfdf5' : 'white', border: `1px solid ${selectedSlideFile ? '#10b981' : 'var(--card-border)'}`, borderRadius: 12, color: selectedSlideFile ? '#059669' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0, transition: 'all 0.2s' }}
                            >
                                <Upload size={16} /> {selectedSlideFile ? 'File Selected' : 'Upload PPT/PDF'}
                            </button>
                            <input
                                id="slide-upload"
                                type="file"
                                accept=".ppt,.pptx,.pdf"
                                onChange={e => {
                                    if(e.target.files[0]) {
                                        setSelectedSlideFile(e.target.files[0]);
                                        setForm(p => ({ ...p, slide_url: '' })); // clear URL if file selected
                                    }
                                }}
                                style={{ display: 'none' }}
                            />
                            {selectedSlideFile && (
                                <button type="button" onClick={() => setSelectedSlideFile(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex' }}>
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            💡 {selectedSlideFile ? `Selected file: ${selectedSlideFile.name}` : 'If provided, slides will be displayed alongside the video.'}
                        </p>
                    </div>

                    {/* Schedule fields */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label htmlFor="week-number" className="form-label">Week</label>
                            <input id="week-number" name="week_number" type="number" className="form-input" min="1" value={form.week_number} onChange={e => setForm(p => ({ ...p, week_number: e.target.value }))} required />
                        </div>
                        <div>
                            <label htmlFor="day-of-week" className="form-label">Day of Week</label>
                            <select id="day-of-week" name="day_of_week" className="form-input" value={form.day_of_week} onChange={e => setForm(p => ({ ...p, day_of_week: e.target.value }))} required>
                                <option value="1">Monday</option>
                                <option value="2">Tuesday</option>
                                <option value="3">Wednesday</option>
                                <option value="4">Thursday</option>
                                <option value="5">Friday</option>
                                <option value="6">Saturday</option>
                                <option value="7">Sunday</option>
                            </select>
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        {renderScheduleFields()}
                    </div>

                    <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-end', minWidth: 180, justifyContent: 'center' }}>
                        {saving
                            ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} /> Processing...</>
                            : <>{mode === 'live' ? <Plus size={16} /> : <Upload size={16} />} {mode === 'live' ? 'Schedule Live Class' : 'Upload Video'}</>
                        }
                    </button>
                </form>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
