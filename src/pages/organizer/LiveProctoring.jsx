import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ICE_SERVERS } from '../../utils/iceServers'
import { useAuth } from '../../contexts/AuthContext'
import { ShieldAlert, VideoOff, ChevronLeft, Search, AlertTriangle, CheckCircle2, PlayCircle, Bell } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { useToast } from '../../components/Toast'
import { useDeviceType } from '../../hooks/useDeviceType'
import MobileBlocker from '../../components/MobileBlocker'

const StreamVideo = ({ stream }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        const video = videoRef.current;
        if (video && stream) {
            video.srcObject = stream;
            video.playsInline = true;
            // NOT forcing muted=true here because organizer wants to hear audio.
            // But this means mobile browser WILL block autoplay until user taps.
            video.onloadedmetadata = () => {
                video.play().catch(e => console.error('Autoplay blocked (tap video to play):', e));
            };
        }
    }, [stream]);

    return (
        <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            webkit-playsinline="true"
            onClick={(e) => e.target.play()}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
        />
    )
};

const PUBLIC_VAPID_KEY = 'BNjRJsIQS8GspSp6F0wLITvpxMtEYMbkwqETiGDVuBiW065JF75laB-jdKyGN09gDSrvbBrlbKsTxka6-Wk9ftc';

export default function LiveProctoring() {
    const { profile } = useAuth()
    const toast = useToast()
    const { isMobile, isTablet, isDesktop } = useDeviceType()
    const [activeStudents, setActiveStudents] = useState({})
    const [search, setSearch] = useState('')
    const [liveStreams, setLiveStreams] = useState({})
    const [iceStates, setIceStates] = useState({})
    const channelRef = useRef(null)
    const peerConnections = useRef({})
    const iceCandidateBuffer = useRef({})

    useEffect(() => {
        // Subscribe to the proctoring broadcast channel
        const channel = supabase.channel('coding_proctoring', {
            config: {
                broadcast: { ack: false }
            }
        })

        channelRef.current = channel

        channel
            .on('broadcast', { event: 'video_frame' }, (payload) => {
                const data = payload.payload
                setActiveStudents(prev => ({
                    ...prev,
                    [data.studentId]: {
                        ...prev[data.studentId],
                        ...data,
                        lastSeen: Date.now()
                    }
                }))
            })
            .on('broadcast', { event: 'student_online' }, (payload) => {
                const data = payload.payload
                setActiveStudents(prev => {
                    const isNew = !prev[data.studentId];
                    if (isNew) {
                        toast.info(`${data.name} has started ${data.type === 'assessment' ? 'an Assessment' : 'a Coding Challenge'}`);
                        if ('Notification' in window && Notification.permission === 'granted') {
                            try {
                                new Notification('New Student Online', {
                                    body: `${data.name} has started ${data.type === 'assessment' ? 'an Assessment' : 'a Coding Challenge'}`,
                                    icon: '/vite.svg'
                                });
                            } catch (err) {
                                console.warn('Failed to show notification (Android Chrome requires Service Worker):', err);
                            }
                        }
                    }
                    return {
                        ...prev,
                        [data.studentId]: {
                            ...prev[data.studentId],
                            ...data,
                            lastSeen: Date.now()
                        }
                    };
                })
            })
            .on('broadcast', { event: 'webrtc_answer' }, async (payload) => {
                const { target, organizerId, studentId, answer } = payload.payload;
                if (target === 'organizer' && organizerId === profile.id) {
                    const pc = peerConnections.current[studentId];
                    if (pc && answer) {
                        try {
                            await pc.setRemoteDescription(new RTCSessionDescription(answer));
                            // Flush buffered ICE candidates
                            if (iceCandidateBuffer.current[studentId]) {
                                for (const c of iceCandidateBuffer.current[studentId]) {
                                    await pc.addIceCandidate(new RTCIceCandidate(c));
                                }
                                delete iceCandidateBuffer.current[studentId];
                            }
                        } catch (err) {
                            console.error('Failed to set remote answer:', err);
                        }
                    }
                }
            })
            .on('broadcast', { event: 'webrtc_ice_candidate' }, async (payload) => {
                const { target, organizerId, studentId, candidate } = payload.payload;
                if (target === 'organizer' && organizerId === profile.id) {
                    const pc = peerConnections.current[studentId];
                    if (pc && candidate) {
                        try {
                            if (!pc.remoteDescription) {
                                if (!iceCandidateBuffer.current[studentId]) iceCandidateBuffer.current[studentId] = [];
                                iceCandidateBuffer.current[studentId].push(candidate);
                            } else {
                                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                            }
                        } catch (err) {
                            console.error('Failed to add remote candidate:', err);
                        }
                    }
                }
            })
            .subscribe()

        // Cleanup disconnected students every 15 seconds (if no ping for > 45 seconds)
        const cleanupInterval = setInterval(() => {
            const now = Date.now()
            setActiveStudents(prev => {
                const next = { ...prev }
                let changed = false
                Object.keys(next).forEach(id => {
                    if (now - next[id].lastSeen > 45000) {
                        delete next[id]
                        changed = true
                        
                        // Clean up WebRTC if they disconnected
                        if (peerConnections.current[id]) {
                            peerConnections.current[id].close();
                            delete peerConnections.current[id];
                            setLiveStreams(s => {
                                const newS = { ...s };
                                delete newS[id];
                                return newS;
                            });
                        }
                    }
                })
                return changed ? next : prev
            })
        }, 15000)

        return () => {
            channel.unsubscribe()
            clearInterval(cleanupInterval)
            Object.values(peerConnections.current).forEach(pc => pc.close());
            peerConnections.current = {};
        }
    }, [profile])

    const startLiveStream = async (studentId) => {
        if (peerConnections.current[studentId]) return;

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        
        peerConnections.current[studentId] = pc;

        // Auto-cleanup on WebRTC disconnect/failure
        pc.oniceconnectionstatechange = () => {
            console.log(`ICE State for ${studentId}:`, pc.iceConnectionState);
            setIceStates(prev => ({ ...prev, [studentId]: pc.iceConnectionState }));
            
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
                console.log(`WebRTC connection lost for ${studentId}. Cleaning up stream.`);
                setLiveStreams(prev => {
                    const next = { ...prev };
                    delete next[studentId];
                    return next;
                });
                pc.close();
                delete peerConnections.current[studentId];
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                channelRef.current.send({
                    type: 'broadcast',
                    event: 'webrtc_ice_candidate',
                    payload: {
                        target: 'student',
                        studentId,
                        organizerId: profile.id,
                        candidate: event.candidate
                    }
                });
            }
        };

        pc.ontrack = (event) => {
            setLiveStreams(prev => ({
                ...prev,
                [studentId]: event.streams[0]
            }));
        };

        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);

        channelRef.current.send({
            type: 'broadcast',
            event: 'webrtc_offer',
            payload: {
                studentId,
                organizerId: profile.id,
                offer
            }
        });
        toast.success('Requesting live stream...');
    };

    const enablePushNotifications = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                let permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'prompt') {
                    permStatus = await PushNotifications.requestPermissions();
                }
                if (permStatus.receive !== 'granted') {
                    toast.error('Native Push Notification permission denied');
                    return;
                }
                
                await PushNotifications.register();
                toast.success('Registering device for Native Push...');
                
                // Note: The actual token is captured via a listener we should register once.
                // We'll set it up right here to store the token when it arrives.
                PushNotifications.addListener('registration', async (token) => {
                    console.log('FCM Token:', token.value);
                    const { error } = await supabase.from('push_subscriptions').upsert({
                        organizer_id: profile.id,
                        subscription: { type: 'fcm', token: token.value }
                    }, { onConflict: 'organizer_id' });
                    
                    if (error) console.error("Error saving FCM token", error);
                    else toast.success("Native Notifications enabled!");
                });
                
                PushNotifications.addListener('registrationError', (error) => {
                    toast.error('Failed to register for push notifications');
                    console.error(error);
                });
                
            } else {
                // Web Push
                if (PUBLIC_VAPID_KEY === 'REPLACE_WITH_YOUR_PUBLIC_VAPID_KEY') {
                    toast.error("Please configure the VAPID keys in LiveProctoring.jsx first.");
                    return;
                }
                if (!('Notification' in window)) {
                    toast.error("Web Push Notifications are not supported in this browser");
                    return;
                }
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    toast.error("Notification permission denied");
                    return;
                }
                
                const registration = await navigator.serviceWorker.ready;
                
                // Clear any old subscriptions attached to different VAPID keys
                let subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await subscription.unsubscribe();
                }

                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: PUBLIC_VAPID_KEY
                });
                
                const { error } = await supabase.from('push_subscriptions').upsert({
                    organizer_id: profile.id,
                    subscription: { type: 'web', data: subscription }
                }, { onConflict: 'organizer_id' });

                if (error) throw error;
                toast.success("Background Web Notifications enabled!");
            }
        } catch (error) {
            console.error('Error enabling notifications:', error);
            toast.error("Failed to enable notifications");
        }
    };

    const sendWarning = async (studentId, studentName) => {
        if (!channelRef.current) return
        
        const message = window.prompt(`Enter warning message for ${studentName}:`, "Please ensure your face is clearly visible.");
        if (!message) return;

        try {
            await channelRef.current.send({
                type: 'broadcast',
                event: 'proctor_warning',
                payload: { studentId, message }
            })
            toast.success(`Warning sent to ${studentName}`)
        } catch (error) {
            console.error('Error sending warning:', error)
            toast.error('Failed to send warning')
        }
    }

    const studentsList = Object.values(activeStudents).filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase())
    )

    // Removed MobileBlocker to allow mobile access

    return (
        <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '2rem', flexDirection: isMobile ? 'column' : 'row', gap: '1rem' }}>
                <div style={{ width: isMobile ? '100%' : 'auto' }}>
                    <Link to="/organizer/coding" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600, marginBottom: '0.5rem' }}>
                        <ChevronLeft size={16} /> Back
                    </Link>
                    <h1 style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShieldAlert size={isMobile ? 24 : 28} color="#ef4444" /> Live Proctoring
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: isMobile ? '0.85rem' : '1rem' }}>Monitor active students in real-time.</p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', width: isMobile ? '100%' : 'auto' }}>
                    <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : 'auto' }}>
                        <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search student..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ padding: '0.75rem 1rem 0.75rem 2.8rem', borderRadius: 8, border: '1px solid #cbd5e1', width: isMobile ? '100%' : 250, fontSize: '0.9rem', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ background: '#ecfdf5', color: '#059669', padding: '0.75rem 1rem', borderRadius: 8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #a7f3d0' }}>
                        <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                        {studentsList.length} Active
                    </div>
                    <button 
                        onClick={enablePushNotifications}
                        className="btn-primary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Bell size={18} /> Enable Alerts
                    </button>
                </div>
            </div>

            {studentsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'white', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <div style={{ width: 80, height: 80, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', color: 'var(--text-muted)' }}>
                        <VideoOff size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Students Currently Coding</h3>
                    <p style={{ color: 'var(--text-muted)', maxWidth: 400, margin: '0 auto' }}>When students start a coding practice session, their live camera feed will appear here automatically.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1.5rem' }}>
                    {studentsList.map(student => {
                        const id = student.studentId;
                        return (
                        <div key={id} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                            <div style={{ position: 'relative', width: '100%', paddingBottom: '75%', background: '#000' }}>
                                {liveStreams[id] ? (
                                    <>
                                        <StreamVideo stream={liveStreams[id]} />
                                        <div style={{ position: 'absolute', bottom: 10, right: 10, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: '0.25rem 0.5rem', borderRadius: 4, color: '#fff', fontSize: '0.7rem' }}>
                                            {iceStates[id] || 'connecting...'}
                                        </div>
                                    </>
                                ) : student.image ? (
                                    <img 
                                        src={student.image} 
                                        alt={student.name} 
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                ) : (
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                        Loading feed...
                                    </div>
                                )}
                                <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ width: 6, height: 6, background: liveStreams[student.studentId] ? '#ef4444' : '#10b981', borderRadius: '50%' }}></div> 
                                    {liveStreams[student.studentId] ? 'LIVE STREAM' : 'SNAPSHOT'}
                                </div>
                            </div>
                            
                            <div style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{student.name}</h3>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{student.type === 'assessment' ? 'Assessment' : 'Coding Challenge'}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#059669', background: '#ecfdf5', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                                        <CheckCircle2 size={12} /> Proctoring Active
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {!liveStreams[student.studentId] && (
                                        <button 
                                            onClick={() => startLiveStream(student.studentId)}
                                            style={{ flex: 1, padding: '0.6rem', background: '#f8fafc', border: '1px solid #cbd5e1', color: 'var(--card-border)', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                                            onMouseOver={(e) => e.target.style.background = '#f1f5f9'}
                                            onMouseOut={(e) => e.target.style.background = '#f8fafc'}
                                        >
                                            <PlayCircle size={16} /> Watch Live
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => sendWarning(student.studentId, student.name)}
                                        style={{ flex: liveStreams[student.studentId] ? '1 1 100%' : 1, padding: '0.6rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                                        onMouseOver={(e) => e.target.style.background = '#fee2e2'}
                                        onMouseOut={(e) => e.target.style.background = '#fef2f2'}
                                    >
                                        <AlertTriangle size={16} /> Send Warning
                                    </button>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
        </div>
    )
}
