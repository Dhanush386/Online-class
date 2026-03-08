import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Video, Link, Calendar, Clock, FolderOpen, CheckCircle, AlertCircle, Plus, Upload, PlayCircle, Radio } from 'lucide-react'

export default function ScheduleLiveClass() {
    const { profile } = useAuth()
    const [courses, setCourses] = useState([])
    const [mode, setMode] = useState('live') // 'live' or 'upload'
    const [form, setForm] = useState({
        course_id: '', title: '', description: '',
        meeting_url: '', scheduled_time: '', end_time: '', duration_minutes: '',
    })
    const [selectedFile, setSelectedFile] = useState(null)
    const [saving, setSaving] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (profile?.id) {
            supabase.from('courses').select('id, title')
                .eq('organizer_id', profile.id)
                .then(({ data }) => setCourses(data || []))
        }
    }, [profile])

    async function handleSubmit(e) {
        e.preventDefault()
        if (!form.course_id) { setError('Please select a course'); return }

        setSaving(true)
        setError('')

        try {
            let finalUrl = form.meeting_url

            // If uploading a file
            if (mode === 'upload') {
                if (!selectedFile) throw new Error('Please select a video file')

                const fileExt = selectedFile.name.split('.').pop()
                const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
                const filePath = `${profile.id}/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('videos')
                    .upload(filePath, selectedFile, {
                        cacheControl: '3600',
                        upsert: false
                    })

                if (uploadError) throw uploadError

                // Get Public URL
                const { data: { publicUrl } } = supabase.storage
                    .from('videos')
                    .getPublicUrl(filePath)

                finalUrl = publicUrl
            }

            // Compute duration_minutes from start and end time for live classes
            let durationMins = parseInt(form.duration_minutes) || null
            if (mode === 'live' && form.scheduled_time && form.end_time) {
                const start = new Date(form.scheduled_time)
                const end = new Date(form.end_time)
                const diff = Math.round((end - start) / 60000)
                if (diff > 0) durationMins = diff
            }

            const { error: dbErr } = await supabase.from('videos').insert({
                course_id: form.course_id,
                title: form.title,
                description: form.description,
                video_url: finalUrl,
                scheduled_time: mode === 'live' && form.scheduled_time
                    ? new Date(form.scheduled_time).toISOString()
                    : null,
                duration_minutes: durationMins,
            })

            if (dbErr) throw dbErr

            setSuccess(true)
            setForm({ course_id: '', title: '', description: '', meeting_url: '', scheduled_time: '', end_time: '', duration_minutes: '' })
            setSelectedFile(null)
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

    return (
        <div className="animate-fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Content Creator</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Upload recorded videos or schedule live sessions
                </p>
            </div>

            {/* Mode Toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '0.35rem', borderRadius: 12, marginBottom: '2rem', gap: '0.35rem' }}>
                <button
                    type="button"
                    onClick={() => setMode('live')}
                    style={{ flex: 1, padding: '0.6rem', border: 'none', borderRadius: 9, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', background: mode === 'live' ? 'white' : 'transparent', color: mode === 'live' ? '#6366f1' : '#64748b', boxShadow: mode === 'live' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                    <Radio size={16} /> Live Class
                </button>
                <button
                    type="button"
                    onClick={() => setMode('upload')}
                    style={{ flex: 1, padding: '0.6rem', border: 'none', borderRadius: 9, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', background: mode === 'upload' ? 'white' : 'transparent', color: mode === 'upload' ? '#6366f1' : '#64748b', boxShadow: mode === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                    <Upload size={16} /> Upload Video
                </button>
            </div>

            {success && (
                <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: '#ecfdf5', border: '1px solid #10b981', borderRadius: 12, marginBottom: '1.5rem', color: '#059669', fontSize: '0.9rem', fontWeight: 500 }}>
                    <CheckCircle size={20} /> {mode === 'live' ? 'Live class scheduled' : 'Video uploaded'} successfully!
                </div>
            )}
            {error && (
                <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.25rem', background: '#fef2f2', border: '1px solid #ef4444', borderRadius: 12, marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.9rem', fontWeight: 500 }}>
                    <AlertCircle size={20} /> {error}
                </div>
            )}

            {mode === 'live' && (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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
                        <label className="form-label">Course</label>
                        <div style={{ position: 'relative' }}>
                            <FolderOpen size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                            <select className="form-input" value={form.course_id} onChange={e => setForm(p => ({ ...p, course_id: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required>
                                <option value="">Select a course...</option>
                                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="form-label">{mode === 'live' ? 'Session Title' : 'Video Title'}</label>
                        <div style={{ position: 'relative' }}>
                            <Video size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" className="form-input" placeholder={mode === 'live' ? 'e.g. Week 3 — React State Management' : 'e.g. Introduction to Next.js'} value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required />
                        </div>
                    </div>

                    {/* Meeting URL or File Upload */}
                    {mode === 'live' ? (
                        <div>
                            <label className="form-label">Meeting Link</label>
                            <div style={{ position: 'relative' }}>
                                <Link size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="https://meet.google.com/abc-defg-hij"
                                    value={form.meeting_url}
                                    onChange={e => setForm(p => ({ ...p, meeting_url: e.target.value }))}
                                    style={{ paddingLeft: '2.5rem' }}
                                    required
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="form-label">Video File</label>
                            <div style={{
                                border: '2px dashed var(--card-border)',
                                borderRadius: 12,
                                padding: '2rem',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: '#f8fafc'
                            }} onClick={() => document.getElementById('file-upload').click()}>
                                <input
                                    id="file-upload"
                                    type="file"
                                    accept="video/*"
                                    onChange={e => setSelectedFile(e.target.files[0])}
                                    style={{ display: 'none' }}
                                />
                                <PlayCircle size={32} color="#6366f1" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
                                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {selectedFile ? selectedFile.name : 'Click to select or drag video file'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                    Recommended: MP4, Max: 100MB
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <label className="form-label">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                        <textarea className="form-input" rows={3} placeholder="Topics covered in this content..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical', minHeight: 80 }} />
                    </div>

                    {/* Schedule fields */}
                    {mode === 'live' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label className="form-label">Start Time</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input type="datetime-local" className="form-input" value={form.scheduled_time} onChange={e => setForm(p => ({ ...p, scheduled_time: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">End Time</label>
                                <div style={{ position: 'relative' }}>
                                    <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input type="datetime-local" className="form-input" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} style={{ paddingLeft: '2.5rem' }} required
                                        min={form.scheduled_time || undefined}
                                    />
                                </div>
                                {form.scheduled_time && form.end_time && (() => {
                                    const mins = Math.round((new Date(form.end_time) - new Date(form.scheduled_time)) / 60000)
                                    return mins > 0 ? <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600, marginTop: '0.35rem' }}>⏱ {mins} min duration</div> : null
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label className="form-label">Publish Date</label>
                                <div style={{ position: 'relative' }}>
                                    <Calendar size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input type="datetime-local" className="form-input" value={form.scheduled_time} onChange={e => setForm(p => ({ ...p, scheduled_time: e.target.value }))} style={{ paddingLeft: '2.5rem' }} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Duration (minutes)</label>
                                <div style={{ position: 'relative' }}>
                                    <Clock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                    <input type="number" className="form-input" placeholder="60" min="1" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} style={{ paddingLeft: '2.5rem' }} />
                                </div>
                            </div>
                        </div>
                    )}

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
