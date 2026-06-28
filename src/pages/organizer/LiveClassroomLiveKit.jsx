import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useMeeting } from '../../contexts/MeetingContext'
import { useToast } from '../../components/Toast'
import { Loader2, Video, VideoOff, Mic, MicOff, MonitorUp, PhoneOff, MessageSquare, BarChart2, Edit3, Users, Maximize, Minimize, Hand, UserCheck, Play, StopCircle, ZoomIn, ZoomOut, UserPlus, XCircle, CheckCircle, Clock, Smile, ShieldCheck, Lock, Unlock, UserMinus, ArrowDown, MoreVertical, Pin, PinOff } from 'lucide-react'

import LiveNotes from '../../components/live-classroom/LiveNotes'
import LivePolls from '../../components/live-classroom/LivePolls'
import LiveAttendance from '../../components/live-classroom/LiveAttendance'
import LiveHandRaise from '../../components/live-classroom/LiveHandRaise'
import LiveChat from '../../components/live-classroom/LiveChat'

import {
    LiveKitRoom,
    useRemoteParticipants,
    useLocalParticipant,
    useRoomContext,
    useConnectionState
} from '@livekit/components-react'
import '@livekit/components-styles'
import { Track, RoomEvent, ConnectionState, ParticipantEvent, DataPacket_Kind } from 'livekit-client'

// Constants
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://meet.learnova.com'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

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

// ─── Custom Track Components (raw attach, no LiveKit React wrappers) ─────────
function CustomVideoTrack({ track, objectFit = 'cover' }) {
    const videoRef = useRef(null)
    useEffect(() => {
        const el = videoRef.current
        if (el && track) {
            track.attach(el)
            return () => track.detach(el)
        }
    }, [track])
    return <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit, background: 'black', pointerEvents: 'none' }} />
}

function CustomAudioTrack({ track }) {
    const audioRef = useRef(null)
    useEffect(() => {
        const el = audioRef.current
        if (el && track) {
            track.attach(el)
            return () => track.detach(el)
        }
    }, [track])
    return <audio ref={audioRef} autoPlay />
}

// ─── Hook: get tracks for a single participant via direct events (no LiveKit hooks) ──
function useManualParticipantTracks(participant) {
    const [, setTick] = useState(0)
    useEffect(() => {
        if (!participant) return
        const bump = () => setTick(n => n + 1)
        participant.on(ParticipantEvent.TrackPublished, bump)
        participant.on(ParticipantEvent.TrackUnpublished, bump)
        participant.on(ParticipantEvent.TrackSubscribed, bump)
        participant.on(ParticipantEvent.TrackUnsubscribed, bump)
        participant.on(ParticipantEvent.TrackMuted, bump)
        participant.on(ParticipantEvent.TrackUnmuted, bump)
        participant.on(ParticipantEvent.LocalTrackPublished, bump)
        participant.on(ParticipantEvent.LocalTrackUnpublished, bump)
        participant.on(ParticipantEvent.ParticipantMetadataChanged, bump)
        return () => {
            participant.off(ParticipantEvent.TrackPublished, bump)
            participant.off(ParticipantEvent.TrackUnpublished, bump)
            participant.off(ParticipantEvent.TrackSubscribed, bump)
            participant.off(ParticipantEvent.TrackUnsubscribed, bump)
            participant.off(ParticipantEvent.TrackMuted, bump)
            participant.off(ParticipantEvent.TrackUnmuted, bump)
            participant.off(ParticipantEvent.LocalTrackPublished, bump)
            participant.off(ParticipantEvent.LocalTrackUnpublished, bump)
            participant.off(ParticipantEvent.ParticipantMetadataChanged, bump)
        }
    }, [participant])

    const camera = participant?.getTrackPublication(Track.Source.Camera)
    const screen = participant?.getTrackPublication(Track.Source.ScreenShare)
    const mic = participant?.getTrackPublication(Track.Source.Microphone)
    return { camera, screen, mic }
}

// ─── Participant Tile ────────────────────────────────────────────────────────
function ParticipantTile({ participant, isLocal, isSpotlight = false, onPin, isPinned = false }) {
    const { isMobile } = useDeviceOrientation()

    const { camera, screen, mic } = useManualParticipantTracks(participant)
    const cameraTrack = camera?.track
    const screenTrack = screen?.track
    const audioTrack = mic?.track

    const isMuted = !participant.isMicrophoneEnabled
    const isCameraOff = !participant.isCameraEnabled
    
    const displayTrack = screenTrack || cameraTrack
    const isScreenShareDisplay = !!screenTrack
    const shouldShowVideo = !!displayTrack && (isScreenShareDisplay || !isCameraOff)

    let metadata = {}
    try { metadata = JSON.parse(participant.metadata || '{}') } catch {}
    const name = participant.name || metadata.name || participant.identity
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

    const [scale, setScale] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const isDragging = useRef(false)
    const lastPos = useRef({ x: 0, y: 0 })

    const handleWheel = (e) => {
        if (!isSpotlight || !isScreenShareDisplay) return;
        const zoomDelta = e.deltaY * -0.002
        let newScale = Math.min(Math.max(1, scale + zoomDelta), 5)
        setScale(newScale)
        if (newScale === 1) setPan({ x: 0, y: 0 })
    }

    const handlePointerDown = (e) => {
        if (scale <= 1 || !isSpotlight || !isScreenShareDisplay) return;
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
            {audioTrack && !isLocal && (
                <CustomAudioTrack track={audioTrack} />
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
                        <CustomVideoTrack
                            track={displayTrack}
                            objectFit={isScreenShareDisplay ? 'contain' : 'cover'}
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
            {screenTrack && (
                <div style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(99,102,241,0.9)', color: 'white',
                    padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 4
                }}>
                    <MonitorUp size={12} /> Screen
                </div>
            )}

            {/* Hand Raise Badge */}
            {metadata.handRaised && (
                <div style={{
                    position: 'absolute', top: screenTrack ? 36 : 8, left: 8,
                    background: 'rgba(245,158,11,0.9)', color: 'white',
                    padding: '3px 8px', borderRadius: 6, fontSize: '0.85rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 4,
                    animation: 'pulse 2s infinite',
                }}>
                    ✋
                </div>
            )}

            {/* Zoom Controls (only if screen share in spotlight) */}
            {isScreenShareDisplay && isSpotlight && (
                <div style={{
                    position: 'absolute', top: 8, right: participant.isSpeaking ? 24 : 8,
                    display: 'flex', alignItems: 'center', gap: 4, 
                    background: 'rgba(15,23,42,0.8)', padding: '4px 8px', borderRadius: 8, zIndex: 10,
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    <button onClick={handleZoomOut} disabled={scale <= 1} style={{ background: 'transparent', border: 'none', color: scale > 1 ? 'white' : 'rgba(255,255,255,0.3)', cursor: scale > 1 ? 'pointer' : 'default', padding: 4, display: 'flex' }}><ZoomOut size={16} /></button>
                    <button onClick={handleResetZoom} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: '0 8px', fontSize: '0.85rem', fontWeight: 600, minWidth: '48px' }}>{Math.round(scale * 100)}%</button>
                    <button onClick={handleZoomIn} disabled={scale >= 5} style={{ background: 'transparent', border: 'none', color: scale < 5 ? 'white' : 'rgba(255,255,255,0.3)', cursor: scale < 5 ? 'pointer' : 'default', padding: 4, display: 'flex' }}><ZoomIn size={16} /></button>
                </div>
            )}

            {/* Pin / Unpin Button */}
            {onPin && (
                <button onClick={(e) => { e.stopPropagation(); onPin(participant.identity) }} title={isPinned ? 'Unpin' : 'Pin'} style={{
                    position: 'absolute',
                    top: 8,
                    right: (isScreenShareDisplay && isSpotlight) ? (participant.isSpeaking ? 160 : 144) : (participant.isSpeaking ? 24 : 8),
                    zIndex: 11,
                    width: 32, height: 32, borderRadius: 8,
                    background: isPinned ? 'rgba(99,102,241,0.9)' : 'rgba(15,23,42,0.8)',
                    border: isPinned ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.15)',
                    color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(4px)',
                }}>
                    {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
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
// CRITICAL: Single return path. All participants rendered in a flat list with
// stable keys. Layout changes are CSS-only (gridColumn/order). No component
// unmount/remount when screen sharing starts — that was the root cause of #300.
function VideoGrid() {
    const remoteParticipants = useRemoteParticipants()
    const { localParticipant } = useLocalParticipant()
    const room = useRoomContext()
    const [, setTick] = useState(0)
    const [pinnedIdentity, setPinnedIdentity] = useState(null)

    // Listen for screen-share track events at the Room level to detect layout changes
    useEffect(() => {
        if (!room) return
        const bump = () => setTick(n => n + 1)
        room.on(RoomEvent.TrackPublished, bump)
        room.on(RoomEvent.TrackUnpublished, bump)
        room.on(RoomEvent.LocalTrackPublished, bump)
        room.on(RoomEvent.LocalTrackUnpublished, bump)
        return () => {
            room.off(RoomEvent.TrackPublished, bump)
            room.off(RoomEvent.TrackUnpublished, bump)
            room.off(RoomEvent.LocalTrackPublished, bump)
            room.off(RoomEvent.LocalTrackUnpublished, bump)
        }
    }, [room])

    // Build participant list: local first, then remotes (no duplicates)
    const allParticipants = useMemo(() => {
        if (!localParticipant) return remoteParticipants
        return [localParticipant, ...remoteParticipants.filter(p => p.identity !== localParticipant.identity)]
    }, [localParticipant, remoteParticipants])

    // TWEAK 1: Multiple screen sharers — latest (last in list) wins priority
    // This prevents flickering when two organizers accidentally share at the same time
    const screenSharers = allParticipants.filter(p => p.isScreenShareEnabled)
    const screenSharerIdentity = screenSharers.length > 0 ? screenSharers[screenSharers.length - 1].identity : null
    const hasScreenShare = !!screenSharerIdentity

    // Track previous screen share state for exit animation
    const prevHadScreenShare = useRef(false)
    const [layoutTransition, setLayoutTransition] = useState(false)

    useEffect(() => {
        if (prevHadScreenShare.current !== hasScreenShare) {
            setLayoutTransition(true)
            const timer = setTimeout(() => setLayoutTransition(false), 300)
            prevHadScreenShare.current = hasScreenShare
            return () => clearTimeout(timer)
        }
    }, [hasScreenShare])

    // Auto-clear pinned identity if the participant left
    useEffect(() => {
        if (pinnedIdentity && !allParticipants.find(p => p.identity === pinnedIdentity)) {
            setPinnedIdentity(null)
        }
    }, [allParticipants, pinnedIdentity])

    // Toggle pin: if already pinned, unpin; otherwise pin
    const handlePin = useCallback((identity) => {
        setPinnedIdentity(prev => prev === identity ? null : identity)
    }, [])

    const count = allParticipants.length
    const { isMobile, isLandscape } = useDeviceOrientation()
    const isMobilePortrait = isMobile && !isLandscape

    // If a participant is pinned, show ONLY that participant
    const pinnedParticipant = pinnedIdentity ? allParticipants.find(p => p.identity === pinnedIdentity) : null

    if (pinnedParticipant) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                padding: '0.5rem',
                overflow: 'hidden',
                width: '100%',
                height: '100%',
                minWidth: 0,
                minHeight: 0,
                boxSizing: 'border-box',
                position: 'relative',
            }}>
                <div style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    overflow: 'hidden',
                    borderRadius: 16,
                }}>
                    <ParticipantTile
                        participant={pinnedParticipant}
                        isLocal={pinnedParticipant.identity === localParticipant?.identity}
                        isSpotlight={true}
                        onPin={handlePin}
                        isPinned={true}
                    />
                </div>
            </div>
        )
    }

    // Dynamic grid sizing
    let cols = 1
    if (isMobilePortrait) {
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

    // Separate screen sharer from other participants for layout purposes
    const screenSharer = hasScreenShare ? allParticipants.find(p => p.identity === screenSharerIdentity) : null
    const otherParticipants = hasScreenShare ? allParticipants.filter(p => p.identity !== screenSharerIdentity) : allParticipants

    // Get presenter display name for the banner
    let presenterName = ''
    if (screenSharer) {
        try {
            const m = JSON.parse(screenSharer.metadata || '{}')
            presenterName = screenSharer.name || m.name || screenSharer.identity
        } catch {
            presenterName = screenSharer.name || screenSharer.identity
        }
    }

    // SINGLE RETURN PATH — no conditional JSX trees
    // When screen sharing:
    //   Desktop / Mobile Landscape: flex row (spotlight + right filmstrip)
    //   Mobile Portrait: flex column (spotlight + bottom horizontal filmstrip)
    // When no screen share: normal grid layout
    return (
        <div style={{
            flex: 1,
            display: hasScreenShare ? 'flex' : 'grid',
            flexDirection: hasScreenShare
                ? (isMobilePortrait ? 'column' : 'row')
                : undefined,
            padding: '0.5rem',
            gap: '0.5rem',
            gridTemplateColumns: hasScreenShare ? undefined : `repeat(${cols}, 1fr)`,
            gridAutoRows: hasScreenShare ? undefined : '1fr',
            alignContent: (!hasScreenShare && count <= 2) ? 'center' : 'start',
            overflow: 'hidden',
            width: '100%',
            height: '100%',
            minWidth: 0,
            minHeight: 0,
            boxSizing: 'border-box',
            // TWEAK 2: Smooth fade transition when entering/exiting spotlight
            animation: layoutTransition
                ? (hasScreenShare ? 'spotlightFadeIn 300ms ease-out' : 'gridFadeIn 300ms ease-out')
                : 'none',
        }}>
            {/* Screen share spotlight: fills main area */}
            {screenSharer && (
                <div key={screenSharer.identity} style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    overflow: 'hidden',
                    borderRadius: 16,
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    {/* TWEAK 4: Presenter name banner — Google Meet style */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px',
                        background: 'rgba(15,23,42,0.85)',
                        borderRadius: '12px 12px 0 0',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderBottom: 'none',
                        backdropFilter: 'blur(8px)',
                        flexShrink: 0,
                    }}>
                        <MonitorUp size={14} color="#818cf8" />
                        <span style={{
                            color: 'rgba(255,255,255,0.9)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            📺 {presenterName} is presenting
                        </span>
                    </div>
                    <div style={{
                        flex: 1,
                        minHeight: 0,
                        overflow: 'hidden',
                        borderRadius: '0 0 12px 12px',
                    }}>
                        <ParticipantTile
                            participant={screenSharer}
                            isLocal={screenSharer.identity === localParticipant?.identity}
                            isSpotlight={true}
                            onPin={handlePin}
                            isPinned={false}
                        />
                    </div>
                </div>
            )}

            {/* Filmstrip: right sidebar (desktop/landscape) or bottom row (mobile portrait) */}
            {hasScreenShare ? (
                otherParticipants.length > 0 && (
                    <div style={{
                        // TWEAK 3: Mobile portrait → horizontal bottom filmstrip
                        ...(isMobilePortrait ? {
                            height: '90px',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'row',
                            gap: '0.5rem',
                            overflowX: 'auto',
                            overflowY: 'hidden',
                            paddingBottom: '2px',
                        } : {
                            width: isMobile ? '120px' : '180px',
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            paddingRight: '2px',
                        }),
                    }}>
                        {otherParticipants.map(p => (
                            <div key={p.identity} style={{
                                ...(isMobilePortrait ? {
                                    width: '120px',
                                    height: '100%',
                                    flexShrink: 0,
                                } : {
                                    width: '100%',
                                    height: isMobile ? '80px' : '120px',
                                    flexShrink: 0,
                                }),
                                minWidth: 0,
                                minHeight: 0,
                                overflow: 'hidden',
                                borderRadius: 12,
                            }}>
                                <ParticipantTile
                                    participant={p}
                                    isLocal={p.identity === localParticipant?.identity}
                                    isSpotlight={false}
                                    onPin={handlePin}
                                    isPinned={false}
                                />
                            </div>
                        ))}
                    </div>
                )
            ) : (
                otherParticipants.map(p => (
                    <div key={p.identity} style={{
                        minWidth: 0,
                        minHeight: 0,
                        overflow: 'hidden',
                    }}>
                        <ParticipantTile
                            participant={p}
                            isLocal={p.identity === localParticipant?.identity}
                            isSpotlight={false}
                            onPin={handlePin}
                            isPinned={false}
                        />
                    </div>
                ))
            )}
        </div>
    )
}

// ─── Reaction Overlay (floating emojis) ──────────────────────────────────────
const REACTION_KEYFRAMES = `
@keyframes floatReaction {
    0% { opacity: 1; transform: translateY(0) scale(1); }
    70% { opacity: 1; transform: translateY(-120px) scale(1.2); }
    100% { opacity: 0; transform: translateY(-180px) scale(0.8); }
}
@keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.15); }
}
@keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes spotlightFadeIn {
    from { opacity: 0; transform: scale(0.98); }
    to { opacity: 1; transform: scale(1); }
}
@keyframes gridFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
`

function ReactionOverlay({ reactions }) {
    return (
        <>
            <style>{REACTION_KEYFRAMES}</style>
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 30, overflow: 'hidden' }}>
                {reactions.map(r => (
                    <div key={r.id} style={{
                        position: 'absolute',
                        bottom: '80px',
                        left: `${r.x}%`,
                        animation: 'floatReaction 2.5s ease-out forwards',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}>
                        <span style={{ fontSize: '2.5rem' }}>{r.emoji}</span>
                        <span style={{
                            fontSize: '0.85rem', color: 'white', fontWeight: 600,
                            background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: 4,
                            whiteSpace: 'nowrap', textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                        }}>{r.senderName}</span>
                    </div>
                ))}
            </div>
        </>
    )
}

// ─── Reaction Picker ─────────────────────────────────────────────────────────
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👏', '😮']

function ReactionPicker({ onSelect, onClose }) {
    return (
        <div style={{
            position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
            marginBottom: 8, background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: '8px 12px', display: 'flex', gap: 4,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
            animation: 'fadeIn 0.15s ease-out',
        }}>
            {REACTION_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { onSelect(emoji); onClose() }} style={{
                    width: 44, height: 44, fontSize: '1.5rem', background: 'transparent',
                    border: 'none', borderRadius: 12, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease',
                }} onMouseEnter={e => { e.target.style.background = 'rgba(255,255,255,0.1)'; e.target.style.transform = 'scale(1.3)' }}
                   onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.transform = 'scale(1)' }}>
                    {emoji}
                </button>
            ))}
        </div>
    )
}

// ─── Raised Hands Panel (Speaking Queue) ─────────────────────────────────────
function RaisedHandsPanel({ participants, raisedHandsFromDataChannel = {}, onLowerHand, onLowerAll }) {
    // Merge metadata-based and data-channel-based hand raises
    const handsMap = new Map()
    
    // From participant metadata
    participants.forEach(p => {
        try {
            const m = JSON.parse(p.metadata || '{}')
            if (m.handRaised) {
                handsMap.set(p.identity, { identity: p.identity, name: p.name || m.name || p.identity, raisedAt: m.handRaisedAt || 0 })
            }
        } catch {}
    })
    
    // From data channel (fallback)
    Object.entries(raisedHandsFromDataChannel).forEach(([identity, data]) => {
        if (!handsMap.has(identity)) {
            handsMap.set(identity, { identity, name: data.name || identity, raisedAt: data.raisedAt || 0 })
        }
    })

    const handsUp = Array.from(handsMap.values()).sort((a, b) => a.raisedAt - b.raisedAt)

    return (
        <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ color: 'white', fontSize: '0.9rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Hand size={16} /> Raised Hands ({handsUp.length})
                </h3>
                {handsUp.length > 0 && (
                    <button onClick={onLowerAll} style={{
                        background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: 'none',
                        padding: '4px 10px', borderRadius: 6, fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600,
                    }}>Lower All</button>
                )}
            </div>
            {handsUp.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>No hands raised</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {handsUp.map((h, i) => (
                        <div key={h.identity} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'rgba(255,255,255,0.03)', padding: '0.6rem 0.85rem', borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ color: '#f59e0b', fontSize: '1.1rem' }}>✋</span>
                                <div>
                                    <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>#{i + 1} {h.name}</span>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', margin: 0 }}>
                                        {h.raisedAt ? new Date(h.raisedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => onLowerHand(h.identity)} style={{
                                background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)',
                                padding: '4px 8px', borderRadius: 6, fontSize: '0.7rem', cursor: 'pointer',
                            }}>Lower</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Host Controls Tab ───────────────────────────────────────────────────────
function HostControlsTab({ room, participants, chatLocked, setChatLocked, micLocked, setMicLocked, videoLocked, setVideoLocked, screenShareLocked, setScreenShareLocked, handsLocked, setHandsLocked, reactionsDisabled, setReactionsDisabled, onLowerAllHands, onRemoveParticipant }) {
    const sendHostCommand = (command, extra = {}) => {
        const msg = JSON.stringify({ type: 'host_command', command, ...extra })
        const encoder = new TextEncoder()
        room.localParticipant.publishData(encoder.encode(msg), { reliable: true })
    }

    const handleMuteAll = () => sendHostCommand('mute_all')
    const handleRequestCameraOffAll = () => sendHostCommand('request_camera_off_all')
    const handleToggleMicLock = () => {
        const newVal = !micLocked
        setMicLocked(newVal)
        sendHostCommand('mic_lock', { enabled: newVal })
    }
    const handleToggleVideoLock = () => {
        const newVal = !videoLocked
        setVideoLocked(newVal)
        sendHostCommand('video_lock', { enabled: newVal })
    }
    const handleToggleScreenShareLock = () => {
        const newVal = !screenShareLocked
        setScreenShareLocked(newVal)
        sendHostCommand('screen_share_lock', { enabled: newVal })
    }
    const handleToggleHandsLock = () => {
        const newVal = !handsLocked
        setHandsLocked(newVal)
        sendHostCommand('hands_lock', { enabled: newVal })
    }
    const handleToggleChatLock = async () => {
        const newVal = !chatLocked
        setChatLocked(newVal)
        sendHostCommand('chat_lock', { enabled: newVal })
        try {
            await supabase.from('live_chat_messages').insert({
                video_id: room.name,
                user_id: participants.find(p => p.isLocal)?.identity, // organizer identity
                message: newVal ? '📢 Chat has been locked by the instructor.' : '📢 Chat has been unlocked.',
                message_type: 'system'
            });
        } catch (e) {}
    }
    const handleToggleReactions = () => {
        const newVal = !reactionsDisabled
        setReactionsDisabled(newVal)
        sendHostCommand('reactions_disabled', { value: newVal })
    }

    const remoteParticipants = participants.filter(p => !p.isLocal)

    const controlBtnStyle = (color = '#6366f1') => ({
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        padding: '0.85rem 1rem', borderRadius: 10, cursor: 'pointer', color: 'white',
        fontSize: '0.85rem', fontWeight: 500, transition: 'all 0.15s ease',
    })

    return (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ color: 'white', fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={16} color="#6366f1" /> Host Controls
            </h3>

            {/* Quick Actions */}
            <button onClick={handleMuteAll} style={controlBtnStyle()}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                <MicOff size={16} color="#ef4444" /> Mute All Participants
            </button>

            <button onClick={handleRequestCameraOffAll} style={controlBtnStyle()}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                <VideoOff size={16} color="#f59e0b" /> Request Camera Off (All)
            </button>

            <button onClick={onLowerAllHands} style={controlBtnStyle()}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}>
                <ArrowDown size={16} color="#f59e0b" /> Lower All Hands
            </button>

            {/* Announcements */}
            <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.85rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructor Announcement</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                        type="text" 
                        value={announcementText} 
                        onChange={e => setAnnouncementText(e.target.value)} 
                        placeholder="Enter announcement..." 
                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '0.5rem', borderRadius: 8, fontSize: '0.8rem' }}
                    />
                    <button onClick={async () => {
                        if (!announcementText.trim()) return;
                        try {
                            await supabase.from('live_chat_messages').insert({
                                video_id: room.name,
                                user_id: participants.find(p => p.isLocal)?.identity,
                                message: `📣 ${announcementText}`,
                                message_type: 'announcement',
                                is_pinned: true
                            });
                            setAnnouncementText('');
                        } catch (e) {}
                    }} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Send</button>
                </div>
            </div>

            {/* Toggles */}
            <div style={{ marginTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.85rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Locks</p>
                <button onClick={handleToggleMicLock} style={{
                    ...controlBtnStyle(), background: micLocked ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                    border: micLocked ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                    {micLocked ? <Lock size={16} color="#ef4444" /> : <Unlock size={16} color="#22c55e" />}
                    {micLocked ? 'Mic Locked — Students Cannot Unmute' : 'Mic Unlocked — Students Can Unmute'}
                </button>
                <button onClick={handleToggleChatLock} style={{
                    ...controlBtnStyle(), marginTop: '0.5rem',
                    background: chatLocked ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                    border: chatLocked ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                    {chatLocked ? <Lock size={16} color="#ef4444" /> : <Unlock size={16} color="#22c55e" />}
                    {chatLocked ? 'Chat Locked — Students Cannot Send Messages' : 'Chat Unlocked — Students Can Send Messages'}
                </button>
                <button onClick={handleToggleVideoLock} style={{
                    ...controlBtnStyle(), marginTop: '0.5rem',
                    background: videoLocked ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                    border: videoLocked ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                    {videoLocked ? <Lock size={16} color="#ef4444" /> : <Unlock size={16} color="#22c55e" />}
                    {videoLocked ? 'Video Locked — Students Cannot Enable Camera' : 'Video Unlocked — Students Can Enable Camera'}
                </button>
                <button onClick={handleToggleScreenShareLock} style={{
                    ...controlBtnStyle(), marginTop: '0.5rem',
                    background: screenShareLocked ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                    border: screenShareLocked ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                    {screenShareLocked ? <Lock size={16} color="#ef4444" /> : <Unlock size={16} color="#22c55e" />}
                    {screenShareLocked ? 'Screen Share Locked — Students Cannot Share' : 'Screen Share Unlocked — Students Can Share'}
                </button>
                <button onClick={handleToggleHandsLock} style={{
                    ...controlBtnStyle(), marginTop: '0.5rem',
                    background: handsLocked ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                    border: handsLocked ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                    {handsLocked ? <Lock size={16} color="#ef4444" /> : <Unlock size={16} color="#22c55e" />}
                    {handsLocked ? 'Hands Locked — Students Cannot Raise Hand' : 'Hands Unlocked — Students Can Raise Hand'}
                </button>
                <button onClick={handleToggleReactions} style={{
                    ...controlBtnStyle(), marginTop: '0.5rem',
                    background: reactionsDisabled ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                    border: reactionsDisabled ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                }}>
                    <Smile size={16} color={reactionsDisabled ? '#ef4444' : '#22c55e'} />
                    {reactionsDisabled ? 'Reactions Disabled' : 'Reactions Enabled'}
                </button>
            </div>

            {/* Per-participant list */}
            {remoteParticipants.length > 0 && (
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.85rem' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Participants</p>
                    {remoteParticipants.map(p => {
                        let meta = {}; try { meta = JSON.parse(p.metadata || '{}') } catch {}
                        const pName = p.name || meta.name || p.identity
                        return (
                            <div key={p.identity} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '0.5rem 0.85rem', borderRadius: 8,
                                background: 'rgba(255,255,255,0.02)', marginBottom: 4,
                            }}>
                                <span style={{ color: 'white', fontSize: '0.8rem', fontWeight: 500 }}>{pName}</span>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button onClick={() => sendHostCommand('mute_participant', { identity: p.identity })} title="Mute" style={{
                                        background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6,
                                        padding: 4, cursor: 'pointer', display: 'flex',
                                    }}><MicOff size={14} color="#ef4444" /></button>
                                    <button onClick={() => sendHostCommand('request_camera_off', { identity: p.identity })} title="Request Camera Off" style={{
                                        background: 'rgba(245,158,11,0.1)', border: 'none', borderRadius: 6,
                                        padding: 4, cursor: 'pointer', display: 'flex',
                                    }}><VideoOff size={14} color="#f59e0b" /></button>
                                    <button onClick={() => onRemoveParticipant(p.identity)} title="Remove" style={{
                                        background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6,
                                        padding: 4, cursor: 'pointer', display: 'flex',
                                    }}><UserMinus size={14} color="#ef4444" /></button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Participant Control Overlay (hover desktop / tap mobile) ────────────────
function ParticipantControlOverlay({ participant, isOrganizer, isMobile, room }) {
    const [showControls, setShowControls] = useState(false)

    const sendHostCommand = (command) => {
        const msg = JSON.stringify({ type: 'host_command', command, identity: participant.identity })
        const encoder = new TextEncoder()
        room.localParticipant.publishData(encoder.encode(msg), { reliable: true })
    }

    if (!isOrganizer || participant.isLocal) return null

    const buttonStyle = {
        background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'white',
        fontSize: '0.7rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
        backdropFilter: 'blur(8px)', transition: 'all 0.15s ease',
    }

    if (isMobile) {
        // Tap to show bottom sheet
        return (
            <>
                <button onClick={(e) => { e.stopPropagation(); setShowControls(!showControls) }} style={{
                    position: 'absolute', top: 8, right: 8, zIndex: 15,
                    background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                    width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <MoreVertical size={14} color="white" />
                </button>
                {showControls && (
                    <div onClick={(e) => e.stopPropagation()} style={{
                        position: 'absolute', bottom: 40, left: 8, right: 8, zIndex: 20,
                        background: 'rgba(15,23,42,0.95)', borderRadius: 12, padding: 8,
                        border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 6, justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}>
                        <button onClick={() => { sendHostCommand('mute_participant'); setShowControls(false) }} style={buttonStyle}>
                            <MicOff size={12} /> Mute
                        </button>
                        <button onClick={() => { sendHostCommand('request_camera_off'); setShowControls(false) }} style={buttonStyle}>
                            <VideoOff size={12} /> Cam Off
                        </button>
                        <button onClick={() => { sendHostCommand('remove_participant'); setShowControls(false) }} style={{
                            ...buttonStyle, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)',
                        }}>
                            <UserMinus size={12} /> Remove
                        </button>
                    </div>
                )}
            </>
        )
    }

    // Desktop: hover overlay
    return (
        <div className="participant-hover-controls" style={{
            position: 'absolute', inset: 0, zIndex: 15,
            background: 'rgba(0,0,0,0.4)', opacity: 0,
            transition: 'opacity 0.2s ease', display: 'flex',
            alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0'}>
            <button onClick={() => sendHostCommand('mute_participant')} style={buttonStyle}><MicOff size={12} /> Mute</button>
            <button onClick={() => sendHostCommand('request_camera_off')} style={buttonStyle}><VideoOff size={12} /> Cam Off</button>
            <button onClick={() => sendHostCommand('remove_participant')} style={{
                ...buttonStyle, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)',
            }}><UserMinus size={12} /> Remove</button>
        </div>
    )
}

// ─── Control Bar ─────────────────────────────────────────────────────────────
function MeetControlBar({ onLeave, onMinimize, isOrganizer, handRaised, raisedHandsCount, reactionsDisabled, micLocked, videoLocked, screenShareLocked, handsLocked, onSendReaction, onToggleHand }) {
    const { isRecording, isRecordingPaused, isUploading, recordingSession, gToken, loginToDrive, startRecording, pauseRecording, resumeRecording, stopAndUploadRecording } = useMeeting()
    const room = useRoomContext()
    const { isMobile } = useDeviceOrientation()
    const localParticipant = useLocalParticipant()
    const [isMicOn, setIsMicOn] = useState(true)
    const [isCamOn, setIsCamOn] = useState(true)
    const [isScreenSharing, setIsScreenSharing] = useState(false)
    const [showReactionPicker, setShowReactionPicker] = useState(false)
    const [forceMutedUntil, setForceMutedUntil] = useState(0)
    const [recordingDuration, setRecordingDuration] = useState(0)

    const lp = localParticipant.localParticipant

    useEffect(() => {
        let interval;
        if (isRecording && !isRecordingPaused) {
            interval = setInterval(() => {
                setRecordingDuration(prev => prev + 1)
            }, 1000)
        } else if (!isRecording) {
            setRecordingDuration(0)
        }
        return () => clearInterval(interval)
    }, [isRecording, isRecordingPaused])

    const formatDuration = (seconds) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

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
        // If mic is locked by instructor and user is not organizer, block unmute
        if (!isOrganizer && micLocked && !isMicOn) return
        // If force-muted recently, block unmute for 5 seconds
        if (!isOrganizer && !isMicOn && Date.now() < forceMutedUntil) return
        await lp.setMicrophoneEnabled(!isMicOn)
        setIsMicOn(!isMicOn)
    }

    const toggleCam = async () => {
        if (!lp) return
        // If video is locked by instructor and user is not organizer, block enable
        if (!isOrganizer && videoLocked && !isCamOn) return
        await lp.setCameraEnabled(!isCamOn)
        setIsCamOn(!isCamOn)
    }

    const toggleScreen = async () => {
        if (!lp) return
        // If screen share is locked by instructor and user is not organizer, block
        if (!isOrganizer && screenShareLocked && !isScreenSharing) return
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

    const isMicBlocked = !isOrganizer && micLocked && !isMicOn

    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '0.5rem' : '0.85rem',
            padding: isMobile ? '0.85rem 1rem' : '1rem 2rem',
            background: 'rgba(15,23,42,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
            {/* Recording Controls (Organizer Only) */}
            {isOrganizer && !isMobile && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: 'auto' }}>
                    {!gToken ? (
                        <button onClick={loginToDrive} style={{
                            background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)',
                            padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                        }}>
                            🔴 Drive Login
                        </button>
                    ) : (
                        !isRecording && !isUploading ? (
                            <>
                                <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600 }}>
                                    ☁️ Drive Connected
                                </div>
                                <button onClick={startRecording} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                                    Start Record
                                </button>
                            </>
                        ) : isRecording ? (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {isRecordingPaused ? (
                                    <button onClick={resumeRecording} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                                        ▶ Resume
                                    </button>
                                ) : (
                                    <button onClick={pauseRecording} style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.5)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center' }}>
                                        ⏸ Pause
                                    </button>
                                )}
                                <button onClick={stopAndUploadRecording} style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.5)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', animation: isRecordingPaused ? 'none' : 'pulse 2s infinite' }}>
                                    ⏹ REC {formatDuration(recordingDuration)}
                                </button>
                            </div>
                        ) : (
                            <div style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.5)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700 }}>
                                ⏳ Uploading...
                            </div>
                        )
                    )}
                </div>
            )}

            {/* Mic */}
            <button onClick={toggleMic} style={{
                ...btnStyle(isMicOn),
                ...(isMicBlocked ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
            }} title={isMicBlocked ? 'Mic locked by instructor' : isMicOn ? 'Mute' : 'Unmute'}>
                {isMicBlocked ? <Lock size={20} /> : isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            {/* Camera */}
            <button onClick={toggleCam} style={{
                ...btnStyle(isCamOn),
                ...(!isOrganizer && videoLocked && !isCamOn ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
            }} title={!isOrganizer && videoLocked && !isCamOn ? 'Video locked by instructor' : isCamOn ? 'Camera Off' : 'Camera On'}>
                {!isOrganizer && videoLocked && !isCamOn ? <Lock size={20} /> : isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            {/* Screen Share (if supported by browser) */}
            {typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia && (
                <button onClick={toggleScreen} style={{
                    ...btnStyle(true),
                    background: isScreenSharing ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)',
                    color: isScreenSharing ? '#818cf8' : 'white',
                    ...(!isOrganizer && screenShareLocked && !isScreenSharing ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                }} title={!isOrganizer && screenShareLocked && !isScreenSharing ? 'Screen share locked by instructor' : 'Share Screen'}>
                    {!isOrganizer && screenShareLocked && !isScreenSharing ? <Lock size={20} /> : <MonitorUp size={20} />}
                </button>
            )}

            {/* Reactions */}
            <div style={{ position: 'relative' }}>
                <button onClick={() => !reactionsDisabled && setShowReactionPicker(!showReactionPicker)}
                    style={{
                        ...btnStyle(true),
                        background: showReactionPicker ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)',
                        ...(reactionsDisabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                    }} title={reactionsDisabled ? 'Reactions disabled by instructor' : 'Send Reaction'}>
                    <Smile size={20} />
                </button>
                {showReactionPicker && !reactionsDisabled && (
                    <ReactionPicker onSelect={onSendReaction} onClose={() => setShowReactionPicker(false)} />
                )}
            </div>

            {/* Minimize */}
            <button onClick={onMinimize} style={btnStyle(true)} title="Minimize Meeting">
                <Minimize size={20} />
            </button>

            {/* Hand Raise */}
            <button onClick={() => { if (!isOrganizer && handsLocked && !handRaised) return; onToggleHand() }} style={{
                ...btnStyle(true),
                background: handRaised ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)',
                color: handRaised ? '#f59e0b' : 'white',
                position: 'relative',
                ...(!isOrganizer && handsLocked && !handRaised ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
            }} title={!isOrganizer && handsLocked && !handRaised ? 'Hands locked by instructor' : handRaised ? 'Lower Hand' : 'Raise Hand'}>
                <Hand size={20} />
                {raisedHandsCount > 0 && (
                    <span style={{
                        position: 'absolute', top: -4, right: -4,
                        background: '#f59e0b', color: '#000', fontSize: '0.6rem', fontWeight: 800,
                        width: 18, height: 18, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{raisedHandsCount}</span>
                )}
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

// ─── Notification Sound (Web Audio API) ──────────────────────────────────────
const playNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if (!AudioContext) return
        const ctx = new AudioContext()
        
        const playTone = (freq, startTime, duration) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.value = freq
            
            gain.gain.setValueAtTime(0, startTime)
            gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
            
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.start(startTime)
            osc.stop(startTime + duration)
        }
        
        playTone(659.25, ctx.currentTime, 0.4) // E5
        playTone(880.00, ctx.currentTime + 0.1, 0.6) // A5
    } catch (e) {
        console.error('Failed to play notification sound', e)
    }
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
                    <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.85rem', borderRadius: 8, marginBottom: '0.5rem' }}>
                        <div>
                            <div style={{ fontWeight: 600, color: 'white', fontSize: '0.9rem' }}>{s.name}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => handleAdmit(s.id)} style={{ background: '#22c55e', color: 'white', border: 'none', padding: '0.4rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Admit</button>
                            <button onClick={() => handleDeny(s.id)} style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '0.4rem 0.85rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>Deny</button>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <button onClick={handleAdmitAll} style={{ width: '100%', background: '#6366f1', color: 'white', border: 'none', padding: '0.85rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
                    <CheckCircle size={16} /> Admit All ({waitingStudents.length})
                </button>
            </div>
        </div>
    )
}

function RoomContent({ videoId, videoData, isOrganizer, profile, channelInstance, sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, onLeave, onMinimize, refreshStats, toast, waitingStudents, setWaitingStudents }) {
    const { isMobile, isLandscape } = useDeviceOrientation()
    const room = useRoomContext()
    const remoteParticipants = useRemoteParticipants()
    const { localParticipant } = useLocalParticipant()
    const joinTimeRef = useRef(Date.now())
    const attendanceMarkedRef = useRef(false)
    const attendanceIntervalRef = useRef(null)
    const containerRef = useRef(null)
    const [isFullScreen, setIsFullScreen] = useState(false)
    const [admittedStudents, setAdmittedStudents] = useState([])
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
    const [unreadChatCount, setUnreadChatCount] = useState(0)

    useEffect(() => {
        if (sidebarTab === 'chat' && sidebarOpen) {
            setUnreadChatCount(0)
        }
    }, [sidebarTab, sidebarOpen])


    // ── New Feature State ──
    const [reactions, setReactions] = useState([])
    const [handRaised, setHandRaised] = useState(false)
    const [micLocked, setMicLocked] = useState(false)
    const [videoLocked, setVideoLocked] = useState(false)
    const [screenShareLocked, setScreenShareLocked] = useState(false)
    const [handsLocked, setHandsLocked] = useState(false)
    const [reactionsDisabled, setReactionsDisabled] = useState(false)
    const [chatLocked, setChatLocked] = useState(false)
    const [announcementText, setAnnouncementText] = useState('')

    // System Messages for Join/Leave (Organizer only)
    useEffect(() => {
        if (!room || !isOrganizer) return;
        const timers = {};
        const joinedSet = new Set();
        
        const onParticipantConnected = (p) => {
            timers[p.identity] = setTimeout(async () => {
                joinedSet.add(p.identity);
                try {
                    await supabase.from('live_chat_messages').insert({
                        video_id: videoData.id,
                        user_id: profile.id,
                        message: `📢 ${p.name || 'A student'} joined the class.`,
                        message_type: 'system'
                    });
                } catch (e) {}
            }, 10000);
        };
        
        const onParticipantDisconnected = async (p) => {
            if (timers[p.identity]) {
                clearTimeout(timers[p.identity]);
                delete timers[p.identity];
            }
            if (joinedSet.has(p.identity)) {
                joinedSet.delete(p.identity);
                try {
                    await supabase.from('live_chat_messages').insert({
                        video_id: videoData.id,
                        user_id: profile.id,
                        message: `📢 ${p.name || 'A student'} left the class.`,
                        message_type: 'system'
                    });
                } catch (e) {}
            }
        };
        
        room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
        room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
        
        return () => {
            room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
            room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
            Object.values(timers).forEach(clearTimeout);
        };
    }, [room, isOrganizer, videoData?.id, profile?.id]);
    const [raisedHands, setRaisedHands] = useState({}) // { identity: { name, raisedAt } } — data channel fallback
    const lastReactionTime = useRef(0)
    const reactionIdCounter = useRef(0)

    // All participants list for host controls
    const allParticipants = useMemo(() => {
        if (!localParticipant) return remoteParticipants
        return [localParticipant, ...remoteParticipants.filter(p => p.identity !== localParticipant.identity)]
    }, [localParticipant, remoteParticipants])

    // Count raised hands (merge metadata + data channel sources)
    const raisedHandsCount = useMemo(() => {
        const fromMetadata = new Set()
        allParticipants.forEach(p => {
            try { if (JSON.parse(p.metadata || '{}').handRaised) fromMetadata.add(p.identity) } catch {}
        })
        const fromDataChannel = new Set(Object.keys(raisedHands))
        return new Set([...fromMetadata, ...fromDataChannel]).size
    }, [allParticipants, raisedHands])

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

    // ── Data Channel Listener (reactions + host commands) ──
    useEffect(() => {
        if (!room) return
        const decoder = new TextDecoder()

        const handleDataReceived = (payload, participant) => {
            try {
                const msg = JSON.parse(decoder.decode(payload))

                if (msg.type === 'reaction') {
                    const id = `reaction-${Date.now()}-${reactionIdCounter.current++}`
                    const x = 10 + (window.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 80 // random horizontal position
                    setReactions(prev => [...prev, { id, emoji: msg.emoji, senderName: msg.senderName, x }])
                    // Auto-remove after animation
                    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2800)
                }

                // Hand raise via data channel (works even without metadata permission)
                if (msg.type === 'hand_raise') {
                    if (msg.raised) {
                        setRaisedHands(prev => ({ ...prev, [msg.identity]: { name: msg.name, raisedAt: msg.timestamp } }))
                        if (msg.identity !== room.localParticipant.identity) {
                            playNotificationSound()
                        }
                    } else {
                        setRaisedHands(prev => { const n = { ...prev }; delete n[msg.identity]; return n })
                    }
                }

                if (msg.type === 'host_command' && !isOrganizer) {
                    const lp = room.localParticipant
                    switch (msg.command) {
                        case 'end_class':
                            toast.info('The instructor has ended the class.')
                            room.forceDisconnect ? room.forceDisconnect() : room.disconnect()
                            onLeave()
                            break
                        case 'mute_all':
                            lp.setMicrophoneEnabled(false)
                            toast.info('🔇 Instructor muted all participants')
                            break
                        case 'mute_participant':
                            if (msg.identity === lp.identity) {
                                lp.setMicrophoneEnabled(false)
                                toast.info('🔇 Instructor muted your microphone')
                            }
                            break
                        case 'request_camera_off_all':
                            lp.setCameraEnabled(false)
                            toast.info('📷 Instructor requested cameras off')
                            break
                        case 'request_camera_off':
                            if (msg.identity === lp.identity) {
                                lp.setCameraEnabled(false)
                                toast.info('📷 Instructor requested your camera off')
                            }
                            break
                        case 'mic_lock':
                            setMicLocked(msg.enabled)
                            if (msg.enabled) {
                                lp.setMicrophoneEnabled(false)
                                toast.warning('🔒 Instructor locked microphones')
                            } else {
                                toast.success('🔓 Microphones unlocked')
                            }
                            break
                        case 'video_lock':
                            setVideoLocked(msg.enabled)
                            if (msg.enabled) {
                                lp.setCameraEnabled(false)
                                toast.warning('🔒 Instructor locked cameras')
                            } else {
                                toast.success('🔓 Cameras unlocked')
                            }
                            break
                        case 'screen_share_lock':
                            setScreenShareLocked(msg.enabled)
                            if (msg.enabled) {
                                if (lp.isScreenShareEnabled) {
                                    lp.setScreenShareEnabled(false)
                                }
                                toast.warning('🔒 Instructor locked screen sharing')
                            } else {
                                toast.success('🔓 Screen sharing unlocked')
                            }
                            break
                        case 'chat_lock':
                            setChatLocked(msg.enabled)
                            if (msg.enabled) {
                                toast.warning('🔒 Instructor locked the chat')
                            } else {
                                toast.success('🔓 Chat unlocked')
                            }
                            break
                        case 'hands_lock':
                            setHandsLocked(msg.enabled)
                            if (msg.enabled) {
                                // Lower hand if currently raised
                                try {
                                    const meta = JSON.parse(lp.metadata || '{}')
                                    if (meta.handRaised) {
                                        lp.setMetadata(JSON.stringify({ ...meta, handRaised: false, handRaisedAt: null }))
                                    }
                                } catch {}
                                setHandRaised(false)
                                toast.warning('🔒 Instructor locked hand raising')
                            } else {
                                toast.success('🔓 Hand raising unlocked')
                            }
                            break
                        case 'reactions_disabled':
                            setReactionsDisabled(msg.value)
                            toast.info(msg.value ? '😶 Reactions disabled by instructor' : '😀 Reactions enabled')
                            break
                        case 'lower_hand':
                            if (msg.identity === lp.identity) {
                                try {
                                    const meta = JSON.parse(lp.metadata || '{}')
                                    lp.setMetadata(JSON.stringify({ ...meta, handRaised: false, handRaisedAt: null }))
                                } catch {}
                                setHandRaised(false)
                                setRaisedHands(prev => { const n = { ...prev }; delete n[lp.identity]; return n })
                                toast.info('✋ Instructor lowered your hand')
                            }
                            break
                        case 'lower_all_hands': {
                            try {
                                const meta = JSON.parse(lp.metadata || '{}')
                                if (meta.handRaised) {
                                    lp.setMetadata(JSON.stringify({ ...meta, handRaised: false, handRaisedAt: null }))
                                }
                            } catch {}
                            setHandRaised(false)
                            setRaisedHands({})
                            toast.info('✋ Instructor lowered all hands')
                            break
                        }
                        case 'remove_participant':
                            if (msg.identity === lp.identity) {
                                toast.error('🚫 You have been removed from this meeting')
                                setTimeout(() => { room.forceDisconnect ? room.forceDisconnect() : room.disconnect(); onLeave() }, 1500)
                            }
                            break
                    }
                }
            } catch (e) {
                // Not a JSON data message, ignore
            }
        }

        room.on(RoomEvent.DataReceived, handleDataReceived)
        return () => room.off(RoomEvent.DataReceived, handleDataReceived)
    }, [room, isOrganizer, toast, onLeave])

    // ── Send Reaction ──
    const sendReaction = useCallback((emoji) => {
        if (!room || reactionsDisabled) return
        const now = Date.now()
        if (now - lastReactionTime.current < 2000) return // 2-second cooldown
        lastReactionTime.current = now

        let meta = {}
        try { meta = JSON.parse(room.localParticipant.metadata || '{}') } catch {}
        const senderName = room.localParticipant.name || meta.name || room.localParticipant.identity

        const msg = JSON.stringify({ type: 'reaction', emoji, senderName, timestamp: now })
        const encoder = new TextEncoder()
        room.localParticipant.publishData(encoder.encode(msg), { reliable: true })

        // Also show locally
        const id = `reaction-${now}-${reactionIdCounter.current++}`
        const x = 10 + (window.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * 80
        setReactions(prev => [...prev, { id, emoji, senderName, x }])
        setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2800)
    }, [room, reactionsDisabled])

    // ── Toggle Hand Raise (hybrid: metadata + data channel fallback) ──
    const toggleHandRaise = useCallback(async () => {
        if (!room) return
        const lp = room.localParticipant
        const newRaised = !handRaised
        const now = Date.now()

        // Try metadata first (survives reconnects)
        try {
            let meta = {}
            try { meta = JSON.parse(lp.metadata || '{}') } catch {}
            await lp.setMetadata(JSON.stringify({
                ...meta,
                handRaised: newRaised,
                handRaisedAt: newRaised ? now : null,
            }))
        } catch (e) {
            // Permission denied — metadata not available, that's OK
            console.warn('Metadata update not permitted, using data channel only')
        }

        // Always broadcast via data channel for immediate visibility
        const senderName = lp.name || lp.identity
        const msg = JSON.stringify({ type: 'hand_raise', raised: newRaised, identity: lp.identity, name: senderName, timestamp: now })
        const encoder = new TextEncoder()
        lp.publishData(encoder.encode(msg), { reliable: true })

        setHandRaised(newRaised)
    }, [room, handRaised])

    // ── Lower Specific Hand (instructor) ──
    const lowerHand = useCallback((identity) => {
        if (!room) return
        const msg = JSON.stringify({ type: 'host_command', command: 'lower_hand', identity })
        const encoder = new TextEncoder()
        room.localParticipant.publishData(encoder.encode(msg), { reliable: true })
        // Also update locally for the instructor's own hand
        if (identity === room.localParticipant.identity) {
            try {
                const meta = JSON.parse(room.localParticipant.metadata || '{}')
                room.localParticipant.setMetadata(JSON.stringify({ ...meta, handRaised: false, handRaisedAt: null }))
            } catch {}
            setHandRaised(false)
        }
    }, [room])

    // ── Lower All Hands (instructor) ──
    const lowerAllHands = useCallback(() => {
        if (!room) return
        const msg = JSON.stringify({ type: 'host_command', command: 'lower_all_hands' })
        const encoder = new TextEncoder()
        room.localParticipant.publishData(encoder.encode(msg), { reliable: true })
        // Also lower own hand
        try {
            const meta = JSON.parse(room.localParticipant.metadata || '{}')
            if (meta.handRaised) {
                room.localParticipant.setMetadata(JSON.stringify({ ...meta, handRaised: false, handRaisedAt: null }))
            }
        } catch {}
        setHandRaised(false)
    }, [room])

    // ── Remove Participant (instructor) ──
    const removeParticipant = useCallback((identity) => {
        if (!room) return
        const msg = JSON.stringify({ type: 'host_command', command: 'remove_participant', identity })
        const encoder = new TextEncoder()
        room.localParticipant.publishData(encoder.encode(msg), { reliable: true })
        toast.success(`Removed participant`)
    }, [room, toast])

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
        if (isOrganizer) {
            setShowLeaveConfirm(true)
            return
        }

        if (!attendanceMarkedRef.current && joinTimeRef.current) {
            const durationSec = Math.floor((Date.now() - joinTimeRef.current) / 1000)
            if (durationSec < 300) {
                toast.warning(`⚠️ You attended only ${Math.floor(durationSec / 60)} minutes. Stay at least 5 mins for credit.`)
            }
        }

        room.forceDisconnect ? room.forceDisconnect() : room.disconnect()
        onLeave()
    }, [room, isOrganizer, profile, videoData, onLeave])

    const confirmEndClass = async () => {
        try {
            await supabase.from('live_chat_messages').insert({
                video_id: videoData.id,
                user_id: profile.id,
                message: '📢 This class has ended.',
                message_type: 'system'
            });
            const cleanupAt = new Date();
            cleanupAt.setHours(cleanupAt.getHours() + 24);
            await supabase.from('live_class_sessions').upsert({ video_id: videoData.id, status: 'ended', ended_at: new Date().toISOString(), chat_cleanup_at: cleanupAt.toISOString() })
            
            
            const msg = JSON.stringify({ type: 'host_command', command: 'end_class' })
            const encoder = new TextEncoder()
            await room.localParticipant.publishData(encoder.encode(msg), { reliable: true })
        } catch (e) {
            console.error('Error ending class:', e)
        }
        room.forceDisconnect ? room.forceDisconnect() : room.disconnect()
        onLeave()
    }

    const confirmJustLeave = () => {
        room.forceDisconnect ? room.forceDisconnect() : room.disconnect()
        onLeave()
    }

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
                padding: '0.85rem 1.5rem',
                background: 'rgba(15, 23, 42, 0.95)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
                backdropFilter: 'blur(12px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
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
                            border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.85rem',
                            borderRadius: 8, fontSize: '0.8rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.3rem'
                        }}>
                            {isFullScreen ? <><Minimize size={14} /> Exit</> : <><Maximize size={14} /> Full</>}
                        </button>
                    )}
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
                        background: sidebarOpen ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                        color: sidebarOpen ? '#818cf8' : 'var(--text-muted)',
                        border: '1px solid rgba(255,255,255,0.1)', padding: '0.4rem 0.85rem',
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

                {/* Reaction Overlay */}
                <ReactionOverlay reactions={reactions} />

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
                                { id: 'chat', icon: MessageSquare, label: unreadChatCount > 0 ? `Chat (${unreadChatCount})` : 'Chat' },
                                { id: 'notes', icon: Edit3, label: 'Notes' },
                                { id: 'polls', icon: BarChart2, label: 'Polls' },
                                ...(isOrganizer ? [
                                    { id: 'attendance', icon: Users, label: 'Att.' },
                                    { id: 'waiting', icon: UserPlus, label: `Wait (${waitingStudents?.length || 0})` },
                                    { id: 'hands', icon: Hand, label: `✋ (${raisedHandsCount})` },
                                    { id: 'host', icon: ShieldCheck, label: 'Host' },
                                ] : []),
                            ].map(tab => (
                                <button key={tab.id} onClick={() => setSidebarTab(tab.id)} style={{
                                    flex: 1, padding: '0.5rem',
                                    background: sidebarTab === tab.id ? '#6366f1' : 'transparent',
                                    color: sidebarTab === tab.id ? 'white' : 'var(--text-muted)',
                                    border: 'none', borderRadius: '6px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '0.3rem', fontSize: '0.85rem', minWidth: '50px'
                                }}>
                                    <tab.icon size={14} /> {tab.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: sidebarTab === 'chat' ? 'flex' : 'none', flex: 1, flexDirection: 'column', height: '100%' }}>
                                <LiveChat videoId={videoId} isOrganizer={isOrganizer} chatLocked={chatLocked} channel={channelInstance} onNewMessage={() => {
                                    if (sidebarTab !== 'chat' || !sidebarOpen) setUnreadChatCount(c => c + 1)
                                }} />
                            </div>
                            {sidebarTab === 'notes' && <LiveNotes videoId={videoId} isOrganizer={isOrganizer} channel={channelInstance} />}
                            {sidebarTab === 'polls' && <LivePolls videoId={videoId} isOrganizer={isOrganizer} channel={channelInstance} />}
                            {sidebarTab === 'attendance' && isOrganizer && <LiveAttendance videoId={videoId} isOrganizer={isOrganizer} videoTitle={videoData?.title} />}
                            {sidebarTab === 'waiting' && isOrganizer && <WaitingRoomTab waitingStudents={waitingStudents} setWaitingStudents={setWaitingStudents} channel={channelInstance} />}
                            {sidebarTab === 'hands' && isOrganizer && <RaisedHandsPanel participants={allParticipants} raisedHandsFromDataChannel={raisedHands} onLowerHand={lowerHand} onLowerAll={lowerAllHands} />}
                            {sidebarTab === 'host' && isOrganizer && (
                                <HostControlsTab
                                    room={room}
                                    participants={allParticipants}
                                    chatLocked={chatLocked}
                                    setChatLocked={setChatLocked}
                                    micLocked={micLocked}
                                    setMicLocked={setMicLocked}
                                    videoLocked={videoLocked}
                                    setVideoLocked={setVideoLocked}
                                    screenShareLocked={screenShareLocked}
                                    setScreenShareLocked={setScreenShareLocked}
                                    handsLocked={handsLocked}
                                    setHandsLocked={setHandsLocked}
                                    reactionsDisabled={reactionsDisabled}
                                    setReactionsDisabled={setReactionsDisabled}
                                    onLowerAllHands={lowerAllHands}
                                    onRemoveParticipant={removeParticipant}
                                />
                            )}
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
                            padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem',
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

            {showLeaveConfirm && isOrganizer && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)' }}>
                    <div style={{ background: '#1e293b', padding: '2rem', borderRadius: 16, width: 400, maxWidth: '90%', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h3 style={{ margin: '0 0 1rem', color: 'white', fontSize: '1.25rem' }}>Leave Meeting</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Do you want to just leave the meeting, or end it for everyone?</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            <button onClick={confirmEndClass} style={{ padding: '0.85rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                                End Class for All & Clear Chat
                            </button>
                            <button onClick={confirmJustLeave} style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                                Just Leave
                            </button>
                            <button onClick={() => setShowLeaveConfirm(false)} style={{ padding: '0.85rem', background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Control Bar */}
            <MeetControlBar
                onLeave={handleLeave}
                onMinimize={onMinimize}
                isOrganizer={isOrganizer}
                handRaised={handRaised}
                raisedHandsCount={raisedHandsCount}
                reactionsDisabled={reactionsDisabled}
                micLocked={micLocked}
                videoLocked={videoLocked}
                screenShareLocked={screenShareLocked}
                handsLocked={handsLocked}
                onSendReaction={sendReaction}
                onToggleHand={toggleHandRaise}
            />
        </div>
    )
}

// ─── Participant Count Badge ─────────────────────────────────────────────────
function ParticipantCount() {
    const participants = useRemoteParticipants()
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.85rem',
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
    const { room, livekitToken: cachedToken, startMeeting, minimizeMeeting, endMeeting } = useMeeting()

    const [videoData, setVideoData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [livekitToken, setLivekitToken] = useState(cachedToken || null)
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
                    startMeeting({ token: data.token, videoId, videoData, isOrganizer })
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
                                    padding: '0.85rem 1.5rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600
                                }}>
                                    Leave
                                </button>
                                <button onClick={handleAskToJoin} style={{
                                    background: '#f59e0b', color: 'white', border: 'none',
                                    padding: '0.85rem 1.5rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600
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
                                    padding: '0.85rem 1.5rem', borderRadius: 10, cursor: 'pointer', fontWeight: 600
                                }}>
                                    Return
                                </button>
                                <button onClick={handleAskToJoin} disabled={askCooldown > 0} style={{
                                    background: askCooldown > 0 ? 'rgba(99,102,241,0.5)' : '#6366f1', color: 'white', border: 'none',
                                    padding: '0.85rem 1.5rem', borderRadius: 10, cursor: askCooldown > 0 ? 'not-allowed' : 'pointer', fontWeight: 600
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
                    <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '2rem' }}>{tokenError}</p>
                    <button onClick={() => { setTokenError(null); setLivekitToken(null) }} style={{
                        background: '#6366f1', color: 'white', border: 'none',
                        padding: '0.85rem 2rem', borderRadius: 10, cursor: 'pointer',
                        fontWeight: 600, fontSize: '0.9rem'
                    }}>
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    // ── Fetching Token ──
    if (!livekitToken || !room) {
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
            room={room}
            adaptiveStream={true}
            dynacast={true}
            videoCaptureDefaults={{
                resolution: {
                    width: 1280,
                    height: 720,
                },
            }}
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
                onLeave={() => { endMeeting(); navigate(-1); }}
                onMinimize={() => { navigate(-1); minimizeMeeting(); }}
                refreshStats={refreshStats}
                toast={toast}
                waitingStudents={waitingStudents}
                setWaitingStudents={setWaitingStudents}
            />
        </LiveKitRoom>
    )
}
