import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../../lib/supabase'
import { BarChart2, Users, Clock, AlertTriangle, UserMinus, Download, X, Loader, Trash2 } from 'lucide-react'
import { useMeeting } from '../../contexts/MeetingContext'

export default function SessionAnalyticsModal({ modalData, onClose }) {
    const { deleteRecordingFromDrive } = useMeeting()
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [videoInfo, setVideoInfo] = useState(null)
    const [metrics, setMetrics] = useState({
        attendancePct: 0,
        present: 0,
        late: 0,
        leftEarly: 0,
        avgDurationMins: 0,
        totalEnrolled: 0
    })

    useEffect(() => {
        if (modalData?.videoId) {
            loadAnalytics()
        }
    }, [modalData])

    async function loadAnalytics() {
        setLoading(true)
        try {
            const vidId = modalData.videoId
            const scheduledTimeStr = modalData.videoData?.scheduled_time

            // Fetch live_attendance for this video
            const { data: attendanceData } = await supabase
                .from('live_attendance')
                .select('*')
                .eq('video_id', vidId)

            const { data: videoData } = await supabase
                .from('videos')
                .select('recording_status, drive_file_id')
                .eq('id', vidId)
                .single()
            
            if (videoData) {
                setVideoInfo(videoData)
            }

            // If we want total enrolled, we need to fetch enrollments for this course
            const courseId = modalData.videoData?.course_id
            let totalEnrolled = 0
            if (courseId) {
                const { count } = await supabase
                    .from('enrollments')
                    .select('*', { count: 'exact', head: true })
                    .eq('course_id', courseId)
                totalEnrolled = count || 0
            }

            if (!attendanceData || attendanceData.length === 0) {
                setMetrics({ attendancePct: 0, present: 0, late: 0, leftEarly: 0, avgDurationMins: 0, totalEnrolled })
                setLoading(false)
                return
            }

            // Calculate metrics
            const scheduledTime = scheduledTimeStr ? new Date(scheduledTimeStr).getTime() : 0
            let presentCount = 0
            let lateCount = 0
            let leftEarlyCount = 0
            let totalDurationSeconds = 0

            // Estimate total class duration (since it just ended)
            const classStartTime = scheduledTime || Math.min(...attendanceData.map(a => new Date(a.time_joined).getTime()))
            const classDurationSeconds = Math.max(0, (Date.now() - classStartTime) / 1000)

            attendanceData.forEach(record => {
                if (record.attendance_status === 'present') {
                    presentCount++
                }

                // Calculate duration
                const joined = new Date(record.time_joined).getTime()
                let left = Date.now()
                if (record.time_left) {
                    left = new Date(record.time_left).getTime()
                }
                const durationSec = Math.max(0, (left - joined) / 1000)
                totalDurationSeconds += durationSec

                // Late Check: > 10 mins after scheduled start
                if (scheduledTime && (joined - scheduledTime > 10 * 60 * 1000)) {
                    lateCount++
                }

                // Left Early Check: Duration < 50% of class duration
                if (classDurationSeconds > 0 && durationSec < (classDurationSeconds * 0.5)) {
                    leftEarlyCount++
                }
            })

            const attendancePct = totalEnrolled > 0 ? Math.round((presentCount / totalEnrolled) * 100) : 0
            const avgDurationMins = attendanceData.length > 0 ? Math.round((totalDurationSeconds / attendanceData.length) / 60) : 0

            setMetrics({
                attendancePct,
                present: presentCount,
                late: lateCount,
                leftEarly: leftEarlyCount,
                avgDurationMins,
                totalEnrolled
            })

        } catch (err) {
            console.error('Failed to load session analytics', err)
        } finally {
            setLoading(false)
        }
    }

    const exportCSV = () => {
        // Implement CSV export logic later if needed
        alert('CSV Export will be implemented soon.')
    }

    const handleDeleteRecording = async () => {
        if (!videoInfo?.drive_file_id) return
        if (!confirm('Are you sure you want to delete this recording from Google Drive and the database? This cannot be undone.')) return
        
        setDeleting(true)
        try {
            const success = await deleteRecordingFromDrive(modalData.videoId, videoInfo.drive_file_id)
            if (success) {
                setVideoInfo(prev => ({ ...prev, drive_file_id: null, recording_status: null }))
            }
        } finally {
            setDeleting(false)
        }
    }

    if (!modalData) return null

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 999999,
            background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem', animation: 'fadeIn 0.2s ease-out'
        }}>
            <div className="glass-card animate-slide-up" style={{
                background: 'white', width: '100%', maxWidth: 500,
                borderRadius: 20, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BarChart2 size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Session Analytics</h2>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{modalData.videoData?.title || 'Live Class'}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }} className="hover-scale">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '2rem' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                            <Loader className="animate-spin" size={32} style={{ marginBottom: '1rem', color: '#6366f1' }} />
                            <p style={{ margin: 0, fontWeight: 500 }}>Crunching attendance data...</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Main Stat */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '3.5rem', fontWeight: 900, color: '#4f46e5', lineHeight: 1 }}>{metrics.attendancePct}%</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Attendance</div>
                            </div>

                            {/* Sub Stats Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ color: '#10b981' }}><Users size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.present} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ {metrics.totalEnrolled}</span></div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Present</div>
                                    </div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ color: '#6366f1' }}><Clock size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.avgDurationMins}m</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Avg Duration</div>
                                    </div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ color: '#f59e0b' }}><AlertTriangle size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.late}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Late</div>
                                    </div>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ color: '#ef4444' }}><UserMinus size={20} /></div>
                                    <div>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{metrics.leftEarly}</div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Left Early</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '1.5rem', borderTop: '1px solid var(--card-border)', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button onClick={onClose} style={{ flex: 1, padding: '0.85rem', background: 'white', border: '1px solid var(--card-border)', borderRadius: 10, fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }} className="hover-scale">
                            Close
                        </button>
                        <button onClick={exportCSV} disabled={loading} style={{ flex: 1, padding: '0.85rem', background: '#4f46e5', border: 'none', borderRadius: 10, fontWeight: 600, color: 'white', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} className="hover-scale">
                            <Download size={18} /> Export CSV
                        </button>
                    </div>
                    
                    {videoInfo?.drive_file_id && (
                        <button onClick={handleDeleteRecording} disabled={deleting} style={{ width: '100%', padding: '0.85rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontWeight: 600, color: '#ef4444', cursor: deleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} className="hover-scale">
                            {deleting ? <Loader size={18} className="animate-spin" /> : <Trash2 size={18} />}
                            {deleting ? 'Deleting...' : 'Delete Recording'}
                        </button>
                    )}
                </div>
            </div>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                .animate-slide-up { animation: slideUp 0.3s ease-out forwards; }
            `}</style>
        </div>
    )
}

SessionAnalyticsModal.propTypes = {
    modalData: PropTypes.object,
    onClose: PropTypes.func.isRequired
}
