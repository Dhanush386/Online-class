import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLiveKitViewer } from '../../hooks/useLiveKitViewer'
import { ShieldAlert, VideoOff, ChevronLeft, Search, AlertTriangle, CheckCircle2, PlayCircle, Bell } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { useToast } from '../../components/Toast'
import { useDeviceType } from '../../hooks/useDeviceType'
import MobileBlocker from '../../components/MobileBlocker'
import ProctoringReportModal from '../../components/organizer/ProctoringReportModal'


const StreamVideo = ({ stream }) => {
    const videoRef = useRef(null);
    useEffect(() => {
        const video = videoRef.current;
        if (video && stream) {
            video.srcObject = stream;
            video.playsInline = true;
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

function StudentLiveKitStream({ assessmentId, studentId, onStop }) {
    const { isConnected, liveStreams } = useLiveKitViewer(assessmentId);
    const stream = liveStreams[studentId];

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 5, background: '#000' }}>
            {stream ? (
                <StreamVideo stream={stream} />
            ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '0.8rem' }}>
                    {isConnected ? 'Waiting for student video...' : 'Connecting to LiveKit...'}
                </div>
            )}
            <button 
                onClick={onStop}
                style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer' }}
            >
                Stop Live
            </button>
        </div>
    );
}

export default function LiveProctoring() {
    const { profile } = useAuth()
    const toast = useToast()
    const { isMobile, isTablet, isDesktop } = useDeviceType()
    const [activeStudents, setActiveStudents] = useState({})
    const [watchingLive, setWatchingLive] = useState({}) // { studentId: challengeId }
    const [search, setSearch] = useState('')
    const [expandedTimeline, setExpandedTimeline] = useState({})
    const [reportSession, setReportSession] = useState(null)
    const channelRef = useRef(null)
    const peerConnections = useRef({})
    const iceCandidateBuffer = useRef({})

    const fetchViolations = async (studentId) => {
        try {
            const { data: session } = await supabase
                .from('proctoring_sessions')
                .select('id, start_time, total_violations, final_risk_score')
                .eq('student_id', studentId)
                .eq('status', 'active')
                .order('start_time', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (session) {
                const { data: violations } = await supabase
                    .from('proctoring_violations')
                    .select('violation_type, timestamp, risk_score_increment, evidence_url')
                    .eq('session_id', session.id)
                    .order('timestamp', { ascending: false });

                setActiveStudents(prev => {
                    if (!prev[studentId]) return prev;
                    return {
                        ...prev,
                        [studentId]: {
                            ...prev[studentId],
                            riskScore: session.final_risk_score,
                            violationCount: session.total_violations,
                            violations: (violations || []).map(v => ({
                                type: v.violation_type,
                                time: new Date(v.timestamp).toLocaleTimeString(),
                                increment: v.risk_score_increment,
                                evidenceUrl: v.evidence_url
                            }))
                        }
                    };
                });
            }
        } catch (err) {
            console.error('Error syncing proctoring data:', err);
        }
    };

    const getRiskStatus = (score) => {
        if (score >= 100) return { label: 'CRITICAL', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' };
        if (score >= 60) return { label: 'HIGH RISK', color: '#f97316', bg: '#fff7ed', border: '#ffedd5' };
        if (score >= 30) return { label: 'WARNING', color: '#eab308', bg: '#fef9c3', border: '#fef08a' };
        return { label: 'SAFE', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' };
    };

    const getNetworkStatus = (quality) => {
        switch (quality?.toLowerCase()) {
            case 'excellent':
                return { label: 'Excellent Connection', color: '#10b981', bg: '#ecfdf5' };
            case 'good':
                return { label: 'Good Connection', color: '#3b82f6', bg: '#eff6ff' };
            case 'poor':
                return { label: 'Poor Connection', color: '#f97316', bg: '#fff7ed' };
            case 'lost':
            case 'disconnected':
                return { label: 'Disconnected', color: '#ef4444', bg: '#fef2f2' };
            default:
                return { label: 'Excellent Connection', color: '#10b981', bg: '#ecfdf5' };
        }
    };

    const toggleTimeline = (studentId) => {
        setExpandedTimeline(prev => ({ ...prev, [studentId]: !prev[studentId] }));
    };

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
                fetchViolations(data.studentId);
            })
            .on('broadcast', { event: 'student_online' }, (payload) => {
                const data = payload.payload
                setActiveStudents(prev => {
                    const isNew = !prev[data.studentId];
                    if (isNew) {
                        // Defer toast and notification side effects to prevent rendering issues in React
                        setTimeout(() => {
                            toast.info(`${data.name} has started ${data.type === 'assessment' ? 'an Assessment' : 'a Coding Challenge'}`);
                            fetchViolations(data.studentId);
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
                        }, 0);
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
                        
                        // Stop watching if they disconnected
                        setWatchingLive(w => {
                            const newW = { ...w };
                            delete newW[id];
                            return newW;
                        });
                    }
                })
                return changed ? next : prev
            })
        }, 15000)

        return () => {
            channel.unsubscribe()
            clearInterval(cleanupInterval)
        }
    }, [profile])

    const startLiveStream = (studentId, challengeId) => {
        setWatchingLive(prev => ({ ...prev, [studentId]: challengeId }));
    };

    const stopLiveStream = (studentId) => {
        setWatchingLive(prev => {
            const next = { ...prev };
            delete next[studentId];
            return next;
        });
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

    // Calculate metrics
    const safeCount = studentsList.filter(s => (s.riskScore || 0) < 30).length;
    const warningCount = studentsList.filter(s => (s.riskScore || 0) >= 30 && (s.riskScore || 0) < 60).length;
    const highRiskCount = studentsList.filter(s => (s.riskScore || 0) >= 60 && (s.riskScore || 0) < 100).length;
    const criticalCount = studentsList.filter(s => (s.riskScore || 0) >= 100).length;
    const highestRiskStudent = studentsList.reduce((max, s) => (s.riskScore || 0) > (max?.riskScore || 0) ? s : max, null);

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

            {/* Summary Banner */}
            {studentsList.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ background: 'white', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>🟢 SAFE</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>{safeCount}</div>
                    </div>
                    <div style={{ background: 'white', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>🟡 WARNING</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#eab308', marginTop: '0.25rem' }}>{warningCount}</div>
                    </div>
                    <div style={{ background: 'white', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>🟠 HIGH RISK</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f97316', marginTop: '0.25rem' }}>{highRiskCount}</div>
                    </div>
                    <div style={{ background: 'white', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>🔴 CRITICAL</div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>{criticalCount}</div>
                    </div>
                    {highestRiskStudent && highestRiskStudent.riskScore > 0 && (
                        <div style={{ background: '#fef2f2', padding: '1rem 1.5rem', borderRadius: 12, border: '1px solid #fee2e2', gridColumn: isMobile ? 'auto' : 'span 2' }}>
                            <div style={{ fontSize: '0.8rem', color: '#dc2626', fontWeight: 700 }}>⚠️ HIGHEST RISK STUDENT</div>
                            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                                {highestRiskStudent.name} (Risk: {highestRiskStudent.riskScore})
                            </div>
                        </div>
                    )}
                </div>
            )}

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
                            {student.riskScore >= 100 && (
                                <div style={{
                                    padding: '0.5rem',
                                    background: student.riskScore >= 200 ? '#fef2f2' : student.riskScore >= 150 ? '#fff5f5' : '#fffbeb',
                                    color: student.riskScore >= 200 ? '#dc2626' : student.riskScore >= 150 ? '#e11d48' : '#d97706',
                                    borderBottom: '1px solid',
                                    borderColor: student.riskScore >= 200 ? '#fee2e2' : student.riskScore >= 150 ? '#ffe4e6' : '#fef3c7',
                                    textAlign: 'center',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '4px',
                                    animation: student.riskScore >= 150 ? 'pulse 2s infinite' : 'none'
                                }}>
                                    {student.riskScore >= 200 ? (
                                        <>⛔ FLAG SUBMISSION (Faculty Review Required)</>
                                    ) : student.riskScore >= 150 ? (
                                        <>🚨 CRITICAL ALERT (Suspicious Behavior)</>
                                    ) : (
                                        <>⚠ HIGH RISK ALERT</>
                                    )}
                                </div>
                            )}
                            <div style={{ position: 'relative', width: '100%', paddingBottom: '75%', background: '#000' }}>
                                {watchingLive[id] && (
                                    <StudentLiveKitStream 
                                        assessmentId={watchingLive[id]} 
                                        studentId={id} 
                                        onStop={() => stopLiveStream(id)} 
                                    />
                                )}
                                {student.image ? (
                                    <img 
                                        src={student.image} 
                                        alt={student.name} 
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: watchingLive[id] ? 0.2 : 1 }} 
                                    />
                                ) : (
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                                        Loading feed...
                                    </div>
                                )}
                                <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 8px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', zIndex: 6 }}>
                                    <div style={{ width: 6, height: 6, background: watchingLive[id] ? '#ef4444' : '#10b981', borderRadius: '50%' }}></div> 
                                    {watchingLive[id] ? 'LIVE STREAM' : 'SNAPSHOT'}
                                </div>
                            </div>
                            
                            <div style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{student.name}</h3>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{student.type === 'assessment' ? 'Assessment' : 'Coding Challenge'}</div>
                                        
                                        {/* Network Quality Badge */}
                                        {(() => {
                                            const net = getNetworkStatus(student.connectionQuality);
                                            return (
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: net.color, background: net.bg, padding: '2px 6px', borderRadius: 4, fontWeight: 600, marginTop: '0.5rem' }}>
                                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: net.color }}></div>
                                                    {net.label}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    {(() => {
                                        const risk = getRiskStatus(student.riskScore || 0);
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: risk.color, background: risk.bg, border: `1px solid ${risk.border}`, padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                                                {risk.label} ({student.riskScore || 0})
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {!watchingLive[id] && (
                                        <button 
                                            onClick={() => startLiveStream(id, student.challengeId)}
                                            style={{ flex: 1, padding: '0.6rem', background: '#f8fafc', border: '1px solid #cbd5e1', color: 'var(--card-border)', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                                            onMouseOver={(e) => e.target.style.background = '#f1f5f9'}
                                            onMouseOut={(e) => e.target.style.background = '#f8fafc'}
                                        >
                                            <PlayCircle size={16} /> Watch Live
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => sendWarning(student.studentId, student.name)}
                                        style={{ flex: watchingLive[id] ? '1 1 100%' : 1, padding: '0.6rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                                        onMouseOver={(e) => e.target.style.background = '#fee2e2'}
                                        onMouseOut={(e) => e.target.style.background = '#fef2f2'}
                                    >
                                        <AlertTriangle size={16} /> Send Warning
                                    </button>
                                    <button 
                                        onClick={() => setReportSession({ studentId: student.studentId, challengeId: student.challengeId, type: student.type })}
                                        style={{ flex: '1 1 100%', marginTop: '0.5rem', padding: '0.6rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 6, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                                        onMouseOver={(e) => e.target.style.background = '#dbeafe'}
                                        onMouseOut={(e) => e.target.style.background = '#eff6ff'}
                                    >
                                        <ShieldAlert size={16} /> Review Report
                                    </button>
                                </div>
                            </div>

                            {/* Expandable Violation Timeline Panel */}
                            <div style={{ padding: '1rem', borderTop: '1px solid #f1f5f9' }}>
                                <button 
                                    onClick={() => toggleTimeline(id)}
                                    style={{ width: '100%', padding: '0.5rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                                >
                                    {expandedTimeline[id] ? 'Hide Violation Timeline' : `Show Violation Timeline (${student.violations?.length || 0})`}
                                </button>
                                
                                {expandedTimeline[id] && (
                                    <div style={{ marginTop: '0.75rem', maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {(!student.violations || student.violations.length === 0) ? (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.5rem' }}>No violations recorded.</div>
                                        ) : (
                                            student.violations.map((v, i) => (
                                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '0.6rem', background: '#f8fafc', borderRadius: 6, borderLeft: `4px solid ${v.increment >= 40 ? '#ef4444' : v.increment >= 30 ? '#f97316' : '#eab308'}`, border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                {v.type?.replace('_', ' ')?.toUpperCase()}
                                                            </div>
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                                {v.time} (+{v.increment} Risk)
                                                            </div>
                                                        </div>
                                                        {v.evidenceUrl && (
                                                            <a href={v.evidenceUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.65rem', color: '#6366f1', textDecoration: 'underline', fontWeight: 600 }}>
                                                                Fullscreen
                                                            </a>
                                                        )}
                                                    </div>
                                                    {v.evidenceUrl && (
                                                        <div style={{ marginTop: '0.2rem' }}>
                                                            <a href={v.evidenceUrl} target="_blank" rel="noreferrer">
                                                                <img 
                                                                    src={v.evidenceUrl} 
                                                                    alt="Violation snapshot" 
                                                                    style={{ width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 4, border: '1px solid #e2e8f0', background: '#000', display: 'block' }} 
                                                                />
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}
            {reportSession && (
                <ProctoringReportModal 
                    studentId={reportSession.studentId}
                    assessmentId={reportSession.type === 'assessment' ? reportSession.challengeId : null}
                    challengeId={reportSession.type === 'coding' || reportSession.type !== 'assessment' ? reportSession.challengeId : null}
                    onClose={() => setReportSession(null)}
                />
            )}
        </div>
    )
}
