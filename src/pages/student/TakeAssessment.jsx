import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, ChevronRight, Send, AlertCircle, Clock, CheckCircle2, XCircle, Lock, ShieldAlert, Camera, Code as CodeIcon } from 'lucide-react'
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import CodeEditor from '../../components/CodeEditor'
import { useLiveKitProctoring } from '../../hooks/useLiveKitProctoring'

const MAX_ATTEMPTS = 1
const BYPASS_PROCTORING = false // Set to false to enable AI proctoring violations in production

import { useDeviceType } from '../../hooks/useDeviceType'
import MobileBlocker from '../../components/MobileBlocker'

export default function TakeAssessment() {
    const { assessmentId } = useParams()
    const { profile, user } = useAuth()
    const navigate = useNavigate()

    const [assessment, setAssessment] = useState(null)
    const [questions, setQuestions] = useState([])
    const [attemptNumber, setAttemptNumber] = useState(1)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')

    const [currentIdx, setCurrentIdx] = useState(0)
    const [answers, setAnswers] = useState({}) // { questionId: selectedOption }
    const [isStarted, setIsStarted] = useState(false)
    const [timeLeft, setTimeLeft] = useState(null)
    const [violationCount, setViolationCount] = useState(0)
    const [isAutoSubmitted, setIsAutoSubmitted] = useState(false)
    const [requiresReentry, setRequiresReentry] = useState(false)
    const [securityAlert, setSecurityAlert] = useState(null)
    const [faceDetected, setFaceDetected] = useState(true)
    const containerRef = useRef(null)

    // Proctoring Risk Engine & Session States
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

    // Proctoring Engine States
    const { isMobile, isTablet, isDesktop } = useDeviceType()
    const [cameraEnabled, setCameraEnabled] = useState(false)
    const [aiModel, setAiModel] = useState(null)
    const [mediaStream, setMediaStream] = useState(null)
    const videoRef = useRef(null)
    const proctorInterval = useRef(null)
    
    // Connect to LiveKit securely in the background (invisible to student)
    const { connectionQuality } = useLiveKitProctoring(isStarted ? assessmentId : null, isStarted ? profile?.id : null, false, null, mediaStream);

    // Check Device
    // Handled by useDeviceType hooks

    // Load AI Model
    useEffect(() => {
        if (BYPASS_PROCTORING) return
        const loadModel = async () => {
            try {
                await tf.ready()
                const model = await cocoSsd.load()
                setAiModel(model)
                console.log('AI Proctoring Model Loaded')
            } catch (err) {
                console.error('Failed to load AI model:', err)
            }
        }
        loadModel()
    }, [])

    // Run Proctoring Loop
    useEffect(() => {
        if (BYPASS_PROCTORING) return
        if (isStarted && cameraEnabled && aiModel && videoRef.current) {
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
    }, [isStarted, cameraEnabled, aiModel])

    useEffect(() => {
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(t => t.stop())
            }
        }
    }, [mediaStream])

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            setMediaStream(stream)
            setCameraEnabled(true)
        } catch (err) {
            alert('Camera and microphone permissions are required to take this proctored assessment.')
        }
    }

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
                challengeId: assessmentId,
                type: 'assessment',
                riskScore: newRiskScore,
                violationCount: currentViolationCount + 1,
                lastViolationType: type,
                lastViolationTime: new Date().toLocaleTimeString(),
                connectionQuality: connectionQuality || 'excellent'
            }
        }).catch(err => console.error(err));
    };

    // WebRTC & Broadcasting to Organizer Dashboard
    useEffect(() => {
        if (!isStarted) return

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
                    challengeId: assessmentId,
                    type: 'assessment',
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
    }, [isStarted, profile, assessmentId, mediaStream, connectionQuality])

    useEffect(() => {
        if (violationCount >= 3 && isStarted && !submitted && !submitting && !isAutoSubmitted) {
            handleAutoSubmit()
        }
    }, [violationCount, isStarted])

    async function handleAutoSubmit() {
        setIsAutoSubmitted(true)
        alert('Security Violation: 3 violations detected. Your assessment is being automatically submitted.')
        await handleSubmit(true)
    }

    useEffect(() => {
        const handleSecurity = (e) => {
            if (isStarted) {
                e.preventDefault()
            }
        }

        const handleFullScreenChange = () => {
            if (BYPASS_PROCTORING) return;
            if (isStarted && !document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement && !submitted) {
                setViolationCount(prev => {
                    const next = prev + 1
                    if (next < 3) {
                        setRequiresReentry(true)
                    }
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
            if (isStarted && document.hidden && !submitted) {
                setViolationCount(prev => {
                    const next = prev + 1
                    if (next < 3) {
                        setSecurityAlert(`Security Warning (${next}/3): You lost focus on the assessment window. Please stay on this page.`)
                    }
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

        if (isStarted) {
            document.addEventListener('contextmenu', handleSecurity)
            document.addEventListener('copy', handleSecurity)
            document.addEventListener('paste', handleSecurity)
            document.addEventListener('cut', handleSecurity)
            document.addEventListener('fullscreenchange', handleFullScreenChange)
            document.addEventListener('webkitfullscreenchange', handleFullScreenChange)
            document.addEventListener('mozfullscreenchange', handleFullScreenChange)
            document.addEventListener('MSFullscreenChange', handleFullScreenChange)
            document.addEventListener('visibilitychange', handleVisibilityChange)
        }

        return () => {
            document.removeEventListener('contextmenu', handleSecurity)
            document.removeEventListener('copy', handleSecurity)
            document.removeEventListener('paste', handleSecurity)
            document.removeEventListener('cut', handleSecurity)
            document.removeEventListener('fullscreenchange', handleFullScreenChange)
            document.removeEventListener('webkitfullscreenchange', handleFullScreenChange)
            document.removeEventListener('mozfullscreenchange', handleFullScreenChange)
            document.removeEventListener('MSFullscreenChange', handleFullScreenChange)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [isStarted, submitted])

    const enterFullScreen = async () => {
        const elem = document.documentElement
        if (elem.requestFullscreen) {
            elem.requestFullscreen()
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen()
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen()
        }
        setIsStarted(true)
        setRequiresReentry(false)

        const duration = assessment?.duration || 30 // default 30 minutes
        const endTimeKey = `assessment_endTime_${assessmentId}`
        if (!localStorage.getItem(endTimeKey)) {
            localStorage.setItem(endTimeKey, (Date.now() + duration * 60 * 1000).toString())
        }

        if (!sessionId) {
            try {
                const { data: sessionData } = await supabase.from('proctoring_sessions').insert({
                    student_id: profile.id,
                    assessment_id: assessmentId,
                    status: 'active'
                }).select().single();
                
                if (sessionData) {
                    setSessionId(sessionData.id);
                }
            } catch (err) {
                console.error('Error starting proctoring session:', err);
            }
        }
    }

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0')
        const s = (secs % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    useEffect(() => {
        if (!isStarted || submitted || !assessment) return;

        const duration = assessment?.duration || 30;
        const endTimeKey = `assessment_endTime_${assessmentId}`;
        
        const updateTimer = () => {
            const savedEndTime = localStorage.getItem(endTimeKey);
            if (!savedEndTime) {
                const end = Date.now() + duration * 60 * 1000;
                localStorage.setItem(endTimeKey, end.toString());
                setTimeLeft(duration * 60);
                return;
            }
            const remaining = Math.floor((parseInt(savedEndTime) - Date.now()) / 1000);
            if (remaining <= 0) {
                setTimeLeft(0);
                alert("Time is up! Your assessment will be automatically submitted.");
                handleSubmit(true);
            } else {
                setTimeLeft(remaining);
            }
        };

        updateTimer();
        const timer = setInterval(updateTimer, 1000);
        return () => clearInterval(timer);
    }, [isStarted, submitted, assessmentId, assessment]);

    useEffect(() => {
        if (assessmentId) loadData()
    }, [assessmentId])

    async function loadData() {
        setLoading(true)
        try {
            // Check attempt count first
            const [
                { data: existingSubs },
                { data: assess, error: aErr },
                { data: qData, error: qErr },
                { data: memberships },
                { data: locks },
                { data: locksDay }
            ] = await Promise.all([
                supabase.from('assessment_submissions').select('id').eq('assessment_id', assessmentId).eq('student_id', profile.id),
                supabase.from('assessments').select('*, courses(title)').eq('id', assessmentId).single(),
                supabase.from('questions').select('*').eq('assessment_id', assessmentId).order('created_at', { ascending: true }),
                supabase.from('group_members').select('group_id').eq('student_id', profile.id),
                supabase.from('resource_access').select('*').eq('resource_id', assessmentId).eq('resource_type', 'assessment').eq('is_locked', true),
                supabase.from('day_access').select('*') // although we use course_id and day_number mostly
            ])

            if (aErr) throw aErr
            if (qErr) throw qErr

            // Check if locked for student's groups
            const userGroupIds = memberships?.map(m => m.group_id) || []

            // Check manual resource-level lock
            const isResourceLocked = locks?.some(l => userGroupIds.includes(l.group_id))

            // Check day-level lock/schedule
            const dayAccess = (locksDay || []).find(a => a.course_id === assess.course_id && a.day_number === assess.day_number && userGroupIds.includes(a.group_id))
            const isDayLocked = dayAccess?.is_locked || (dayAccess?.open_time && new Date(dayAccess.open_time) > new Date())

            if (isResourceLocked || isDayLocked) {
                alert(isDayLocked && dayAccess?.open_time ? `This day opens at ${new Date(dayAccess.open_time).toLocaleString()}` : 'This assessment is currently locked for your group.')
                navigate(`/student/courses/${assess.course_id}`, { replace: true })
                return
            }

            // CHECK: Deadline Expiry
            if (assess.due_date && new Date(assess.due_date) < new Date()) {
                alert('This assessment is no longer available as the deadline has passed.')
                navigate(`/student/courses/${assess.course_id}`, { replace: true })
                return
            }

            if ((existingSubs || []).length >= MAX_ATTEMPTS) {
                navigate(`/student/assessments/${assessmentId}/review`, { replace: true })
                return
            }

            setAttemptNumber((existingSubs || []).length + 1)
            setAssessment(assess)
            
            // Shuffle questions for this student
            let fetchedQuestions = qData || []
            for (let i = fetchedQuestions.length - 1; i > 0; i--) {
                const j = Math.floor((window.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * (i + 1));
                [fetchedQuestions[i], fetchedQuestions[j]] = [fetchedQuestions[j], fetchedQuestions[i]];
            }
            
            setQuestions(fetchedQuestions)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function updateOverallProgress(courseId) {
        if (!profile?.id || !courseId) return

        const [
            { data: vids, error: ve },
            { data: chls, error: ce },
            { data: assessData, error: ae },
            { data: vpData, error: vpe },
            { data: subData, error: se }
        ] = await Promise.all([
            supabase.from('videos').select('id').eq('course_id', courseId),
            supabase.from('coding_challenges').select('id').eq('course_id', courseId),
            supabase.from('assessments').select('id').eq('course_id', courseId),
            supabase.from('video_progress').select('video_id').eq('student_id', profile.id).eq('course_id', courseId),
            supabase.from('coding_submissions').select('challenge_id, status').eq('student_id', profile.id)
        ])

        if (ve || ce || ae || vpe || se) {
            console.error('Progress fetch error:', { ve, ce, ae, vpe, se })
        }

        const { data: allAssessSubs, error: ase } = await supabase.from('assessment_submissions').select('assessment_id').eq('student_id', profile.id)
        if (ase) console.error('Assessment subs fetch error:', ase)

        const totalSessions = (vids || []).length
        const totalCoding = (chls || []).length
        const totalAssessments = (assessData || []).length

        const completedSessions = (vids || []).filter(v => (vpData || []).some(vp => vp.video_id === v.id)).length
        const completedCoding = (chls || []).filter(c => (subData || []).some(s => s.challenge_id === c.id && s.status === 'accepted')).length
        const completedAssess = (assessData || []).filter(a => (allAssessSubs || []).some(s => s.assessment_id === a.id)).length

        const sessionPct = totalSessions > 0 ? (completedSessions / totalSessions) : 0
        const codingPct = totalCoding > 0 ? (completedCoding / totalCoding) : 0
        const assessPct = totalAssessments > 0 ? (completedAssess / totalAssessments) : 0

        let activeCategories = 0
        let sumPct = 0
        if (totalSessions > 0) { activeCategories++; sumPct += sessionPct }
        if (totalCoding > 0) { activeCategories++; sumPct += codingPct }
        if (totalAssessments > 0) { activeCategories++; sumPct += assessPct }

        const finalPct = activeCategories > 0 ? Math.round((sumPct / activeCategories) * 100) : 0
        console.log(`Progress Update [${courseId}]: ${finalPct}% (V:${completedSessions}/${totalSessions}, C:${completedCoding}/${totalCoding}, A:${completedAssess}/${totalAssessments})`)

        const { error: upError } = await supabase.from('progress').upsert({
            student_id: profile.id,
            course_id: courseId,
            completion_percentage: finalPct,
            last_updated: new Date().toISOString()
        }, { onConflict: 'student_id,course_id' })

        if (upError) {
            console.error('Progress upsert error:', upError)
        }
    }

    async function handleSubmit(isAuto = false) {
        if (!isAuto && timeLeft !== null && timeLeft > 60) {
            alert('Submission is only allowed during the last 1 minute of the assessment.')
            return
        }

        if (!isAuto && Object.keys(answers).length < questions.length) {
            if (!confirm('You haven\'t answered all questions. Submit anyway?')) return
        }

        setSubmitting(true)
        try {
            let correctCount = 0
            const submissionAnswers = questions.map(q => {
                const selected = answers[q.id] || (isMulti(q) ? [] : '')
                
                let isCorrect = false
                if (isMulti(q)) {
                    const correctArr = getCorrectArray(q)
                    const selectedArr = Array.isArray(selected) ? selected : [selected]
                    isCorrect = correctArr.length === selectedArr.length && 
                               correctArr.every(opt => selectedArr.includes(opt))
                } else {
                    isCorrect = selected === q.correct_answer
                }

                if (isCorrect) correctCount++
                return {
                    question_id: q.id,
                    selected_option: selected,
                    is_correct: isCorrect
                }
            })

            const { data, error: sErr } = await supabase
                .from('assessment_submissions')
                .insert({
                    assessment_id: assessmentId,
                    student_id: profile.id,
                    score: correctCount,
                    total_questions: questions.length,
                    answers: submissionAnswers
                })
                .select()
                .single()

            if (sErr) throw sErr

            // Finalize the proctoring session in DB
            if (sessionIdRef.current) {
                await supabase.from('proctoring_sessions')
                    .update({
                        end_time: new Date().toISOString(),
                        status: riskScoreRef.current >= 100 ? 'flagged' : 'completed'
                    })
                    .eq('id', sessionIdRef.current);
            }

            setResult({
                score: correctCount,
                total: questions.length,
                percentage: Math.round((correctCount / questions.length) * 100)
            })
            setSubmitted(true)
            localStorage.removeItem(`assessment_endTime_${assessmentId}`)

            // Update course progress
            updateOverallProgress(assessment.course_id)
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading assessment...</div>
    if (error && !assessment) return <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>Error: {error}</div>

    if ((requiresReentry || securityAlert) && !submitted && !BYPASS_PROCTORING) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.98)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="glass-card animate-scale-in" style={{ maxWidth: 500, padding: '3rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ width: 80, height: 80, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#ef4444' }}>
                        <ShieldAlert size={40} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>{securityAlert ? 'Security Warning' : 'Security Block'}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', lineHeight: 1.6 }}>
                        {securityAlert || `You have exited Secure Mode. This is a security violation (${violationCount}/3). You must re-enter fullscreen to continue your assessment.`}
                    </p>
                    <button onClick={() => {
                        setSecurityAlert(null);
                        setRequiresReentry(false);
                        enterFullScreen();
                    }} className="btn-primary" style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem', background: '#ef4444', border: 'none', justifyContent: 'center' }}>
                        {securityAlert ? 'I Understand & Resume' : 'Re-enter Secure Mode'}
                    </button>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg-base)', overflowY: 'auto', padding: '4rem 1.25rem' }}>
                <div className="animate-fade-in" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
                    <div className="glass-card" style={{ padding: '3rem' }}>
                        <div style={{ width: 80, height: 80, background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <CheckCircle2 size={40} />
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Assessment Completed!</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>You have successfully submitted your answers for <strong>{assessment?.title}</strong>.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ padding: '1.5rem', background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--card-border)' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>{result.score} / {result.total}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Correct Answers</div>
                            </div>
                            <div style={{ padding: '1.5rem', background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--card-border)' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{result.percentage}%</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Final Score</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <button onClick={() => navigate(`/student/assessments/${assessmentId}/review`)} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                View Detailed Results
                            </button>
                            <button onClick={() => navigate(`/student/courses/${assessment?.course_id}`, { state: { tab: 'assessments' } })} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                                Back to Course
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (!isDesktop || isMobile || isTablet) {
        return <MobileBlocker />
    }

    if (!isStarted) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg-base)', overflowY: 'auto', padding: '4rem 1.25rem' }}>
                <div className="animate-fade-in" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
                    <div className="glass-card" style={{ padding: '3rem' }}>
                        <div style={{ width: 80, height: 80, background: 'rgba(99, 102, 241, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                            <Lock size={40} />
                        </div>
                        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Secure AI Proctored Assessment</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            This assessment will be taken in <strong>Fullscreen Mode</strong> with <strong>AI Webcam Monitoring</strong> to ensure a fair environment.
                        </p>
                        <div style={{ padding: '1.25rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.2)', color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <strong style={{ color: '#f59e0b' }}>Security Rules:</strong>
                            <li style={{ listStyleType: 'disc', marginLeft: '1rem' }}>Exiting fullscreen or switching tabs will result in a warning strike.</li>
                            <li style={{ listStyleType: 'disc', marginLeft: '1rem' }}>An AI model will monitor your webcam to detect cell phones.</li>
                            <li style={{ listStyleType: 'disc', marginLeft: '1rem' }}><strong>Live Monitoring May Be Used:</strong> Proctors may periodically review your video stream.</li>
                            <li style={{ listStyleType: 'disc', marginLeft: '1rem' }}>Receiving 3 violation strikes will result in automatic test failure.</li>
                        </div>
                        
                        {!cameraEnabled ? (
                            <button onClick={startCamera} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem', fontSize: '1.1rem', marginBottom: '1rem', border: '1.5px solid var(--primary-500)', color: 'var(--primary-400)', background: 'transparent' }}>
                                <Camera size={20} style={{ marginRight: '0.5rem' }} /> Enable Webcam to Continue
                            </button>
                        ) : (
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <CheckCircle2 size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.25rem' }} /> Webcam Enabled & AI Ready
                                </div>
                                <button onClick={enterFullScreen} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem', fontSize: '1.1rem' }}>
                                    Enter Secure Mode & Start
                                </button>
                            </div>
                        )}

                        <Link to={`/student/courses/${assessment?.course_id}`} style={{ display: 'block', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Cancel and Go Back
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const currentQ = questions[currentIdx]
    const progress = Math.round(((currentIdx + 1) / questions.length) * 100)

    const isMulti = (q) => {
        if (!q?.correct_answer) return false
        if (q.correct_answer.startsWith('[') && q.correct_answer.endsWith(']')) {
            try {
                const arr = JSON.parse(q.correct_answer)
                return Array.isArray(arr) && arr.length > 1
            } catch (e) {
                return false
            }
        }
        return false
    }

    const getCorrectArray = (q) => {
        try {
            if (q?.correct_answer?.startsWith('[') && q?.correct_answer?.endsWith(']')) {
                return JSON.parse(q.correct_answer)
            }
            return [q.correct_answer]
        } catch (e) {
            return [q.correct_answer]
        }
    }

    const handleOptionClick = (opt) => {
        if (isMulti(currentQ)) {
            const currentAnswers = Array.isArray(answers[currentQ.id]) ? answers[currentQ.id] : []
            const isSelected = currentAnswers.includes(opt)
            
            let newAnswers
            if (isSelected) {
                newAnswers = currentAnswers.filter(a => a !== opt)
            } else {
                newAnswers = [...currentAnswers, opt]
            }
            setAnswers(p => ({ ...p, [currentQ.id]: newAnswers }))
        } else {
            setAnswers(p => ({ ...p, [currentQ.id]: opt }))
        }
    }

    const currentAnswer = answers[currentQ?.id]
    const isAnswered = isMulti(currentQ)
        ? (Array.isArray(currentAnswer) && currentAnswer.length > 0)
        : (currentAnswer !== undefined && currentAnswer !== null && currentAnswer !== '')

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg-base)', overflowY: 'auto', padding: '2rem 1.25rem' }}>
            <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <button onClick={() => navigate(`/student/courses/${assessment?.course_id}`, { state: { tab: 'assessments' } })} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            <ChevronLeft size={16} /> Quit Assessment
                        </button>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{assessment?.title}</h1>
                        {profile && <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>Student: {profile.full_name || profile.name || 'Unknown'}</div>}
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        {timeLeft !== null && (
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.4rem', 
                                color: timeLeft <= 60 ? '#ef4444' : 'var(--text-secondary)', 
                                fontSize: '0.85rem', 
                                fontWeight: 700,
                                background: timeLeft <= 60 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.08)',
                                padding: '0.3rem 0.6rem',
                                borderRadius: 6,
                                border: timeLeft <= 60 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(99, 102, 241, 0.15)'
                            }}>
                                <Clock size={14} className={timeLeft <= 60 ? 'animate-pulse' : ''} />
                                {formatTime(timeLeft)}
                            </div>
                        )}
                        {violationCount > 0 && (
                            <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, background: '#fef2f2', padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid #fee2e2' }}>
                                Violations: {violationCount}/3
                            </div>
                        )}
                        <div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Question {currentIdx + 1} of {questions.length}</div>
                            <div style={{ width: 120, height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ width: `${progress}%`, height: '100%', background: '#6366f1', transition: 'width 0.3s ease' }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Question Card */}
                <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {currentQ?.question_text}
                    </h2>
                    {currentQ?.image_url && (
                        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                            <img src={currentQ.image_url} alt="Question Reference" style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: '12px', border: '1px solid var(--card-border)', objectFit: 'contain' }} />
                        </div>
                    )}

                    {currentQ?.question_type === 'code_mcq' && currentQ?.code_snippet && (
                        <div style={{ marginBottom: '2rem', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                            <div style={{ background: '#1e293b', padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CodeIcon size={16} color="#94a3b8" />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0' }}>
                                        {currentQ.snippet_title || 'Code Snippet'}
                                    </span>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {currentQ.code_language}
                                </span>
                            </div>
                            <div style={{ background: '#0f172a', overflowX: 'auto' }}>
                                <div style={{ minWidth: 'min-content' }}>
                                    <CodeEditor
                                        value={currentQ.code_snippet}
                                        language={currentQ.code_language}
                                        readOnly={true}
                                        theme="dark"
                                        style={{ height: 'auto', minHeight: 150, padding: 0 }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {currentQ?.options.map((opt, i) => {
                            const isSelected = isMulti(currentQ) 
                                ? (Array.isArray(answers[currentQ.id]) && answers[currentQ.id].includes(opt))
                                : answers[currentQ.id] === opt

                            return (
                                <button
                                    key={i}
                                    onClick={() => handleOptionClick(opt)}
                                    style={{
                                        padding: '1.25rem 1.5rem',
                                        borderRadius: 12,
                                        border: `2px solid ${isSelected ? '#6366f1' : 'var(--card-border)'}`,
                                        background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--card-bg)',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        transition: 'all 0.2s ease',
                                        color: isSelected ? 'var(--primary-400)' : 'var(--text-primary)',
                                        fontWeight: isSelected ? 600 : 500
                                    }}
                                >
                                    <div style={{
                                        width: 24, height: 24,
                                        borderRadius: isMulti(currentQ) ? '6px' : '50%',
                                        border: `2px solid ${isSelected ? '#6366f1' : 'var(--text-muted)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: isSelected ? '#6366f1' : 'transparent',
                                        color: 'white',
                                        fontSize: '0.75rem',
                                        flexShrink: 0
                                    }}>
                                        {isSelected ? <CheckCircle2 size={14} /> : String.fromCodePoint(65 + i)}
                                    </div>
                                    {opt}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                        onClick={() => setCurrentIdx(p => Math.max(0, p - 1))}
                        disabled={currentIdx === 0}
                        className="btn-secondary"
                        style={{ gap: '0.5rem', opacity: currentIdx === 0 ? 0.5 : 1 }}
                    >
                        <ChevronLeft size={18} /> Previous
                    </button>

                    {currentIdx === questions.length - 1 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || (timeLeft !== null && timeLeft > 60) || !isAnswered}
                                className="btn-primary"
                                style={{ gap: '0.5rem', padding: '0.75rem 2rem' }}
                            >
                                {submitting ? 'Submitting...' : <><Send size={18} /> Submit Assessment</>}
                            </button>
                            {timeLeft !== null && timeLeft > 60 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>
                                    <Clock size={12} className="animate-pulse" />
                                    <span>Enabled in {formatTime(timeLeft - 60)}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => setCurrentIdx(p => Math.min(questions.length - 1, p + 1))}
                            disabled={!isAnswered}
                            className="btn-primary"
                            style={{ gap: '0.5rem' }}
                        >
                            Next Question <ChevronRight size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Webcam Feed */}
            {cameraEnabled && (
                <div style={{ position: 'fixed', top: '20px', right: '20px', width: '150px', height: '112px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #ef4444', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: !faceDetected ? 10000 : 50, background: '#000', transition: 'all 0.3s ease', transform: !faceDetected ? 'scale(1.5) translate(-20px, 20px)' : 'none' }}>
                    <video 
                        ref={(node) => {
                            videoRef.current = node;
                            if (node && mediaStream) {
                                if (node.srcObject !== mediaStream) node.srcObject = mediaStream;
                                if (node.paused) node.play().catch(e => console.error("Video play error:", e));
                            }
                        }}
                        autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    <div style={{ position: 'absolute', bottom: '4px', left: '0', right: '0', textAlign: 'center', fontSize: '0.6rem', color: 'white', fontWeight: 800, background: 'rgba(239,68,68,0.8)', padding: '2px 0' }}>
                        AI PROCTORING ACTIVE
                    </div>
                </div>
            )}

            {/* Face Not Detected Overlay */}
            {!faceDetected && isStarted && cameraEnabled && !submitted && !BYPASS_PROCTORING && (
                <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(15px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', flexDirection: 'column' }}>
                    <div style={{ width: 100, height: 100, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', color: '#ef4444', animation: 'pulse 2s infinite' }}>
                        <Camera size={50} />
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Face Not Detected</h1>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.2rem', maxWidth: 600, textAlign: 'center', lineHeight: 1.6 }}>
                        AI Proctoring has lost track of your face. Please ensure you are looking directly at the camera and your face is well-lit to continue the assessment.
                    </p>
                </div>
            )}
        </div>
    )
}
