import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Video, Search, Calendar, Clock, Database, PlayCircle, Copy, CheckCircle, AlertCircle, RefreshCw, FolderOpen, Loader, Trash2, RefreshCcw, FileText, Upload, Link, X, BookOpen, ChevronDown, ChevronUp, Layers, LayoutList, CalendarDays, Edit3 } from 'lucide-react'
import { useMeeting } from '../../contexts/MeetingContext'

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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

    // Schedule (Week & Day) editing
    const [editingSchedule, setEditingSchedule] = useState(null)
    const [scheduleForm, setScheduleForm] = useState({ week_number: 1, day_of_week: 1 })
    const [savingSchedule, setSavingSchedule] = useState(false)

    // Filters & View
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCourse, setSelectedCourse] = useState('')
    const [selectedWeek, setSelectedWeek] = useState('')
    const [selectedDay, setSelectedDay] = useState('')
    const [viewMode, setViewMode] = useState('grouped') // 'grouped' | 'flat'
    const [collapsedCourses, setCollapsedCourses] = useState({})
    const [collapsedWeeks, setCollapsedWeeks] = useState({})

    useEffect(() => {
        if (profile?.id) {
            loadData()
        }
    }, [profile])

    async function loadData() {
        setLoading(true)
        try {
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

            if (courseIds.length > 0) {
                const { data: vids } = await supabase
                    .from('videos')
                    .select('*, courses(title)')
                    .in('course_id', courseIds)
                    .or('recording_status.not.is.null,drive_file_id.not.is.null,video_url.not.is.null')
                    .order('week_number', { ascending: true })
                    .order('day_of_week', { ascending: true })
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
        } catch (err) {
            console.error('Failed to copy', err)
        }
    }

    // Counts per course
    const courseCounts = useMemo(() => {
        const counts = {}
        recordings.forEach(r => {
            if (r.course_id) {
                counts[r.course_id] = (counts[r.course_id] || 0) + 1
            }
        })
        return counts
    }, [recordings])

    // Available weeks in data
    const availableWeeks = useMemo(() => {
        const set = new Set()
        recordings.forEach(r => {
            if (r.week_number) set.add(r.week_number)
        })
        return Array.from(set).sort((a, b) => a - b)
    }, [recordings])

    const filteredRecordings = useMemo(() => {
        return recordings.filter(r => {
            const matchSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || r.courses?.title?.toLowerCase().includes(searchQuery.toLowerCase())
            const matchCourse = selectedCourse ? r.course_id === selectedCourse : true
            const matchWeek = selectedWeek ? String(r.week_number || 1) === String(selectedWeek) : true
            const matchDay = selectedDay ? String(r.day_of_week || 1) === String(selectedDay) : true
            return matchSearch && matchCourse && matchWeek && matchDay
        })
    }, [recordings, searchQuery, selectedCourse, selectedWeek, selectedDay])

    // Hierarchical Course -> Week -> Day grouping
    const courseWiseWeekDayGroups = useMemo(() => {
        const groups = {}
        
        filteredRecordings.forEach(rec => {
            const cId = rec.course_id || 'unassigned'
            const cTitle = rec.courses?.title || (cId === 'unassigned' ? 'General / Unassigned Sessions' : 'Unknown Course')
            const weekNum = rec.week_number || 1
            const dayNum = rec.day_of_week || 1

            if (!groups[cId]) {
                groups[cId] = {
                    courseId: cId,
                    courseTitle: cTitle,
                    weeks: {},
                    recordings: []
                }
            }
            groups[cId].recordings.push(rec)

            if (!groups[cId].weeks[weekNum]) {
                groups[cId].weeks[weekNum] = {
                    weekNum,
                    days: {},
                    recordings: []
                }
            }
            groups[cId].weeks[weekNum].recordings.push(rec)

            if (!groups[cId].weeks[weekNum].days[dayNum]) {
                groups[cId].weeks[weekNum].days[dayNum] = {
                    dayNum,
                    dayName: DAY_NAMES[dayNum] || `Day ${dayNum}`,
                    recordings: []
                }
            }
            groups[cId].weeks[weekNum].days[dayNum].recordings.push(rec)
        })

        return Object.values(groups).map(c => ({
            ...c,
            weeks: Object.values(c.weeks)
                .sort((a, b) => a.weekNum - b.weekNum)
                .map(w => ({
                    ...w,
                    days: Object.values(w.days).sort((a, b) => a.dayNum - b.dayNum)
                }))
        }))
    }, [filteredRecordings])

    async function handleSaveSchedule() {
        if (!editingSchedule) return
        setSavingSchedule(true)
        try {
            const { error } = await supabase
                .from('videos')
                .update({
                    week_number: Number.parseInt(scheduleForm.week_number) || 1,
                    day_of_week: Number.parseInt(scheduleForm.day_of_week) || 1
                })
                .eq('id', editingSchedule.id)

            if (error) throw error
            setEditingSchedule(null)
            loadData()
        } catch (err) {
            alert('Failed to update week and day: ' + err.message)
        } finally {
            setSavingSchedule(false)
        }
    }

    const renderRecordingCard = (rec) => (
        <div key={rec.id} className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', padding: '1.25rem', borderRadius: '12px' }}>
            <div style={{ flex: '1 1 240px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Recording</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{rec.title}</div>
                {rec.file_size_mb && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}><Database size={12}/> {rec.file_size_mb} MB</div>}
            </div>
            <div style={{ flex: '1 1 140px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Course</div>
                <div style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.9rem' }}>{rec.courses?.title || 'Unknown'}</div>
            </div>
            <div style={{ flex: '1 1 130px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Pattern</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0.25rem 0.55rem', borderRadius: 6, background: 'rgba(99, 102, 241, 0.08)', color: 'var(--primary-600)', fontSize: '0.82rem', fontWeight: 700, border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                    <CalendarDays size={13} />
                    <span>Week {rec.week_number || 1} • Day {rec.day_of_week || 1}</span>
                </div>
            </div>
            <div style={{ flex: '1 1 120px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Recorded Date</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <Calendar size={13} />
                    {rec.recorded_at ? new Date(rec.recorded_at).toLocaleDateString() : new Date(rec.created_at).toLocaleDateString()}
                </div>
            </div>
            <div style={{ flex: '1 1 90px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Duration</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    <Clock size={13} />
                    {formatDuration(rec.duration_seconds)}
                </div>
            </div>
            <div style={{ flex: '1 1 90px' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 700 }}>Status</div>
                {getRecordingStatusBadge(rec)}
            </div>
            <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem', paddingTop: '0.85rem', borderTop: '1px solid var(--card-border)' }}>
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
                        setEditingSchedule(rec)
                        setScheduleForm({
                            week_number: rec.week_number || 1,
                            day_of_week: rec.day_of_week || 1
                        })
                    }}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid var(--card-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600 }}
                    title="Change Week & Day Pattern"
                    className="hover-scale"
                >
                    <Edit3 size={14} color="var(--primary-500)" /> Edit W/D Pattern
                </button>
                <button 
                    onClick={() => {
                        setEditingSlide(rec)
                        setSlideUrl(rec.slide_url || '')
                        setSlideFile(null)
                    }}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: 'none', background: rec.slide_url ? '#dcfce7' : '#f3e8ff', color: rec.slide_url ? '#16a34a' : '#9333ea', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600 }}
                    title={rec.slide_url ? "Edit PPT" : "Attach PPT"}
                    className="hover-scale"
                >
                    <FileText size={16} /> Attach PPT
                </button>
                {rec.video_url && (
                    <>
                        <button 
                            onClick={() => copyToClipboard(rec.video_url)}
                            style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: 'none', background: 'var(--bg-elevated)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600 }}
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
    )

    return (
        <div className="animate-fade-in" style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Recording History</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Manage class recordings organized by Course, Week, and Day curriculum patterns.
                    </p>
                </div>
                <button onClick={loadData} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>

            {/* Storage Analytics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(99,102,241,0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Video size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Recordings</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{recordings.length}</div>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={24} />
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Hours</div>
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
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Storage Used</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {(recordings.reduce((acc, r) => acc + Number(r.file_size_mb || 0), 0) / 1024).toFixed(2)} GB
                        </div>
                    </div>
                </div>
            </div>

            {/* Course Separation Pill Tabs */}
            <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                    Course Wise Separation
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', scrollbarWidth: 'none' }}>
                    <button
                        onClick={() => setSelectedCourse('')}
                        style={{
                            padding: '0.45rem 0.95rem',
                            borderRadius: '999px',
                            border: selectedCourse === '' ? '1.5px solid var(--primary-500)' : '1px solid var(--card-border)',
                            background: selectedCourse === '' ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-elevated)',
                            color: selectedCourse === '' ? 'var(--primary-600)' : 'var(--text-secondary)',
                            fontWeight: selectedCourse === '' ? 700 : 500,
                            fontSize: '0.85rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.18s ease'
                        }}
                    >
                        <FolderOpen size={14} /> All Courses
                        <span style={{
                            fontSize: '0.75rem',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '999px',
                            background: selectedCourse === '' ? 'var(--primary-500)' : 'var(--sidebar-border)',
                            color: selectedCourse === '' ? '#ffffff' : 'var(--text-muted)',
                            fontWeight: 700
                        }}>
                            {recordings.length}
                        </span>
                    </button>

                    {courses.map(c => {
                        const count = courseCounts[c.id] || 0
                        const isSelected = selectedCourse === c.id
                        return (
                            <button
                                key={c.id}
                                onClick={() => setSelectedCourse(isSelected ? '' : c.id)}
                                style={{
                                    padding: '0.45rem 0.95rem',
                                    borderRadius: '999px',
                                    border: isSelected ? '1.5px solid var(--primary-500)' : '1px solid var(--card-border)',
                                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-elevated)',
                                    color: isSelected ? 'var(--primary-600)' : 'var(--text-secondary)',
                                    fontWeight: isSelected ? 700 : 500,
                                    fontSize: '0.85rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.45rem',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.18s ease'
                                }}
                            >
                                <BookOpen size={14} /> {c.title}
                                <span style={{
                                    fontSize: '0.75rem',
                                    padding: '0.1rem 0.45rem',
                                    borderRadius: '999px',
                                    background: isSelected ? 'var(--primary-500)' : 'var(--sidebar-border)',
                                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                                    fontWeight: 700
                                }}>
                                    {count}
                                </span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Filter Bar: Search, Week Filter, Day Filter, View Mode */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 200px' }}>
                    <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        type="text" 
                        placeholder="Search recordings..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="form-input" 
                        style={{ paddingLeft: '2.5rem' }} 
                    />
                </div>

                {/* Week Filter Dropdown */}
                <div style={{ position: 'relative', flex: '0 1 150px' }}>
                    <select
                        className="form-input"
                        value={selectedWeek}
                        onChange={e => setSelectedWeek(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                    >
                        <option value="">All Weeks</option>
                        {availableWeeks.map(w => (
                            <option key={`week-${w}`} value={w}>Week {w}</option>
                        ))}
                    </select>
                </div>

                {/* Day Filter Dropdown */}
                <div style={{ position: 'relative', flex: '0 1 160px' }}>
                    <select
                        className="form-input"
                        value={selectedDay}
                        onChange={e => setSelectedDay(e.target.value)}
                        style={{ fontSize: '0.85rem' }}
                    >
                        <option value="">All Days</option>
                        {[1, 2, 3, 4, 5, 6, 7].map(d => (
                            <option key={`day-${d}`} value={d}>Day {d} ({DAY_NAMES[d]?.slice(0, 3)})</option>
                        ))}
                    </select>
                </div>

                {/* View Mode Switcher */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'var(--bg-elevated)', padding: '0.25rem', borderRadius: 10, border: '1px solid var(--card-border)' }}>
                    <button
                        onClick={() => setViewMode('grouped')}
                        title="Week & Day Pattern Hierarchy"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.85rem', borderRadius: 8,
                            border: 'none',
                            background: viewMode === 'grouped' ? 'var(--primary-500)' : 'transparent',
                            color: viewMode === 'grouped' ? '#ffffff' : 'var(--text-muted)',
                            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <Layers size={14} /> Week & Day
                    </button>
                    <button
                        onClick={() => setViewMode('flat')}
                        title="Continuous Flat List"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.45rem 0.85rem', borderRadius: 8,
                            border: 'none',
                            background: viewMode === 'flat' ? 'var(--primary-500)' : 'transparent',
                            color: viewMode === 'flat' ? '#ffffff' : 'var(--text-muted)',
                            fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <LayoutList size={14} /> All List
                    </button>
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
                <div style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--card-border)', borderRadius: '14px' }}>
                    <Video size={36} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No recordings found</div>
                    <div style={{ fontSize: '0.85rem' }}>No recorded sessions match your course, week, or day filters.</div>
                </div>
            )}

            {/* Week & Day Pattern Grouped Mode */}
            {!loading && filteredRecordings.length > 0 && viewMode === 'grouped' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {courseWiseWeekDayGroups.map(group => {
                        const isCourseCollapsed = collapsedCourses[group.courseId]
                        const totalGroupSecs = group.recordings.reduce((sum, r) => sum + (r.duration_seconds || 0), 0)

                        return (
                            <div key={group.courseId} className="animate-fade-in">
                                {/* Course Header Banner */}
                                <div 
                                    onClick={() => setCollapsedCourses(p => ({ ...p, [group.courseId]: !p[group.courseId] }))}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.9rem 1.25rem',
                                        background: 'var(--bg-elevated)',
                                        borderRadius: 12,
                                        border: '1px solid var(--card-border)',
                                        marginBottom: isCourseCollapsed ? 0 : '1.25rem',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                        <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <BookOpen size={20} />
                                        </div>
                                        <div>
                                            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                                {group.courseTitle}
                                            </h2>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.6rem', borderRadius: 999, background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary-600)', fontWeight: 700 }}>
                                            {group.recordings.length} {group.recordings.length === 1 ? 'recording' : 'recordings'}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            <Clock size={13} /> {formatDuration(totalGroupSecs)}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)' }}>
                                            {isCourseCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Weeks inside this course */}
                                {!isCourseCollapsed && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingLeft: '0.5rem' }}>
                                        {group.weeks.map(week => {
                                            const weekKey = `${group.courseId}-W${week.weekNum}`
                                            const isWeekCollapsed = collapsedWeeks[weekKey]
                                            const totalWeekSecs = week.recordings.reduce((sum, r) => sum + (r.duration_seconds || 0), 0)

                                            return (
                                                <div key={weekKey} style={{ background: 'rgba(99, 102, 241, 0.03)', borderRadius: 12, border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                                                    {/* Week Header */}
                                                    <div 
                                                        onClick={() => setCollapsedWeeks(p => ({ ...p, [weekKey]: !p[weekKey] }))}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'space-between',
                                                            padding: '0.75rem 1.25rem',
                                                            background: 'var(--bg-surface)',
                                                            borderBottom: isWeekCollapsed ? 'none' : '1px solid var(--card-border)',
                                                            cursor: 'pointer',
                                                            userSelect: 'none'
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary-500)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800 }}>
                                                                W{week.weekNum}
                                                            </div>
                                                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                                                Week {week.weekNum}
                                                            </span>
                                                            <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.5rem', borderRadius: 999, background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                                {week.recordings.length} {week.recordings.length === 1 ? 'session' : 'sessions'}
                                                            </span>
                                                        </div>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                            <span>{formatDuration(totalWeekSecs)}</span>
                                                            {isWeekCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                                        </div>
                                                    </div>

                                                    {/* Days inside Week */}
                                                    {!isWeekCollapsed && (
                                                        <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                                            {week.days.map(day => (
                                                                <div key={`${weekKey}-D${day.dayNum}`}>
                                                                    {/* Day Sub-header */}
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem', color: 'var(--primary-600)', fontSize: '0.82rem', fontWeight: 700 }}>
                                                                        <CalendarDays size={14} />
                                                                        <span>Day {day.dayNum} — {day.dayName}</span>
                                                                        <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({day.recordings.length})</span>
                                                                    </div>

                                                                    {/* Day Recordings Cards */}
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                                        {day.recordings.map(rec => renderRecordingCard(rec))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Flat List Mode */}
            {!loading && filteredRecordings.length > 0 && viewMode === 'flat' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filteredRecordings.map(rec => renderRecordingCard(rec))}
                </div>
            )}

            {/* Edit Week & Day Pattern Modal */}
            {editingSchedule && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="glass-card animate-scale-in" style={{ padding: '2rem', width: '100%', maxWidth: 440, background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CalendarDays size={22} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Edit Curriculum Pattern</h3>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{editingSchedule.title}</div>
                            </div>
                        </div>

                        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Assign this recording to the corresponding <strong>Week</strong> and <strong>Day</strong> of the curriculum.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                                    Week Number
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="52"
                                    className="form-input"
                                    value={scheduleForm.week_number}
                                    onChange={e => setScheduleForm(p => ({ ...p, week_number: e.target.value }))}
                                    placeholder="e.g. 1"
                                    required
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                                    Day of Week
                                </label>
                                <select
                                    className="form-input"
                                    value={scheduleForm.day_of_week}
                                    onChange={e => setScheduleForm(p => ({ ...p, day_of_week: e.target.value }))}
                                >
                                    {[1, 2, 3, 4, 5, 6, 7].map(d => (
                                        <option key={d} value={d}>
                                            Day {d} — {DAY_NAMES[d]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button className="btn-secondary" onClick={() => setEditingSchedule(null)}>Cancel</button>
                            <button 
                                className="btn-primary" 
                                disabled={savingSchedule}
                                onClick={handleSaveSchedule}
                            >
                                {savingSchedule ? <Loader className="animate-spin" size={16} /> : <CheckCircle size={16} />} Save Pattern
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Attach PPT Modal */}
            {editingSlide && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="glass-card animate-scale-in" style={{ padding: '2rem', width: '100%', maxWidth: 500, background: 'var(--bg-surface)', border: '1px solid var(--card-border)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Attach Slides</h3>
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
                                style={{ padding: '0 1rem', height: 42, background: slideFile ? '#ecfdf5' : 'var(--bg-elevated)', border: `1px solid ${slideFile ? '#10b981' : 'var(--card-border)'}`, borderRadius: 12, color: slideFile ? '#059669' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', flexShrink: 0 }}
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

