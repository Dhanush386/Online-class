import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, ChevronRight, Send, Clock, CheckCircle2, Lock, ShieldAlert, Camera, Code as CodeIcon, Minimize, AlertTriangle, Sun, RotateCcw } from 'lucide-react'
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import CodeEditor from '../../components/CodeEditor'
import { useLiveKitProctoring } from '../../hooks/useLiveKitProctoring'
import useXpAward from '../../hooks/useXpAward'
import { getQuizEventType } from '../../constants/xpRewards'
import useTheme from '../../hooks/useTheme'
import { calculateAccessibleDay, isItemUnlocked } from '../../utils/dayAccessEngine'
import { calculateCourseProgress, saveProgressRecord } from '../../utils/progressSync'

const MAX_ATTEMPTS = 1
const BYPASS_PROCTORING = false // Set to false to enable AI proctoring violations in production

import { useDeviceType } from '../../hooks/useDeviceType'
import MobileBlocker from '../../components/MobileBlocker'

const isMulti = (q) => {
    if (!q?.correct_answer) return false
    if (q.correct_answer.startsWith('[') && q.correct_answer.endsWith(']')) {
        try {
            const arr = JSON.parse(q.correct_answer)
            return Array.isArray(arr) && arr.length > 1
        } catch {
            return false
        }
    }
    return false
}

export default function TakeAssessment() {
    const { assessmentId } = useParams()
    const { profile, user } = useAuth()
    const navigate = useNavigate()
    const { awardXp, toastMessage } = useXpAward()
    const { theme } = useTheme()

    const searchParams = new URLSearchParams(window.location.search)
    const isAdminTest = searchParams.get('admin') === 'true' || ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)

    const [assessment, setAssessment] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [result, setResult] = useState(null)
    const [error, setError] = useState('')

    const [currentIdx, setCurrentIdx] = useState(0)
    const [answers, setAnswers] = useState({}) // { questionId: selectedOption }
    const [isStarted, setIsStarted] = useState(false)
    const [timeLeft, _setTimeLeft] = useState(null)
    const [violationCount, setViolationCount] = useState(0)
    const [isAutoSubmitted, setIsAutoSubmitted] = useState(false)
    const [requiresReentry, setRequiresReentry] = useState(false)
    const [securityAlert, setSecurityAlert] = useState(null)
    const [faceDetected, setFaceDetected] = useState(true)
    const [showQuitConfirm, setShowQuitConfirm] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(
        () => typeof document !== 'undefined' && Boolean(document.fullscreenElement)
    )

    // Proctoring Risk Engine & Session States
    const [sessionId, setSessionId] = useState(null)
    const [riskScore, setRiskScore] = useState(0)
    const sessionIdRef = useRef(null)
    const sessionTokenRef = useRef(null)
    const riskScoreRef = useRef(0)
    const violationCountRef = useRef(0)
    const lastViolationTimes = useRef({})
    const hasTabSwitched = useRef(false)
    const handleSubmitRef = useRef(null)

    useEffect(() => { riskScoreRef.current = riskScore }, [riskScore])
    useEffect(() => { violationCountRef.current = violationCount }, [violationCount])
    useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

    // Proctoring Engine States
    const { isMobile, isTablet, isDesktop } = useDeviceType()
    const [cameraEnabled, setCameraEnabled] = useState(false)
    const [cameraBrightness, setCameraBrightness] = useState(1.0)
    const [aiModel, setAiModel] = useState(null)
    const [mediaStream, setMediaStream] = useState(null)
    const videoRef = useRef(null)
    const proctorInterval = useRef(null)
    const faceLostCountRef = useRef(0)
    const runProctorCheckRef = useRef(null)
    
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

        const handlePhoneDetected = (now) => {
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

        const handleFaceLost = (now) => {
            if (now - (lastViolationTimes.current['face_lost'] || 0) > 10000) {
                lastViolationTimes.current['face_lost'] = now;
                logViolation('face_lost', 20);
            }
        }

        const handleMultipleFaces = (now) => {
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

        const checkProctorFrame = async () => {
            if (videoRef.current?.readyState >= 2) {
                let hasFace = false

                // 1. Hardware accelerated FaceDetector (Chrome / Edge)
                if (typeof window !== 'undefined' && 'FaceDetector' in window) {
                    try {
                        const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 3 })
                        const faces = await detector.detect(videoRef.current)
                        if (faces && faces.length > 0) hasFace = true
                    } catch (e) {
                        console.debug('FaceDetector check note:', e)
                    }
                }

                let phoneDetected = false
                let personCount = 0

                if (aiModel) {
                    try {
                        const predictions = await aiModel.detect(videoRef.current)
                        predictions.forEach(p => {
                            if (p.class === 'cell phone') phoneDetected = true
                            if (p.class === 'person' && p.score > 0.35) personCount++
                        })
                        if (personCount > 0) hasFace = true
                    } catch (e) {
                        console.debug('COCO-SSD error in TakeAssessment:', e)
                    }
                }

                if (hasFace) {
                    faceLostCountRef.current = 0
                    setFaceDetected(true)
                } else {
                    faceLostCountRef.current = (faceLostCountRef.current || 0) + 1
                    // Require 3 consecutive misses (~7.5s) before triggering blocking overlay
                    if (faceLostCountRef.current >= 3) {
                        setFaceDetected(false)
                    }
                }

                const now = Date.now();

                // 1. Phone Detection (Risk: +40)
                if (phoneDetected) handlePhoneDetected(now)

                // 2. Face Lost Detection (Risk: +20)
                if (!hasFace && faceLostCountRef.current >= 3) handleFaceLost(now)

                // 3. Multiple Faces Detection (Risk: +50)
                if (personCount > 1) handleMultipleFaces(now)
            }
        }

        runProctorCheckRef.current = checkProctorFrame

        if (isStarted && cameraEnabled && videoRef.current) {
            proctorInterval.current = setInterval(checkProctorFrame, 2500)
        }

        return () => {
            if (proctorInterval.current) clearInterval(proctorInterval.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: true
            })
            setMediaStream(stream)
            setCameraEnabled(true)
        } catch {
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

    const autoSubmittedRef = useRef(false)
    useEffect(() => {
        if (violationCount >= 3 && isStarted && !submitted && !submitting && !autoSubmittedRef.current) {
            autoSubmittedRef.current = true
            setIsAutoSubmitted(true)
            // Use setTimeout + ref to ensure we call the latest handleSubmit
            setTimeout(() => {
                if (handleSubmitRef.current) {
                    handleSubmitRef.current(true)
                }
            }, 200)
        }
    }, [violationCount, isStarted, submitted, submitting])

    useEffect(() => {
        const handleSecurity = (e) => {
            if (isStarted) {
                e.preventDefault()
            }
        }

        const handleFullScreenChange = () => {
            const hasFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
            setIsFullscreen(hasFs);
            if (BYPASS_PROCTORING) return;
            if (isStarted && !hasFs && !submitted) {
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
            if (isAdminTest) {
                setSessionId('admin-preview-session')
                sessionIdRef.current = 'admin-preview-session'
                sessionTokenRef.current = 'admin-preview-token'
            } else {
                try {
                    // Server-side device validation & cryptographically signed session token issuance
                    const { data: sessionResp, error: rpcErr } = await supabase.rpc('start_exam_session', {
                        p_assessment_id: assessmentId,
                        p_user_agent: navigator.userAgent,
                        p_viewport_width: window.innerWidth,
                        p_viewport_height: window.innerHeight,
                        p_touch_points: navigator.maxTouchPoints || 0
                    })
                    
                    if (rpcErr) {
                        if (rpcErr.code === '22023') {
                            alert('Mobile devices are blocked. Proctored exams must be taken on a desktop or laptop.')
                            navigate('/student/assessments')
                            return
                        } else if (rpcErr.code === '23505') {
                            alert('You have already submitted an attempt for this assessment.')
                            navigate('/student/assessments')
                            return
                        } else if (rpcErr.code === 'PGRST202' || rpcErr.message?.includes('schema cache') || rpcErr.message?.includes('not found') || rpcErr.status === 404) {
                            console.warn('start_exam_session RPC not found, falling back to direct session creation:', rpcErr)
                            const { data: directSession } = await supabase.from('proctoring_sessions').insert({
                                student_id: profile.id,
                                assessment_id: assessmentId,
                                status: 'active'
                            }).select().maybeSingle()

                            const genId = directSession?.id || `session-${Date.now()}`
                            setSessionId(genId)
                            sessionIdRef.current = genId
                            sessionTokenRef.current = `token-${genId}`
                        } else {
                            alert('Could not start verified exam session: ' + (rpcErr.message || 'Verification failed.'))
                            navigate('/student/assessments')
                            return
                        }
                    } else if (sessionResp) {
                        setSessionId(sessionResp.sessionId)
                        sessionIdRef.current = sessionResp.sessionId
                        sessionTokenRef.current = sessionResp.sessionToken
                    }
                } catch (err) {
                    console.warn('Error starting proctoring session via RPC, falling back:', err)
                    const { data: directSession } = await supabase.from('proctoring_sessions').insert({
                        student_id: profile.id,
                        assessment_id: assessmentId,
                        status: 'active'
                    }).select().maybeSingle()

                    const genId = directSession?.id || `session-${Date.now()}`
                    setSessionId(genId)
                    sessionIdRef.current = genId
                    sessionTokenRef.current = `token-${genId}`
                }
            }
        }
    }



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

            // Check if locked for student's groups (Skip in admin test mode)
            if (!isAdminTest) {
                const userGroupIds = memberships?.map(m => m.group_id) || []
                const isResourceLocked = locks?.some(l => userGroupIds.includes(l.group_id))

                // Get enrollment date & accessible day
                const { data: enrollData } = await supabase
                    .from('enrollments')
                    .select('enrolled_at')
                    .eq('student_id', profile.id)
                    .eq('course_id', assess.course_id)
                    .maybeSingle()

                const enrolledAt = enrollData?.enrolled_at || profile?.created_at || new Date()
                const accessibleDay = calculateAccessibleDay(enrolledAt)

                const lockStatus = isItemUnlocked({
                    item: assess,
                    type: 'assessment',
                    accessibleDay,
                    lockedAssessIds: isResourceLocked ? [assess.id] : [],
                    groupDayAccess: locksDay
                })

                if (lockStatus.isLocked) {
                    alert(lockStatus.reason || 'This assessment is currently locked.')
                    navigate(`/student/courses/${assess.course_id}`, { replace: true })
                    return
                }

                // CHECK: Scheduled Open Time
                if (assess.open_time && new Date(assess.open_time) > new Date()) {
                    alert(`This assessment opens on ${new Date(assess.open_time).toLocaleString()}.`)
                    navigate(`/student/courses/${assess.course_id}`, { replace: true })
                    return
                }

                if ((existingSubs || []).length >= MAX_ATTEMPTS) {
                    navigate(`/student/assessments/${assessmentId}/review`, { replace: true })
                    return
                }
            }

            setAssessment(assess)
            
            // Shuffle questions for this student
            let fetchedQuestions = qData || []
            for (let i = fetchedQuestions.length - 1; i > 0; i--) {
                const j = Math.floor((globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * (i + 1));
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
            supabase.from('video_progress').select('video_id').eq('student_id', profile.id),
            supabase.from('coding_submissions').select('challenge_id, status').eq('student_id', profile.id)
        ])

        if (ve || ce || ae || vpe || se) {
            console.error('Progress fetch error:', { ve, ce, ae, vpe, se })
        }

        const { data: allAssessSubs, error: ase } = await supabase.from('assessment_submissions').select('assessment_id').eq('student_id', profile.id)
        if (ase) console.error('Assessment subs fetch error:', ase)

        const courseProgress = calculateCourseProgress(
            vids,
            chls,
            assessData,
            vpData,
            subData,
            allAssessSubs
        )

        console.log(`Progress Update [${courseId}]: ${courseProgress.percentage}% (V:${courseProgress.completedSessions}/${courseProgress.totalSessions}, C:${courseProgress.completedCoding}/${courseProgress.totalCoding}, A:${courseProgress.completedAssess}/${courseProgress.totalAssessments})`)

        await saveProgressRecord(profile.id, courseId, courseProgress.percentage)
    }

    async function handleSubmit(isAuto = false) {
        if (!isAuto && Object.keys(answers).length < questions.length) {
            if (!confirm('You haven\'t answered all questions. Submit anyway?')) return
        }

        if (isAdminTest) {
            let testScore = 0
            questions.forEach(q => {
                const ans = answers[q.id]
                let isCorrect = false
                try {
                    if (q.correct_answer?.startsWith('[') && q.correct_answer?.endsWith(']')) {
                        const correctArr = JSON.parse(q.correct_answer)
                        if (Array.isArray(ans)) {
                            isCorrect = ans.length === correctArr.length && ans.every(v => correctArr.includes(v))
                        } else {
                            isCorrect = correctArr.includes(ans)
                        }
                    } else {
                        isCorrect = ans === q.correct_answer
                    }
                } catch {
                    isCorrect = ans === q.correct_answer
                }
                if (isCorrect) testScore++
            })
            const finalPct = Math.round((testScore / (questions.length || 1)) * 100)
            setResult({
                score: testScore,
                total: questions.length,
                percentage: finalPct
            })
            setSubmitted(true)
            setSubmitting(false)
            return
        }

        setSubmitting(true)
        try {
            const rawAnswers = questions.map(q => ({
                question_id: q.id,
                selected_option: answers[q.id] || (isMulti(q) ? [] : '')
            }))

            // Fail-closed server-side grading and token submission
            if (!sessionTokenRef.current || !sessionIdRef.current) {
                throw new Error('Active exam session token not found. Please refresh and restart.')
            }

            const { data: submitResp, error: tokenErr } = await supabase.rpc('submit_assessment_with_token', {
                p_assessment_id: assessmentId,
                p_session_id: sessionIdRef.current,
                p_session_token: sessionTokenRef.current,
                p_answers: rawAnswers
            })

            if (tokenErr) {
                if (tokenErr.code !== '23505') throw tokenErr
            }

            const finalScore = submitResp?.score ?? 0
            const finalTotal = submitResp?.total ?? questions.length
            const finalPct = submitResp?.percentage ?? Math.round((finalScore / (finalTotal || 1)) * 100)

            setResult({
                score: finalScore,
                total: finalTotal,
                percentage: finalPct
            })
            setSubmitted(true)
            localStorage.removeItem(`assessment_endTime_${assessmentId}`)

            // Award XP based on server-verified score
            const scorePercent = finalPct
            const xpEventType = getQuizEventType(scorePercent)
            await awardXp({
                eventType: xpEventType,
                referenceId: assessmentId,
                courseId: assessment.course_id || null,
                moduleType: 'quiz',
                reason: `${assessment.title} — ${scorePercent}%`,
                isFirstAttempt: true,
                metadata: { score: finalScore, total: finalTotal, percentage: scorePercent }
            })

            // Update course progress
            updateOverallProgress(assessment.course_id)

            // If submitted due to violations, navigate back to course after 3 seconds
            if (isAuto || violationCount >= 3) {
                setTimeout(() => {
                    navigate(`/student/courses/${assessment.course_id}`, { state: { tab: 'assessments' } })
                }, 3000)
            }
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }
    // Keep ref in sync every render so auto-submit effect always calls the latest version
    handleSubmitRef.current = handleSubmit

    // Show Security Block UNLESS we're in auto-submit territory (violations maxed or timer expired)
    const shouldBlockForSecurity = (requiresReentry || securityAlert) && !submitted && !BYPASS_PROCTORING
        && violationCount < 3 && !isAutoSubmitted && !(timeLeft !== null && timeLeft <= 0)

    useEffect(() => {
        if (shouldBlockForSecurity) {
            const handleKey = (e) => {
                if (e.key === 'Enter' || e.code === 'Space') {
                    e.preventDefault();
                    setSecurityAlert(null);
                    setRequiresReentry(false);
                    enterFullScreen();
                }
            };
            window.addEventListener('keydown', handleKey);
            return () => window.removeEventListener('keydown', handleKey);
        }
    }, [shouldBlockForSecurity]);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading assessment...</div>
    if (error && !assessment) return <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>Error: {error}</div>

    const renderSecurityBlock = () => {
        return (
            <div 
                onClick={() => {
                    setSecurityAlert(null);
                    setRequiresReentry(false);
                    enterFullScreen();
                }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.98)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', cursor: 'pointer' }}
            >
                <div onClick={(e) => e.stopPropagation()} className="glass-card animate-scale-in" style={{ maxWidth: 500, padding: '3rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'default' }}>
                    <div style={{ width: 80, height: 80, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#ef4444' }}>
                        <ShieldAlert size={40} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>{securityAlert ? 'Security Warning' : 'Fullscreen Required'}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', lineHeight: 1.6 }}>
                        {securityAlert || `You have exited Fullscreen Secure Mode. Full screen is strictly required until you complete and submit your assessment. Click below to return.`}
                    </p>
                    <button onClick={() => {
                        setSecurityAlert(null);
                        setRequiresReentry(false);
                        enterFullScreen();
                    }} className="btn-primary" style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem', background: '#ef4444', border: 'none', justifyContent: 'center' }}>
                        {securityAlert ? 'I Understand & Resume' : 'Return to Full Screen Mode'}
                    </button>
                </div>
            </div>
        )
    }

    if (shouldBlockForSecurity) {
        return renderSecurityBlock()
    }

    const renderSubmittedState = () => {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg-base)', overflowY: 'auto', padding: '4rem 1.25rem' }}>
                <div className="animate-fade-in" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
                    <div className="glass-card" style={{ padding: '3rem' }}>
                        <div style={{ width: 80, height: 80, background: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <CheckCircle2 size={40} />
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Assessment Completed!</h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>You have successfully submitted your answers for <strong>{assessment?.title}</strong>.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ padding: '1.5rem', background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--card-border)' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>{result.score} / {result.total}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Correct Answers</div>
                            </div>
                            <div style={{ padding: '1.5rem', background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid var(--card-border)' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{result.percentage}%</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Final Score</div>
                            </div>
                            <div style={{ padding: '1.5rem', background: 'rgba(99,102,241,0.07)', borderRadius: 16, border: '1px solid rgba(99,102,241,0.2)' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                                    <span>⚡</span>
                                    {result.percentage >= 80 ? 25 : result.percentage >= 50 ? 15 : 5}
                                </div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>XP Earned</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {isAdminTest ? (
                                <>
                                    <button
                                        onClick={() => {
                                            setSubmitted(false)
                                            setIsStarted(false)
                                            setAnswers({})
                                            setResult(null)
                                            setCurrentIdx(0)
                                        }}
                                        className="btn-primary"
                                        style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                                    >
                                        🔄 Test Assessment Again
                                    </button>
                                    <button onClick={() => window.close()} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                                        Close Preview Tab
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => {
                                        if (typeof document !== 'undefined' && document.fullscreenElement) {
                                            document.exitFullscreen().catch(() => {});
                                        }
                                        navigate(`/student/assessments/${assessmentId}/review`);
                                    }} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                        View Detailed Results
                                    </button>
                                    <button onClick={() => {
                                        if (typeof document !== 'undefined' && document.fullscreenElement) {
                                            document.exitFullscreen().catch(() => {});
                                        }
                                        navigate(`/student/courses/${assessment?.course_id}`, { state: { tab: 'assessments' } });
                                    }} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                                        Back to Course
                                    </button>
                                    {isFullscreen && (
                                        <button onClick={() => {
                                            if (typeof document !== 'undefined' && document.fullscreenElement) {
                                                document.exitFullscreen().catch(() => {});
                                            }
                                        }} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', gap: '0.4rem' }}>
                                            <Minimize size={16} /> Exit Full Screen
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* XP Toast */}
                {toastMessage && (
                    <div style={{
                        position: 'fixed',
                        bottom: '2rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 99999,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: 'white',
                        padding: '0.85rem 1.75rem',
                        borderRadius: '999px',
                        fontSize: '1rem',
                        fontWeight: 700,
                        boxShadow: '0 8px 32px rgba(99,102,241,0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem'
                    }}>
                        <span style={{ fontSize: '1.4rem' }}>⚡</span>
                        <div>
                            <div style={{ fontSize: '1rem', fontWeight: 800 }}>{toastMessage.text}</div>
                            {toastMessage.reason && <div style={{ fontSize: '0.78rem', opacity: 0.85, marginTop: '0.1rem' }}>{toastMessage.reason}</div>}
                        </div>
                    </div>
                )}
            </div>
        )
    }

    if (submitted) {
        return renderSubmittedState()
    }

    if (!isDesktop || isMobile || isTablet) {
        return <MobileBlocker />
    }

    const renderStartScreen = () => {
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
                        
                        {isAdminTest && (
                            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '0.85rem 1.25rem', marginBottom: '1.5rem', color: '#6d28d9', fontSize: '0.875rem', fontWeight: 600 }}>
                                👑 Organizer Test Mode: You are previewing and testing this assessment. Single-attempt restrictions and proctoring locks are bypassed.
                            </div>
                        )}
                        {isAdminTest ? (
                            <button onClick={enterFullScreen} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem', fontSize: '1.1rem', marginBottom: '1rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                Start Test Preview
                            </button>
                        ) : cameraEnabled ? (
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ width: '100%', maxWidth: 360, height: 210, margin: '0 auto 1.25rem', borderRadius: 14, overflow: 'hidden', border: '2px solid rgba(99, 102, 241, 0.4)', background: '#000', position: 'relative', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                                    <video
                                        ref={(node) => {
                                            if (node && mediaStream && node.srcObject !== mediaStream) {
                                                node.srcObject = mediaStream;
                                                node.play().catch(() => {});
                                            }
                                        }}
                                        autoPlay playsInline muted
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', filter: `brightness(${cameraBrightness}) contrast(1.05)` }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setCameraBrightness(b => b >= 1.75 ? 1.0 : Number((b + 0.25).toFixed(2)))}
                                        style={{ position: 'absolute', top: 10, right: 10, background: cameraBrightness > 1 ? 'rgba(245, 158, 11, 0.95)' : 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '4px 10px', borderRadius: 8, fontSize: '0.74rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}
                                    >
                                        <Sun size={13} /> {cameraBrightness > 1 ? `Boosted ${Math.round(cameraBrightness * 100)}%` : 'Boost Brightness'}
                                    </button>
                                    <div style={{ position: 'absolute', bottom: 8, left: 10, right: 10, background: 'rgba(0,0,0,0.65)', padding: '3px 8px', borderRadius: 6, color: '#fff', fontSize: '0.72rem', textAlign: 'center' }}>
                                        Check your lighting before starting
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', padding: '0.85rem', borderRadius: 8, fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                    <CheckCircle2 size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.25rem' }} /> Webcam Enabled & AI Ready
                                </div>
                                <button onClick={enterFullScreen} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem', fontSize: '1.1rem' }}>
                                    Enter Secure Mode & Start
                                </button>
                            </div>
                        ) : (
                            <button onClick={startCamera} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem', fontSize: '1.1rem', marginBottom: '1rem', border: '1.5px solid var(--primary-500)', color: 'var(--primary-400)', background: 'transparent' }}>
                                <Camera size={20} style={{ marginRight: '0.5rem' }} /> Enable Webcam to Continue
                            </button>
                        )}

                        <Link to={`/student/courses/${assessment?.course_id}`} style={{ display: 'block', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Cancel and Go Back
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (!isStarted) {
        return renderStartScreen()
    }

    const currentQ = questions[currentIdx]
    const progress = Math.round(((currentIdx + 1) / questions.length) * 100)



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

    const renderHeader = () => (
        <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#10b981', fontSize: '0.78rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                        <Lock size={12} /> Fullscreen Exam Mode Enforced
                    </span>
                    <button onClick={() => setShowQuitConfirm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
                        Quit Exam
                    </button>
                </div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{assessment?.title}</h1>
                {profile && <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>Student: {profile.full_name || profile.name || 'Unknown'}</div>}
            </div>
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>

                {violationCount > 0 && (
                    <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, background: '#fef2f2', padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid #fee2e2' }}>
                        Violations: {violationCount}/3
                    </div>
                )}
                <div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Question {currentIdx + 1} of {questions.length}</div>
                    <div style={{ width: 120, height: 6, background: 'var(--sidebar-border)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: '#6366f1', transition: 'width 0.3s ease' }} />
                    </div>
                </div>
            </div>
        </div>
    );

    const renderOptions = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {currentQ?.options.map((opt) => {
                const isSelected = isMulti(currentQ)
                    ? (Array.isArray(answers[currentQ.id]) && answers[currentQ.id].includes(opt))
                    : answers[currentQ.id] === opt

                return (
                    <button
                        key={opt}
                        onClick={() => handleOptionClick(opt)}
                        style={{
                            padding: '0.9rem 1.25rem',
                            borderRadius: 10,
                            border: isSelected ? '2px solid var(--primary-500)' : '1px solid var(--sidebar-border)',
                            background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-elevated)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.85rem',
                            transition: 'all 0.18s ease',
                            color: isSelected ? 'var(--primary-600)' : 'var(--text-primary)',
                            fontWeight: isSelected ? 600 : 500,
                            fontSize: '0.92rem'
                        }}
                    >
                        <div style={{
                            width: 22, height: 22,
                            borderRadius: isMulti(currentQ) ? '6px' : '50%',
                            border: isSelected ? '2px solid var(--primary-500)' : '1.5px solid var(--sidebar-border)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isSelected ? 'var(--primary-500)' : 'var(--bg-surface)',
                            color: 'white',
                            fontSize: '0.75rem',
                            flexShrink: 0
                        }}>
                            {isSelected ? <CheckCircle2 size={13} color="#ffffff" strokeWidth={2.5} /> : null}
                        </div>
                        <span style={{ flex: 1, wordBreak: 'break-word', lineHeight: 1.4 }}>{opt}</span>
                    </button>
                )
            })}
        </div>
    );

    const renderQuestionCard = () => (
        <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {currentQ?.question_text}
            </h2>
            {currentQ?.image_url && (
                <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <img src={currentQ.image_url} alt="Question Reference" style={{ maxWidth: '100%', maxHeight: '350px', borderRadius: '12px', border: '1px solid var(--card-border)', objectFit: 'contain' }} />
                </div>
            )}
            {renderOptions()}
        </div>
    );

    const renderNavigation = () => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <button
                onClick={() => setCurrentIdx(p => Math.max(0, p - 1))}
                disabled={currentIdx === 0}
                className="btn-secondary"
                style={{ gap: '0.5rem', opacity: currentIdx === 0 ? 0.5 : 1 }}
            >
                <ChevronLeft size={18} /> Previous
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                {/* Show Submit on last question OR when violations maxed */}
                {(currentIdx === questions.length - 1 || violationCount >= 3) && (
                    <button
                        onClick={() => handleSubmit(violationCount >= 3)}
                        disabled={submitting}
                        className="btn-primary"
                        style={{
                            gap: '0.5rem', padding: '0.85rem 2rem',
                            ...(violationCount >= 3 ? { background: '#ef4444', borderColor: '#dc2626' } : {})
                        }}
                    >
                        {submitting ? 'Submitting...' : <><Send size={18} /> {violationCount >= 3 ? 'Submit Now (Violations)' : 'Submit Assessment'}</>}
                    </button>
                )}

                {/* Show Next Question when not on last question */}
                {currentIdx !== questions.length - 1 && violationCount < 3 && (
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
    );


    const renderWebcamFeed = () => {
        if (!cameraEnabled) return null;
        return (
            <div style={{ position: 'fixed', top: '20px', right: '20px', width: '150px', height: '112px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #ef4444', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: faceDetected ? 50 : 10000, background: '#000', transition: 'all 0.3s ease', transform: faceDetected ? 'none' : 'scale(1.5) translate(-20px, 20px)' }}>
                <video 
                    ref={(node) => {
                        videoRef.current = node;
                        if (node && mediaStream) {
                            if (node.srcObject !== mediaStream) node.srcObject = mediaStream;
                            if (node.paused) node.play().catch(e => console.error("Video play error:", e));
                        }
                    }}
                    autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', filter: `brightness(${cameraBrightness}) contrast(1.05)` }} 
                />
                {/* Quick Brightness Toggle */}
                <button
                    type="button"
                    title="Boost Camera Brightness"
                    onClick={() => setCameraBrightness(b => b >= 1.75 ? 1.0 : Number((b + 0.25).toFixed(2)))}
                    style={{ position: 'absolute', top: '4px', right: '4px', background: cameraBrightness > 1 ? 'rgba(245, 158, 11, 0.9)' : 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', borderRadius: '4px', padding: '2px 5px', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                    <Sun size={10} /> {cameraBrightness > 1 ? `${Math.round(cameraBrightness * 100)}%` : ''}
                </button>
                <div style={{ position: 'absolute', bottom: '4px', left: '0', right: '0', textAlign: 'center', fontSize: '0.6rem', color: 'white', fontWeight: 800, background: 'rgba(239,68,68,0.8)', padding: '2px 0' }}>
                    AI PROCTORING ACTIVE
                </div>
            </div>
        );
    };

    const renderFaceNotDetectedOverlay = () => {
        if (faceDetected || !isStarted || !cameraEnabled || submitted || BYPASS_PROCTORING) return null;
        return (
            <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(15px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', flexDirection: 'column' }}>
                <div style={{ width: 80, height: 80, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', color: '#ef4444', animation: 'pulse 2s infinite' }}>
                    <Camera size={42} />
                </div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white', marginBottom: '0.75rem', textAlign: 'center' }}>Face Not Detected</h1>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', maxWidth: 540, textAlign: 'center', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                    AI Proctoring has lost track of your face. If your room is well-lit, your webcam may be underexposed. Click <strong>Boost Brightness</strong> below or adjust your laptop angle.
                </p>

                {/* Viewfinder Preview */}
                <div style={{ width: '100%', maxWidth: 300, height: 180, borderRadius: 12, overflow: 'hidden', border: '2px dashed #ef4444', background: '#000', marginBottom: '1.25rem', position: 'relative' }}>
                    <video
                        ref={(node) => {
                            if (node && mediaStream && node.srcObject !== mediaStream) {
                                node.srcObject = mediaStream;
                                node.play().catch(() => {});
                            }
                        }}
                        autoPlay playsInline muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', filter: `brightness(${cameraBrightness}) contrast(1.05)` }}
                    />
                    <div style={{ position: 'absolute', bottom: 6, left: 10, right: 10, textAlign: 'center', background: 'rgba(0,0,0,0.7)', borderRadius: 4, padding: '2px 6px', color: '#fff', fontSize: '0.7rem' }}>
                        Center your face in good light
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1rem' }}>
                    <button
                        type="button"
                        onClick={() => {
                            setCameraBrightness(b => b >= 1.75 ? 1.0 : Number((b + 0.25).toFixed(2)));
                            setTimeout(() => {
                                if (runProctorCheckRef.current) runProctorCheckRef.current();
                            }, 200);
                        }}
                        className="btn-secondary"
                        style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#f59e0b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.1rem' }}
                    >
                        <Sun size={16} /> Boost Brightness ({Math.round(cameraBrightness * 100)}%)
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            if (runProctorCheckRef.current) runProctorCheckRef.current();
                        }}
                        className="btn-primary"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem' }}
                    >
                        <RotateCcw size={16} /> Re-verify Face Now
                    </button>
                </div>
            </div>
        );
    };

    const renderQuitConfirmModal = () => {
        if (!showQuitConfirm) return null;
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div className="glass-card animate-scale-in" style={{ maxWidth: 450, width: '100%', padding: '2rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: '#ef4444' }}>
                        <AlertTriangle size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>Quit Assessment?</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                        Full screen mode is strictly required to preserve exam integrity. Quitting before completing all questions will record an incomplete attempt.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button onClick={() => setShowQuitConfirm(false)} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                            Stay in Exam
                        </button>
                        <button onClick={() => {
                            setShowQuitConfirm(false);
                            if (typeof document !== 'undefined' && document.fullscreenElement) {
                                document.exitFullscreen().catch(() => {});
                            }
                            navigate(`/student/courses/${assessment?.course_id}`, { state: { tab: 'assessments' } });
                        }} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', color: '#ef4444', borderColor: '#ef4444' }}>
                            Quit Anyway
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const isCodeMCQ = currentQ?.question_type === 'code_mcq' && currentQ?.code_snippet

    if (isCodeMCQ) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Top header bar */}
                <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--card-border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
                    {renderHeader()}
                </div>

                {/* Split layout */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                    {/* LEFT: Question + Options + Nav */}
                    <div style={{
                        width: '320px',
                        minWidth: '280px',
                        maxWidth: '380px',
                        borderRight: '1px solid var(--sidebar-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflowY: 'auto',
                        background: 'var(--bg-surface)',
                        padding: '1.5rem 1.25rem',
                        gap: '1.25rem'
                    }}>
                        {/* Question text */}
                        <div>
                            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {currentQ?.question_text}
                            </p>
                        </div>

                        {/* Options */}
                        {renderOptions()}

                        {/* Navigation */}
                        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
                            {renderNavigation()}
                        </div>
                    </div>

                    {/* Collapse toggle (visual only) */}
                    <div style={{
                        width: '24px',
                        background: 'var(--bg-base)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRight: '1px solid var(--card-border)',
                        cursor: 'default',
                        flexShrink: 0
                    }}>
                        <ChevronLeft size={14} color="var(--text-muted)" />
                    </div>

                    {/* RIGHT: Code Editor */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base)' }}>
                        {/* Editor header */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 1rem',
                            borderBottom: '1px solid var(--card-border)',
                            background: 'var(--bg-surface)',
                            flexShrink: 0
                        }}>
                            <span style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: 700, background: 'rgba(99,102,241,0.12)', padding: '0.2rem 0.6rem', borderRadius: 4, borderTop: '2px solid #6366f1' }}>
                                {currentQ.snippet_title || 'Code'}
                            </span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {currentQ.code_language?.toUpperCase()}
                            </span>
                        </div>

                        {/* Editor body - fills remaining height */}
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            <CodeEditor
                                value={currentQ.code_snippet}
                                language={currentQ.code_language}
                                readOnly={true}
                                theme={theme === 'light' ? 'light' : 'dark'}
                                style={{ height: '100%', minHeight: '100%' }}
                            />
                        </div>
                    </div>
                </div>

                {renderWebcamFeed()}
                {renderFaceNotDetectedOverlay()}
                {renderQuitConfirmModal()}
            </div>
        )
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg-base)', overflowY: 'auto', padding: '2rem 1.25rem' }}>
            <div className="animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
                {renderHeader()}
                {renderQuestionCard()}
                {renderNavigation()}
            </div>

            {renderWebcamFeed()}
            {renderFaceNotDetectedOverlay()}
            {renderQuitConfirmModal()}
        </div>
    )
}
