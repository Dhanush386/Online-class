import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Video, Search, Calendar, Clock, Database, PlayCircle, Copy, CheckCircle, AlertCircle, RefreshCw, FolderOpen, Loader, Trash2, RefreshCcw, FileText, Upload, Link, X } from 'lucide-react'
import { useMeeting } from '../../contexts/MeetingContext'

function getRecordingStatusBadge(rec) {
    if (rec.recording_status === 'uploading') {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.6rem', background: '#e0e7ff', color: '#4f46e5', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600 }}>
                <Loader className="animate-spin" size={12} /> Uploading
            </span>
        )
    }
    if (rec.recording_status === 'completed' || rec.drive_file_id) {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.6rem', background: '#dcfce7', color: '#16a34a', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600 }}>
                <CheckCircle size={12} /> Completed
            </span>
        )
    }
    if (rec.recording_status === 'failed') {
        return (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.6rem', background: '#fee2e2', color: '#dc2626', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600 }}>
                <AlertCircle size={12} /> Failed
            </span>
        )
    }
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.6rem', background: '#fef3c7', color: '#d97706', borderRadius: 999, fontSize: '0.85rem', fontWeight: 600 }}>
            <Video size={12} /> Recording
        </span>
    )
}

export default function OrganizerRecordings() {
    const { profile } = useAuth()
    const { retryUpload, deleteFailedUpload, failedUploads, deleteRecordingFromDrive, loginToDrive, gToken } = useMeeting()
    const [recordings, setRecordings] = useState([])
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingSlide, setEditingSlide] = useState(null)
    const [slideUrl, setSlideUrl] = useState('')
    const [slideFile, setSlideFile] = useState(null)
    const [savingSlide, setSavingSlide] = useState(false)

    // Filters
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCourse, setSelectedCourse] = useState('')

    useEffect(() => {
        if (profile?.id) {
            loadData()
        }
    }, [profile])

    async function loadData() {
        setLoading(true)
        try {
            // Get courses for filter
            let coursesQuery = supabase.from('courses').select('id, title')
            if (profile.role === 'sub_admin') {
                const { data: assignments } = await supabase.from('admin_course_assignments').select('course_id').eq('admin_id', profile.id)
                coursesQuery = coursesQuery.in('id', (assignments || []).map(a => a.course_id))
            } else if (profile.role === 'organizer') {
                coursesQuery = coursesQuery.eq('organizer_id', profile.id)
            }
            const { data: coursesData } = await coursesQuery
            setCourses(coursesData || [])

            const courseIds = (coursesData || []).map(c => c.id)

            // Get recordings
            if (courseIds.length > 0) {
                const { data: vids } = await supabase
                    .from('videos')
                    .select('*, courses(title)')
                    .in('course_id', courseIds)
                    .or('recording_status.not.is.null,drive_file_id.not.is.null,video_url.not.is.null')
                    .order('created_at', { ascending: false })
                
                setRecordings(vids || [])
            }
        } catch (err) {
            console.error('Failed to load recordings', err)
        } finally {
            setLoading(false)
        }
    }

    const formatDuration = (seconds) => {
        if (!seconds) return '--:--'
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const copyToClipboard = async (text) => {
        if (!text) return
        try {
            await navigator.clipboard.writeText(text)
            // Ideally a toast would show here
        } catch (err) {
            console.error('Failed to copy', err)
        }
    }

    const filteredRecordings = recordings.filter(r => {
        const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.courses?.title?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchCourse = selectedCourse ? r.course_id === selectedCourse : true
        return matchSearch && matchCourse
    })

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Recording History</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Manage your live class recordings and Google Drive uploads.
                    </p>
                </div>
                <button onClick={loadData} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Storage Analytics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Video size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Recordings</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{recordings.length}</div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Total Hours</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {Math.round(recordings.reduce((acc, r) => acc + (r.duration_seconds || 0), 0) / 3600)}h
                        </div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Database size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Storage Used</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {(recordings.reduce((acc, r) => acc + Number(r.file_size_mb || 0), 0) / 1024).toFixed(2)} GB
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        type="text" 
                        placeholder="Search recording or course title..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input" 
                        style={{ paddingLeft: '2.5rem' }} 
                    />
                </div>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <FolderOpen size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                    <select 
                        className="form-input" 
                        value={selectedCourse} 
                        onChange={e => setSelectedCourse(e.target.value)}
                        style={{ paddingLeft: '2.5rem' }}
                    >
                        <option value="">All Courses</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </div>
            </div>

            {/* Recordings List */}
            {loading && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader className="animate-spin" size={24} style={{ margin: '0 auto 1rem' }} />
                    Loading recordings...
                </div>
            )}
            {!loading && filteredRecordings.length === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.02)', borderRadius: '12px' }}>
                    <Video size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    No recordings found matching your filters.
                </div>
            )}
            {!loading && filteredRecordings.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredRecordings.map(rec => (
                        <div key={rec.id} className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', padding: '1.25rem', borderRadius: '12px' }}>
                            <div style={{ flex: '1 1 250px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Recording</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.title}</div>
                                {rec.file_size_mb && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><Database size={12}/> {rec.file_size_mb} MB</div>}
                            </div>
                            <div style={{ flex: '1 1 150px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Course</div>
                                <div style={{ color: 'var(--text-secondary)' }}>{rec.courses?.title || 'Unknown'}</div>
                            </div>
                            <div style={{ flex: '1 1 150px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Date</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                                    <Calendar size={14} />
                                    {rec.recorded_at ? new Date(rec.recorded_at).toLocaleDateString() : new Date(rec.created_at).toLocaleDateString()}
                                </div>
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Duration</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                                    <Clock size={14} />
                                    {formatDuration(rec.duration_seconds)}
                                </div>
                            </div>
                            <div style={{ flex: '1 1 100px' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Status</div>
                                {getRecordingStatusBadge(rec)}
                            </div>
                            <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--card-border)' }}>
                                {rec.recording_status === 'failed' && failedUploads[rec.id] && (
                                    <>
                                        <button 
                                            onClick={async () => {
                                                const ok = await retryUpload(rec.id)
                                                if (ok) loadData()
                                            }}
                                            style={{ padding: '0.4rem 0.8rem', borderRadius: 6, border: 'none', background: '#3b82f6', color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                            className="hover-scale"
                                        >
                                            <RefreshCcw size={16} /> Retry
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                await deleteFailedUpload(rec.id)
                                                loadData()
                                            }}
                                            style={{ padding: '0.4rem', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}
                                            className="hover-scale"
                                            title="Discard failed upload"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </>
                                )}
                                <button 
                                    onClick={() => {
                                        setEditingSlide(rec)
                                        setSlideUrl(rec.slide_url || '')
                                        setSlideFile(null)
                                    }}
                                    style={{ padding: '0.4rem', borderRadius: 6, border: 'none', background: rec.slide_url ? '#dcfce7' : '#f3e8ff', color: rec.slide_url ? '#16a34a' : '#9333ea', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
                                    title={rec.slide_url ? "Edit PPT" : "Attach PPT"}
                                    className="hover-scale"
                                >
                                    <FileText size={16} /> Attach PPT
                                </button>
                                {rec.video_url && (
                                    <>
                                        <button 
                                            onClick={() => copyToClipboard(rec.video_url)}
                                            style={{ padding: '0.4rem', borderRadius: 6, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
                                            title="Copy Drive Link"
                                            className="hover-scale"
                                        >
                                            <Copy size={16} /> Link
                                        </button>
                                        <a 
                                            href={rec.video_url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            style={{ padding: '0.4rem 0.8rem', borderRadius: 6, border: 'none', background: '#10b981', color: 'white', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                            className="hover-scale"
                                        >
                                            <PlayCircle size={16} /> Watch
                                        </a>
                                        <button 
                                            onClick={async () => {
                                                if (!gToken) {
                                                    loginToDrive()
                                                    return
                                                }
                                                if (globalThis.confirm('Are you sure you want to completely delete this recording from Google Drive?')) {
                                                    const ok = await deleteRecordingFromDrive(rec.id, rec.drive_file_id)
                                                    if (ok) loadData()
                                                }
                                            }}
                                            style={{ padding: '0.4rem', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}
                                            title="Delete Recording"
                                            className="hover-scale"
                                        >
                                            <Trash2 size={16} /> Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Attach PPT Modal */}
            {editingSlide && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="glass-card animate-scale-in" style={{ padding: '2rem', width: '100%', maxWidth: 500, background: 'white' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1rem' }}>Attach Slides</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Add presentation slides for <strong>{editingSlide.title}</strong>. Students will see these alongside the video.
                        </p>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Link size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="url"
                                    className="form-input"
                                    placeholder="Paste URL or upload a file..."
                                    value={slideUrl}
                                    onChange={e => setSlideUrl(e.target.value)}
                                    style={{ paddingLeft: '2.5rem' }}
                                    disabled={!!slideFile}
                                />
                            </div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>OR</span>
                            <button
                                type="button"
                                onClick={() => document.getElementById('slide-upload-modal').click()}
                                style={{ padding: '0 1rem', height: 42, background: slideFile ? '#ecfdf5' : 'white', border: `1px solid ${slideFile ? '#10b981' : 'var(--card-border)'}`, borderRadius: 12, color: slideFile ? '#059669' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0 }}
                            >
                                <Upload size={16} /> {slideFile ? 'File Selected' : 'Upload PPT'}
                            </button>
                            <input
                                id="slide-upload-modal"
                                type="file"
                                accept=".ppt,.pptx,.pdf"
                                onChange={e => {
                                    if(e.target.files[0]) {
                                        setSlideFile(e.target.files[0])
                                        setSlideUrl('')
                                    }
                                }}
                                style={{ display: 'none' }}
                            />
                            {slideFile && (
                                <button type="button" onClick={() => setSlideFile(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4, display: 'flex' }}>
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button className="btn-secondary" onClick={() => setEditingSlide(null)}>Cancel</button>
                            <button 
                                className="btn-primary" 
                                disabled={savingSlide}
                                onClick={async () => {
                                    setSavingSlide(true)
                                    try {
                                        let finalUrl = slideUrl
                                        if (slideFile) {
                                            const fileExt = slideFile.name.split('.').pop()
                                            const fileName = `${crypto.randomUUID().split("-")[0]}.${fileExt}`
                                            const filePath = `${profile.id}/slides/${fileName}`
                            
                                            const { error: uploadError } = await supabase.storage
                                                .from('study-materials')
                                                .upload(filePath, slideFile, { cacheControl: '3600', upsert: false })
                            
                                            if (uploadError) throw uploadError
                            
                                            const { data: { publicUrl } } = supabase.storage.from('study-materials').getPublicUrl(filePath)
                                            finalUrl = publicUrl
                                        }

                                        const { error } = await supabase.from('videos').update({ slide_url: finalUrl || null }).eq('id', editingSlide.id)
                                        if (error) throw error
                                        
                                        setEditingSlide(null)
                                        loadData()
                                    } catch (err) {
                                        alert('Failed to save slides: ' + err.message)
                                    } finally {
                                        setSavingSlide(false)
                                    }
                                }}
                            >
                                {savingSlide ? <Loader className="animate-spin" size={16} /> : <CheckCircle size={16} />} Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
