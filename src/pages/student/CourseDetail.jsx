import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Video, Clock, ExternalLink, Calendar, CheckCircle, Zap, Play, X, ClipboardList, Code, ChevronRight, Eye, Lock, FileText, Edit2, Plus, List, Trash2, Save, FileEdit, Map, LayoutList } from 'lucide-react'
import ReactPlayer from 'react-player'
import ProtectedViewer from '../../components/shared/ProtectedViewer'
import SplitViewer from '../../components/shared/SplitViewer'
import JourneyMap from '../../components/student/JourneyMap'
import DayDetailPanel from '../../components/student/DayDetailPanel'
import WeeklyCompletionModal from '../../components/student/WeeklyCompletionModal'
import SemesterTimeline from '../../components/student/SemesterTimeline'
import CourseJourneyTimeline from '../../components/student/CourseJourneyTimeline'
import useWeeklyCourse from '../../hooks/useWeeklyCourse'
import useXpAward from '../../hooks/useXpAward'

const MAX_ATTEMPTS = 1
const ASSESS_COLORS = { daily: '#6366f1', weekly: '#f59e0b', final: '#10b981' }

export default function CourseDetail() {
    const { courseId } = useParams()
    const { profile } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    // Helper utilities
    const isLive = (t) => t && Math.abs(new Date() - new Date(t)) < 3600000
    const isUpcoming = (t) => t && new Date(t) > new Date() && !isLive(t)
    const isRecorded = (vid) => vid && vid.video_url && (
        vid.video_url.includes('supabase.co/storage') || 
        vid.video_url.includes('drive.google.com') ||
        !vid.video_url.startsWith('http')
    )

    const [course, setCourse] = useState(null)
    const [sessions, setSessions] = useState([])
    const [challenges, setChallenges] = useState([])
    const [assessments, setAssessments] = useState({ daily: [], weekly: [], final: [] })
    const [submissions, setSubmissions] = useState({}) // { assessmentId: [sub, ...] }
    const [progress, setProgress] = useState(null)
    const [courseResources, setCourseResources] = useState([])
    const [dayAccess, setDayAccess] = useState([])
    const [selectedDay, setSelectedDay] = useState(1)
    const [loading, setLoading] = useState(true)
    const [activeVideo, setActiveVideo] = useState(null)
    const [activeResource, setActiveResource] = useState(null)
    const [notes, setNotes] = useState([])
    const [isAddingNote, setIsAddingNote] = useState(false)
    const [activeNote, setActiveNote] = useState(null) // For editing
    const [savingNote, setSavingNote] = useState(false)
    const [signedUrl, setSignedUrl] = useState(null)
    const [loadingVideo, setLoadingVideo] = useState(false)
    const [videoType, setVideoType] = useState('native') // 'native' | 'drive'

    // Journey Engine state
    const [viewMode, setViewMode] = useState('journey') // 'journey' | 'classic'
    const [selectedJourneyDay, setSelectedJourneyDay] = useState(null)
    const [showWeeklyModal, setShowWeeklyModal] = useState(false)
    const [completedWeekInfo, setCompletedWeekInfo] = useState(null)

    // Journey Engine hooks
    const {
        weeks, currentWeek, weekProgress, courseSettings, loading: weeklyLoading,
        isWeekLocked, getDayModules, pendingForWeek, getWeekGrade, getScheduleDate, refreshProgress
    } = useWeeklyCourse(courseId)
    const { awardXp, todaysXp, xpTimeline, toastMessage } = useXpAward()

    useEffect(() => {
        async function load() {
            if (!profile?.id || !courseId) return
            const [
                { data: crs },
                { data: vids },
                { data: prog },
                { data: chls },
                { data: assessData },
                { data: subData },
                { data: memberships },
                { data: dayAccessData },
                { data: locks },
                { data: resData },
                { data: vpData },
                { data: initialNotes }
            ] = await Promise.all([
                supabase.from('courses').select('*').eq('id', courseId).single(),
                supabase.from('videos').select('*').eq('course_id', courseId).order('week_number', { ascending: true }).order('day_of_week', { ascending: true }),
                supabase.from('progress').select('*').eq('student_id', profile.id).eq('course_id', courseId).maybeSingle(),
                supabase.from('coding_challenges').select('*').eq('course_id', courseId).order('week_number', { ascending: true }).order('day_of_week', { ascending: true }),
                supabase.from('assessments').select('*').eq('course_id', courseId).order('week_number', { ascending: true }).order('day_of_week', { ascending: true }),
                supabase.from('assessment_submissions').select('*').eq('student_id', profile.id),
                supabase.from('group_members').select('group_id').eq('student_id', profile.id),
                supabase.from('day_access').select('*').eq('course_id', courseId),
                supabase.from('resource_access').select('*').eq('is_locked', true),
                supabase.from('course_resources').select('*').eq('course_id', courseId).order('week_number', { ascending: true }).order('day_of_week', { ascending: true }),
                supabase.from('video_progress').select('video_id').eq('student_id', profile.id).eq('course_id', courseId),
                supabase.from('student_notes').select('*').eq('student_id', profile.id).eq('course_id', courseId).order('created_at', { ascending: false })
            ])

            // No need for setMaxDay state if we just use it to build the day list, but let's see

            const userGroupIds = memberships?.map(m => m.group_id) || []
            const groupDayAccess = (dayAccessData || []).filter(da => userGroupIds.includes(da.group_id))
            setDayAccess(groupDayAccess)

            const lockedCodingIds = locks?.filter(l => userGroupIds.includes(l.group_id) && l.resource_type === 'coding').map(l => l.resource_id) || []
            const lockedAssessIds = locks?.filter(l => userGroupIds.includes(l.group_id) && l.resource_type === 'assessment').map(l => l.resource_id) || []
            const lockedMaterialIds = locks?.filter(l => userGroupIds.includes(l.group_id) && (l.resource_type === 'resource' || l.resource_type === 'other')).map(l => l.resource_id) || []

            setCourse(crs)
            const now = new Date()
            setSessions((vids || []).filter(v => !(v.scheduled_time && new Date(v.scheduled_time) > now && !v.video_url)))
            setProgress({ ...(prog || {}), video_progress: vpData || [] })
            setChallenges((chls || []).filter(c => !lockedCodingIds.includes(c.id) && !(c.open_time && new Date(c.open_time) > now)))
            setCourseResources((resData || []).filter(r => !lockedMaterialIds.includes(r.id)))

            const grouped = { daily: [], weekly: [], final: [] }
                ; (assessData || [])
                    .filter(a => !lockedAssessIds.includes(a.id) && !(a.open_time && new Date(a.open_time) > now))
                    .forEach(a => { if (grouped[a.type]) grouped[a.type].push(a) })
            setAssessments(grouped)

            const subMap = {}
                ; (subData || []).forEach(s => {
                    if (!subMap[s.assessment_id]) subMap[s.assessment_id] = []
                    subMap[s.assessment_id].push(s)
                })
            setSubmissions(subMap)
            setNotes(initialNotes || [])
            setLoading(false)
        }
        load()
    }, [courseId, profile])

    async function updateOverallProgress() {
        if (!profile?.id || !courseId) return

        const [
            { data: vids, error: ve },
            { data: chls, error: ce },
            { data: assessData, error: ae },
            { data: vpData, error: vpe },
            { data: subData, error: se }
        ] = await Promise.all([
            supabase.from('videos').select('id').eq('course_id', courseId),
            supabase.from('coding_challenges').select('id').eq('course_id', courseId),
            supabase.from('assessments').select('id').eq('course_id', courseId),
            supabase.from('video_progress').select('video_id').eq('student_id', profile.id).eq('course_id', courseId),
            supabase.from('coding_submissions').select('challenge_id, status').eq('student_id', profile.id)
        ])

        if (ve || ce || ae || vpe || se) {
            console.error('Progress fetch error:', { ve, ce, ae, vpe, se })
        }

        const { data: allAssessSubs, error: ase } = await supabase.from('assessment_submissions').select('assessment_id').eq('student_id', profile.id)
        if (ase) console.error('Assessment subs fetch error:', ase)

        const totalSessions = (vids || []).length
        const totalCoding = (chls || []).length
        const totalAssessments = (assessData || []).length

        const completedSessions = (vids || []).filter(v => (vpData || []).some(vp => vp.video_id === v.id)).length
        const completedCoding = (chls || []).filter(c => (subData || []).some(s => s.challenge_id === c.id && s.status === 'accepted')).length
        const completedAssess = (assessData || []).filter(a => (allAssessSubs || []).some(s => s.assessment_id === a.id)).length

        const totalTopics = totalSessions + totalCoding + totalAssessments
        const completedTopics = completedSessions + completedCoding + completedAssess

        const finalPct = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0
        console.log(`Progress Update [${courseId}]: ${finalPct}% (V:${completedSessions}/${totalSessions}, C:${completedCoding}/${totalCoding}, A:${completedAssess}/${totalAssessments})`)

        const { error: upError } = await supabase.from('progress').upsert({
            student_id: profile.id,
            course_id: courseId,
            completion_percentage: finalPct,
            last_updated: new Date().toISOString()
        }, { onConflict: 'student_id,course_id' })

        if (upError) {
            console.error('Progress upsert error:', upError)
        }

        setProgress(p => ({ ...(p || {}), completion_percentage: finalPct }))
    }

    // Extract Google Drive file ID from any share-link format
    function extractDriveFileId(url) {
        // Format: /file/d/FILE_ID/view or /file/d/FILE_ID/preview
        const slashMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
        if (slashMatch) return slashMatch[1]
        // Format: ?id=FILE_ID or open?id=FILE_ID
        const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
        if (idMatch) return idMatch[1]
        return null
    }

    async function handleWatchVideo(video) {
        if (!video.video_url) return

        setActiveVideo(video)
        setSignedUrl(null)
        window.scrollTo({ top: 0, behavior: 'smooth' })

        // ── Google Drive ────────────────────────────────────────────────
        if (video.video_url.includes('drive.google.com') || video.drive_file_id) {
            const fileId = extractDriveFileId(video.video_url) || video.drive_file_id
            if (fileId) {
                const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`
                setVideoType('drive-iframe')
                setSignedUrl(previewUrl)
                setTimeout(() => markComplete(video.id), 8000)
                return
            }
            
            // Fallback if no file ID could be extracted
            window.open(video.video_url, '_blank')
            markComplete(video.id)
            return
        }

        // ── YouTube / external HTTP links ────────────────────────────────
        if (video.video_url.startsWith('http') && !video.video_url.includes('supabase.co/storage')) {
            setVideoType('native')
            setSignedUrl(video.video_url)
            return
        }

        // ── Supabase Storage ─────────────────────────────────────────────
        try {
            setLoadingVideo(true)

            let path = video.video_url
            if (path.includes('/storage/v1/object/public/videos/')) {
                path = path.split('/storage/v1/object/public/videos/')[1]
            } else if (path.includes('/storage/v1/object/sign/videos/')) {
                path = path.split('/storage/v1/object/sign/videos/')[1].split('?')[0]
            }

            const { data, error } = await supabase.storage
                .from('videos')
                .createSignedUrl(path, 7200)

            if (error) throw error
            setVideoType('native')
            setSignedUrl(data.signedUrl)
        } catch (err) {
            console.error('Error getting signed URL:', err)
            alert('Failed to load video. Please try again.')
        } finally {
            setLoadingVideo(false)
        }
    }

    async function markComplete(sessionId) {
        // ... (existing code)
        const { error } = await supabase.from('video_progress').upsert({
            student_id: profile.id,
            course_id: courseId,
            video_id: sessionId
        }, { onConflict: 'student_id,video_id' })

        if (!error || error.code === '23505') {
            setProgress(prev => ({
                ...(prev || {}),
                video_progress: [...(prev?.video_progress || []), { video_id: sessionId }]
            }))
            updateOverallProgress()
        }
    }

    async function handleSaveNote(noteData) {
        if (!profile?.id || !courseId) return
        try {
            setSavingNote(true)
            const payload = {
                student_id: profile.id,
                course_id: courseId,
                title: noteData.title || 'Untitled Note',
                content: noteData.content || '',
                day_number: noteData.day_number ?? null
            }

            if (noteData.id) {
                const { data: updated, error } = await supabase
                    .from('student_notes')
                    .update(payload)
                    .eq('id', noteData.id)
                    .select()
                    .single()
                if (error) throw error
                setNotes(prev => prev.map(n => n.id === updated.id ? updated : n))
            } else {
                const { data: created, error } = await supabase
                    .from('student_notes')
                    .insert(payload)
                    .select()
                    .single()
                if (error) throw error
                setNotes(prev => [created, ...prev])
            }
            setIsAddingNote(false)
            setActiveNote(null)
        } catch (err) {
            console.error('Error saving note:', err)
            alert('Failed to save note. Please try again.')
        } finally {
            setSavingNote(false)
        }
    }

    async function handleDeleteNote(noteId) {
        if (!window.confirm('Are you sure you want to delete this note?')) return
        try {
            const { error } = await supabase
                .from('student_notes')
                .delete()
                .eq('id', noteId)
            if (error) throw error
            setNotes(prev => prev.filter(n => n.id !== noteId))
            if (activeNote?.id === noteId) {
                setActiveNote(null)
                setIsAddingNote(false)
            }
        } catch (err) {
            console.error('Error deleting note:', err)
        }
    }

    const getDayStatus = (dayNum) => {
        const access = dayAccess.find(a => a.day_number === dayNum)
        if (!access) return { locked: false, reason: '' } // Default to open if no specific batch rule? Or maybe default to locked?

        if (access.is_locked) return { locked: true, reason: 'Locked by Instructor' }

        if (access.open_time && new Date(access.open_time) > new Date()) {
            return { locked: true, reason: `Opens at ${new Date(access.open_time).toLocaleString()}` }
        }

        if (access.close_time && new Date(access.close_time) < new Date()) {
            return { locked: true, reason: 'Access Period Ended' }
        }

        return { locked: false, reason: '' }
    }

    const daysCount = Math.max(1, ...[
        ...sessions.map(s => s.day_number),
        ...challenges.map(c => c.day_number),
        ...Object.values(assessments).flat().map(a => a.day_number),
        ...courseResources.map(r => r.day_number)
    ].filter(d => d !== null))


    if (loading) return <div style={{ color: 'var(--text-muted)', padding: '2rem' }}>Loading...</div>

    const isStudent = profile?.role === 'student'
    const hasStarted = !course?.start_date || new Date(course.start_date) <= new Date()

    if (isStudent && !hasStarted) {
        return (
            <div className="animate-fade-in" style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                <div style={{ width: 80, height: 80, background: 'rgba(99,102,241,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <Clock size={40} color="#6366f1" />
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Course Starting Soon</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 2rem' }}>
                    This course is scheduled to start on <strong style={{color: 'var(--text-primary)'}}>{new Date(course.start_date).toLocaleString()}</strong>.
                    <br />Please check back then to access your lessons and materials.
                </p>
                <button onClick={() => navigate('/student/courses')} className="btn-secondary">
                    Back to My Courses
                </button>
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            {/* Cinematic Video Modal */}
            {activeVideo && (
                activeVideo.slide_url ? (
                    <SplitViewer 
                        videoUrl={signedUrl || (videoType === 'drive-iframe' ? activeVideo.video_url : null)}
                        slideUrl={activeVideo.slide_url}
                        videoType={videoType}
                        title={activeVideo.title}
                        onClose={() => { setActiveVideo(null); setSignedUrl(null); setVideoType('native') }}
                        onEnded={() => markComplete(activeVideo.id)}
                        loadingVideo={loadingVideo}
                    />
                ) : (
                    <div style={{ 
                        position: 'fixed', 
                        inset: 0, 
                        zIndex: 10000, 
                        background: 'rgba(0,0,0,0.95)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        padding: '2rem',
                        backdropFilter: 'blur(10px)',
                        animation: 'fadeIn 0.3s ease-out'
                    }}>
                        <div style={{ width: '100%', maxWidth: '1100px', position: 'relative' }}>
                            {/* Modal Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                                    <h2 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{activeVideo.title}</h2>
                                </div>
                                <button 
                                    onClick={() => { setActiveVideo(null); setSignedUrl(null); setVideoType('native') }} 
                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '0.6rem', cursor: 'pointer', color: 'white', display: 'flex' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Player Container */}
                            <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
                                {loadingVideo ? (
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: '1rem' }}>
                                        <div className="animate-spin" style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%' }} />
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Securing your connection...</span>
                                    </div>
                                ) : signedUrl ? (
                                    videoType === 'drive-iframe' ? (
                                        // Google Drive Preview iframe
                                        <iframe
                                            src={signedUrl}
                                            width="100%"
                                            height="100%"
                                            style={{ position: 'absolute', top: 0, left: 0, border: 'none' }}
                                            allow="autoplay; fullscreen"
                                            allowFullScreen
                                            title={activeVideo.title}
                                        />
                                    ) : (
                                        // ReactPlayer for Supabase/YouTube/other URLs
                                        <ReactPlayer
                                            url={signedUrl}
                                            controls
                                            playing={true}
                                            width="100%"
                                            height="100%"
                                            style={{ position: 'absolute', top: 0, left: 0 }}
                                            onEnded={() => markComplete(activeVideo.id)}
                                            config={{
                                                file: {
                                                    attributes: {
                                                        controlsList: 'nodownload',
                                                        disablePictureInPicture: true,
                                                        onContextMenu: e => e.preventDefault()
                                                    }
                                                }
                                            }}
                                        />
                                    )
                                ) : null}
                            </div>

                            {/* Modal Footer */}
                            <div style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    <Lock size={14} />
                                    <span>Secured by Learnova Protection System</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            )}

            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{course?.title}</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>{course?.description}</p>
                    </div>
                    {(course?.start_date || course?.end_date) && (
                        <div style={{ textAlign: 'right', background: 'rgba(99,102,241,0.05)', padding: '0.85rem 1.25rem', borderRadius: 12, border: '1px solid rgba(99,102,241,0.1)' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Course Timeline</div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={14} color="#6366f1" />
                                {course.start_date ? new Date(course.start_date).toLocaleDateString() : 'TBA'} - {course.end_date ? new Date(course.end_date).toLocaleDateString() : 'TBA'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress banner */}
            {progress && (
                <div className="glass-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Your Progress</span>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-light)' }}>{progress.completion_percentage}%</span>
                        </div>
                        <div className="progress-bar-track">
                            <div className="progress-bar-fill" style={{ width: `${progress.completion_percentage}%` }} />
                        </div>
                    </div>
                </div>
            )}



            {/* Course Journey Timeline */}
            {weeks.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <CourseJourneyTimeline 
                        course={course}
                        sessions={sessions}
                        challenges={challenges}
                        courseResources={courseResources}
                        assessments={assessments}
                        progress={progress}
                        getScheduleDate={getScheduleDate}
                        onModuleAction={(type, module) => {
                            const content = module._content;
                            if (!content) return;
                            
                            if (type === 'video' || type === 'watch') {
                                handleWatchVideo(content)
                            } else if (type === 'live') {
                                navigate(`/student/classroom/${content.id}`)
                            } else if (type === 'coding') {
                                navigate(`/student/coding/${content.id}`)
                            } else if (type === 'assessment') {
                                navigate(`/student/assessments/${content.id}/take`)
                            } else if (type === 'resource') {
                                if (content.url) window.open(content.url, '_blank')
                            }
                        }}
                    />
                </div>
            )}

            {/* Weekly Completion Modal */}
            {showWeeklyModal && completedWeekInfo && (
                <WeeklyCompletionModal
                    isVisible={showWeeklyModal}
                    weekNumber={completedWeekInfo.weekNumber}
                    xpEarned={completedWeekInfo.xpEarned}
                    coinsEarned={completedWeekInfo.coinsEarned}
                    grade={completedWeekInfo.grade}
                    nextWeekNumber={completedWeekInfo.nextWeekNumber}
                    onClose={() => setShowWeeklyModal(false)}
                    onContinue={() => {
                        setShowWeeklyModal(false)
                        refreshProgress()
                    }}
                />
            )}

            {/* XP Toast */}
            {toastMessage && (
                <div style={{
                    position: 'fixed',
                    bottom: 24,
                    right: 24,
                    zIndex: 10001,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    padding: '0.85rem 1.5rem',
                    borderRadius: 14,
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
                    animation: 'fadeInUp 0.3s ease-out',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                }}>
                    <span>{toastMessage.text}</span>
                    {toastMessage.reason && (
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{toastMessage.reason}</span>
                    )}
                </div>
            )}


            <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '2px dashed var(--card-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <FileText size={22} /> Notes
                    </h2>
                    {!isAddingNote && !activeNote && (
                        <button 
                            onClick={() => { setIsAddingNote(true); setActiveNote({ title: '', content: '', day_number: selectedDay }) }} 
                            className="btn-primary" 
                            style={{ padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, background: '#3b82f6', border: 'none', borderRadius: 8, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(59,130,246,0.2)' }}
                        >
                            <Plus size={18} /> NEW NOTE
                        </button>
                    )}
                </div>

                {/* Note Editor */}
                {(isAddingNote || activeNote) && (
                    <div className="glass-card animate-slide-up" style={{ padding: 0, overflow: 'hidden', border: '1px solid #e2e8f0', background: 'white', marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', gap: '0.85rem', color: 'var(--text-muted)' }}>
                                <span style={{ fontWeight: 800 }}>B</span>
                                <span style={{ fontStyle: 'italic' }}>I</span>
                                <span style={{ textDecoration: 'underline' }}>U</span>
                                <span style={{ textDecoration: 'line-through' }}>S</span>
                                <List size={16} />
                                <Edit2 size={16} />
                                <ExternalLink size={16} />
                            </div>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <input
                                value={activeNote?.title || ''}
                                onChange={(e) => setActiveNote(p => ({ ...p, title: e.target.value }))}
                                placeholder="Title"
                                style={{ width: '100%', border: 'none', outline: 'none', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Assign to:</span>
                                <select 
                                    value={activeNote?.day_number || ''} 
                                    onChange={(e) => setActiveNote(p => ({ ...p, day_number: e.target.value ? Number.parseInt(e.target.value) : null }))}
                                    style={{ padding: '0.2rem 0.5rem', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: '0.8rem' }}
                                >
                                    <option value="">General (No Day)</option>
                                    {Array.from({ length: daysCount }, (_, i) => i + 1).map(d => (
                                        <option key={d} value={d}>Day {d}</option>
                                    ))}
                                </select>
                            </div>
                            <textarea
                                value={activeNote?.content || ''}
                                onChange={(e) => setActiveNote(p => ({ ...p, content: e.target.value }))}
                                placeholder="Take a Note"
                                style={{ width: '100%', border: 'none', outline: 'none', fontSize: '1rem', color: 'var(--text-secondary)', minHeight: '150px', resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    <Clock size={14} /> 
                                    <span>{savingNote ? 'Saving...' : 'Not Saved'}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.85rem' }}>
                                    <button 
                                        onClick={() => { setIsAddingNote(false); setActiveNote(null) }} 
                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => handleSaveNote(activeNote)} 
                                        disabled={savingNote}
                                        className="btn-primary" 
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', gap: '0.4rem', background: '#3b82f6' }}
                                    >
                                        <Save size={16} /> {activeNote?.id ? 'Update' : 'Save'} Note
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Notes List Grouped by Day */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {notes.length === 0 && !isAddingNote && !activeNote ? (
                        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(99,102,241,0.03)', borderRadius: 20, border: '1px dashed var(--card-border)' }}>
                            <FileText size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Notes Yet</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Start your first note to keep track of important points during your learning!</p>
                        </div>
                    ) : (
                        [...new Set(notes.map(n => n.day_number))].sort((a,b) => (a||0) - (b||0)).map(day => (
                            <div key={day || 'general'}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
                                    <div style={{ padding: '0.3rem 0.8rem', background: day ? 'rgba(59,130,246,0.1)' : 'rgba(148,163,184,0.1)', color: day ? '#3b82f6' : 'var(--text-muted)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 700 }}>
                                        {day ? `Day ${day} Notes` : 'General Notes'}
                                    </div>
                                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--card-border), transparent)' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                    {notes.filter(n => n.day_number === day).map(note => (
                                        <div key={note.id} className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', border: '1px solid var(--card-border)', background: 'white' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                                                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>{note.title}</h4>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button onClick={() => setActiveNote(note)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} title="Edit">
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button onClick={() => handleDeleteNote(note.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} title="Delete">
                                                        <Trash2 size={16} color="#ef4444" />
                                                    </button>
                                                </div>
                                            </div>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                                            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                <Calendar size={12} /> {new Date(note.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
