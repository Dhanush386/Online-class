import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
    Calendar, Edit2, Trash2, X, Save, Video, Users,
    Clock, Filter, Search, Radio, Sparkles, CheckCircle2, ChevronRight, Layers
} from 'lucide-react'
import { format, parseISO, formatDistanceToNow, isAfter } from 'date-fns'
import { toLocalInput, toISOWithOffset } from '../../lib/dateUtils'

const DAY_NAMES = {
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
    7: 'Sunday',
}

function formatTime(t) {
    if (!t) return 'Not scheduled'
    try { return format(parseISO(t), 'MMM d, yyyy • h:mm a') } catch { return t }
}

function formatTimeOnly(t) {
    if (!t) return ''
    try { return format(parseISO(t), 'h:mm a') } catch { return t }
}

function getRelativeTime(t) {
    if (!t) return ''
    try {
        const date = parseISO(t)
        if (isAfter(date, new Date())) {
            return `Starts ${formatDistanceToNow(date, { addSuffix: true })}`
        }
        return `Started ${formatDistanceToNow(date, { addSuffix: true })}`
    } catch {
        return ''
    }
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
        return (
            <span className="badge badge-danger" style={{ animation: 'pulse 2s infinite', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Radio size={12} className="animate-spin" /> 🔴 LIVE NOW
            </span>
        )
    }
    if (v.scheduled_time && new Date(v.scheduled_time) > new Date()) {
        return (
            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <Clock size={12} /> Upcoming
            </span>
        )
    }
    return (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={12} /> Completed
        </span>
    )
}

function getAttendanceBgColor(status) {
    if (status === 'present') return '#ecfdf5'
    if (status === 'absent') return '#fef2f2'
    return '#f8fafc'
}

function getAttendanceTextColor(status) {
    if (status === 'present') return '#059669'
    if (status === 'absent') return '#dc2626'
    return 'var(--text-muted)'
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

    // Filters and View states
    const [selectedCourse, setSelectedCourse] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedWeek, setSelectedWeek] = useState('all')
    const [activeView, setActiveView] = useState('all') // 'all' | 'live_upcoming' | 'weeks'

    const navigate = useNavigate()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const [{ data: vids }, { data: crs }] = await Promise.all([
            supabase.from('videos').select('*, courses(title)').order('scheduled_time', { ascending: true }),
            supabase.from('courses').select('id, title'),
        ])
        setVideos(vids || [])
        setCourses(crs || [])
        setLoading(false)
    }

    async function handleDelete(id) {
        if (!globalThis.confirm('Delete this video from the schedule?')) return
        await supabase.from('videos').delete().eq('id', id)
        setVideos(prev => prev.filter(v => v.id !== id))
    }

    async function handleSave() {
        setSaving(true)
        const { error } = await supabase.from('videos').update({
            title: editVideo.title,
            description: editVideo.description,
            scheduled_time: toISOWithOffset(editVideo.scheduled_time),
            duration_minutes: Number.parseInt(editVideo.duration_minutes, 10) || null,
            week_number: Number.parseInt(editVideo.week_number, 10) || 1,
            day_of_week: Number.parseInt(editVideo.day_of_week, 10) || 1,
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
        ])

        const unifiedData = enrolledStudents?.map(enrollment => {
            const attRecord = attData?.find(a => a.student_id === enrollment.student_id)
            if (attRecord) return attRecord
            return {
                id: null,
                student_id: enrollment.student_id,
                users: enrollment.users,
                joined_at: null,
                left_at: null,
                duration_seconds: 0,
                attendance_status: 'absent'
            }
        }) || []

        attData?.forEach(record => {
            if (!unifiedData.some(u => u.student_id === record.student_id)) {
                unifiedData.push(record)
            }
        })

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
        }
        if (record.id) payload.id = record.id

        const { data, error } = await supabase.from('live_attendance').upsert(payload, { onConflict: 'student_id,video_id' }).select('id, joined_at').single()

        if (error) {
            console.error("Error updating status:", error)
        } else if (!record.id && data) {
            setAttendanceData(prev => prev.map(d => d.student_id === record.student_id ? { ...d, id: data.id, joined_at: data.joined_at } : d))
        }
    }

    // Filter videos by Course & Search Query
    const filteredVideos = useMemo(() => {
        return videos.filter(v => {
            const matchesCourse = selectedCourse === 'all' || v.course_id === selectedCourse
            const matchesSearch = !searchQuery.trim() ||
                v.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                v.courses?.title?.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesCourse && matchesSearch
        })
    }, [videos, selectedCourse, searchQuery])

    // Partition into Live, Upcoming, and Past
    const liveVideos = useMemo(() => {
        return filteredVideos.filter(v => isLive(v.scheduled_time, v.duration_minutes))
    }, [filteredVideos])

    const upcomingVideos = useMemo(() => {
        return filteredVideos
            .filter(v => v.scheduled_time && new Date(v.scheduled_time) > new Date() && !isLive(v.scheduled_time, v.duration_minutes))
            .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time))
    }, [filteredVideos])

    // Group videos by Week
    const { weekNumbers, weekGroups } = useMemo(() => {
        const groups = {}
        const weeksSet = new Set()

        filteredVideos.forEach(v => {
            const wk = v.week_number || 1
            weeksSet.add(wk)
            if (!groups[wk]) groups[wk] = {}

            const dow = v.day_of_week || 1
            if (!groups[wk][dow]) groups[wk][dow] = []
            groups[wk][dow].push(v)
        })

        const sortedWeeks = Array.from(weeksSet).sort((a, b) => a - b)
        return { weekNumbers: sortedWeeks, weekGroups: groups }
    }, [filteredVideos])

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Calendar size={28} color="#6366f1" /> Schedule Manager
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Live, upcoming, and week-by-week class schedules
                    </p>
                </div>
                <button
                    onClick={() => navigate('/organizer/upload')}
                    className="btn-primary"
                    style={{ padding: '0.6rem 1.2rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Radio size={16} /> + Schedule New Class
                </button>
            </div>

            {/* Top Toolbar & Filters */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* View Switcher Pills */}
                    <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(0,0,0,0.04)', padding: '0.3rem', borderRadius: '10px' }}>
                        <button
                            onClick={() => setActiveView('all')}
                            style={{
                                padding: '0.45rem 0.9rem',
                                borderRadius: '8px',
                                border: 'none',
                                fontSize: '0.825rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: activeView === 'all' ? 'white' : 'transparent',
                                color: activeView === 'all' ? '#6366f1' : 'var(--text-muted)',
                                boxShadow: activeView === 'all' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: '0.4rem'
                            }}
                        >
                            <Layers size={14} /> All View
                        </button>
                        <button
                            onClick={() => setActiveView('live_upcoming')}
                            style={{
                                padding: '0.45rem 0.9rem',
                                borderRadius: '8px',
                                border: 'none',
                                fontSize: '0.825rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: activeView === 'live_upcoming' ? 'white' : 'transparent',
                                color: activeView === 'live_upcoming' ? '#ef4444' : 'var(--text-muted)',
                                boxShadow: activeView === 'live_upcoming' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: '0.4rem'
                            }}
                        >
                            <Radio size={14} color="#ef4444" /> Live & Upcoming ({liveVideos.length + upcomingVideos.length})
                        </button>
                        <button
                            onClick={() => setActiveView('weeks')}
                            style={{
                                padding: '0.45rem 0.9rem',
                                borderRadius: '8px',
                                border: 'none',
                                fontSize: '0.825rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                background: activeView === 'weeks' ? 'white' : 'transparent',
                                color: activeView === 'weeks' ? '#10b981' : 'var(--text-muted)',
                                boxShadow: activeView === 'weeks' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                                transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: '0.4rem'
                            }}
                        >
                            <Calendar size={14} color="#10b981" /> Week-wise View ({weekNumbers.length} Wks)
                        </button>
                    </div>

                    {/* Filter controls */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                        {/* Course Filter */}
                        <div style={{ position: 'relative', minWidth: 180 }}>
                            <Filter size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <select
                                value={selectedCourse}
                                onChange={e => setSelectedCourse(e.target.value)}
                                className="form-input"
                                style={{ paddingLeft: '2.2rem', paddingRight: '1rem', fontSize: '0.85rem', height: '38px', borderRadius: '8px' }}
                            >
                                <option value="all">All Courses</option>
                                {courses.map(c => (
                                    <option key={c.id} value={c.id}>{c.title}</option>
                                ))}
                            </select>
                        </div>

                        {/* Search Input */}
                        <div style={{ position: 'relative', width: 200 }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search classes..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="form-input"
                                style={{ paddingLeft: '2.2rem', fontSize: '0.85rem', height: '38px', borderRadius: '8px' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading schedule data...
                </div>
            )}

            {!loading && (
                <>
                    {/* SECTION 1: LIVE & UPCOMING CLASSES (Top / Upfront) */}
                    {(activeView === 'all' || activeView === 'live_upcoming') && (
                        <div style={{ marginBottom: '2.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Sparkles size={20} color="#f59e0b" /> Live & Upcoming Classes
                                </h2>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                    {liveVideos.length} Live • {upcomingVideos.length} Upcoming
                                </span>
                            </div>

                            {/* 🔴 LIVE CLASS BANNER (IF LIVE) */}
                            {liveVideos.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                                    {liveVideos.map(v => (
                                        <div
                                            key={v.id}
                                            style={{
                                                padding: '1.5rem',
                                                borderRadius: '16px',
                                                background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(220,38,38,0.03) 100%)',
                                                border: '2px solid rgba(239,68,68,0.4)',
                                                boxShadow: '0 8px 30px rgba(239,68,68,0.15)',
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                alignItems: 'center',
                                                justify: 'space-between',
                                                gap: '1.25rem'
                                            }}
                                        >
                                            <div style={{ flex: '1 1 300px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                                                    <span className="badge badge-danger" style={{ animation: 'pulse 1.5s infinite', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 800 }}>
                                                        🔴 LIVE NOW
                                                    </span>
                                                    <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                                                        {v.courses?.title || 'Course'}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>
                                                        W{v.week_number || 1} • Day {v.day_of_week || 1} ({DAY_NAMES[v.day_of_week] || 'Mon'})
                                                    </span>
                                                </div>
                                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>
                                                    {v.title}
                                                </h3>
                                                {v.description && (
                                                    <p style={{ fontSize: '0.85rem', color: '#b91c1c', marginTop: '0.35rem', opacity: 0.9 }}>
                                                        {v.description}
                                                    </p>
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem', fontSize: '0.825rem', color: '#991b1b', fontWeight: 600 }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                        <Clock size={14} /> Scheduled: {formatTimeOnly(v.scheduled_time)}
                                                    </span>
                                                    <span>•</span>
                                                    <span>Duration: {v.duration_minutes || 60} mins</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => navigate(`/organizer/classroom/${v.id}`)}
                                                    className="btn-primary btn-live-pulse"
                                                    style={{
                                                        padding: '0.65rem 1.4rem',
                                                        fontSize: '0.9rem',
                                                        fontWeight: 700,
                                                        background: '#dc2626',
                                                        border: 'none',
                                                        display: 'flex', alignItems: 'center', gap: '0.5rem'
                                                    }}
                                                >
                                                    <Video size={18} /> Launch Live Classroom <ChevronRight size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleViewAttendance(v)}
                                                    className="btn-secondary"
                                                    style={{ padding: '0.65rem 1rem', fontSize: '0.85rem', background: 'white' }}
                                                >
                                                    <Users size={15} /> Attendance
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* UPCOMING CLASSES GRID */}
                            {upcomingVideos.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
                                    {upcomingVideos.map(v => (
                                        <div
                                            key={v.id}
                                            className="glass-card zoom-in"
                                            style={{
                                                padding: '1.25rem',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justify: 'space-between',
                                                borderLeft: '4px solid #f59e0b',
                                                background: 'var(--card-bg)'
                                            }}
                                        >
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
                                                    <span className="badge badge-warning" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
                                                        ⚡ {getRelativeTime(v.scheduled_time)}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.08)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                                                        W{v.week_number || 1} • D{v.day_of_week || 1} ({DAY_NAMES[v.day_of_week]?.slice(0, 3)})
                                                    </span>
                                                </div>

                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                                    {v.courses?.title || 'Course'}
                                                </div>
                                                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', lineHeight: '1.3' }}>
                                                    {v.title}
                                                </h4>
                                                {v.description && (
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {v.description}
                                                    </p>
                                                )}
                                            </div>

                                            <div style={{ paddingTop: '0.85rem', borderTop: '1px solid var(--card-border)', marginTop: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.825rem', marginBottom: '0.85rem' }}>
                                                    <Calendar size={14} color="#6366f1" /> {formatTime(v.scheduled_time)}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => navigate(`/organizer/classroom/${v.id}`)}
                                                        className="btn-primary"
                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', flex: 1 }}
                                                    >
                                                        <Video size={13} /> Launch
                                                    </button>
                                                    <button
                                                        onClick={() => handleViewAttendance(v)}
                                                        className="btn-secondary"
                                                        style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem' }}
                                                    >
                                                        <Users size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditVideo({ ...v, recording_duration_mins: v.duration_seconds ? v.duration_seconds / 60 : '' })}
                                                        className="btn-secondary"
                                                        style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem' }}
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(v.id)}
                                                        className="btn-danger"
                                                        style={{ padding: '0.4rem 0.65rem', fontSize: '0.78rem' }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                !liveVideos.length && (
                                    <div className="glass-card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <Clock size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.3, display: 'block' }} />
                                        <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>No live or upcoming classes right now</p>
                                        <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Scheduled future classes will appear here automatically.</p>
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {/* SECTION 2: WEEK-WISE CLASS SCHEDULE */}
                    {(activeView === 'all' || activeView === 'weeks') && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Calendar size={20} color="#10b981" /> Week-wise Class Schedule
                                    </h2>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        Organized by week and day of the week
                                    </p>
                                </div>

                                {/* Week Selector Filter Pills */}
                                {weekNumbers.length > 0 && (
                                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={() => setSelectedWeek('all')}
                                            style={{
                                                padding: '0.35rem 0.75rem',
                                                borderRadius: '20px',
                                                border: selectedWeek === 'all' ? '1px solid #10b981' : '1px solid var(--card-border)',
                                                background: selectedWeek === 'all' ? '#10b981' : 'transparent',
                                                color: selectedWeek === 'all' ? 'white' : 'var(--text-secondary)',
                                                fontSize: '0.78rem',
                                                fontWeight: 600,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            All Weeks
                                        </button>
                                        {weekNumbers.map(wk => (
                                            <button
                                                key={wk}
                                                onClick={() => setSelectedWeek(wk)}
                                                style={{
                                                    padding: '0.35rem 0.75rem',
                                                    borderRadius: '20px',
                                                    border: selectedWeek === wk ? '1px solid #10b981' : '1px solid var(--card-border)',
                                                    background: selectedWeek === wk ? '#10b981' : 'transparent',
                                                    color: selectedWeek === wk ? 'white' : 'var(--text-secondary)',
                                                    fontSize: '0.78rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Week {wk}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {weekNumbers.length === 0 ? (
                                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                                    <Calendar size={44} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                                    <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>No week-wise classes found</p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                                        Click "+ Schedule New Class" to create your first scheduled session.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                    {weekNumbers
                                        .filter(wk => selectedWeek === 'all' || selectedWeek === wk)
                                        .map(wk => {
                                            const daysObject = weekGroups[wk] || {}
                                            const sortedDays = Object.keys(daysObject).map(Number).sort((a, b) => a - b)
                                            const totalWeekClasses = Object.values(daysObject).flat().length

                                            return (
                                                <div key={wk} className="glass-card" style={{ overflow: 'hidden', borderLeft: '4px solid #6366f1' }}>
                                                    {/* Week Header */}
                                                    <div style={{
                                                        padding: '1.25rem 1.5rem',
                                                        background: 'rgba(99,102,241,0.04)',
                                                        borderBottom: '1px solid var(--card-border)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justify: 'space-between',
                                                        flexWrap: 'wrap',
                                                        gap: '1rem'
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{
                                                                width: 38, height: 38, borderRadius: '10px',
                                                                background: '#6366f1', color: 'white',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontWeight: 800, fontSize: '0.95rem'
                                                            }}>
                                                                W{wk}
                                                            </div>
                                                            <div>
                                                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                                                    Week {wk} Schedule
                                                                </h3>
                                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                                                    {totalWeekClasses} session{totalWeekClasses === 1 ? '' : 's'} scheduled across {sortedDays.length} day{sortedDays.length === 1 ? '' : 's'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                                                            Week {wk} Overview
                                                        </span>
                                                    </div>

                                                    {/* Days Breakdown */}
                                                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                        {sortedDays.map(dayNum => {
                                                            const dayClasses = daysObject[dayNum] || []
                                                            return (
                                                                <div
                                                                    key={dayNum}
                                                                    style={{
                                                                        borderRadius: '12px',
                                                                        border: '1px solid var(--card-border)',
                                                                        background: 'rgba(0,0,0,0.01)',
                                                                        padding: '1rem 1.25rem'
                                                                    }}
                                                                >
                                                                    {/* Day Sub-header */}
                                                                    <div style={{
                                                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                                        marginBottom: '0.85rem', borderBottom: '1px dashed var(--card-border)',
                                                                        paddingBottom: '0.5rem'
                                                                    }}>
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6366f1' }}>
                                                                            Day {dayNum} ({DAY_NAMES[dayNum] || 'Day'})
                                                                        </span>
                                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                            • {dayClasses.length} class{dayClasses.length === 1 ? '' : 'es'}
                                                                        </span>
                                                                    </div>

                                                                    {/* Day Classes List */}
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                        {dayClasses.map(v => (
                                                                            <div
                                                                                key={v.id}
                                                                                style={{
                                                                                    display: 'flex',
                                                                                    flexWrap: 'wrap',
                                                                                    gap: '1rem',
                                                                                    alignItems: 'center',
                                                                                    justify: 'space-between',
                                                                                    padding: '1rem',
                                                                                    borderRadius: '10px',
                                                                                    background: 'white',
                                                                                    border: '1px solid #e2e8f0'
                                                                                }}
                                                                            >
                                                                                <div style={{ flex: '1 1 240px' }}>
                                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                                                        {getStatusBadge(v)}
                                                                                        <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>
                                                                                            {v.courses?.title || 'Course'}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>
                                                                                        {v.title}
                                                                                    </div>
                                                                                    {v.description && (
                                                                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                                                                                            {v.description}
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 160 }}>
                                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                                                                                        Time Slot
                                                                                    </div>
                                                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                                        <Clock size={13} color="#6366f1" /> {formatTime(v.scheduled_time)}
                                                                                    </div>
                                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                                        Duration: {v.duration_minutes || 60} mins
                                                                                    </div>
                                                                                </div>

                                                                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                                    <button
                                                                                        onClick={() => navigate(`/organizer/classroom/${v.id}`)}
                                                                                        className={`btn-primary ${isLive(v.scheduled_time, v.duration_minutes) ? 'btn-live-pulse' : ''}`}
                                                                                        style={{
                                                                                            padding: '0.4rem 0.85rem',
                                                                                            fontSize: '0.78rem',
                                                                                            background: isLive(v.scheduled_time, v.duration_minutes) ? '#ef4444' : '#6366f1'
                                                                                        }}
                                                                                    >
                                                                                        <Video size={13} /> Launch
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleViewAttendance(v)}
                                                                                        className="btn-secondary"
                                                                                        style={{ padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
                                                                                    >
                                                                                        <Users size={13} /> Attendance
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => setEditVideo({ ...v, recording_duration_mins: v.duration_seconds ? v.duration_seconds / 60 : '' })}
                                                                                        className="btn-secondary"
                                                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                                                                                    >
                                                                                        <Edit2 size={13} />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDelete(v.id)}
                                                                                        className="btn-danger"
                                                                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem' }}
                                                                                    >
                                                                                        <Trash2 size={13} />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

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
                                        <option value="1">Monday (Day 1)</option>
                                        <option value="2">Tuesday (Day 2)</option>
                                        <option value="3">Wednesday (Day 3)</option>
                                        <option value="4">Thursday (Day 4)</option>
                                        <option value="5">Friday (Day 5)</option>
                                        <option value="6">Saturday (Day 6)</option>
                                        <option value="7">Sunday (Day 7)</option>
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
                                    <div className="stat-grid" style={{ gap: '1rem' }}>
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
                                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflowX: 'auto' }}>
                                                <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
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
