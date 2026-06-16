import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../components/Toast'
import { Loader2, Video, StopCircle, Play, UserCheck, MessageSquare, BarChart2, Edit3, Users, Hand, Maximize, Minimize } from 'lucide-react'

import LiveNotes from '../../components/live-classroom/LiveNotes'
import LivePolls from '../../components/live-classroom/LivePolls'
import LiveAttendance from '../../components/live-classroom/LiveAttendance'
import LiveQA from '../../components/live-classroom/LiveQA'
import LiveHandRaise from '../../components/live-classroom/LiveHandRaise'

// Constants
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY

export default function LiveClassroom() {
    const { videoId } = useParams()
    const { profile, refreshStats } = useAuth()
    const navigate = useNavigate()
    const toast = useToast()
    
    const [videoData, setVideoData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [recording, setRecording] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [gToken, setGToken] = useState(null)
    const [instructorPresent, setInstructorPresent] = useState(false)
    const [jitsiLoaded, setJitsiLoaded] = useState(false)
    const [sidebarTab, setSidebarTab] = useState('notes')
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [channelInstance, setChannelInstance] = useState(null)
    
    const jitsiContainerRef = useRef(null)
    const jitsiApiRef = useRef(null)
    const mediaRecorderRef = useRef(null)
    const videoDataRef = useRef(null)
    const tokenClientRef = useRef(null)
    const uploadUrlRef = useRef(null)
    const totalBytesRecordedRef = useRef(0)
    const containerRef = useRef(null)

    const isOrganizer = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)
    const [isFullScreen, setIsFullScreen] = useState(false)

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement)
        }
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

    useEffect(() => {
        // 1. Load 8x8 Jitsi Script
        const appId = import.meta.env.VITE_8X8_APP_ID || '';
        const jitsiScript = document.createElement('script')
        jitsiScript.src = 'https://meet.jit.si/external_api.js'
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
            let intervalId = null;
            const channel = supabase.channel(`class-lobby-${videoId}`, { config: { broadcast: { self: true } } })
            setChannelInstance(channel)
            channel
                .on('broadcast', { event: 'check_instructor' }, () => {
                    if (isOrganizer) channel.send({ type: 'broadcast', event: 'presence', payload: { instructorJoined: true } })
                })
                .on('broadcast', { event: 'presence' }, (p) => {
                    if (p.payload.instructorJoined) {
                        setInstructorPresent(true)
                        if (intervalId) {
                            clearInterval(intervalId)
                            intervalId = null
                        }
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

            return () => {
                if (intervalId) clearInterval(intervalId)
                supabase.removeChannel(channel)
            }
        }
    
        fetchVideo()
        return () => {
            if (jitsiApiRef.current) jitsiApiRef.current.dispose()
            document.head.removeChild(jitsiScript)
            document.body.removeChild(gScript)
        }
    }, [videoId])

    function initGoogleAuth() {
        if (!window.google || !GOOGLE_CLIENT_ID) return
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
        const domain = 'meet.jit.si' 
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
                toolbarButtons: [
                    'camera', 'chat', 'closedcaptions', 'desktop', 'download', 'hangup', 'highlight', 'microphone', 'participants-pane', 'profile', 'raisehand', 'recording', 'security', 'select-background', 'settings', 'shareaudio', 'sharedvideo', 'shortcuts', 'stats', 'tileview', 'toggle-camera', 'videoquality', '__end'
                ],
                p2p: { enabled: false } // Disabled: Prevents audio drops when transitioning from 1-on-1 to group mode (when late students join)
            }
        }
        jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options)

        let joinTime = null;
        let attendanceInterval = null;
        let attendanceMarked = false;

        jitsiApiRef.current.on('videoConferenceJoined', () => {
            if (!isOrganizer && profile?.id) {
                joinTime = Date.now();
                // Initial insert
                supabase.from('live_attendance').upsert({
                    student_id: profile.id,
                    video_id: data.id,
                    course_id: data.course_id,
                    joined_at: new Date(joinTime).toISOString()
                }, { onConflict: 'student_id,video_id' }).then(({ error }) => {
                    if (error) console.error('Failed to init attendance:', error)
                })

                // Start duration tracking
                attendanceInterval = setInterval(async () => {
                    if (!joinTime) return;
                    const durationSec = Math.floor((Date.now() - joinTime) / 1000);
                    const isSufficient = durationSec >= 300; // 5 minutes

                    const updateData = {
                        student_id: profile.id,
                        video_id: data.id,
                        left_at: new Date().toISOString(),
                        duration_seconds: durationSec
                    };

                    if (isSufficient && !attendanceMarked) {
                        updateData.attendance_status = 'present';
                        updateData.streak_awarded = true;
                        attendanceMarked = true;
                        
                        toast.success('🎉 Attendance Marked! +20 XP earned');
                        
                        // Award XP
                        const { data: userProfile } = await supabase.from('users').select('xp').eq('id', profile.id).single();
                        if (userProfile) {
                            await supabase.from('users').update({ xp: (userProfile.xp || 0) + 20 }).eq('id', profile.id);
                            refreshStats(); // Update streak and XP context
                        }
                    } else if (!attendanceMarked) {
                         updateData.attendance_status = 'insufficient_time';
                    }

                    supabase.from('live_attendance').upsert(updateData, { onConflict: 'student_id,video_id' })
                        .then(({error}) => { if(error) console.error(error) });

                }, 10000); // Check every 10s
            }
        });

        // Auto-navigate back when the user leaves the conference
        jitsiApiRef.current.on('videoConferenceLeft', () => {
            if (attendanceInterval) clearInterval(attendanceInterval);
            if (!isOrganizer && !attendanceMarked && joinTime) {
                const durationSec = Math.floor((Date.now() - joinTime) / 1000);
                toast.warning(`⚠️ You attended only ${Math.floor(durationSec/60)} minutes. Stay at least 5 mins for credit.`);
                
                // Final save
                supabase.from('live_attendance').upsert({
                    student_id: profile.id,
                    video_id: data.id,
                    left_at: new Date().toISOString(),
                    duration_seconds: durationSec,
                    attendance_status: 'insufficient_time'
                }, { onConflict: 'student_id,video_id' }).then();
            }
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

            mediaRecorderRef.current = new MediaRecorder(combinedStream, { mimeType: 'video/webm; codecs=vp9,opus' })
            const recordedChunks = []
            
            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    recordedChunks.push(e.data)
                }
            }
            
            mediaRecorderRef.current.onstop = async () => {
                setRecording(false); 
                setUploading(true);
                let success = false;

                try {
                    const finalBlob = new Blob(recordedChunks, { type: 'video/webm' })
                    
                    // 1. Get Resumable Session URL
                    const metadata = { name: `Class_Recording_${videoDataRef.current.title}.webm`, mimeType: 'video/webm' }
                    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
                        method: 'POST',
                        headers: { 
                            'Authorization': `Bearer ${gToken}`, 
                            'Content-Type': 'application/json; charset=UTF-8', 
                            'X-Upload-Content-Type': 'video/webm' 
                        },
                        body: JSON.stringify(metadata)
                    })

                    const uploadUrl = res.headers.get('Location')
                    if (!uploadUrl) throw new Error('Failed to get Google Drive upload session URL.')

                    // 2. Upload the entire video file to the session URL
                    const uploadRes = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Length': finalBlob.size.toString() },
                        body: finalBlob
                    })

                    if (uploadRes.ok) {
                        const data = await uploadRes.json()
                        const fileId = data.id

                        if (fileId) {
                            // Set permissions to anyone with the link
                            try {
                                await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
                                    method: 'POST',
                                    headers: { 'Authorization': `Bearer ${gToken}`, 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ role: 'reader', type: 'anyone' })
                                })
                            } catch (permErr) {
                                console.error('Failed to set permissions on Drive file', permErr)
                            }

                            const driveLink = `https://drive.google.com/file/d/${fileId}/view`
                            // Update database with the recording link
                            await supabase
                                .from('videos')
                                .update({ video_url: driveLink })
                                .eq('id', videoDataRef.current.id)
                            
                            success = true;
                        }
                    } else {
                        console.error('Upload to Drive failed:', await uploadRes.text())
                    }
                } catch (err) {
                    console.error('Recording upload error:', err)
                } finally {
                    // Cleanup tracks
                    screenStream.getTracks().forEach(t => t.stop())
                    if (micStream) micStream.getTracks().forEach(t => t.stop())
                    audioContext.close()
                    
                    setUploading(false)
                    if (success) {
                        alert('Success! Recording saved and linked to the course.'); 
                    } else {
                        alert('Failed to save the recording to Google Drive. Please check the console.');
                    }
                    navigate('/organizer/courses')
                }
            }
            
            mediaRecorderRef.current.start(1000)
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
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>The class will start automatically when your teacher joins. Stay tuned!</p>
                </div>
            </div>
        )
    }

    return (
        <div ref={containerRef} style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#020617' }}>
            <div style={{ padding: '1rem 2rem', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
                <div>
                    <h1 style={{ color: 'white', fontSize: '1rem', fontWeight: 700, margin: 0 }}>{videoData?.title}</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: 0 }}>{isOrganizer ? 'Instructor Control Panel' : 'Live Class Session'}</p>
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
                    <button onClick={toggleFullScreen} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        {isFullScreen ? <><Minimize size={14} /> Exit Fullscreen</> : <><Maximize size={14} /> Fullscreen</>}
                    </button>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: sidebarOpen ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', color: sidebarOpen ? '#818cf8' : 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                        {sidebarOpen ? 'Close Panel' : 'Open Panel'}
                    </button>
                    <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' }}>Leave Class</button>
                </div>
            </div>
            {uploading && (
                <div style={{ background: '#6366f1', color: 'white', padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                    💾 Finalizing recording and saving to Google Drive... please wait.
                </div>
            )}
            <div style={{ flex: 1, display: 'flex', width: '100%', overflow: 'hidden' }}>
                <div ref={jitsiContainerRef} style={{ flex: 1, height: '100%', background: '#000' }} />
                
                {sidebarOpen && channelInstance && (
                    <div style={{ width: '360px', background: 'var(--text-primary)', borderLeft: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', background: 'var(--text-primary)', padding: '0.5rem', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', overflowX: 'auto' }}>
                            <button onClick={() => setSidebarTab('notes')} style={{ flex: 1, padding: '0.5rem', background: sidebarTab === 'notes' ? '#6366f1' : 'transparent', color: sidebarTab === 'notes' ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.8rem', minWidth: '65px' }}>
                                <Edit3 size={14} /> Notes
                            </button>
                            <button onClick={() => setSidebarTab('polls')} style={{ flex: 1, padding: '0.5rem', background: sidebarTab === 'polls' ? '#6366f1' : 'transparent', color: sidebarTab === 'polls' ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.8rem', minWidth: '65px' }}>
                                <BarChart2 size={14} /> Polls
                            </button>
                            <button onClick={() => setSidebarTab('qa')} style={{ flex: 1, padding: '0.5rem', background: sidebarTab === 'qa' ? '#6366f1' : 'transparent', color: sidebarTab === 'qa' ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.8rem', minWidth: '65px' }}>
                                <MessageSquare size={14} /> Q&A
                            </button>
                            {isOrganizer && (
                                <button onClick={() => setSidebarTab('attendance')} style={{ flex: 1, padding: '0.5rem', background: sidebarTab === 'attendance' ? '#6366f1' : 'transparent', color: sidebarTab === 'attendance' ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.8rem', minWidth: '65px' }}>
                                    <Users size={14} /> Att.
                                </button>
                            )}
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
        </div>
    )
}
