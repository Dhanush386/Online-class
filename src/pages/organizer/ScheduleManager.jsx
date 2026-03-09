import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Calendar, Edit2, Trash2, Clock, X, Save, Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'

// Convert a UTC ISO string from the database into the value format required by <input type="datetime-local">
function toLocalInput(utcString) {
    if (!utcString) return ''
    const d = new Date(utcString)
    // Pad a number to 2 digits
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Convert a datetime-local string (no timezone) to a proper ISO string with local timezone offset
function toISOWithOffset(localStr) {
    if (!localStr) return null
    const d = new Date(localStr) // browser treats this as local time
    return d.toISOString()       // store as UTC ISO, which Supabase expects
}

export default function ScheduleManager() {
    const [videos, setVideos] = useState([])
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)
    const [editVideo, setEditVideo] = useState(null)
    const [saving, setSaving] = useState(false)

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
            duration_minutes: parseInt(editVideo.duration_minutes) || null,
            day_number: parseInt(editVideo.day_number) || 1,
            course_id: editVideo.course_id,
        }).eq('id', editVideo.id)
        if (!error) {
            await loadData()
            setEditVideo(null)
        }
        setSaving(false)
    }

    function formatTime(t) {
        if (!t) return 'Not scheduled'
        try { return format(parseISO(t), 'MMM d, yyyy • h:mm a') } catch { return t }
    }

    function isLive(t) {
        if (!t) return false
        const now = new Date()
        const s = parseISO(t)
        return Math.abs(now - s) < 3600000
    }

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Schedule Manager</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage your scheduled class videos</p>
            </div>

            <div className="glass-card" style={{ overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading schedule...</div>
                ) : videos.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center' }}>
                        <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                        <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>No videos scheduled yet</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>Go to Upload Video to add your first class</p>
                    </div>
                ) : (
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
                                            Day {v.day_number || 1}
                                        </div>
                                    </td>
                                    <td>
                                        {isLive(v.scheduled_time) ? (
                                            <span className="badge badge-danger" style={{ animation: 'pulse 2s infinite' }}>🔴 LIVE</span>
                                        ) : v.scheduled_time && new Date(v.scheduled_time) > new Date() ? (
                                            <span className="badge badge-warning">Upcoming</span>
                                        ) : (
                                            <span className="badge badge-success">Completed</span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => setEditVideo({ ...v })} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}>
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
                                <label className="form-label">Title</label>
                                <input type="text" className="form-input" value={editVideo.title} onChange={e => setEditVideo(p => ({ ...p, title: e.target.value }))} />
                            </div>
                            <div>
                                <label className="form-label">Course</label>
                                <select className="form-input" value={editVideo.course_id} onChange={e => setEditVideo(p => ({ ...p, course_id: e.target.value }))}>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Description</label>
                                <textarea className="form-input" rows={3} value={editVideo.description || ''} onChange={e => setEditVideo(p => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label className="form-label">Scheduled Time</label>
                                    <input type="datetime-local" className="form-input" value={toLocalInput(editVideo.scheduled_time)} onChange={e => setEditVideo(p => ({ ...p, scheduled_time: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="form-label">Duration (min)</label>
                                    <input type="number" className="form-input" value={editVideo.duration_minutes || ''} onChange={e => setEditVideo(p => ({ ...p, duration_minutes: e.target.value }))} />
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Day Number</label>
                                <input type="number" className="form-input" min="1" value={editVideo.day_number || 1} onChange={e => setEditVideo(p => ({ ...p, day_number: e.target.value }))} required />
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button onClick={() => setEditVideo(null)} className="btn-secondary">Cancel</button>
                                <button onClick={handleSave} className="btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : <><Save size={16} /> Save Changes</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
