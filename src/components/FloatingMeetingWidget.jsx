import { useEffect, useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Maximize2, PhoneOff, Users, MonitorUp } from 'lucide-react'
import { Track, RoomEvent } from 'livekit-client'
import { useMeeting } from '../contexts/MeetingContext'
import PropTypes from 'prop-types'

// ─── Custom Video Preview (attaches track to <video>) ────────────────────────
function MiniVideoPreview({ track, fallbackName }) {
    const videoRef = useRef(null)

    useEffect(() => {
        const el = videoRef.current
        if (el && track) {
            track.attach(el)
            return () => track.detach(el)
        }
    }, [track])

    if (!track) {
        return (
            <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', fontWeight: 600, color: 'white',
                    textTransform: 'uppercase'
                }}>
                    {fallbackName ? fallbackName.charAt(0) : 'A'}
                </div>
            </div>
        )
    }

    return (
        <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
                width: '100%', height: '100%',
                objectFit: 'cover',
                background: 'black',
                pointerEvents: 'none',
            }}
        />
    )
}

MiniVideoPreview.propTypes = {
    track: PropTypes.instanceOf(Track),
    fallbackName: PropTypes.string
}

// ─── Custom Audio Track ──────────────────────────────────────────────────────
function CustomAudioTrack({ track }) {
    const audioRef = useRef(null)
    useEffect(() => {
        const el = audioRef.current
        if (el && track) {
            track.attach(el)
            return () => track.detach(el)
        }
    }, [track])
    return (
        <audio ref={audioRef} autoPlay>
            <track kind="captions" />
        </audio>
    )
}

CustomAudioTrack.propTypes = {
    track: PropTypes.instanceOf(Track)
}

// ─── Remote Audio Renderer (Global for Widget) ───────────────────────────────
function RemoteAudioRenderer() {
    const { room } = useMeeting()
    const [tracks, setTracks] = useState([])

    useEffect(() => {
        if (!room) return
        const updateTracks = () => {
            const newTracks = []
            room.remoteParticipants.forEach(p => {
                const pub = p.getTrackPublication(Track.Source.Microphone)
                if (pub?.track) {
                    newTracks.push(pub.track)
                }
            })
            setTracks(newTracks)
        }
        
        updateTracks()
        
        room.on(RoomEvent.TrackSubscribed, updateTracks)
        room.on(RoomEvent.TrackUnsubscribed, updateTracks)
        room.on(RoomEvent.ParticipantConnected, updateTracks)
        room.on(RoomEvent.ParticipantDisconnected, updateTracks)
        room.on(RoomEvent.TrackMuted, updateTracks)
        room.on(RoomEvent.TrackUnmuted, updateTracks)

        return () => {
            room.off(RoomEvent.TrackSubscribed, updateTracks)
            room.off(RoomEvent.TrackUnsubscribed, updateTracks)
            room.off(RoomEvent.ParticipantConnected, updateTracks)
            room.off(RoomEvent.ParticipantDisconnected, updateTracks)
            room.off(RoomEvent.TrackMuted, updateTracks)
            room.off(RoomEvent.TrackUnmuted, updateTracks)
        }
    }, [room])

    return (
        <div style={{ display: 'none' }}>
            {tracks.map(t => <CustomAudioTrack key={t.sid} track={t} />)}
        </div>
    )
}

// ─── Snap to nearest corner ──────────────────────────────────────────────────
function snapToCorner(x, y, widgetW, widgetH) {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 16

    const corners = [
        { x: pad, y: pad },                                       // top-left
        { x: vw - widgetW - pad, y: pad },                        // top-right
        { x: pad, y: vh - widgetH - pad },                        // bottom-left
        { x: vw - widgetW - pad, y: vh - widgetH - pad },         // bottom-right
    ]

    let nearest = corners[3] // default bottom-right
    let minDist = Infinity

    for (const c of corners) {
        const dist = Math.hypot(x - c.x, y - c.y)
        if (dist < minDist) {
            minDist = dist
            nearest = c
        }
    }

    return nearest
}

// ─── Floating Meeting Widget ─────────────────────────────────────────────────
// ─── Widget Content (Used for both Draggable and PiP) ───────────────────────
function WidgetContent({ isPip }) {
    const {
        videoData, participantCount, isMicOn, hasScreenShare, previewTrack, fallbackName,
        restoreMeeting, endMeeting, toggleMicFromWidget,
        isRecording, isUploading, uploadProgress, recordingSession
    } = useMeeting()

    const [recordingDuration, setRecordingDuration] = useState(0)

    useEffect(() => {
        let interval;
        if (isRecording && recordingSession?.startedAt) {
            interval = setInterval(() => {
                setRecordingDuration(Math.floor((Date.now() - recordingSession.startedAt) / 1000))
            }, 1000)
            setRecordingDuration(Math.floor((Date.now() - recordingSession.startedAt) / 1000))
        } else {
            setRecordingDuration(0)
        }
        return () => clearInterval(interval)
    }, [isRecording, recordingSession?.startedAt])

    const formatDuration = (seconds) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${h ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const title = videoData?.title || 'Live Meeting'
    const truncatedTitle = title.length > 20 ? title.slice(0, 18) + '…' : title

    return (
        <div style={{
            width: '100%',
            height: isPip ? '100vh' : '100%',
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(15,23,42,1)',
            overflow: 'hidden',
        }}>
            {/* Video Preview Area */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
                <MiniVideoPreview track={previewTrack} fallbackName={fallbackName} />

                {/* Screen share badge */}
                {hasScreenShare && (
                    <div style={{
                        position: 'absolute', top: 6, left: 6,
                        background: 'rgba(99,102,241,0.9)', color: 'white',
                        padding: '2px 6px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                        <MonitorUp size={10} /> Screen
                    </div>
                )}

                {/* Upload indicator */}
                {isUploading && (
                    <div style={{
                        position: 'absolute', top: 6, right: 6,
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'rgba(99,102,241,0.9)', padding: '3px 8px', borderRadius: 6,
                        boxShadow: '0 2px 10px rgba(99,102,241,0.5)',
                    }}>
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: 'white',
                            animation: 'widgetPulse 2s infinite',
                        }} />
                        <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 700 }}>
                            Up: {uploadProgress}%
                        </span>
                    </div>
                )}

                {/* Recording indicator */}
                {!isUploading && isRecording && (
                    <div style={{
                        position: 'absolute', top: 6, right: 6,
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'rgba(239,68,68,0.9)', padding: '3px 8px', borderRadius: 6,
                        boxShadow: '0 2px 10px rgba(239,68,68,0.5)',
                    }}>
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: 'white',
                            animation: 'widgetPulse 2s infinite',
                        }} />
                        <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 700 }}>
                            REC {formatDuration(recordingDuration)}
                        </span>
                    </div>
                )}

                {/* Live indicator (hide if recording) */}
                {!isUploading && !isRecording && (
                    <div style={{
                        position: 'absolute', top: 6, right: 6,
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: 'rgba(0,0,0,0.6)', padding: '3px 8px', borderRadius: 6,
                    }}>
                        <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: '#22c55e', boxShadow: '0 0 6px #22c55e',
                            animation: 'widgetPulse 2s infinite',
                        }} />
                        <span style={{ color: 'white', fontSize: '0.6rem', fontWeight: 700 }}>LIVE</span>
                    </div>
                )}
            </div>

            {/* Bottom Controls Bar */}
            <div style={{
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 10px',
                background: 'rgba(15,23,42,1)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
            }}>
                {/* Left: Title + Participants */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    minWidth: 0, flex: 1,
                }}>
                    <span style={{
                        color: 'white', fontSize: '0.72rem', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 100,
                    }}>
                        {truncatedTitle}
                    </span>
                    <span style={{
                        color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem',
                        display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
                    }}>
                        <Users size={10} /> {participantCount}
                    </span>
                </div>

                {/* Right: Action Buttons */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {/* Mic Toggle */}
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleMicFromWidget() }}
                        title={isMicOn ? 'Mute' : 'Unmute'}
                        style={{
                            width: 28, height: 28, borderRadius: '50%', border: 'none',
                            background: isMicOn ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.2)',
                            color: isMicOn ? 'white' : '#ef4444',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        {isMicOn ? <Mic size={12} /> : <MicOff size={12} />}
                    </button>

                    {/* Expand */}
                    <button
                        onClick={(e) => { e.stopPropagation(); restoreMeeting() }}
                        title="Return to Meeting"
                        style={{
                            width: 28, height: 28, borderRadius: '50%', border: 'none',
                            background: '#6366f1', color: 'white',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <Maximize2 size={12} />
                    </button>

                    {/* Leave */}
                    <button
                        onClick={(e) => { e.stopPropagation(); endMeeting() }}
                        title="Leave Meeting"
                        style={{
                            width: 28, height: 28, borderRadius: '50%', border: 'none',
                            background: '#ef4444', color: 'white',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s ease',
                        }}
                    >
                        <PhoneOff size={12} />
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes widgetSlideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes widgetPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
            `}</style>
        </div>
    )
}

// ─── Floating Meeting Widget ─────────────────────────────────────────────────
import { createPortal } from 'react-dom'

function MobileWidget({ isUploading, isRecording, truncatedTitle, restoreMeeting }) {
    let indicatorColor = '#22c55e'
    if (isUploading) {
        indicatorColor = '#6366f1'
    } else if (isRecording) {
        indicatorColor = '#ef4444'
    }

    return (
        <div style={{
            position: 'fixed',
            bottom: 24,
            right: 16,
            zIndex: 99999,
            background: 'rgba(15,23,42,0.95)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: 28,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.15)',
            backdropFilter: 'blur(16px)',
            animation: 'widgetSlideUp 300ms ease-out',
            cursor: 'pointer',
        }}>
            <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: indicatorColor,
                boxShadow: `0 0 6px ${indicatorColor}`,
                animation: 'widgetPulse 2s infinite',
                flexShrink: 0,
            }} />

            <span style={{
                color: 'white', fontSize: '0.78rem', fontWeight: 600,
                maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
                {truncatedTitle}
            </span>

            <button onClick={(e) => { e.stopPropagation(); restoreMeeting() }} style={{
                background: '#6366f1', border: 'none', borderRadius: '50%',
                width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: 'white', flexShrink: 0,
            }}>
                <Maximize2 size={13} />
            </button>
        </div>
    )
}

function PipWidget({ pipWindow, restoreMeeting }) {
    return (
        <>
            {createPortal(<WidgetContent isPip={true} />, pipWindow.document.body)}
            {/* Banner inside Main Window */}
            <div style={{
                position: 'fixed',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 99999,
                background: 'rgba(15,23,42,0.95)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: 28,
                padding: '10px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.15)',
                backdropFilter: 'blur(16px)',
                animation: 'widgetSlideUp 300ms ease-out',
            }}>
                <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 500 }}>
                    🖼 Meeting running in Picture-in-Picture
                </span>
                <button
                    onClick={() => restoreMeeting()}
                    style={{
                        background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.5)',
                        borderRadius: 20, padding: '6px 16px', color: '#818cf8', fontWeight: 600,
                        cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s',
                    }}
                    onMouseOver={e => e.target.style.background = 'rgba(99,102,241,0.3)'}
                    onMouseOut={e => e.target.style.background = 'rgba(99,102,241,0.2)'}
                    onFocus={e => e.target.style.background = 'rgba(99,102,241,0.3)'}
                    onBlur={e => e.target.style.background = 'rgba(99,102,241,0.2)'}
                >
                    Restore
                </button>
                <style>{`
                    @keyframes widgetSlideUp {
                        from { opacity: 0; transform: translate(-50%, 20px) scale(0.95); }
                        to { opacity: 1; transform: translate(-50%, 0) scale(1); }
                    }
                `}</style>
            </div>
        </>
    )
}

function DraggableWidget() {
    const WIDGET_W = 280
    const WIDGET_H = 180
    const [pos, setPos] = useState({ x: window.innerWidth - WIDGET_W - 16, y: window.innerHeight - WIDGET_H - 100 })
    const [isDragging, setIsDragging] = useState(false)
    const dragOffset = useRef({ x: 0, y: 0 })
    const widgetRef = useRef(null)
    const hasDragged = useRef(false)

    const handlePointerDown = useCallback((e) => {
        const rect = widgetRef.current?.getBoundingClientRect()
        if (!rect) return
        dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        setIsDragging(true)
        hasDragged.current = false
        e.target.setPointerCapture?.(e.pointerId)
    }, [])

    const handlePointerMove = useCallback((e) => {
        if (!isDragging) return
        hasDragged.current = true
        setPos({
            x: Math.max(0, Math.min(window.innerWidth - WIDGET_W, e.clientX - dragOffset.current.x)),
            y: Math.max(0, Math.min(window.innerHeight - WIDGET_H, e.clientY - dragOffset.current.y)),
        })
    }, [isDragging])

    const handlePointerUp = useCallback((e) => {
        if (!isDragging) return
        setIsDragging(false)
        e.target.releasePointerCapture?.(e.pointerId)

        const snapped = snapToCorner(
            e.clientX - dragOffset.current.x,
            e.clientY - dragOffset.current.y,
            WIDGET_W, WIDGET_H
        )
        setPos(snapped)
    }, [isDragging])

    useEffect(() => {
        const handleResize = () => {
            setPos(prev => {
                const x = Math.min(prev.x, window.innerWidth - WIDGET_W - 16)
                const y = Math.min(prev.y, window.innerHeight - WIDGET_H - 100)
                return { x: Math.max(16, x), y: Math.max(16, y) }
            })
        }
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    return (
        <div
            ref={widgetRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
                position: 'fixed',
                left: pos.x,
                top: pos.y,
                width: WIDGET_W,
                height: WIDGET_H,
                zIndex: 99999,
                borderRadius: 16,
                overflow: 'hidden',
                background: 'rgba(15,23,42,0.98)',
                border: '1px solid rgba(99,102,241,0.25)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)',
                backdropFilter: 'blur(16px)',
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                transition: isDragging ? 'none' : 'left 300ms ease, top 300ms ease',
                animation: 'widgetSlideUp 300ms ease-out',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <WidgetContent isPip={false} />
        </div>
    )
}

export default function FloatingMeetingWidget() {
    const {
        videoData, pipWindow, restoreMeeting,
        isRecording, isUploading
    } = useMeeting()

    const [isMobile] = useState(() => window.innerWidth <= 768)

    const title = videoData?.title || 'Live Meeting'
    const truncatedTitle = title.length > 20 ? title.slice(0, 18) + '…' : title

    const renderWidgetContent = () => {
        if (isMobile) {
            return <MobileWidget 
                isUploading={isUploading} 
                isRecording={isRecording} 
                truncatedTitle={truncatedTitle} 
                restoreMeeting={restoreMeeting} 
            />
        }
        if (pipWindow) {
            return <PipWidget 
                pipWindow={pipWindow} 
                restoreMeeting={restoreMeeting} 
            />
        }
        return <DraggableWidget />
    }

    return (
        <>
            <RemoteAudioRenderer />
            {renderWidgetContent()}
        </>
    )
}

WidgetContent.propTypes = {
    isPip: PropTypes.bool
}

MobileWidget.propTypes = {
    isUploading: PropTypes.bool,
    isRecording: PropTypes.bool,
    truncatedTitle: PropTypes.string,
    restoreMeeting: PropTypes.func
}

PipWidget.propTypes = {
    pipWindow: PropTypes.object,
    restoreMeeting: PropTypes.func
}
