import { useEffect, useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Maximize2, PhoneOff, Users, MonitorUp } from 'lucide-react'
import { useMeeting } from '../contexts/MeetingContext'

// ─── Custom Video Preview (attaches track to <video>) ────────────────────────
function MiniVideoPreview({ track }) {
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
                    fontSize: '0.9rem', fontWeight: 700, color: 'white',
                }}>
                    📺
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
        const dist = Math.sqrt((x - c.x) ** 2 + (y - c.y) ** 2)
        if (dist < minDist) {
            minDist = dist
            nearest = c
        }
    }

    return nearest
}

// ─── Floating Meeting Widget ─────────────────────────────────────────────────
export default function FloatingMeetingWidget() {
    const {
        videoData, participantCount, isMicOn, hasScreenShare, previewTrack,
        restoreMeeting, endMeeting, toggleMicFromWidget,
        isRecording, isUploading, uploadProgress, recordingSession
    } = useMeeting()

    const [isMobile] = useState(() => window.innerWidth <= 768)

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

    // ── Drag state (desktop only) ──
    const WIDGET_W = isMobile ? 200 : 280
    const WIDGET_H = isMobile ? 56 : 180
    const [pos, setPos] = useState({ x: window.innerWidth - WIDGET_W - 16, y: window.innerHeight - WIDGET_H - 100 })
    const [isDragging, setIsDragging] = useState(false)
    const dragOffset = useRef({ x: 0, y: 0 })
    const widgetRef = useRef(null)
    const hasDragged = useRef(false)

    // ── Pointer drag handlers ──
    const handlePointerDown = useCallback((e) => {
        if (isMobile) return // No drag on mobile
        const rect = widgetRef.current?.getBoundingClientRect()
        if (!rect) return
        dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        setIsDragging(true)
        hasDragged.current = false
        e.target.setPointerCapture?.(e.pointerId)
    }, [isMobile])

    const handlePointerMove = useCallback((e) => {
        if (!isDragging) return
        hasDragged.current = true
        setPos({
            x: Math.max(0, Math.min(window.innerWidth - WIDGET_W, e.clientX - dragOffset.current.x)),
            y: Math.max(0, Math.min(window.innerHeight - WIDGET_H, e.clientY - dragOffset.current.y)),
        })
    }, [isDragging, WIDGET_W, WIDGET_H])

    const handlePointerUp = useCallback((e) => {
        if (!isDragging) return
        setIsDragging(false)
        e.target.releasePointerCapture?.(e.pointerId)

        // Snap to nearest corner
        const snapped = snapToCorner(
            e.clientX - dragOffset.current.x,
            e.clientY - dragOffset.current.y,
            WIDGET_W, WIDGET_H
        )
        setPos(snapped)
    }, [isDragging, WIDGET_W, WIDGET_H])

    // ── Reposition on window resize ──
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
    }, [WIDGET_W, WIDGET_H])

    const title = videoData?.title || 'Live Meeting'
    const truncatedTitle = title.length > 20 ? title.slice(0, 18) + '…' : title

    // ─── Mobile: Compact Pill ────────────────────────────────────────────────
    if (isMobile) {
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
                {/* Pulsing live/rec indicator */}
                <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isUploading ? '#6366f1' : isRecording ? '#ef4444' : '#22c55e',
                    boxShadow: isUploading ? '0 0 6px #6366f1' : isRecording ? '0 0 6px #ef4444' : '0 0 6px #22c55e',
                    animation: 'widgetPulse 2s infinite',
                    flexShrink: 0,
                }} />

                {isUploading ? (
                    <span style={{ color: '#818cf8', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        Uploading {uploadProgress}%
                    </span>
                ) : isRecording ? (
                    <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        REC {formatDuration(recordingDuration)}
                    </span>
                ) : null}

                {/* Title */}
                <span style={{
                    color: 'white', fontSize: '0.78rem', fontWeight: 600,
                    maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {truncatedTitle}
                </span>

                {/* Participant count */}
                <span style={{
                    color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem',
                    display: 'flex', alignItems: 'center', gap: 3,
                }}>
                    <Users size={11} /> {participantCount}
                </span>

                {/* Mic toggle */}
                <button onClick={(e) => { e.stopPropagation(); toggleMicFromWidget() }} style={{
                    background: isMicOn ? 'rgba(255,255,255,0.1)' : 'rgba(239,68,68,0.2)',
                    border: 'none', borderRadius: '50%',
                    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: isMicOn ? 'white' : '#ef4444', flexShrink: 0,
                }}>
                    {isMicOn ? <Mic size={13} /> : <MicOff size={13} />}
                </button>

                {/* Expand */}
                <button onClick={(e) => { e.stopPropagation(); restoreMeeting() }} style={{
                    background: '#6366f1', border: 'none', borderRadius: '50%',
                    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'white', flexShrink: 0,
                }}>
                    <Maximize2 size={13} />
                </button>

                {/* Leave */}
                <button onClick={(e) => { e.stopPropagation(); endMeeting() }} style={{
                    background: 'rgba(239,68,68,0.15)', border: 'none', borderRadius: '50%',
                    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#ef4444', flexShrink: 0,
                }}>
                    <PhoneOff size={13} />
                </button>

                <style>{`
                    @keyframes widgetSlideUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                    @keyframes widgetPulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.4; }
                    }
                `}</style>
            </div>
        )
    }

    // ─── Desktop: Draggable Card with Video Preview ──────────────────────────
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
            {/* Video Preview Area */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
                <MiniVideoPreview track={previewTrack} />

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
                        <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 700 }}>
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
                        <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 700 }}>
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
                background: 'rgba(15,23,42,0.98)',
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
                        color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem',
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
