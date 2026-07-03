import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Calendar, Edit2, Trash2, X, Save, Video, Users } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toLocalInput, toISOWithOffset } from '../../lib/dateUtils'


function formatTime(t) {
    if (!t) return 'Not scheduled'
    try { return format(parseISO(t), 'MMM d, yyyy • h:mm a') } catch { return t }
}

function isLive(t, duration) {
    if (!t) return false
    const now = new Date()
    const s = parseISO(t)
    const durationMs = (duration || 60) * 60000
    return now >= s && (now - s) < durationMs
}

function getStatusBadge(v) {
    if (isLive(v.scheduled_time, v.duration_minutes)) {
        return <span className="badge badge-danger" style={{ animation: 'pulse 2s infinite' }}>🔴 LIVE</span>;
    }
    if (v.scheduled_time && new Date(v.scheduled_time) > new Date()) {
        return <span className="badge badge-warning">Upcoming</span>;
    }
    return <span className="badge badge-success">Completed</span>;
}

function getAttendanceBgColor(status) {
    if (status === 'present') return '#ecfdf5';
    if (status === 'absent') return '#fef2f2';
    return '#f8fafc';
}

function getAttendanceTextColor(status) {
    if (status === 'present') return '#059669';
    if (status === 'absent') return '#dc2626';
    return 'var(--text-muted)';
}

export default function ScheduleManager() {
    const [videos, setVideos] = useState([])
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)
    const [editVideo, setEditVideo] = useState(null)
    const [saving, setSaving] = useState(false)
    const [viewAttendanceFor, setViewAttendanceFor] = useState(null)
    const [attendanceData, setAttendanceData] = useState([])
    const [totalEnrolled, setTotalEnrolled] = useState(0)
    const [loadingAttendance, setLoadingAttendance] = useState(false)
    const navigate = useNavigate()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        const [{ data: vids }, { data: crs }] = await Promise.all([
            supabase.from('videos').select('*, courses(title)').order('scheduled_time', { ascending: true }),
            supabase.from('courses').select('id, title'),
        ])
        setVideos(vids || [])
        setCourses(crs || [])
        setLoading(false)
    }

    async function handleDelete(id) {
        if (!confirm('Delete this video from the schedule?')) return
        await supabase.from('videos').delete().eq('id', id)
        setVideos(prev => prev.filter(v => v.id !== id))
    }

    async function handleSave() {
        setSaving(true)
        const { error } = await supabase.from('videos').update({
            title: editVideo.title,
            description: editVideo.description,
            scheduled_time: toISOWithOffset(editVideo.scheduled_time),
            duration_minutes: Number.parseInt(editVideo.duration_minutes) || null,
            week_number: Number.parseInt(editVideo.week_number) || 1,
            day_of_week: Number.parseInt(editVideo.day_of_week) || 1,
            course_id: editVideo.course_id,
            video_url: editVideo.video_url,
            duration_seconds: editVideo.recording_duration_mins ? Number.parseFloat(editVideo.recording_duration_mins) * 60 : null,
        }).eq('id', editVideo.id)
        if (!error) {
            await loadData()
            setEditVideo(null)
        }
        setSaving(false)
    }

    async function handleViewAttendance(video) {
        setViewAttendanceFor(video)
        setLoadingAttendance(true)
        const [{ data: attData }, { data: enrolledStudents }] = await Promise.all([
            supabase.from('live_attendance')
                .select('id, student_id, joined_at, left_at, duration_seconds, attendance_status, users(name, email)')
                .eq('video_id', video.id)
                .order('joined_at', { ascending: true }),
            supabase.from('enrollments')
                .select('student_id, users(name, email)')
                .eq('course_id', video.course_id)
        ]);
        
        const unifiedData = enrolledStudents?.map(enrollment => {
            const attRecord = attData?.find(a => a.student_id === enrollment.student_id);
            if (attRecord) return attRecord;
            return {
                id: null,
                student_id: enrollment.student_id,
                users: enrollment.users,
                joined_at: null,
                left_at: null,
                duration_seconds: 0,
                attendance_status: 'absent'
            };
        }) || [];

        // Append any attendees who aren't explicitly enrolled
        attData?.forEach(record => {
            if (!unifiedData.some(u => u.student_id === record.student_id)) {
                unifiedData.push(record);
            }
        });
        
        setAttendanceData(unifiedData)
        setTotalEnrolled(enrolledStudents?.length || 0)
        setLoadingAttendance(false)
    }

    async function handleUpdateStatus(record, newStatus) {
        setAttendanceData(prev => prev.map(d => d.student_id === record.student_id ? { ...d, attendance_status: newStatus } : d))
        
        const payload = {
            student_id: record.student_id,
            video_id: viewAttendanceFor.id,
            course_id: viewAttendanceFor.course_id,
            attendance_status: newStatus
        };
        if (record.id) payload.id = record.id;

        const { data, error } = await supabase.from('live_attendance').upsert(payload, { onConflict: 'student_id,video_id' }).select('id, joined_at').single()
        
        if (error) {
            console.error("Error updating status:", error)
        } else if (!record.id && data) {
            setAttendanceData(prev => prev.map(d => d.student_id === record.student_id ? { ...d, id: data.id, joined_at: data.joined_at } : d))
        }
    }

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Schedule Manager</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage your scheduled class videos</p>
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
                {loading && (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading schedule...</div>
                )}
                {!loading && videos.length === 0 && (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>No videos scheduled yet</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Go to Upload Video to add your first class</p>
                    </div>
                )}
                {!loading && videos.length > 0 && (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Video Title</th>
                                <th>Course</th>
                                <th>Scheduled Time</th>
                                <th>Day</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {videos.map(v => (
                                <tr key={v.id}>
                                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v.title}</td>
                                    <td>
                                        <span className="badge badge-info">{v.courses?.title || '—'}</span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Calendar size={13} />
                                            {formatTime(v.scheduled_time)}
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                                            W{v.week_number || 1} D{v.day_of_week || 1}
                                        </div>
                                    </td>
                                    <td>
                                        {getStatusBadge(v)}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button 
                                                onClick={() => navigate(`/organizer/classroom/${v.id}`)} 
                                                className={`btn-primary ${isLive(v.scheduled_time, v.duration_minutes) ? 'btn-live-pulse' : ''}`}
                                                style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem', background: isLive(v.scheduled_time, v.duration_minutes) ? '#ef4444' : '#6366f1' }}
                                            >
                                                <Video size={13} /> Launch Classroom
                                            </button>
                                            <button onClick={() => handleViewAttendance(v)} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}>
                                                <Users size={13} /> Attendance
                                            </button>
                                            <button onClick={() => setEditVideo({ 
                                                ...v, 
                                                recording_duration_mins: v.duration_seconds ? v.duration_seconds / 60 : '' 
                                            })} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}>
                                                <Edit2 size={13} /> Edit
                                            </button>
                                            <button onClick={() => handleDelete(v.id)} className="btn-danger">
                                                <Trash2 size={13} /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Edit Modal */}
            {editVideo && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
                    <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: 520, padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Edit Scheduled Video</h2>
                            <button onClick={() => setEditVideo(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label htmlFor="edit-title" className="form-label">Title</label>
                                <input id="edit-title" name="title" type="text" className="form-input" value={editVideo.title} onChange={e => setEditVideo(p => ({ ...p, title: e.target.value }))} />
                            </div>
                            <div>
                                <label htmlFor="edit-course" className="form-label">Course</label>
                                <select id="edit-course" name="course_id" className="form-input" value={editVideo.course_id} onChange={e => setEditVideo(p => ({ ...p, course_id: e.target.value }))}>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="edit-desc" className="form-label">Description</label>
                                <textarea id="edit-desc" name="description" className="form-input" rows={3} value={editVideo.description || ''} onChange={e => setEditVideo(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label htmlFor="edit-time" className="form-label">Scheduled Time</label>
                                    <input id="edit-time" name="scheduled_time" type="datetime-local" className="form-input" value={toLocalInput(editVideo.scheduled_time)} onChange={e => setEditVideo(p => ({ ...p, scheduled_time: e.target.value }))} />
                                </div>
                                <div>
                                    <label htmlFor="edit-duration" className="form-label">Live Class Duration (min)</label>
                                    <input id="edit-duration" name="duration_minutes" type="number" className="form-input" value={editVideo.duration_minutes || ''} onChange={e => setEditVideo(p => ({ ...p, duration_minutes: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="edit-recording-duration" className="form-label">Recording Duration (min)</label>
                                <input id="edit-recording-duration" name="recording_duration_mins" type="number" step="0.1" className="form-input" placeholder="e.g. 45" value={editVideo.recording_duration_mins || ''} onChange={e => setEditVideo(p => ({ ...p, recording_duration_mins: e.target.value }))} />
                            </div>
                            <div>
                                <label htmlFor="edit-url" className="form-label">Meeting URL (Google Meet / Zoom)</label>
                                <input id="edit-url" name="video_url" type="url" className="form-input" placeholder="https://meet.google.com/..." value={editVideo.video_url || ''} onChange={e => setEditVideo(p => ({ ...p, video_url: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label htmlFor="edit-week" className="form-label">Week Number</label>
                                    <input id="edit-week" name="week_number" type="number" className="form-input" min="1" value={editVideo.week_number || 1} onChange={e => setEditVideo(p => ({ ...p, week_number: e.target.value }))} required />
                                </div>
                                <div>
                                    <label htmlFor="edit-day-of-week" className="form-label">Day of Week</label>
                                    <select id="edit-day-of-week" name="day_of_week" className="form-input" value={editVideo.day_of_week || 1} onChange={e => setEditVideo(p => ({ ...p, day_of_week: e.target.value }))} required>
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
                            <div style={{ display: 'flex', gap: '0.85rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button onClick={() => setEditVideo(null)} className="btn-secondary">Cancel</button>
                                <button onClick={handleSave} className="btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance Modal */}
            {viewAttendanceFor && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
                    <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: 700, padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>Live Class Analytics</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{viewAttendanceFor.title}</p>
                            </div>
                            <button onClick={() => setViewAttendanceFor(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                            {loadingAttendance ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytics...</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    {/* Analytics Row */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                                        <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalEnrolled}</div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Students</div>
                                        </div>
                                        <div style={{ background: '#ecfdf5', padding: '1.25rem', borderRadius: 12, border: '1px solid #a7f3d0', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
                                                {attendanceData.filter(d => d.attendance_status === 'present').length}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase' }}>Present</div>
                                        </div>
                                        <div style={{ background: '#fef2f2', padding: '1.25rem', borderRadius: 12, border: '1px solid #fecaca', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>
                                                {Math.max(0, totalEnrolled - attendanceData.filter(d => d.attendance_status === 'present').length)}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>Absent</div>
                                        </div>
                                        <div style={{ background: '#eff6ff', padding: '1.25rem', borderRadius: 12, border: '1px solid #bfdbfe', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>
                                                {totalEnrolled > 0 ? Math.round((attendanceData.filter(d => d.attendance_status === 'present').length / totalEnrolled) * 100) : 0}%
                                            </div>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase' }}>Attendance Rate</div>
                                        </div>
                                    </div>

                                    {/* Detailed List */}
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Participant Details</h3>
                                        {attendanceData.length === 0 ? (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
                                                <Users size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.3, display: 'block' }} />
                                                No students have joined this class yet.
                                            </div>
                                        ) : (
                                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                                        <tr>
                                                            <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Student</th>
                                                            <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Joined</th>
                                                            <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Left</th>
                                                            <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Duration</th>
                                                            <th style={{ padding: '0.85rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {attendanceData.map((record, idx) => (
                                                            <tr key={record.student_id} style={{ borderBottom: idx === attendanceData.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{record.users?.name || 'Unknown'}</div>
                                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{record.users?.email}</div>
                                                                </td>
                                                                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                                                                    {formatTime(record.joined_at).split('•')[1] || '—'}
                                                                </td>
                                                                <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                                                                    {record.left_at ? formatTime(record.left_at).split('•')[1] : '—'}
                                                                </td>
                                                                <td style={{ padding: '0.85rem 1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                                                    {record.duration_seconds > 0 ? `${Math.floor(record.duration_seconds / 60)} min` : '< 1 min'}
                                                                </td>
                                                                <td style={{ padding: '0.85rem 1rem' }}>
                                                                    <select 
                                                                        value={record.attendance_status}
                                                                        onChange={(e) => handleUpdateStatus(record, e.target.value)}
                                                                        style={{ 
                                                                            padding: '0.2rem 0.5rem', 
                                                                            borderRadius: 6, 
                                                                            fontSize: '0.85rem', 
                                                                            fontWeight: 600, 
                                                                            border: '1px solid #e2e8f0', 
                                                                            background: getAttendanceBgColor(record.attendance_status), 
                                                                            color: getAttendanceTextColor(record.attendance_status),
                                                                            cursor: 'pointer',
                                                                            outline: 'none'
                                                                        }}
                                                                    >
                                                                        <option value="present">✅ Present</option>
                                                                        <option value="absent">❌ Absent</option>
                                                                        <option value="insufficient_time">⚠️ Insufficient</option>
                                                                    </select>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
                .btn-live-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                    transition: all 0.3s ease;
                }
                .btn-live-pulse:hover {
                    box-shadow: 0 0 15px rgba(239, 68, 68, 0.5);
                }
            `}</style>
        </div>
    )
}
