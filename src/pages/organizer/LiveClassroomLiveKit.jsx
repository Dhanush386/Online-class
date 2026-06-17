import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/Toast'
import { Loader2, Video, VideoOff, Mic, MicOff, MonitorUp, PhoneOff, MessageSquare, BarChart2, Edit3, Users, Maximize, Minimize, Hand, UserCheck, Play, StopCircle, ZoomIn, ZoomOut, UserPlus, XCircle, CheckCircle, Clock } from 'lucide-react'

import LiveNotes from '../../components/live-classroom/LiveNotes'
import LivePolls from '../../components/live-classroom/LivePolls'
import LiveAttendance from '../../components/live-classroom/LiveAttendance'
import LiveHandRaise from '../../components/live-classroom/LiveHandRaise'

import {
    LiveKitRoom,
    VideoTrack,
    AudioTrack,
    useRemoteParticipants,
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

const TRACK_SOURCES = [
    Track.Source.Camera,
    Track.Source.Microphone,
    Track.Source.ScreenShare,
]

function useDeviceOrientation() {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight)

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768)
            setIsLandscape(window.innerWidth > window.innerHeight)
        }
        window.addEventListener('resize', handleResize)
        handleResize()
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return { isMobile, isLandscape }
}

// ─── Participant Tile ────────────────────────────────────────────────────────
function ParticipantTile({ participant, isLocal, isSpotlight = false, allTracks = [] }) {
    const { isMobile } = useDeviceOrientation()

    const participantTracks = allTracks.filter(t => t.participant.identity === participant.identity)
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

    const [scale, setScale] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const isDragging = useRef(false)
    const lastPos = useRef({ x: 0, y: 0 })

    const handleWheel = (e) => {
        if (!isSpotlight || displayTrack !== screenTrack) return;
        const zoomDelta = e.deltaY * -0.002
        let newScale = Math.min(Math.max(1, scale + zoomDelta), 5)
        setScale(newScale)
        if (newScale === 1) setPan({ x: 0, y: 0 })
    }

    const handlePointerDown = (e) => {
        if (scale <= 1 || !isSpotlight || displayTrack !== screenTrack) return;
        isDragging.current = true
        lastPos.current = { x: e.clientX, y: e.clientY }
        e.target.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e) => {
        if (!isDragging.current) return;
        const dx = e.clientX - lastPos.current.x
        const dy = e.clientY - lastPos.current.y
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
        lastPos.current = { x: e.clientX, y: e.clientY }
    }

    const handlePointerUp = (e) => {
        isDragging.current = false
        if (e.target.hasPointerCapture(e.pointerId)) {
            e.target.releasePointerCapture(e.pointerId)
        }
    }

    const handleZoomIn = () => setScale(s => Math.min(s + 0.5, 5))
    const handleZoomOut = () => setScale(s => {
        const newScale = Math.max(s - 0.5, 1)
        if (newScale === 1) setPan({ x: 0, y: 0 })
        return newScale
    })
    const handleResetZoom = () => {
        setScale(1)
        setPan({ x: 0, y: 0 })
    }

    return (
        <div style={{
            position: 'relative',
            borderRadius: 16,
            overflow: 'hidden',
            background: 'linear-gradient(145deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))',
            border: participant.isSpeaking ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
            boxShadow: participant.isSpeaking ? '0 0 20px rgba(99,102,241,0.3)' : 'none',
            transition: 'all 0.3s ease',
            aspectRatio: isSpotlight ? 'auto' : '16/9',
            width: '100%',
            height: (isMobile && !isSpotlight) ? 'auto' : '100%',
            minHeight: (isMobile && !isSpotlight) ? '180px' : 0,
        }}>
            {/* Audio Track */}
            {audioTrack?.publication?.track && !isLocal && (
                <AudioTrack trackRef={audioTrack} />
            )}

            {/* Video or Avatar */}
            {shouldShowVideo ? (
                <div 
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    style={{ 
                        width: '100%', height: '100%', 
                        overflow: 'hidden',
                        touchAction: scale > 1 ? 'none' : 'auto'
                    }}
                >
                    <div style={{
                        width: '100%', height: '100%',
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                        transformOrigin: 'center',
                        transition: isDragging.current ? 'none' : 'transform 0.1s ease',
                        cursor: scale > 1 ? (isDragging.current ? 'grabbing' : 'grab') : 'auto'
                    }}>
                        <VideoTrack
                            trackRef={displayTrack}
                            style={{ width: '100%', height: '100%', objectFit: displayTrack === screenTrack ? 'contain' : 'cover', background: 'black', pointerEvents: 'none' }}
                        />
                    </div>
                </div>
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

            {/* Zoom Controls (only if screen share in spotlight) */}
            {displayTrack === screenTrack && isSpotlight && (
                <div style={{
                    position: 'absolute', top: 8, right: participant.isSpeaking ? 24 : 8,
                    display: 'flex', alignItems: 'center', gap: 4, 
                    background: 'rgba(15,23,42,0.8)', padding: '4px 8px', borderRadius: 8, zIndex: 10,
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <button onClick={handleZoomOut} disabled={scale <= 1} style={{ background: 'transparent', border: 'none', color: scale > 1 ? 'white' : 'rgba(255,255,255,0.3)', cursor: scale > 1 ? 'pointer' : 'default', padding: 4, display: 'flex' }}><ZoomOut size={16} /></button>
                    <button onClick={handleResetZoom} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0 8px', fontSize: '0.75rem', fontWeight: 600, minWidth: '48px' }}>{Math.round(scale * 100)}%</button>
                    <button onClick={handleZoomIn} disabled={scale >= 5} style={{ background: 'transparent', border: 'none', color: scale < 5 ? 'white' : 'rgba(255,255,255,0.3)', cursor: scale < 5 ? 'pointer' : 'default', padding: 4, display: 'flex' }}><ZoomIn size={16} /></button>
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
    const remoteParticipants = useRemoteParticipants()
    const { localParticipant } = useLocalParticipant()
    const rawTracks = useTracks(TRACK_SOURCES)

    // Stabilize tracks reference to prevent infinite re-renders during layout switches
    const trackKey = rawTracks.map(t => `${t.participant.identity}:${t.source}:${!!t.publication?.track}`).join('|')
    const tracks = useMemo(() => rawTracks, [trackKey])

    // Build participant list: local first, then remotes (no duplicates)
    const allParticipants = useMemo(() => {
        if (!localParticipant) return remoteParticipants
        return [localParticipant, ...remoteParticipants.filter(p => p.identity !== localParticipant.identity)]
    }, [localParticipant, remoteParticipants])

    const screenSharer = allParticipants.find(p => p.isScreenShareEnabled)

    if (screenSharer) {
        // Spotlight layout for screen sharing
        const otherParticipants = allParticipants.filter(p => p.identity !== screenSharer.identity)

        return (
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', gap: '0.75rem',
                overflow: 'hidden', height: '100%'
            }}>
                {/* Main Spotlight (Screen Share) */}
                <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ height: '100%', width: '100%', maxWidth: '100%' }}>
                        <ParticipantTile 
                            key={`spotlight-${screenSharer.identity}`}
                            participant={screenSharer} 
                            isLocal={screenSharer.identity === localParticipant?.identity} 
                            isSpotlight={true} 
                            allTracks={tracks}
                        />
                    </div>
                </div>
                
                {/* Bottom Row for other participants */}
                {otherParticipants.length > 0 && (
                    <div style={{
                        display: 'flex', gap: '0.75rem', overflowX: 'auto',
                        paddingBottom: '0.5rem', height: '160px', flexShrink: 0
                    }}>
                        {otherParticipants.map(p => (
                            <div key={p.identity} style={{ width: '240px', flexShrink: 0, height: '100%' }}>
                                <ParticipantTile
                                    participant={p}
                                    isLocal={p.identity === localParticipant?.identity}
                                    allTracks={tracks}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    const count = allParticipants.length
    const { isMobile, isLandscape } = useDeviceOrientation()

    // Dynamic grid sizing
    let cols = 1
    if (isMobile && !isLandscape) {
        if (count === 1) cols = 1
        else if (count === 2) cols = 1
        else if (count <= 6) cols = 2
        else if (count <= 12) cols = 3
        else cols = 4
    } else {
        if (count === 2) cols = 2
        else if (count <= 4) cols = 2
        else if (count <= 9) cols = 3
        else if (count <= 16) cols = 4
        else cols = 5
    }

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
                    isLocal={p.identity === localParticipant?.identity}
                    allTracks={tracks}
                />
            ))}
        </div>
    )
}

// ─── Control Bar ─────────────────────────────────────────────────────────────
function MeetControlBar({ onLeave }) {
    const room = useRoomContext()
    const { isMobile } = useDeviceOrientation()
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
            {!isMobile && (
                <button onClick={toggleScreen} style={{
                    ...btnStyle(true),
                    background: isScreenSharing ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)',
                    color: isScreenSharing ? '#818cf8' : 'white'
                }} title="Share Screen">
                    <MonitorUp size={20} />
                </button>
            )}

            {/* Raise Hand for Mobile (Placeholder) */}
            {isMobile && (
                <button onClick={() => { /* emit raise hand event */ }} style={{ ...btnStyle(true), background: 'rgba(255,255,255,0.1)' }} title="Raise Hand">
                    <Hand size={20} />
                </button>
            )}

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
function WaitingRoomTab({ waitingStudents, setWaitingStudents, channel }) {
    const handleAdmit = (studentId) => {
        channel.send({ type: 'broadcast', event: 'join_response', payload: { studentId, admitted: true } })
        setWaitingStudents(prev => prev.filter(s => s.id !== studentId))
    }
    const handleDeny = (studentId) => {
        channel.send({ type: 'broadcast', event: 'join_response', payload: { studentId, admitted: false } })
        setWaitingStudents(prev => prev.filter(s => s.id !== studentId))
    }
    const handleAdmitAll = () => {
        waitingStudents.forEach(s => {
            channel.send({ type: 'broadcast', event: 'join_response', payload: { studentId: s.id, admitted: true } })
        })
        setWaitingStudents([])
    }

    if (waitingStudents.length === 0) return (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No students waiting.
        </div>
    )

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                {waitingStudents.map(s => (
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: 8, marginBottom: '0.5rem' }}>
                        <div>
                            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => handleAdmit(s.id)} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '0.4rem 0.75rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Admit</button>
                            <button onClick={() => handleDeny(s.id)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.4rem 0.75rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Deny</button>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={handleAdmitAll} style={{ width: '100%', background: '#6366f1', color: 'white', border: 'none', padding: '0.75rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                    <CheckCircle size={16} /> Admit All ({waitingStudents.length})
                </button>
            </div>
        </div>
    )
}

function RoomContent({ videoId, videoData, isOrganizer, profile, channelInstance, sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, onLeave, refreshStats, toast, waitingStudents, setWaitingStudents }) {
    const { isMobile, isLandscape } = useDeviceOrientation()
    const room = useRoomContext()
    const joinTimeRef = useRef(Date.now())
    const attendanceMarkedRef = useRef(false)
    const attendanceIntervalRef = useRef(null)
    const containerRef = useRef(null)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [admittedStudents, setAdmittedStudents] = useState([])

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

    // ── Attendance Tracking (Supabase Realtime) ──
    useEffect(() => {
        if (isOrganizer || !profile?.id || !videoData) return

        joinTimeRef.current = Date.now()

        // Listen to changes on live_attendance table for THIS student and THIS video
        const attendanceChannel = supabase.channel(`attendance-${profile.id}-${videoData.id}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'live_attendance',
                filter: `student_id=eq.${profile.id}`
            }, (payload) => {
                if (payload.new.video_id === videoData.id) {
                    // Check if xp_awarded changed from false to true
                    if (payload.new.xp_awarded && !payload.old.xp_awarded) {
                        if (!attendanceMarkedRef.current) {
                            attendanceMarkedRef.current = true
                            toast.success('🎉 Attendance Marked! +50 XP earned')
                            refreshStats()
                        }
                    }
                }
            })
            .subscribe()

        return () => {
            supabase.removeChannel(attendanceChannel)
        }
    }, [videoData, profile?.id, isOrganizer])

    const handleLeave = useCallback(() => {
        if (!isOrganizer && !attendanceMarkedRef.current && joinTimeRef.current) {
            const durationSec = Math.floor((Date.now() - joinTimeRef.current) / 1000)
            if (durationSec < 300) {
                toast.warning(`⚠️ You attended only ${Math.floor(durationSec / 60)} minutes. Stay at least 5 mins for credit.`)
            }
        }

        room.disconnect()
        onLeave()
    }, [room, isOrganizer, profile, videoData])

    return (
        <div ref={containerRef} style={{ 
            height: '100%', flex: 1, display: 'flex', flexDirection: 'column', background: '#020617',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)'
        }}>
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
                    {!isMobile && (
                        <button onClick={toggleFullScreen} style={{
                            background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                            border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.75rem',
                            borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.3rem'
                        }}>
                            {isFullScreen ? <><Minimize size={14} /> Exit</> : <><Maximize size={14} /> Full</>}
                        </button>
                    )}
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
            <div style={{ flex: 1, display: 'flex', flexDirection: (isMobile && !isLandscape) ? 'column' : 'row', width: '100%', overflow: 'hidden', position: 'relative' }}>
                {/* Video Grid */}
                <VideoGrid />

                {/* Sidebar */}
                {sidebarOpen && channelInstance && (
                    <div 
                        onTouchStart={(e) => { e.currentTarget.dataset.startY = e.touches[0].clientY }}
                        onTouchEnd={(e) => { 
                            const startY = Number(e.currentTarget.dataset.startY || 0)
                            if (e.changedTouches[0].clientY - startY > 50 && isMobile && !isLandscape) {
                                setSidebarOpen(false)
                            }
                        }}
                        style={{
                            width: (isMobile && !isLandscape) ? '100%' : (isMobile && isLandscape ? '280px' : '360px'),
                            height: (isMobile && !isLandscape) ? '60%' : '100%',
                            minHeight: (isMobile && !isLandscape) ? '50%' : 'auto',
                            maxHeight: (isMobile && !isLandscape) ? '85%' : 'none',
                            position: (isMobile && !isLandscape) ? 'absolute' : 'relative',
                            bottom: (isMobile && !isLandscape) ? 0 : 'auto',
                            background: 'rgba(15,23,42,0.98)',
                            borderLeft: (isMobile && !isLandscape) ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            borderTop: (isMobile && !isLandscape) ? '1px solid rgba(255,255,255,0.08)' : 'none',
                            borderTopLeftRadius: (isMobile && !isLandscape) ? 16 : 0,
                            borderTopRightRadius: (isMobile && !isLandscape) ? 16 : 0,
                            display: 'flex', flexDirection: 'column',
                            backdropFilter: 'blur(12px)',
                            zIndex: 20,
                            boxShadow: (isMobile && !isLandscape) ? '0 -10px 40px rgba(0,0,0,0.5)' : 'none'
                        }}>
                        {/* Drag Handle for Mobile */}
                        {isMobile && !isLandscape && (
                            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', padding: '8px 0', cursor: 'grab' }}>
                                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
                            </div>
                        )}
                        <div style={{
                            display: 'flex', padding: '0.5rem', gap: '0.4rem',
                            borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto'
                        }}>
                            {[
                                { id: 'notes', icon: Edit3, label: 'Notes' },
                                { id: 'polls', icon: BarChart2, label: 'Polls' },
                                ...(isOrganizer ? [{ id: 'attendance', icon: Users, label: 'Att.' }, { id: 'waiting', icon: UserPlus, label: `Wait (${waitingStudents?.length || 0})` }] : []),
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
                            {sidebarTab === 'attendance' && isOrganizer && <LiveAttendance videoId={videoId} isOrganizer={isOrganizer} videoTitle={videoData?.title} />}
                            {sidebarTab === 'waiting' && isOrganizer && <WaitingRoomTab waitingStudents={waitingStudents} setWaitingStudents={setWaitingStudents} channel={channelInstance} />}
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Admit Floating Toasts for Organizer */}
            {isOrganizer && waitingStudents?.length > 0 && (
                <div style={{ position: 'fixed', bottom: 100, left: 24, zIndex: 50, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {waitingStudents.slice(-3).map(s => (
                        <div key={s.id} style={{
                            background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12,
                            padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)', width: 280, backdropFilter: 'blur(8px)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ background: 'rgba(99,102,241,0.2)', padding: 8, borderRadius: '50%' }}><UserPlus size={18} color="#818cf8"/></div>
                                <div>
                                    <p style={{ margin: 0, color: 'white', fontWeight: 600, fontSize: '0.9rem' }}>Join Request</p>
                                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{s.name} wants to join.</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={() => {
                                    channelInstance.send({ type: 'broadcast', event: 'join_response', payload: { studentId: s.id, admitted: true } })
                                    setWaitingStudents(prev => prev.filter(x => x.id !== s.id))
                                }} style={{ flex: 1, background: '#6366f1', color: 'white', border: 'none', padding: '0.5rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Admit</button>
                                <button onClick={() => {
                                    channelInstance.send({ type: 'broadcast', event: 'join_response', payload: { studentId: s.id, admitted: false } })
                                    setWaitingStudents(prev => prev.filter(x => x.id !== s.id))
                                }} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}>Deny</button>
                            </div>
                        </div>
                    ))}
                    {waitingStudents.length > 3 && (
                        <div style={{ background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.8rem', padding: '0.5rem', borderRadius: 8, textAlign: 'center', width: 280 }}>
                            + {waitingStudents.length - 3} more waiting
                        </div>
                    )}
                </div>
            )}

            {/* Control Bar */}
            <MeetControlBar onLeave={handleLeave} />
        </div>
    )
}

// ─── Participant Count Badge ─────────────────────────────────────────────────
function ParticipantCount() {
    const participants = useRemoteParticipants()
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.75rem',
            borderRadius: 8, fontSize: '0.8rem', color: 'var(--text-muted)'
        }}>
            <Users size={14} /> {participants.length + 1}
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
    const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)
    const [channelInstance, setChannelInstance] = useState(null)
    const [waitingStudents, setWaitingStudents] = useState([])
    const isOrganizer = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)

    const [askCooldown, setAskCooldown] = useState(0)
    const joinTimeoutRef = useRef(null)

    const [joinStatus, setJoinStatus] = useState(() => {
        if (isOrganizer) return 'admitted'
        try {
            const admitted = JSON.parse(sessionStorage.getItem('admitted_classes') || '{}')
            if (admitted[videoId] && (Date.now() - admitted[videoId] < 1000 * 60 * 60 * 2)) {
                return 'admitted'
            }
        } catch {}
        return 'idle' // idle, requesting, timeout, admitted_animating, admitted, denied
    })

    // ── Fetch Video Data & Setup Real-time Channel ──
    useEffect(() => {
        let intervalId = null
        let localChannel = null

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
            localChannel = channel
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
                .on('broadcast', { event: 'join_request' }, (p) => {
                    if (isOrganizer) {
                        setWaitingStudents(prev => {
                            if (prev.some(s => s.id === p.payload.studentId)) return prev
                            return [...prev, {
                                id: p.payload.studentId,
                                name: p.payload.studentName,
                                timestamp: Date.now()
                            }]
                        })
                    }
                })
                .on('broadcast', { event: 'join_cancelled' }, (p) => {
                    if (isOrganizer) {
                        setWaitingStudents(prev => prev.filter(s => s.id !== p.payload.studentId))
                    }
                })
                .on('broadcast', { event: 'join_response' }, (p) => {
                    if (!isOrganizer && p.payload.studentId === profile?.id) {
                        if (p.payload.admitted) {
                            setJoinStatus('admitted_animating')
                            setTimeout(() => setJoinStatus('admitted'), 1500)
                            try {
                                const admitted = JSON.parse(sessionStorage.getItem('admitted_classes') || '{}')
                                admitted[videoId] = Date.now()
                                sessionStorage.setItem('admitted_classes', JSON.stringify(admitted))
                            } catch {}
                        } else {
                            setJoinStatus('denied')
                        }
                    }
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        if (isOrganizer) {
                            channel.send({ type: 'broadcast', event: 'presence', payload: { instructorJoined: true } })
                            intervalId = setInterval(() => {
                                channel.send({ type: 'broadcast', event: 'presence', payload: { instructorJoined: true } })
                            }, 15000)
                        } else {
                            channel.send({ type: 'broadcast', event: 'check_instructor', payload: {} })
                            intervalId = setInterval(() => {
                                channel.send({ type: 'broadcast', event: 'check_instructor', payload: {} })
                            }, 15000)
                        }
                    }
                })
        }

        fetchVideo()
        return () => {
            if (intervalId) clearInterval(intervalId)
            if (localChannel) supabase.removeChannel(localChannel)
        }
    }, [videoId])

    // ── Fetch LiveKit Token ──
    useEffect(() => {
        const canJoin = isOrganizer || (instructorPresent && joinStatus === 'admitted')
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
    }, [videoData, isOrganizer, instructorPresent, joinStatus, livekitToken])

    // ── Loading State ──
    if (loading) {
        return (
            <div style={{
                height: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                height: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
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

    const handleAskToJoin = () => {
        if (askCooldown > 0) {
            toast.error(`Please wait ${askCooldown} seconds before asking again.`)
            return
        }

        setJoinStatus('requesting')
        if (channelInstance) {
            channelInstance.send({
                type: 'broadcast',
                event: 'join_request',
                payload: { studentId: profile?.id, studentName: profile?.name || 'Student' }
            })
            // Set a timeout for 2 minutes
            if (joinTimeoutRef.current) clearTimeout(joinTimeoutRef.current)
            joinTimeoutRef.current = setTimeout(() => {
                setJoinStatus(prev => prev === 'requesting' ? 'timeout' : prev)
            }, 1000 * 60 * 2)
        }

        setAskCooldown(15)
        const cInterval = setInterval(() => {
            setAskCooldown(c => {
                if (c <= 1) { clearInterval(cInterval); return 0 }
                return c - 1
            })
        }, 1000)
    }

    const cancelRequest = () => {
        setJoinStatus('idle')
        if (channelInstance) {
            channelInstance.send({
                type: 'broadcast',
                event: 'join_cancelled',
                payload: { studentId: profile?.id }
            })
        }
    }

    // ── Student Ask To Join / Waiting Room UI ──
    if (!isOrganizer && joinStatus !== 'admitted') {
        return (
            <div style={{
                height: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#020617', color: 'white', textAlign: 'center', padding: '2rem'
            }}>
                <div style={{ maxWidth: 400, background: 'linear-gradient(145deg, rgba(15,23,42,0.9), rgba(30,41,59,0.8))', padding: '3rem 2rem', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', width: '100%' }}>
                    {joinStatus === 'idle' && (
                        <>
                            <div style={{
                                width: 72, height: 72, background: 'rgba(99,102,241,0.1)',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1.5rem'
                            }}>
                                <Hand size={32} color="#6366f1" />
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Learnova Meet</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                                Class: {videoData?.title || 'Live Session'}
                            </p>
                            <button onClick={handleAskToJoin} style={{
                                width: '100%', background: '#6366f1', color: 'white', border: 'none',
                                padding: '0.875rem', borderRadius: 12, cursor: 'pointer',
                                fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                            }}>
                                Ask to Join
                            </button>
                        </>
                    )}

                    {joinStatus === 'requesting' && (
                        <>
                            <div style={{
                                width: 72, height: 72, background: 'rgba(34,197,94,0.1)',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1.5rem'
                            }}>
                                <Loader2 size={32} className="animate-spin" color="#22c55e" />
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Waiting for approval...</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                                The organizer will admit you shortly.
                            </p>
                            <button onClick={cancelRequest} style={{
                                background: 'transparent', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)',
                                padding: '0.5rem 1.5rem', borderRadius: 8, cursor: 'pointer',
                                fontWeight: 500, fontSize: '0.875rem'
                            }}>
                                Cancel Request
                            </button>
                        </>
                    )}

                    {joinStatus === 'timeout' && (
                        <>
                            <div style={{
                                width: 72, height: 72, background: 'rgba(245,158,11,0.1)',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1.5rem'
                            }}>
                                <Clock size={32} color="#f59e0b" />
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>No Response</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                                Still waiting for organizer approval.
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button onClick={() => navigate(-1)} style={{
                                    background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '0.75rem 1.5rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600
                                }}>
                                    Leave
                                </button>
                                <button onClick={handleAskToJoin} style={{
                                    background: '#f59e0b', color: 'white', border: 'none',
                                    padding: '0.75rem 1.5rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600
                                }}>
                                    Retry
                                </button>
                            </div>
                        </>
                    )}

                    {joinStatus === 'denied' && (
                        <>
                            <div style={{
                                width: 72, height: 72, background: 'rgba(239,68,68,0.1)',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1.5rem'
                            }}>
                                <XCircle size={32} color="#ef4444" />
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Entry Denied</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                                You weren't admitted to this session. Please contact the organizer.
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button onClick={() => navigate(-1)} style={{
                                    background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '0.75rem 1.5rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600
                                }}>
                                    Return
                                </button>
                                <button onClick={handleAskToJoin} disabled={askCooldown > 0} style={{
                                    background: askCooldown > 0 ? 'rgba(99,102,241,0.5)' : '#6366f1', color: 'white', border: 'none',
                                    padding: '0.75rem 1.5rem', borderRadius: 10, cursor: askCooldown > 0 ? 'not-allowed' : 'pointer', fontWeight: 600
                                }}>
                                    {askCooldown > 0 ? `Wait ${askCooldown}s` : 'Ask Again'}
                                </button>
                            </div>
                        </>
                    )}

                    {joinStatus === 'admitted_animating' && (
                        <>
                            <div style={{
                                width: 72, height: 72, background: 'rgba(34,197,94,0.1)',
                                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1.5rem'
                            }}>
                                <CheckCircle size={32} color="#22c55e" />
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>🎉 You've been admitted!</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                Joining Learnova Meet...
                            </p>
                        </>
                    )}
                </div>
            </div>
        )
    }

    // ── Token Error ──
    if (tokenError) {
        return (
            <div style={{
                height: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
                height: '100%', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
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
            style={{ height: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}
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
                waitingStudents={waitingStudents}
                setWaitingStudents={setWaitingStudents}
            />
        </LiveKitRoom>
    )
}
