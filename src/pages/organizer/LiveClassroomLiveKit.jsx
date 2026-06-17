import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/Toast'
import { Loader2, Video, VideoOff, Mic, MicOff, MonitorUp, PhoneOff, MessageSquare, BarChart2, Edit3, Users, Maximize, Minimize, Hand, UserCheck, Play, StopCircle } from 'lucide-react'

import LiveNotes from '../../components/live-classroom/LiveNotes'
import LivePolls from '../../components/live-classroom/LivePolls'
import LiveAttendance from '../../components/live-classroom/LiveAttendance'
import LiveQA from '../../components/live-classroom/LiveQA'
import LiveHandRaise from '../../components/live-classroom/LiveHandRaise'

import {
    LiveKitRoom,
    VideoTrack,
    AudioTrack,
    useParticipants,
    useLocalParticipant,
    useTracks,
    useRoomContext,
    useConnectionState
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track, RoomEvent, ConnectionState } from 'livekit-client'

// Constants
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://meet.learnova.com'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

// ─── Participant Tile ────────────────────────────────────────────────────────
function ParticipantTile({ participant, isLocal }) {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.Microphone, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    )

    const participantTracks = tracks.filter(t => t.participant.identity === participant.identity)
    const cameraTrack = participantTracks.find(t => t.source === Track.Source.Camera && t.publication?.track)
    const screenTrack = participantTracks.find(t => t.source === Track.Source.ScreenShare && t.publication?.track)
    const audioTrack = participantTracks.find(t => t.source === Track.Source.Microphone && t.publication?.track)

    const isMuted = !participant.isMicrophoneEnabled
    const isCameraOff = !participant.isCameraEnabled
    const displayTrack = screenTrack || cameraTrack
    const shouldShowVideo = displayTrack?.publication?.track && (displayTrack === screenTrack || !isCameraOff)

    let metadata = {}
    try { metadata = JSON.parse(participant.metadata || '{}') } catch {}
    const name = participant.name || metadata.name || participant.identity
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

    return (
        <div style={{
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            background: 'linear-gradient(145deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
            border: participant.isSpeaking ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: participant.isSpeaking ? '0 0 20px rgba(99,102,241,0.3)' : 'none',
            transition: 'all 0.3s ease',
            aspectRatio: '16/9',
            minHeight: 0,
        }}>
            {/* Audio Track */}
            {audioTrack?.publication?.track && !isLocal && (
                <AudioTrack trackRef={audioTrack} />
            )}

            {/* Video or Avatar */}
            {shouldShowVideo ? (
                <VideoTrack
                    trackRef={displayTrack}
                    style={{ width: '100%', height: '100%', objectFit: displayTrack === screenTrack ? 'contain' : 'cover', background: 'black' }}
                />
            ) : (
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(145deg, #1e293b, #0f172a)'
                }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.5rem', fontWeight: 700, color: 'white',
                        boxShadow: '0 4px 20px rgba(99,102,241,0.3)'
                    }}>
                        {initials}
                    </div>
                </div>
            )}

            {/* Screen Share Badge */}
            {screenTrack?.publication?.track && (
                <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(99,102,241,0.9)', color: 'white',
                    padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4
                }}>
                    <MonitorUp size={12} /> Screen
                </div>
            )}

            {/* Bottom Bar: Name + Mic Status */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '24px 12px 8px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <span style={{
                    color: 'white', fontSize: '0.8rem', fontWeight: 600,
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: 'calc(100% - 30px)'
                }}>
                    {name}{isLocal ? ' (You)' : ''}
                </span>
                <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: isMuted ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                }}>
                    {isMuted ? <MicOff size={12} color="white" /> : <Mic size={12} color="white" />}
                </div>
            </div>

            {/* Speaking Indicator */}
            {participant.isSpeaking && (
                <div style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 10, height: 10, borderRadius: '50%',
                    background: '#22c55e', boxShadow: '0 0 8px #22c55e',
                    animation: 'pulse 1.5s infinite'
                }} />
            )}
        </div>
    )
}

// ─── Video Grid ──────────────────────────────────────────────────────────────
function VideoGrid() {
    const participants = useParticipants()
    const localParticipant = useLocalParticipant()

    const allParticipants = participants
    const count = allParticipants.length

    // Dynamic grid sizing
    let cols = 1
    if (count === 2) cols = 2
    else if (count <= 4) cols = 2
    else if (count <= 9) cols = 3
    else if (count <= 16) cols = 4
    else cols = 5

    return (
        <div style={{
            flex: 1, display: 'grid', padding: '1rem', gap: '0.75rem',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridAutoRows: '1fr',
            alignContent: count <= 2 ? 'center' : 'start',
            overflow: 'auto',
        }}>
            {allParticipants.map(p => (
                <ParticipantTile
                    key={p.identity}
                    participant={p}
                    isLocal={p.identity === localParticipant.localParticipant?.identity}
                />
            ))}
        </div>
    )
}

// ─── Control Bar ─────────────────────────────────────────────────────────────
function MeetControlBar({ onLeave }) {
    const room = useRoomContext()
    const localParticipant = useLocalParticipant()
    const [isMicOn, setIsMicOn] = useState(true)
    const [isCamOn, setIsCamOn] = useState(true)
    const [isScreenSharing, setIsScreenSharing] = useState(false)

    const lp = localParticipant.localParticipant

    // Sync state with actual track state
    useEffect(() => {
        if (lp) {
            setIsMicOn(lp.isMicrophoneEnabled)
            setIsCamOn(lp.isCameraEnabled)
            setIsScreenSharing(lp.isScreenShareEnabled)
        }
    }, [lp?.isMicrophoneEnabled, lp?.isCameraEnabled, lp?.isScreenShareEnabled])

    const toggleMic = async () => {
        if (!lp) return
        await lp.setMicrophoneEnabled(!isMicOn)
        setIsMicOn(!isMicOn)
    }

    const toggleCam = async () => {
        if (!lp) return
        await lp.setCameraEnabled(!isCamOn)
        setIsCamOn(!isCamOn)
    }

    const toggleScreen = async () => {
        if (!lp) return
        try {
            await lp.setScreenShareEnabled(!isScreenSharing)
            setIsScreenSharing(!isScreenSharing)
        } catch (err) {
            console.error('Screen share error:', err)
        }
    }

    const btnStyle = (active, danger) => ({
        width: 48, height: 48, borderRadius: '50%',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
        background: danger ? '#ef4444' : active ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.15)',
        color: danger ? 'white' : active ? 'white' : '#ef4444',
        boxShadow: danger ? '0 4px 15px rgba(239,68,68,0.4)' : 'none',
    })

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem',
            padding: '1rem 2rem',
            background: 'rgba(15,23,42,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
            {/* Mic */}
            <button onClick={toggleMic} style={btnStyle(isMicOn)} title={isMicOn ? 'Mute' : 'Unmute'}>
                {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            {/* Camera */}
            <button onClick={toggleCam} style={btnStyle(isCamOn)} title={isCamOn ? 'Camera Off' : 'Camera On'}>
                {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            {/* Screen Share */}
            <button onClick={toggleScreen} style={{
                ...btnStyle(true),
                background: isScreenSharing ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)',
                color: isScreenSharing ? '#818cf8' : 'white'
            }} title="Share Screen">
                <MonitorUp size={20} />
            </button>

            {/* Leave */}
            <button onClick={onLeave} style={btnStyle(false, true)} title="Leave Meeting">
                <PhoneOff size={20} />
            </button>
        </div>
    )
}

// ─── Connection Status Banner ─────────────────────────────────────────────────
function ConnectionBanner() {
    const connectionState = useConnectionState()

    if (connectionState === ConnectionState.Connected) return null

    const messages = {
        [ConnectionState.Connecting]: { text: 'Connecting to Learnova Meet...', bg: '#6366f1' },
        [ConnectionState.Reconnecting]: { text: 'Reconnecting... please wait', bg: '#f59e0b' },
        [ConnectionState.Disconnected]: { text: 'Disconnected from meeting', bg: '#ef4444' },
    }

    const msg = messages[connectionState] || { text: 'Connecting...', bg: '#6366f1' }

    return (
        <div style={{
            background: msg.bg, color: 'white', padding: '0.5rem',
            textAlign: 'center', fontSize: '0.8rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
            <Loader2 size={14} className="animate-spin" /> {msg.text}
        </div>
    )
}

// ─── Room Content (inside LiveKitRoom context) ───────────────────────────────
function RoomContent({ videoId, videoData, isOrganizer, profile, channelInstance, sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, onLeave, refreshStats, toast }) {
    const room = useRoomContext()
    const joinTimeRef = useRef(Date.now())
    const attendanceMarkedRef = useRef(false)
    const attendanceIntervalRef = useRef(null)
    const containerRef = useRef(null)
    const [isFullScreen, setIsFullScreen] = useState(false)

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullScreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    const toggleFullScreen = () => {
        if (!document.fullscreenElement && containerRef.current) {
            containerRef.current.requestFullscreen().catch(err => console.log(err))
        } else if (document.fullscreenElement) {
            document.exitFullscreen()
        }
    }

    // ── Attendance Tracking ──
    useEffect(() => {
        if (isOrganizer || !profile?.id || !videoData) return

        joinTimeRef.current = Date.now()

        // Initial insert
        supabase.from('live_attendance').upsert({
            student_id: profile.id,
            video_id: videoData.id,
            course_id: videoData.course_id,
            joined_at: new Date(joinTimeRef.current).toISOString()
        }, { onConflict: 'student_id,video_id' }).then(({ error }) => {
            if (error) console.error('Failed to init attendance:', error)
        })

        // Duration tracking
        attendanceIntervalRef.current = setInterval(async () => {
            const durationSec = Math.floor((Date.now() - joinTimeRef.current) / 1000)
            const isSufficient = durationSec >= 300 // 5 minutes

            const updateData = {
                student_id: profile.id,
                video_id: videoData.id,
                left_at: new Date().toISOString(),
                duration_seconds: durationSec
            }

            if (isSufficient && !attendanceMarkedRef.current) {
                updateData.attendance_status = 'present'
                updateData.streak_awarded = true
                attendanceMarkedRef.current = true

                toast.success('🎉 Attendance Marked! +20 XP earned')

                const { data: userProfile } = await supabase.from('users').select('xp').eq('id', profile.id).single()
                if (userProfile) {
                    await supabase.from('users').update({ xp: (userProfile.xp || 0) + 20 }).eq('id', profile.id)
                    refreshStats()
                }
            } else if (!attendanceMarkedRef.current) {
                updateData.attendance_status = 'insufficient_time'
            }

            supabase.from('live_attendance').upsert(updateData, { onConflict: 'student_id,video_id' })
                .then(({ error }) => { if (error) console.error(error) })
        }, 10000)

        return () => {
            if (attendanceIntervalRef.current) clearInterval(attendanceIntervalRef.current)
        }
    }, [videoData, profile?.id, isOrganizer])

    const handleLeave = useCallback(() => {
        if (attendanceIntervalRef.current) clearInterval(attendanceIntervalRef.current)

        if (!isOrganizer && !attendanceMarkedRef.current && joinTimeRef.current) {
            const durationSec = Math.floor((Date.now() - joinTimeRef.current) / 1000)
            toast.warning(`⚠️ You attended only ${Math.floor(durationSec / 60)} minutes. Stay at least 5 mins for credit.`)

            supabase.from('live_attendance').upsert({
                student_id: profile.id,
                video_id: videoData.id,
                left_at: new Date().toISOString(),
                duration_seconds: durationSec,
                attendance_status: 'insufficient_time'
            }, { onConflict: 'student_id,video_id' }).then()
        }

        room.disconnect()
        onLeave()
    }, [room, isOrganizer, profile, videoData])

    return (
        <div ref={containerRef} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#020617' }}>
            {/* Top Bar */}
            <div style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(15, 23, 42, 0.95)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
                backdropFilter: 'blur(12px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Video size={16} color="white" />
                    </div>
                    <div>
                        <h1 style={{ color: 'white', fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>
                            {videoData?.title}
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', margin: 0 }}>
                            Learnova Meet • {isOrganizer ? 'Instructor' : 'Student'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ParticipantCount />
                    <button onClick={toggleFullScreen} style={{
                        background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                        border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.75rem',
                        borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.3rem'
                    }}>
                        {isFullScreen ? <><Minimize size={14} /> Exit</> : <><Maximize size={14} /> Full</>}
                    </button>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
                        background: sidebarOpen ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                        color: sidebarOpen ? '#818cf8' : 'var(--text-muted)',
                        border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.75rem',
                        borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer'
                    }}>
                        {sidebarOpen ? 'Close Panel' : 'Open Panel'}
                    </button>
                </div>
            </div>

            {/* Connection Banner */}
            <ConnectionBanner />

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', width: '100%', overflow: 'hidden' }}>
                {/* Video Grid */}
                <VideoGrid />

                {/* Sidebar */}
                {sidebarOpen && channelInstance && (
                    <div style={{
                        width: '360px', background: 'rgba(15,23,42,0.98)',
                        borderLeft: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex', flexDirection: 'column',
                        backdropFilter: 'blur(12px)'
                    }}>
                        <div style={{
                            display: 'flex', padding: '0.5rem', gap: '0.4rem',
                            borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto'
                        }}>
                            {[
                                { id: 'notes', icon: Edit3, label: 'Notes' },
                                { id: 'polls', icon: BarChart2, label: 'Polls' },
                                { id: 'qa', icon: MessageSquare, label: 'Q&A' },
                                ...(isOrganizer ? [{ id: 'attendance', icon: Users, label: 'Att.' }] : []),
                            ].map(tab => (
                                <button key={tab.id} onClick={() => setSidebarTab(tab.id)} style={{
                                    flex: 1, padding: '0.5rem',
                                    background: sidebarTab === tab.id ? '#6366f1' : 'transparent',
                                    color: sidebarTab === tab.id ? 'white' : 'var(--text-muted)',
                                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '0.3rem', fontSize: '0.8rem', minWidth: '60px'
                                }}>
                                    <tab.icon size={14} /> {tab.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {sidebarTab === 'notes' && <LiveNotes videoId={videoId} isOrganizer={isOrganizer} channel={channelInstance} />}
                            {sidebarTab === 'polls' && <LivePolls videoId={videoId} isOrganizer={isOrganizer} channel={channelInstance} />}
                            {sidebarTab === 'qa' && <LiveQA videoId={videoId} isOrganizer={isOrganizer} channel={channelInstance} />}
                            {sidebarTab === 'attendance' && isOrganizer && <LiveAttendance videoId={videoId} isOrganizer={isOrganizer} videoTitle={videoData?.title} />}
                        </div>
                    </div>
                )}
            </div>

            {/* Control Bar */}
            <MeetControlBar onLeave={handleLeave} />
        </div>
    )
}

// ─── Participant Count Badge ─────────────────────────────────────────────────
function ParticipantCount() {
    const participants = useParticipants()
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.75rem',
            borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted)'
        }}>
            <Users size={14} /> {participants.length}
        </div>
    )
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function LiveClassroom() {
    const { videoId } = useParams()
    const { profile, refreshStats } = useAuth()
    const navigate = useNavigate()
    const toast = useToast()

    const [videoData, setVideoData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [livekitToken, setLivekitToken] = useState(null)
    const [tokenError, setTokenError] = useState(null)
    const [instructorPresent, setInstructorPresent] = useState(false)
    const [sidebarTab, setSidebarTab] = useState('notes')
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [channelInstance, setChannelInstance] = useState(null)

    const isOrganizer = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)

    // ── Fetch Video Data & Setup Real-time Channel ──
    useEffect(() => {
        let intervalId = null

        async function fetchVideo() {
            const { data, error } = await supabase.from('videos').select('*, courses(title)').eq('id', videoId).single()
            if (error || !data) {
                navigate(profile?.role === 'student' ? '/student/courses' : '/organizer/courses')
                return
            }
            setVideoData(data)
            setLoading(false)

            // Real-time Handshake for instructor presence
            const channel = supabase.channel(`class-lobby-${videoId}`, { config: { broadcast: { self: true } } })
            setChannelInstance(channel)
            channel
                .on('broadcast', { event: 'check_instructor' }, () => {
                    if (isOrganizer) channel.send({ type: 'broadcast', event: 'presence', payload: { instructorJoined: true } })
                })
                .on('broadcast', { event: 'presence' }, (p) => {
                    if (p.payload.instructorJoined) {
                        setInstructorPresent(true)
                        if (intervalId) { clearInterval(intervalId); intervalId = null }
                    }
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        if (isOrganizer) {
                            channel.send({ type: 'broadcast', event: 'presence', payload: { instructorJoined: true } })
                            intervalId = setInterval(() => {
                                channel.send({ type: 'broadcast', event: 'presence', payload: { instructorJoined: true } })
                            }, 3000)
                        } else {
                            channel.send({ type: 'broadcast', event: 'check_instructor', payload: {} })
                            intervalId = setInterval(() => {
                                channel.send({ type: 'broadcast', event: 'check_instructor', payload: {} })
                            }, 3000)
                        }
                    }
                })
        }

        fetchVideo()
        return () => {
            if (intervalId) clearInterval(intervalId)
            if (channelInstance) supabase.removeChannel(channelInstance)
        }
    }, [videoId])

    // ── Fetch LiveKit Token ──
    useEffect(() => {
        const canJoin = isOrganizer || instructorPresent
        if (!canJoin || !videoData || livekitToken) return

        async function fetchToken() {
            try {
                const roomName = `learnova-class-${videoData.id}`
                const { data, error } = await supabase.functions.invoke('livekit-token', {
                    body: { roomName }
                })
                if (error) throw error
                if (data?.error) throw new Error(`Server Error: ${data.error}`)
                if (data?.token) {
                    setLivekitToken(data.token)
                } else {
                    throw new Error('No token returned')
                }
            } catch (err) {
                console.error('Failed to get LiveKit token:', err)
                setTokenError(err.message)
            }
        }

        fetchToken()
    }, [videoData, isOrganizer, instructorPresent])

    // ── Loading State ──
    if (loading) {
        return (
            <div style={{
                height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#020617', flexDirection: 'column', gap: '1rem'
            }}>
                <Loader2 size={32} className="animate-spin" color="#6366f1" />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading class...</p>
            </div>
        )
    }

    // ── Waiting for Instructor ──
    if (!isOrganizer && !instructorPresent) {
        return (
            <div style={{
                height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#020617', color: 'white', textAlign: 'center', padding: '2rem'
            }}>
                <div style={{ maxWidth: 400 }}>
                    <div style={{
                        width: 80, height: 80, background: 'rgba(99,102,241,0.1)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem', animation: 'pulse 2s infinite'
                    }}>
                        <Video size={40} color="#6366f1" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>Waiting for Instructor</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                        The class will start automatically when your teacher joins. Stay tuned!
                    </p>
                </div>
            </div>
        )
    }

    // ── Token Error ──
    if (tokenError) {
        return (
            <div style={{
                height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#020617', color: 'white', textAlign: 'center', padding: '2rem'
            }}>
                <div style={{ maxWidth: 400 }}>
                    <div style={{
                        width: 80, height: 80, background: 'rgba(239,68,68,0.1)',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 1.5rem'
                    }}>
                        <VideoOff size={40} color="#ef4444" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>Connection Error</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        Failed to connect to Learnova Meet. Please try again.
                    </p>
                    <p style={{ color: '#ef4444', fontSize: '0.75rem', marginBottom: '2rem' }}>{tokenError}</p>
                    <button onClick={() => { setTokenError(null); setLivekitToken(null) }} style={{
                        background: '#6366f1', color: 'white', border: 'none',
                        padding: '0.75rem 2rem', borderRadius: 10, cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.9rem'
                    }}>
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    // ── Fetching Token ──
    if (!livekitToken) {
        return (
            <div style={{
                height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#020617', flexDirection: 'column', gap: '1rem'
            }}>
                <Loader2 size={32} className="animate-spin" color="#6366f1" />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Setting up Learnova Meet...</p>
            </div>
        )
    }

    // ── LiveKit Room ──
    return (
        <LiveKitRoom
            serverUrl={LIVEKIT_URL}
            token={livekitToken}
            connect={true}
            audio={isOrganizer}
            video={isOrganizer}
            onDisconnected={() => navigate(-1)}
            style={{ height: '100vh' }}
        >
            <RoomContent
                videoId={videoId}
                videoData={videoData}
                isOrganizer={isOrganizer}
                profile={profile}
                channelInstance={channelInstance}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                sidebarTab={sidebarTab}
                setSidebarTab={setSidebarTab}
                onLeave={() => navigate(-1)}
                refreshStats={refreshStats}
                toast={toast}
            />
        </LiveKitRoom>
    )
}
