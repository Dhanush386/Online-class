import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Video, Search, Calendar, Clock, Database, PlayCircle, Copy, CheckCircle, AlertCircle, RefreshCw, FolderOpen, Loader, Trash2, RefreshCcw } from 'lucide-react'
import { useMeeting } from '../../contexts/MeetingContext'

export default function OrganizerRecordings() {
    const { profile } = useAuth()
    const { retryUpload, deleteFailedUpload, failedUploads, deleteRecordingFromDrive, loginToDrive, gToken } = useMeeting()
    const [recordings, setRecordings] = useState([])
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)

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
                    .or('recording_status.not.is.null,drive_file_id.not.is.null')
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
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
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
                <div style={{ position: 'relative', flex: '1 1 300px' }}>
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
                <div style={{ position: 'relative', flex: '0 0 250px' }}>
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

            {/* Table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Recording</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Course</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Date</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Duration</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: '1rem', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <Loader className="animate-spin" size={24} style={{ margin: '0 auto 1rem' }} />
                                        Loading recordings...
                                    </td>
                                </tr>
                            ) : filteredRecordings.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <Video size={32} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                                        No recordings found matching your filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecordings.map(rec => (
                                    <tr key={rec.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rec.title}</div>
                                            {rec.file_size_mb && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><Database size={12}/> {rec.file_size_mb} MB</div>}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{rec.courses?.title || 'Unknown'}</td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Calendar size={14} />
                                                {rec.recorded_at ? new Date(rec.recorded_at).toLocaleDateString() : new Date(rec.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <Clock size={14} />
                                                {formatDuration(rec.duration_seconds)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {rec.recording_status === 'uploading' ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.6rem', background: '#e0e7ff', color: '#4f46e5', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }}>
                                                    <Loader className="animate-spin" size={12} /> Uploading
                                                </span>
                                            ) : rec.recording_status === 'completed' || rec.drive_file_id ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.6rem', background: '#dcfce7', color: '#16a34a', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }}>
                                                    <CheckCircle size={12} /> Completed
                                                </span>
                                            ) : rec.recording_status === 'failed' ? (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.6rem', background: '#fee2e2', color: '#dc2626', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }}>
                                                    <AlertCircle size={12} /> Failed
                                                </span>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0.25rem 0.6rem', background: '#fef3c7', color: '#d97706', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }}>
                                                    <Video size={12} /> Recording
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
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
                                                {rec.video_url && (
                                                    <>
                                                        <button 
                                                            onClick={() => copyToClipboard(rec.video_url)}
                                                            style={{ padding: '0.4rem', borderRadius: 6, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                                                            title="Copy Drive Link"
                                                            className="hover-scale"
                                                        >
                                                            <Copy size={16} />
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
                                                                if (window.confirm('Are you sure you want to completely delete this recording from Google Drive?')) {
                                                                    const ok = await deleteRecordingFromDrive(rec.id, rec.drive_file_id)
                                                                    if (ok) loadData()
                                                                }
                                                            }}
                                                            style={{ padding: '0.4rem', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', transition: 'all 0.2s' }}
                                                            title="Delete Recording"
                                                            className="hover-scale"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
