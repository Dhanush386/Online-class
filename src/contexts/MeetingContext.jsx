import { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { useNavigate, useLocation, useBlocker } from 'react-router-dom'
import { Room, RoomEvent, Track } from 'livekit-client'
import { useAuth } from './AuthContext'
import FloatingMeetingWidget from '../components/FloatingMeetingWidget'
import SessionAnalyticsModal from '../components/organizer/SessionAnalyticsModal'
import { supabase } from '../lib/supabase'

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://meet.learnova.com'
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

const MeetingContext = createContext(null)
export const useMeeting = () => useContext(MeetingContext)

// ─── Navigation Guard Dialog ─────────────────────────────────────────────────
function NavigationGuardDialog({ onMinimize, onStay, onLeave, meeting }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 100000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'meetingGuardFadeIn 200ms ease-out',
        }}>
            <div style={{
                background: 'linear-gradient(145deg, #1e293b, #0f172a)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 20, padding: '2rem', maxWidth: 400, width: '90%',
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                textAlign: 'center',
            }}>
                <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(99,102,241,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                    fontSize: '1.75rem', fontWeight: 600, color: 'var(--primary)',
                    textTransform: 'uppercase'
                }}>
                    {meeting.fallbackName ? meeting.fallbackName.charAt(0) : 'A'}
                </div>
                <h3 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                    You're in a live meeting
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
                    Your meeting is still active. What would you like to do?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button onClick={onMinimize} style={{
                        width: '100%', padding: '0.85rem', borderRadius: 12,
                        background: '#6366f1', color: 'white', border: 'none',
                        fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        transition: 'all 0.15s ease',
                    }}>
                        📌 Minimize & Continue
                    </button>
                    <button onClick={onStay} style={{
                        width: '100%', padding: '0.85rem', borderRadius: 12,
                        background: 'rgba(255,255,255,0.05)', color: 'white',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}>
                        Stay in Meeting
                    </button>
                    <button onClick={onLeave} style={{
                        width: '100%', padding: '0.85rem', borderRadius: 12,
                        background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                        border: '1px solid rgba(239,68,68,0.2)',
                        fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
                        transition: 'all 0.15s ease',
                    }}>
                        Leave Meeting
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes meetingGuardFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    )
}

NavigationGuardDialog.propTypes = {
    onMinimize: PropTypes.func.isRequired,
    onStay: PropTypes.func.isRequired,
    onLeave: PropTypes.func.isRequired,
    meeting: PropTypes.shape({
        fallbackName: PropTypes.string
    })
}

function getBestPreviewTrack(room, participants) {
    for (const p of participants) {
        const screenPub = p.getTrackPublication(Track.Source.ScreenShare)
        if (screenPub?.track) return { track: screenPub.track, hasScreenShare: true }
    }
    const localScreen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
    if (localScreen?.track) return { track: localScreen.track, hasScreenShare: true }

    const speaker = room.activeSpeakers?.find(s => s.identity !== room.localParticipant.identity)
    const speakerCam = speaker?.getTrackPublication(Track.Source.Camera)?.track
    if (speakerCam) return { track: speakerCam, hasScreenShare: false }

    for (const p of participants) {
        const cam = p.getTrackPublication(Track.Source.Camera)?.track
        if (cam) return { track: cam, hasScreenShare: false }
    }
    return { track: null, hasScreenShare: false }
}

function getFallbackName(room, participants) {
    const speaker = room.activeSpeakers?.find(s => s.identity !== room.localParticipant.identity)
    if (speaker) return speaker.name || speaker.identity
    if (participants.length > 0) return participants[0].name || participants[0].identity
    
    let meta = {}
    try { meta = JSON.parse(room.localParticipant.metadata || '{}') } catch {}
    return room.localParticipant.name || meta.name || room.localParticipant.identity
}

function cleanupRecordingStreams(streams) {
    if (!streams) return;
    
    streams.screenStream.getTracks().forEach(t => t.stop())
    if (streams.micStream) streams.micStream.getTracks().forEach(t => t.stop())
    
    // Clean up LiveKit listeners to prevent duplicate recordings/echoes
    if (streams.room) {
        streams.room.off(RoomEvent.TrackSubscribed, streams.addRemoteTrack)
        streams.room.off(RoomEvent.TrackUnsubscribed, streams.removeRemoteTrack)
    }
    
    if (streams.remoteAudioNodes) {
        streams.remoteAudioNodes.forEach(({ source, gainNode }) => {
            source.disconnect();
            gainNode.disconnect();
        });
        streams.remoteAudioNodes.clear();
    }
    
    streams.audioContext.close()
}

// ─── Meeting Provider ────────────────────────────────────────────────────────
export function MeetingProvider({ children }) {
    const navigate = useNavigate()
    const location = useLocation()

    // Core meeting state
    const [meeting, setMeeting] = useState({
        isActive: false,
        isMinimized: false,
        room: null,
        token: null,
        videoId: null,
        videoData: null,
        isOrganizer: false,
        classroomPath: null,  // e.g. /organizer/classroom/abc123

        // Widget display state (updated from room events)
        participantCount: 0,
        isMicOn: false,
        hasScreenShare: false,
        previewTrack: null,
        pipWindow: null,
        livekitToken: null,

        // Recording state
        isRecording: false,
        isRecordingPaused: false,
        isUploading: false,
        uploadProgress: 0,
        recordingSession: null,
        gToken: null,
        failedUploads: {}, // { [vidId]: { finalBlob, token, durationSeconds, fileSizeMb, title } }
        
        // Post-meeting Analytics
        analyticsModalData: null,
    })

    const roomRef = useRef(null)
    const cleanupRef = useRef(null)
    const [showNavGuard, setShowNavGuard] = useState(false)
    const pendingNavigationRef = useRef(null)
    const isMinimizingRef = useRef(false)

    // Recording refs
    const tokenClientRef = useRef(null)
    const mediaRecorderRef = useRef(null)
    const recordedChunksRef = useRef([])

    const handleGoogleAuthCallback = useCallback((res) => {
        if (res.access_token) {
            setMeeting(prev => ({ ...prev, gToken: res.access_token }))
        }
    }, [])

    const handleGoogleScriptLoad = useCallback(() => {
        if (!globalThis.google || !GOOGLE_CLIENT_ID) return
        tokenClientRef.current = globalThis.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: handleGoogleAuthCallback
        })
    }, [handleGoogleAuthCallback])

    // ── Init Google Auth for Drive ──
    useEffect(() => {
        const gScript = document.createElement('script')
        gScript.src = 'https://accounts.google.com/gsi/client'
        gScript.async = true
        gScript.defer = true
        gScript.onload = handleGoogleScriptLoad
        document.body.appendChild(gScript)
        return () => {
            if (document.body.contains(gScript)) {
                gScript.remove()
            }
        }
    }, [handleGoogleScriptLoad])

    // ── Update widget state from room events ──
    const updateWidgetState = useCallback(() => {
        const room = roomRef.current
        if (!room) return

        const participants = Array.from(room.remoteParticipants.values())
        const { track: previewTrack, hasScreenShare } = getBestPreviewTrack(room, participants)
        const fallbackName = previewTrack ? null : getFallbackName(room, participants)

        setMeeting(prev => ({
            ...prev,
            participantCount: participants.length + 1,
            isMicOn: room.localParticipant.isMicrophoneEnabled,
            hasScreenShare,
            previewTrack,
            fallbackName,
        }))
    }, [])

    // ── Start Meeting ──
    const startMeeting = useCallback(async ({ token, videoId, videoData, isOrganizer }) => {
        // If already active with same video, just restore
        if (meeting.isActive && meeting.videoId === videoId && roomRef.current) {
            setMeeting(prev => ({ ...prev, isMinimized: false }))
            return roomRef.current
        }

        // End any existing meeting first
        if (roomRef.current) {
            cleanupRef.current?.()
            roomRef.current.forceDisconnect ? roomRef.current.forceDisconnect() : roomRef.current.disconnect()
            roomRef.current = null
        }

        const room = new Room({ adaptiveStream: true, dynacast: true })
        
        // Save original disconnect so we can call it manually
        room.forceDisconnect = room.disconnect.bind(room);
        room.disconnect = (...args) => {
            // Prevent third-party components (like LiveKitRoom) from disconnecting 
            // the room automatically when they unmount during navigation/minimization.
            console.log('Intercepted room.disconnect call. Connection kept alive.');
        }

        try {
            await room.connect(LIVEKIT_URL, token)
        } catch (err) {
            console.error('MeetingContext: Failed to connect room:', err)
            throw err
        }
        // By default, mic and camera are OFF for everyone (including organizer)

        roomRef.current = room

        // Wire up event listeners for widget state
        const events = [
            RoomEvent.ParticipantConnected,
            RoomEvent.ParticipantDisconnected,
            RoomEvent.TrackSubscribed,
            RoomEvent.TrackUnsubscribed,
            RoomEvent.TrackMuted,
            RoomEvent.TrackUnmuted,
            RoomEvent.ActiveSpeakersChanged,
            RoomEvent.LocalTrackPublished,
            RoomEvent.LocalTrackUnpublished,
        ]

        const bump = () => updateWidgetState()
        events.forEach(ev => room.on(ev, bump))

        // Handle unexpected disconnect
        const onDisconnect = () => {
            cleanupRef.current?.()
            roomRef.current = null
            setMeeting(prev => ({
                ...prev,
                isActive: false, isMinimized: false, room: null, token: null,
                videoId: null, videoData: null, isOrganizer: false, classroomPath: null,
                participantCount: 0, isMicOn: false, hasScreenShare: false, previewTrack: null,
            }))
        }
        room.on(RoomEvent.Disconnected, onDisconnect)

        cleanupRef.current = () => {
            events.forEach(ev => room.off(ev, bump))
            room.off(RoomEvent.Disconnected, onDisconnect)
        }

        // Determine classroom path based on role
        const rolePrefix = isOrganizer ? '/organizer' : '/student'
        const classroomPath = `${rolePrefix}/classroom/${videoId}`

        roomRef.current = room

        setMeeting(prev => ({
            ...prev,
            isActive: true,
            isMinimized: false,
            room,
            videoId,
            videoData,
            classroomPath,
            isOrganizer,
            livekitToken: token,
            participantCount: 1,
            isMicOn: true,
            hasScreenShare: false,
            previewTrack: null,
        }))

        // Initial state update after tracks arrive
        setTimeout(bump, 1000)

        return room
    }, [meeting.isActive, meeting.videoId, updateWidgetState])

    // ── Restore Meeting (expand from widget) ──
    const restoreMeeting = useCallback(() => {
        setMeeting(prev => {
            if (prev.pipWindow) {
                prev.pipWindow.close();
            }
            return { ...prev, isMinimized: false, pipWindow: null }
        })
        if (meeting.classroomPath) {
            navigate(meeting.classroomPath)
        }
    }, [meeting.classroomPath, navigate])

    const handlePipClose = useCallback(() => {
        setMeeting(prev => {
            // If it's still minimized, it means user clicked OS X button, so restore
            if (prev.isMinimized) {
                setTimeout(restoreMeeting, 0)
            }
            return { ...prev, pipWindow: null }
        })
    }, [restoreMeeting])

    // ── Minimize Meeting ──
    const minimizeMeeting = useCallback(async () => {
        isMinimizingRef.current = true
        setMeeting(prev => ({ ...prev, isMinimized: true }))

        // Attempt to open Document PiP if supported
        if (globalThis.documentPictureInPicture) {
            try {
                const pip = await globalThis.documentPictureInPicture.requestWindow({
                    width: 320,
                    height: 480,
                    disallowReturnToOpener: true
                });
                
                // Copy styles for React components and theme color
                const styles = [...document.head.querySelectorAll('style, link[rel="stylesheet"], meta[name="theme-color"]')];
                styles.forEach(node => {
                    pip.document.head.appendChild(node.cloneNode(true));
                });
                
                // Listen to PiP close
                pip.addEventListener('pagehide', handlePipClose);

                setMeeting(prev => ({ ...prev, pipWindow: pip }))
            } catch (error) {
                console.warn('PiP failed or was blocked by browser', error);
            }
        }
    }, [handlePipClose])


    // ── Recording Handlers ──
    const loginToDrive = useCallback(() => {
        if (tokenClientRef.current) {
            tokenClientRef.current.requestAccessToken()
        } else {
            console.error("Google Drive client not initialized")
            alert("Google Drive recording is disabled. Please add VITE_GOOGLE_CLIENT_ID to your .env file and restart the server.")
        }
    }, [])

    const startRecording = useCallback(async () => {
        if (!meeting.gToken) {
            alert('Login to Google Drive first.')
            return
        }
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { frameRate: { ideal: 30 } }, 
                audio: { echoCancellation: true, noiseSuppression: true } 
            })

            let micStream;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
                })
            } catch (e) {
                console.warn('Microphone access denied or not available.', e)
            }

            const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)()
            const mixedOutput = audioContext.createMediaStreamDestination()

            // 1. Screen Audio
            if (screenStream.getAudioTracks().length > 0) {
                const systemSource = audioContext.createMediaStreamSource(screenStream)
                const gainNode = audioContext.createGain()
                gainNode.gain.value = 0.8 // Slightly lower screen audio
                systemSource.connect(gainNode)
                gainNode.connect(mixedOutput)
            }

            // 2. Teacher Mic Audio
            if (micStream && micStream.getAudioTracks().length > 0) {
                const micSource = audioContext.createMediaStreamSource(micStream)
                const gainNode = audioContext.createGain()
                gainNode.gain.value = 1 // Normal mic volume
                micSource.connect(gainNode)
                gainNode.connect(mixedOutput)
            }

            // 3. LiveKit Students Audio
            const remoteAudioNodes = new Map();
            const room = roomRef.current;
            
            const addRemoteTrack = (track) => {
                if (track.kind === 'audio' && track.mediaStreamTrack) {
                    const stream = new MediaStream([track.mediaStreamTrack]);
                    const source = audioContext.createMediaStreamSource(stream);
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 1; // Normal student volume
                    source.connect(gainNode);
                    gainNode.connect(mixedOutput);
                    remoteAudioNodes.set(track.sid, { source, gainNode });
                }
            };
            
            const removeRemoteTrack = (track) => {
                if (track.kind === 'audio' && remoteAudioNodes.has(track.sid)) {
                    const { source, gainNode } = remoteAudioNodes.get(track.sid);
                    source.disconnect();
                    gainNode.disconnect();
                    remoteAudioNodes.delete(track.sid);
                }
            };

            if (room) {
                room.remoteParticipants.forEach(participant => {
                    participant.audioTrackPublications.forEach(pub => {
                        if (pub.track) addRemoteTrack(pub.track);
                    });
                });
                
                room.on(RoomEvent.TrackSubscribed, addRemoteTrack);
                room.on(RoomEvent.TrackUnsubscribed, removeRemoteTrack);
            }

            const combinedStream = new MediaStream([
                screenStream.getVideoTracks()[0],
                ...mixedOutput.stream.getAudioTracks()
            ])

            mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' })
            recordedChunksRef.current = []
            
            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunksRef.current.push(e.data)
                }
            }
            
            const startedAt = Date.now()
            const fileName = `Class_Recording_${meeting.videoData?.title || 'Unknown'}_${startedAt}.webm`
            
            mediaRecorderRef.current.__streamsToStop = { 
                screenStream, 
                micStream, 
                audioContext,
                room,
                addRemoteTrack,
                removeRemoteTrack,
                remoteAudioNodes
            }
            mediaRecorderRef.current.start(30000) // Generate chunks every 30 seconds for safety
            setMeeting(prev => ({ 
                ...prev, 
                isRecording: true,
                isRecordingPaused: false,
                recordingSession: { startedAt, fileName }
            }))
        } catch (err) { 
            console.error(err)
            alert('Recording setup failed. Please ensure you allow Microphone and Screen sharing (with audio).') 
        }
    }, [meeting.gToken, meeting.videoData])

    const handleUploadProgress = useCallback((e) => {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100)
            setMeeting(prev => ({ ...prev, uploadProgress: pct }))
        }
    }, [])

    const handleUploadComplete = useCallback(async (xhr, token, vidId, durationSeconds, fileSizeMb) => {
        if (xhr.status >= 200 && xhr.status < 300) {
            const data = JSON.parse(xhr.responseText)
            const fileId = data.id

            if (fileId) {
                try {
                    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role: 'reader', type: 'anyone' })
                    })
                } catch (permErr) {
                    console.error('Failed to set permissions on Drive file', permErr)
                }

                const driveLink = `https://drive.google.com/file/d/${fileId}/preview`
                if (vidId) {
                    await supabase
                        .from('videos')
                        .update({ 
                            video_url: driveLink,
                            drive_file_id: fileId,
                            duration_seconds: durationSeconds,
                            file_size_mb: fileSizeMb,
                            recording_status: 'completed',
                            recorded_at: new Date().toISOString()
                        })
                        .eq('id', vidId)
                }
                return true
            }
        } else {
            console.error('Upload to Drive failed:', xhr.responseText)
        }
        return false
    }, [])

    const handleRecordingStop = useCallback(async (resolve) => {
        setMeeting(prev => ({ ...prev, isRecording: false, isRecordingPaused: false, isUploading: true, uploadProgress: 0 }));
        let success = false;
        
        const streams = mediaRecorderRef.current.__streamsToStop;
        cleanupRecordingStreams(streams);

        try {
            const finalBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
            const fileSizeMb = (finalBlob.size / (1024 * 1024)).toFixed(2)
            const vidId = meeting.videoId
            const token = meeting.gToken
            const session = meeting.recordingSession
            const durationSeconds = session?.startedAt ? Math.floor((Date.now() - session.startedAt) / 1000) : 0
            const meetingTitle = meeting.videoData?.title || 'Class_Recording'

            const metadata = { name: session?.fileName || `${meetingTitle}.webm`, mimeType: 'video/webm' }
            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json; charset=UTF-8', 
                    'X-Upload-Content-Type': 'video/webm' 
                },
                body: JSON.stringify(metadata)
            })

            const uploadUrl = res.headers.get('Location')
            if (!uploadUrl) throw new Error('Failed to get Google Drive upload session URL.')

            if (vidId) {
                await supabase.from('videos').update({ recording_status: 'uploading' }).eq('id', vidId)
            }

            const uploadPromise = new Promise((resolveUpload, rejectUpload) => {
                const xhr = new XMLHttpRequest()
                xhr.open('PUT', uploadUrl)
                xhr.upload.onprogress = handleUploadProgress
                xhr.onload = async () => {
                    const ok = await handleUploadComplete(xhr, token, vidId, durationSeconds, fileSizeMb)
                    resolveUpload(ok)
                }
                xhr.onerror = () => rejectUpload(new Error('Network error during upload'))
                xhr.send(finalBlob)
            })

            success = await uploadPromise
            if (!success && vidId) {
                await supabase.from('videos').update({ recording_status: 'failed' }).eq('id', vidId)
                setMeeting(prev => ({
                    ...prev,
                    failedUploads: {
                        ...prev.failedUploads,
                        [vidId]: { finalBlob, token, durationSeconds, fileSizeMb, title: meetingTitle }
                    }
                }))
            }
        } catch (err) {
            console.error('Recording upload error:', err)
            if (meeting.videoId) {
                await supabase.from('videos').update({ recording_status: 'failed' }).eq('id', meeting.videoId)
                setMeeting(prev => ({
                    ...prev,
                    failedUploads: {
                        ...prev.failedUploads,
                        [meeting.videoId]: { 
                            finalBlob: new Blob(recordedChunksRef.current, { type: 'video/webm' }), 
                            token: meeting.gToken, 
                            durationSeconds: 0, 
                            fileSizeMb: '0.00', 
                            title: meeting.videoData?.title || 'Class_Recording' 
                        }
                    }
                }))
            }
        } finally {
            setMeeting(prev => ({ ...prev, isUploading: false, uploadProgress: 0, recordingSession: null }))
            if (success) {
                alert('Success! Recording saved and linked to the course.'); 
            } else {
                alert('Failed to save the recording to Google Drive. Please check the console.');
            }
            resolve(success)
        }
    }, [meeting.videoId, meeting.gToken, meeting.recordingSession, meeting.videoData?.title, handleUploadProgress, handleUploadComplete])

    const stopAndUploadRecording = useCallback(async () => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
        return new Promise((resolve) => {
            mediaRecorderRef.current.onstop = () => handleRecordingStop(resolve);
            mediaRecorderRef.current.stop();
        })
    }, [handleRecordingStop])

    const pauseRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.pause()
            setMeeting(prev => ({ ...prev, isRecordingPaused: true }))
        }
    }, [])

    const resumeRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'paused') {
            mediaRecorderRef.current.resume()
            setMeeting(prev => ({ ...prev, isRecordingPaused: false }))
        }
    }, [])

    // ── Retry Failed Upload ──
    const retryUpload = useCallback(async (vidId) => {
        const failedData = meeting.failedUploads[vidId]
        if (!failedData) return false

        setMeeting(prev => ({ ...prev, isUploading: true, uploadProgress: 0 }))
        let success = false
        
        try {
            const { finalBlob, token, durationSeconds, fileSizeMb, title } = failedData
            await supabase.from('videos').update({ recording_status: 'uploading' }).eq('id', vidId)

            const metadata = { name: `${title}_Retry.webm`, mimeType: 'video/webm' }
            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'application/json; charset=UTF-8', 
                    'X-Upload-Content-Type': 'video/webm' 
                },
                body: JSON.stringify(metadata)
            })

            const uploadUrl = res.headers.get('Location')
            if (!uploadUrl) throw new Error('Failed to get Drive upload session URL.')

            const onProgress = (e) => {
                if (e.lengthComputable) {
                    setMeeting(p => ({ ...p, uploadProgress: Math.round((e.loaded / e.total) * 100) }))
                }
            }

            const onLoad = async (xhr, resolveUpload) => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const data = JSON.parse(xhr.responseText)
                    const fileId = data.id
                    if (fileId) {
                        try {
                            await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ role: 'reader', type: 'anyone' })
                            })
                        } catch (e) {
                            console.error('Failed to set permissions on Drive file', e)
                        }

                        await supabase.from('videos').update({ 
                            video_url: `https://drive.google.com/file/d/${fileId}/preview`,
                            drive_file_id: fileId,
                            duration_seconds: durationSeconds,
                            file_size_mb: fileSizeMb,
                            recording_status: 'completed',
                            recorded_at: new Date().toISOString()
                        }).eq('id', vidId)
                        resolveUpload(true)
                    } else {
                        resolveUpload(false)
                    }
                } else {
                    resolveUpload(false)
                }
            }

            const uploadPromise = new Promise((resolveUpload) => {
                const xhr = new XMLHttpRequest()
                xhr.open('PUT', uploadUrl)
                xhr.upload.onprogress = onProgress
                xhr.onload = () => onLoad(xhr, resolveUpload)
                xhr.onerror = () => resolveUpload(false)
                xhr.send(finalBlob)
            })

            success = await uploadPromise
            if (success) {
                setMeeting(prev => {
                    const newFailed = { ...prev.failedUploads }
                    delete newFailed[vidId]
                    return { ...prev, failedUploads: newFailed }
                })
            } else {
                await supabase.from('videos').update({ recording_status: 'failed' }).eq('id', vidId)
            }
        } catch (err) {
            console.error('Retry error:', err)
            await supabase.from('videos').update({ recording_status: 'failed' }).eq('id', vidId)
        } finally {
            setMeeting(prev => ({ ...prev, isUploading: false, uploadProgress: 0 }))
        }
        return success
    }, [meeting.failedUploads])

    const deleteFailedUpload = useCallback(async (vidId) => {
        setMeeting(prev => {
            const newFailed = { ...prev.failedUploads }
            delete newFailed[vidId]
            return { ...prev, failedUploads: newFailed }
        })
        await supabase.from('videos').update({ recording_status: 'failed', drive_file_id: 'DELETED' }).eq('id', vidId)
    }, [])

    const deleteRecordingFromDrive = useCallback(async (vidId, driveFileId) => {
        if (!meeting.gToken) {
            console.error('No Google token available for deletion.');
            return false;
        }
        
        try {
            if (driveFileId && driveFileId !== 'DELETED') {
                const res = await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${meeting.gToken}` }
                });
                if (!res.ok && res.status !== 404) {
                    console.warn('Failed to delete from Google Drive, or it was already deleted.');
                }
            }
            
            await supabase.from('videos').update({
                recording_status: null,
                drive_file_id: null,
                duration_seconds: null,
                file_size_mb: null,
                video_url: null,
                recorded_at: null
            }).eq('id', vidId);
            
            return true;
        } catch (err) {
            console.error('Delete recording error:', err);
            alert('Failed to delete the recording.');
            return false;
        }
    }, [meeting.gToken, loginToDrive])

    // ── End Meeting ──
    const endMeeting = useCallback(() => {
        // Capture data for Session Analytics Modal if organizer
        if (meeting.isOrganizer && meeting.videoId) {
            setMeeting(prev => ({
                ...prev,
                analyticsModalData: {
                    videoId: prev.videoId,
                    videoData: prev.videoData,
                }
            }))
        }

        cleanupRef.current?.()
        if (roomRef.current) {
            roomRef.current.forceDisconnect ? roomRef.current.forceDisconnect() : roomRef.current.disconnect()
            roomRef.current = null
        }
        
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            stopAndUploadRecording()
        }

        setMeeting(prev => ({
            ...prev,
            isActive: false, isMinimized: false, room: null, token: null,
            videoId: null, videoData: null, isOrganizer: false, classroomPath: null,
            participantCount: 0, isMicOn: false, hasScreenShare: false, previewTrack: null,
            isRecording: false, isRecordingPaused: false, // isUploading, uploadProgress, recordingSession stay if uploading
        }))
    }, [meeting.isOrganizer, meeting.videoId, meeting.videoData, stopAndUploadRecording])

    // ── Toggle Mic (from widget) ──
    const toggleMicFromWidget = useCallback(async () => {
        const room = roomRef.current
        if (!room) return
        const lp = room.localParticipant
        const newState = !lp.isMicrophoneEnabled
        await lp.setMicrophoneEnabled(newState)
        setMeeting(prev => ({ ...prev, isMicOn: newState }))
    }, [])

    // ── Check if user is navigating away from classroom ──
    const isInClassroom = meeting.classroomPath && location.pathname === meeting.classroomPath
    const prevLocationRef = useRef(location.pathname)

    useEffect(() => {
        if (!meeting.isActive || meeting.isMinimized) {
            prevLocationRef.current = location.pathname
            return
        }

        const wasInClassroom = prevLocationRef.current && meeting.classroomPath &&
            prevLocationRef.current.includes('/classroom/')
        const nowInClassroom = location.pathname.includes('/classroom/')

        // If navigating away from classroom while meeting is active
        if (wasInClassroom && !nowInClassroom && !isMinimizingRef.current) {
            // Auto-minimize the meeting instead of showing a guard
            // (The guard was triggered by explicit nav link clicks — handled in layouts)
            setMeeting(prev => ({ ...prev, isMinimized: true }))
        }

        isMinimizingRef.current = false
        prevLocationRef.current = location.pathname
    }, [location.pathname, meeting.isActive, meeting.isMinimized, meeting.classroomPath])

    // ── Navigation Guard Handlers ──
    const handleNavGuardMinimize = useCallback(() => {
        minimizeMeeting()
        setShowNavGuard(false)
        if (pendingNavigationRef.current) {
            navigate(pendingNavigationRef.current)
            pendingNavigationRef.current = null
        }
    }, [minimizeMeeting, navigate])

    const handleNavGuardStay = useCallback(() => {
        setShowNavGuard(false)
        pendingNavigationRef.current = null
    }, [])

    // Exposed: used by layout nav links to trigger guard
    const requestNavigation = useCallback((targetPath) => {
        if (meeting.isActive && !meeting.isMinimized && location.pathname.includes('/classroom/')) {
            pendingNavigationRef.current = targetPath
            setShowNavGuard(true)
            return true // Navigation was intercepted
        }
        return false // Let navigation proceed normally
    }, [meeting.isActive, meeting.isMinimized, location.pathname])

    const { user, signOut } = useAuth()
    const [showLogoutGuard, setShowLogoutGuard] = useState(false)

    // ── Global Browser Navigation Interception ──
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) => {
            const isClassroom = meeting.isActive && !meeting.isMinimized && currentLocation.pathname.includes('/classroom/') && nextLocation.pathname !== currentLocation.pathname
            const isLogout = !!user && nextLocation.pathname === '/login' && currentLocation.pathname !== '/login'
            return isClassroom || isLogout
        }
    )

    useEffect(() => {
        if (blocker.state === 'blocked') {
            const isLogout = blocker.location.pathname === '/login'
            const isClassroom = meeting.isActive && !meeting.isMinimized && location.pathname.includes('/classroom/')
            
            if (isLogout && !isClassroom) {
                setShowLogoutGuard(true)
            } else {
                pendingNavigationRef.current = blocker.location.pathname
                setShowNavGuard(true)
            }
        }
    }, [blocker.state, blocker.location, meeting.isActive, meeting.isMinimized, location.pathname])

    // Update nav guard leave to handle blocker
    const handleNavGuardLeave = useCallback(() => {
        endMeeting()
        setShowNavGuard(false)
        if (blocker.state === 'blocked') {
            blocker.proceed()
        } else if (pendingNavigationRef.current) {
            navigate(pendingNavigationRef.current)
            pendingNavigationRef.current = null
        }
    }, [endMeeting, navigate, blocker])

    const handleNavGuardCancel = useCallback(() => {
        setShowNavGuard(false)
        if (blocker.state === 'blocked') {
            blocker.reset()
        }
        pendingNavigationRef.current = null
    }, [blocker])

    const handleLogoutConfirm = async () => {
        if (signOut) await signOut()
        setShowLogoutGuard(false)
        if (blocker.state === 'blocked') blocker.proceed()
    }

    const handleLogoutCancel = () => {
        setShowLogoutGuard(false)
        if (blocker.state === 'blocked') blocker.reset()
    }

    // ── Browser close/refresh warning ──
    useEffect(() => {
        if (!meeting.isActive && !meeting.isUploading) return
        const handleBeforeUnload = (e) => {
            if (meeting.isUploading) {
                e.preventDefault()
                e.returnValue = 'Your recording is still uploading to Google Drive! If you leave now, the recording will be lost.'
                return e.returnValue
            }
            if (meeting.isActive) {
                e.preventDefault()
                e.returnValue = 'You are in an active meeting. Leaving this page will disconnect you.'
                return e.returnValue
            }
        }
        globalThis.addEventListener('beforeunload', handleBeforeUnload)
        return () => globalThis.removeEventListener('beforeunload', handleBeforeUnload)
    }, [meeting.isActive, meeting.isUploading])

    const closeAnalyticsModal = useCallback(() => setMeeting(prev => ({ ...prev, analyticsModalData: null })), []);

    const value = useMemo(() => ({
        ...meeting,
        startMeeting,
        minimizeMeeting,
        restoreMeeting,
        endMeeting,
        toggleMicFromWidget,
        requestNavigation,
        isInClassroom,
        loginToDrive,
        startRecording,
        pauseRecording,
        resumeRecording,
        stopAndUploadRecording,
        retryUpload,
        deleteFailedUpload,
        deleteRecordingFromDrive,
        closeAnalyticsModal,
    }), [
        meeting,
        startMeeting,
        minimizeMeeting,
        restoreMeeting,
        endMeeting,
        toggleMicFromWidget,
        requestNavigation,
        isInClassroom,
        loginToDrive,
        startRecording,
        pauseRecording,
        resumeRecording,
        stopAndUploadRecording,
        retryUpload,
        deleteFailedUpload,
        deleteRecordingFromDrive,
        closeAnalyticsModal
    ])

    return (
        <MeetingContext.Provider value={value}>
            {children}

            {/* Floating Widget — shown when meeting is minimized */}
            {meeting.isActive && meeting.isMinimized && (
                <FloatingMeetingWidget />
            )}

            {meeting.analyticsModalData && (
                <SessionAnalyticsModal 
                    modalData={meeting.analyticsModalData} 
                    onClose={() => value.closeAnalyticsModal()} 
                />
            )}

            {/* Navigation Guard Dialog */}
            {showNavGuard && (
                <NavigationGuardDialog
                    onMinimize={handleNavGuardMinimize}
                    onStay={handleNavGuardStay}
                    onLeave={handleNavGuardLeave}
                    meeting={meeting}
                />
            )}

            {/* Global Uploading Toast */}
            {meeting.isUploading && (
                <div style={{
                    position: 'fixed', top: 20, right: 20, zIndex: 99999,
                    background: '#6366f1', color: 'white', padding: '1rem',
                    borderRadius: 12, boxShadow: '0 10px 25px rgba(99,102,241,0.4)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    animation: 'slideInRight 0.3s ease-out'
                }}>
                    <div style={{ width: 24, height: 24, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Uploading Recording... {meeting.uploadProgress}%</span>
                        <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>Please do not close this browser tab.</span>
                    </div>
                </div>
            )}
            </AnimatePresence>

            {/* Logout Guard */}
            <AnimatePresence>
                {showLogoutGuard && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ background: 'var(--bg-base)', padding: '1.5rem', borderRadius: 12, width: '90%', maxWidth: 400 }}>
                            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Sign Out?</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Are you sure you want to sign out of your account?</p>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button onClick={handleLogoutCancel} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                                <button onClick={handleLogoutConfirm} className="btn-primary" style={{ padding: '0.5rem 1rem', background: '#ef4444' }}>Sign Out</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </MeetingContext.Provider>
    )
}

MeetingProvider.propTypes = {
    children: PropTypes.node.isRequired
}
