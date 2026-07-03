import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../../lib/supabase'
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import { useLiveKitProctoring } from '../../../../hooks/useLiveKitProctoring'

export function useProctoring({ isStarted, canBypass, BYPASS_PROCTORING, challengeId, profile, user }) {
    const navigate = useNavigate()
    const [violationCount, setViolationCount] = useState(0)
    const [requiresReentry, setRequiresReentry] = useState(false)
    const [securityAlert, setSecurityAlert] = useState(null)
    const [faceDetected, setFaceDetected] = useState(true)

    const [cameraEnabled, setCameraEnabled] = useState(false)
    const [mediaStream, setMediaStream] = useState(null)
    const [aiModel, setAiModel] = useState(null)
    
    const videoRef = useRef(null)
    const proctorInterval = useRef(null)

    const [sessionId, setSessionId] = useState(null)
    const [riskScore, setRiskScore] = useState(0)
    const riskScoreRef = useRef(0)
    const violationCountRef = useRef(0)
    const sessionIdRef = useRef(null)
    const lastViolationTimes = useRef({})
    const hasTabSwitched = useRef(false)

    useEffect(() => { riskScoreRef.current = riskScore }, [riskScore])
    useEffect(() => { violationCountRef.current = violationCount }, [violationCount])
    useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

    const { connectionQuality } = useLiveKitProctoring(isStarted ? challengeId : null, isStarted ? profile?.id : null, false, null, mediaStream)

    // Load AI Model
    useEffect(() => {
        if (canBypass || BYPASS_PROCTORING) return;
        const loadModel = async () => {
            try {
                await tf.ready()
                const model = await cocoSsd.load()
                setAiModel(model)
            } catch (err) {
                console.error('Failed to load AI model:', err)
            }
        }
        loadModel()
    }, [canBypass, BYPASS_PROCTORING])

    // Run Proctoring Loop
    useEffect(() => {
        if (BYPASS_PROCTORING) return;
        if (isStarted && cameraEnabled && aiModel && videoRef.current && !canBypass) {
            proctorInterval.current = setInterval(async () => {
                if (videoRef.current && videoRef.current.readyState === 4) {
                    const predictions = await aiModel.detect(videoRef.current)
                    let phoneDetected = false
                    let personCount = 0
                    predictions.forEach(p => {
                        if (p.class === 'cell phone') phoneDetected = true
                        if (p.class === 'person') personCount++
                    })
                    setFaceDetected(personCount > 0)
                    
                    const now = Date.now();

                    // 1. Phone Detection (Risk: +40)
                    if (phoneDetected) {
                        setViolationCount(prev => {
                            const next = prev + 1
                            if (next < 3) {
                                setSecurityAlert(`Security Warning (${next}/3): Unauthorized device (cell phone) detected by AI Proctoring.`)
                            }
                            return next
                        })

                        if (now - (lastViolationTimes.current['phone_detected'] || 0) > 10000) {
                            lastViolationTimes.current['phone_detected'] = now;
                            logViolation('phone_detected', 40);
                        }
                    }

                    // 2. Face Lost Detection (Risk: +20)
                    if (personCount === 0) {
                        if (now - (lastViolationTimes.current['face_lost'] || 0) > 10000) {
                            lastViolationTimes.current['face_lost'] = now;
                            logViolation('face_lost', 20);
                        }
                    }

                    // 3. Multiple Faces Detection (Risk: +50)
                    if (personCount > 1) {
                        setViolationCount(prev => {
                            const next = prev + 1
                            if (next < 3) {
                                setSecurityAlert(`Security Warning (${next}/3): Multiple people detected in webcam feed.`)
                            }
                            return next
                        })

                        if (now - (lastViolationTimes.current['multiple_faces'] || 0) > 10000) {
                            lastViolationTimes.current['multiple_faces'] = now;
                            logViolation('multiple_faces', 50);
                        }
                    }
                }
            }, 2500)
        }
        return () => {
            if (proctorInterval.current) clearInterval(proctorInterval.current)
        }
    }, [isStarted, cameraEnabled, aiModel, canBypass, BYPASS_PROCTORING])

    const logViolation = async (type, increment) => {
        if (BYPASS_PROCTORING) return;
        const currentSessionId = sessionIdRef.current;
        if (!currentSessionId) return;

        const currentRisk = riskScoreRef.current;
        const currentViolationCount = violationCountRef.current;
        const newRiskScore = currentRisk + increment;
        
        setRiskScore(newRiskScore);

        // Update proctoring_sessions record in Supabase
        await supabase.from('proctoring_sessions')
            .update({
                final_risk_score: newRiskScore,
                total_violations: currentViolationCount + 1
            })
            .eq('id', currentSessionId);

        let evidenceUrl = null;
        if (videoRef.current && (type === 'phone_detected' || type === 'multiple_faces')) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = videoRef.current.videoWidth || 640;
                canvas.height = videoRef.current.videoHeight || 480;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                
                await new Promise((resolve) => {
                    canvas.toBlob(async (blob) => {
                        if (!blob) {
                            resolve();
                            return;
                        }
                        const fileName = `${profile.id}/${Date.now()}_evidence.jpg`;
                        const { data } = await supabase.storage
                            .from('proctoring-evidence')
                            .upload(fileName, blob, { contentType: 'image/jpeg' });
                        
                        if (data) {
                            const { data: { publicUrl } } = supabase.storage
                                .from('proctoring-evidence')
                                .getPublicUrl(fileName);
                            evidenceUrl = publicUrl;
                        }
                        resolve();
                    }, 'image/jpeg');
                });
            } catch (err) {
                console.error('Error capturing screenshot evidence:', err);
            }
        }

        // Insert violation record in DB
        await supabase.from('proctoring_violations').insert({
            session_id: currentSessionId,
            student_id: profile.id,
            violation_type: type,
            risk_score_increment: increment,
            evidence_url: evidenceUrl
        });

        // Broadcast real-time update
        const channel = supabase.channel('coding_proctoring');
        channel.send({
            type: 'broadcast',
            event: 'video_frame',
            payload: {
                studentId: profile.id,
                name: profile?.full_name || profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Student',
                challengeId: challengeId,
                type: 'coding',
                riskScore: newRiskScore,
                violationCount: currentViolationCount + 1,
                lastViolationType: type,
                lastViolationTime: new Date().toLocaleTimeString(),
                connectionQuality: connectionQuality || 'excellent'
            }
        }).catch(err => console.error(err));
    };

    const stopProctoring = async () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop())
            setMediaStream(null)
            setCameraEnabled(false)
        }
        // Use globalThis.document since window could be flagged
        if (globalThis.document.fullscreenElement || globalThis.document.webkitFullscreenElement || globalThis.document.msFullscreenElement) {
            if (globalThis.document.exitFullscreen) globalThis.document.exitFullscreen()
            else if (globalThis.document.webkitExitFullscreen) globalThis.document.webkitExitFullscreen()
            else if (globalThis.document.msExitFullscreen) globalThis.document.msExitFullscreen()
        }

        // Finalize proctoring session in DB
        if (sessionIdRef.current) {
            await supabase.from('proctoring_sessions')
                .update({
                    end_time: new Date().toISOString(),
                    status: riskScoreRef.current >= 100 ? 'flagged' : 'completed'
                })
                .eq('id', sessionIdRef.current);
        }
    }

    const startCamera = async () => {
        try {
            const stream = await globalThis.navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            setMediaStream(stream)
            setCameraEnabled(true)
        } catch {
            alert('Camera and microphone permissions are required to take this proctored challenge.')
        }
    }

    useEffect(() => {
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(t => t.stop())
            }
        }
    }, [mediaStream])

    useEffect(() => {
        if (violationCount >= 3 && isStarted && !canBypass && !BYPASS_PROCTORING) {
            alert('Security Violation: 3 violations detected. You are being removed from the coding session.')
            navigate('/student/coding')
        }
    }, [violationCount, isStarted, canBypass, BYPASS_PROCTORING, navigate])

    useEffect(() => {
        const handleFullScreenChange = () => {
            if (BYPASS_PROCTORING) return;
            if (isStarted && !globalThis.document.fullscreenElement && !globalThis.document.webkitFullscreenElement && !globalThis.document.msFullscreenElement && !canBypass) {
                setViolationCount(prev => {
                    const next = prev + 1
                    if (next < 3) setRequiresReentry(true)
                    return next
                })

                const now = Date.now();
                if (now - (lastViolationTimes.current['tab_switch'] || 0) > 10000) {
                    lastViolationTimes.current['tab_switch'] = now;
                    const increment = hasTabSwitched.current ? 25 : 15;
                    hasTabSwitched.current = true;
                    logViolation('tab_switch', increment);
                }
            }
        }

        const handleVisibilityChange = () => {
            if (BYPASS_PROCTORING) return;
            if (isStarted && globalThis.document.hidden && !canBypass) {
                setViolationCount(prev => {
                    const next = prev + 1
                    if (next < 3) setSecurityAlert(`Security Warning (${next}/3): You lost focus on the coding window. Please stay on this page.`)
                    return next
                })

                const now = Date.now();
                if (now - (lastViolationTimes.current['tab_switch'] || 0) > 10000) {
                    lastViolationTimes.current['tab_switch'] = now;
                    const increment = hasTabSwitched.current ? 25 : 15;
                    hasTabSwitched.current = true;
                    logViolation('tab_switch', increment);
                }
            }
        }

        if (isStarted && !canBypass) {
            globalThis.document.addEventListener('fullscreenchange', handleFullScreenChange)
            globalThis.document.addEventListener('webkitfullscreenchange', handleFullScreenChange)
            globalThis.document.addEventListener('mozfullscreenchange', handleFullScreenChange)
            globalThis.document.addEventListener('MSFullscreenChange', handleFullScreenChange)
            globalThis.document.addEventListener('visibilitychange', handleVisibilityChange)
        }
        return () => {
            globalThis.document.removeEventListener('fullscreenchange', handleFullScreenChange)
            globalThis.document.removeEventListener('webkitfullscreenchange', handleFullScreenChange)
            globalThis.document.removeEventListener('mozfullscreenchange', handleFullScreenChange)
            globalThis.document.removeEventListener('MSFullscreenChange', handleFullScreenChange)
            globalThis.document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [isStarted, canBypass, BYPASS_PROCTORING])

    useEffect(() => {
        if (!isStarted || canBypass) return

        const channel = supabase.channel('coding_proctoring', {
            config: {
                broadcast: { ack: false }
            }
        })

        channel
            .on('broadcast', { event: 'proctor_warning' }, (payload) => {
                if (payload.payload.studentId === profile.id) {
                    if (BYPASS_PROCTORING) return
                    setViolationCount(prev => {
                        const next = prev + 1
                        if (next < 3) {
                            const msg = payload.payload.message || "Warning from Ai. Please ensure your environment is clear.";
                            setSecurityAlert(`Security Warning (${next}/3): ${msg}`)
                        }
                        return next
                    })
                }
            })
            .subscribe()

        // Tell organizers we are online so they can request streams
        const pingInterval = setInterval(() => {
            channel.send({
                type: 'broadcast',
                event: 'student_online',
                payload: {
                    studentId: profile.id,
                    name: profile?.full_name || profile?.name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Student',
                    challengeId,
                    type: 'coding',
                    riskScore: riskScoreRef.current,
                    violationCount: violationCountRef.current,
                    connectionQuality: connectionQuality || 'excellent'
                }
            }).catch(err => console.error(err))
        }, 3000)

        return () => {
            clearInterval(pingInterval)
            channel.unsubscribe()
        }
    }, [isStarted, canBypass, profile, challengeId, connectionQuality, BYPASS_PROCTORING, user])

    return {
        violationCount,
        requiresReentry, setRequiresReentry,
        securityAlert, setSecurityAlert,
        faceDetected,
        cameraEnabled,
        mediaStream,
        videoRef,
        stopProctoring,
        startCamera,
        sessionId, setSessionId
    }
}
