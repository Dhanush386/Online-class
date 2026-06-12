import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Loader2, Video, StopCircle, Play, UserCheck } from 'lucide-react'

// Constants
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

export default function LiveClassroom() {
    const { videoId } = useParams()
    const { profile } = useAuth()
    const navigate = useNavigate()
    
    const [videoData, setVideoData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [recording, setRecording] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [gToken, setGToken] = useState(null)
    const [instructorPresent, setInstructorPresent] = useState(false)
    const [jitsiLoaded, setJitsiLoaded] = useState(false)
    
    const jitsiContainerRef = useRef(null)
    const jitsiApiRef = useRef(null)
    const mediaRecorderRef = useRef(null)
    const videoDataRef = useRef(null)
    const tokenClientRef = useRef(null)
    const uploadUrlRef = useRef(null)
    const totalBytesRecordedRef = useRef(0)

    const isOrganizer = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)

    useEffect(() => {
        // 1. Load Jitsi Script (Riot.im)
        const jitsiScript = document.createElement('script')
        jitsiScript.src = 'https://jitsi.riot.im/external_api.js'
        jitsiScript.async = true
        jitsiScript.onload = () => setJitsiLoaded(true)
        document.head.appendChild(jitsiScript)

        // 2. Load Google Script
        const gScript = document.createElement('script')
        gScript.src = 'https://accounts.google.com/gsi/client'
        gScript.async = true
        gScript.defer = true
        gScript.onload = initGoogleAuth
        document.body.appendChild(gScript)

        async function fetchVideo() {
            const { data, error } = await supabase.from('videos').select('*, courses(title)').eq('id', videoId).single()
            if (error || !data) {
                navigate(profile?.role === 'student' ? '/student/courses' : '/organizer/courses')
                return
            }
            setVideoData(data)
            videoDataRef.current = data
            setLoading(false)

            // Real-time Handshake
            const channel = supabase.channel(`class-lobby-${videoId}`, { config: { broadcast: { self: true } } })
            channel
                .on('broadcast', { event: 'check_instructor' }, () => {
                    if (isOrganizer) channel.send({ type: 'broadcast', event: 'presence', payload: { instructorJoined: true } })
                })
                .on('broadcast', { event: 'presence' }, (p) => {
                    if (p.payload.instructorJoined) setInstructorPresent(true)
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        if (isOrganizer) {
                            channel.send({ type: 'broadcast', event: 'presence', payload: { instructorJoined: true } })
                        } else {
                            channel.send({ type: 'broadcast', event: 'check_instructor', payload: {} })
                        }
                    }
                })

            return () => supabase.removeChannel(channel)
        }
    
        fetchVideo()
        return () => {
            if (jitsiApiRef.current) jitsiApiRef.current.dispose()
            document.head.removeChild(jitsiScript)
            document.body.removeChild(gScript)
        }
    }, [videoId])

    function initGoogleAuth() {
        if (!window.google) return
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (res) => { if (res.access_token) setGToken(res.access_token) }
        })
    }

    useEffect(() => {
        const canJoin = isOrganizer || instructorPresent
        if (!loading && videoData && jitsiContainerRef.current && !jitsiApiRef.current && canJoin && jitsiLoaded) {
            initJitsi(videoData)
        }
    }, [loading, videoData, profile, instructorPresent, jitsiLoaded])

    function initJitsi(data) {
        const domain = 'jitsi.riot.im' 
        const options = {
            roomName: `Learnova_LiveClass_${data.id}`,
            width: '100%',
            height: '100%',
            parentNode: jitsiContainerRef.current,
            userInfo: { 
                displayName: profile?.name || (isOrganizer ? 'Instructor' : 'Student'),
                role: isOrganizer ? 'moderator' : 'participant'
            },
            configOverwrite: { 
                prejoinPageEnabled: false, 
                disableDeepLinking: true,
                startWithAudioMuted: !isOrganizer,
                startWithVideoMuted: !isOrganizer,
                enableWelcomePage: false,
                enableNoAudioDetection: true,
                enableNoVideoDetection: true,
                p2p: { enabled: false } // Disabled: Prevents audio drops when transitioning from 1-on-1 to group mode (when late students join)
            }
        }
        jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options)

        // Auto-navigate back when the user leaves the conference
        jitsiApiRef.current.on('videoConferenceLeft', () => {
            setTimeout(() => navigate(-1), 500)
        })
    }

    // Recording System
    async function startRecording() {
        if (!gToken) return alert('Login to Google first.')
        try {
            // 1. Get Screen Stream (with System Audio)
            const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { frameRate: { ideal: 30 } }, 
                audio: { echoCancellation: true, noiseSuppression: true } 
            })

            // 2. Get Microphone Stream
            let micStream;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
            } catch (e) {
                console.warn('Microphone access denied or not available.')
            }

            // 3. Mix Audio (Microphone + System Audio)
            const audioContext = new (window.AudioContext || window.webkitAudioContext)()
            const mixedOutput = audioContext.createMediaStreamDestination()

            // Add System Audio to Mix
            if (screenStream.getAudioTracks().length > 0) {
                const systemSource = audioContext.createMediaStreamSource(screenStream)
                systemSource.connect(mixedOutput)
            }

            // Add Microphone Audio to Mix
            if (micStream && micStream.getAudioTracks().length > 0) {
                const micSource = audioContext.createMediaStreamSource(micStream)
                micSource.connect(mixedOutput)
            }

            // 4. Combine Video from Screen and Mixed Audio
            const combinedStream = new MediaStream([
                screenStream.getVideoTracks()[0],
                ...mixedOutput.stream.getAudioTracks()
            ])

            const metadata = { name: `Class_Recording_${videoDataRef.current.title}.webm`, mimeType: 'video/webm' }
            const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${gToken}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/webm' },
                body: JSON.stringify(metadata)
            })
            uploadUrlRef.current = res.headers.get('Location')
            
            mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' })
            totalBytesRecordedRef.current = 0
            
            mediaRecorderRef.current.ondataavailable = async (e) => {
                if (e.data.size > 0) {
                    const start = totalBytesRecordedRef.current
                    await fetch(uploadUrlRef.current, { method: 'PUT', headers: { 'Content-Range': `bytes ${start}-${start + e.data.size - 1}/*` }, body: e.data })
                    totalBytesRecordedRef.current += e.data.size
                }
            }
            
            mediaRecorderRef.current.onstop = async () => {
                setRecording(false); setUploading(true)
                const response = await fetch(uploadUrlRef.current, { method: 'PUT', headers: { 'Content-Range': `bytes */${totalBytesRecordedRef.current}` } })
                
                if (response.ok || response.status === 308) {
                    const text = await response.text()
                    const data = text ? JSON.parse(text) : {}
                    const fileId = data.id

                    if (fileId) {
                        const driveLink = `https://drive.google.com/file/d/${fileId}/view`
                        // Update database with the recording link
                        await supabase
                            .from('videos')
                            .update({ video_url: driveLink })
                            .eq('id', videoDataRef.current.id)
                    }
                }

                // Cleanup tracks
                screenStream.getTracks().forEach(t => t.stop())
                if (micStream) micStream.getTracks().forEach(t => t.stop())
                audioContext.close()
                
                alert('Success! Recording saved and linked to the course.'); 
                navigate('/organizer/courses')
            }
            
            mediaRecorderRef.current.start(5000)
            setRecording(true)
        } catch (err) { 
            console.error(err)
            alert('Recording setup failed. Please ensure you allow Microphone and Screen sharing (with audio).') 
        }
    }

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617' }}><Loader2 className="animate-spin" color="white" /></div>

    if (!isOrganizer && !instructorPresent) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', color: 'white', textAlign: 'center', padding: '2rem' }}>
                <div style={{ maxWidth: 400 }}>
                    <div style={{ width: 80, height: 80, background: 'rgba(99,102,241,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', animation: 'pulse 2s infinite' }}>
                        <Video size={40} color="#6366f1" />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>Waiting for Instructor</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '2rem' }}>The class will start automatically when your teacher joins. Stay tuned!</p>
                </div>
            </div>
        )
    }

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#020617' }}>
            <div style={{ padding: '1rem 2rem', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <div>
                    <h1 style={{ color: 'white', fontSize: '1rem', fontWeight: 700, margin: 0 }}>{videoData?.title}</h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.75rem', margin: 0 }}>{isOrganizer ? 'Instructor Control Panel' : 'Live Class Session'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {isOrganizer && (
                        <>
                            {!gToken ? (
                                <button onClick={() => tokenClientRef.current.requestAccessToken()} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                    <UserCheck size={16} /> Login to Drive
                                </button>
                            ) : (
                                !recording ? (
                                    <button onClick={startRecording} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <Play size={16} /> Record Class
                                    </button>
                                ) : (
                                    <button onClick={() => mediaRecorderRef.current.stop()} style={{ background: '#f87171', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                        <StopCircle size={16} /> End & Save
                                    </button>
                                )
                            )}
                        </>
                    )}
                    <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' }}>Leave Class</button>
                </div>
            </div>
            {uploading && (
                <div style={{ background: '#6366f1', color: 'white', padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                    💾 Finalizing recording and saving to Google Drive... please wait.
                </div>
            )}
            <div ref={jitsiContainerRef} style={{ flex: 1, width: '100%', background: '#000' }} />
        </div>
    )
}
