import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ChevronLeft, ChevronRight, Send, AlertCircle, Clock, CheckCircle2, XCircle, Lock, ShieldAlert, Camera } from 'lucide-react'
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'

const MAX_ATTEMPTS = 1


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
    const [violationCount, setViolationCount] = useState(0)
    const [isAutoSubmitted, setIsAutoSubmitted] = useState(false)
    const [requiresReentry, setRequiresReentry] = useState(false)
    const [faceDetected, setFaceDetected] = useState(true)
    const containerRef = useRef(null)

    // Proctoring Engine States
    const { isMobile, isTablet, isDesktop } = useDeviceType()
    const [cameraEnabled, setCameraEnabled] = useState(false)
    const [aiModel, setAiModel] = useState(null)
    const [mediaStream, setMediaStream] = useState(null)
    const videoRef = useRef(null)
    const proctorInterval = useRef(null)
    const peerConnections = useRef({})

    // Check Device
    // Handled by useDeviceType hooks

    // Load AI Model
    useEffect(() => {
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

                    if (phoneDetected) {
                        setViolationCount(prev => {
                            const next = prev + 1
                            if (next < 3) {
                                alert(`Security Warning (${next}/3): Unauthorized device (cell phone) detected by AI Proctoring.`)
                            }
                            return next
                        })
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
                    setViolationCount(prev => {
                        const next = prev + 1
                        if (next < 3) {
                            const msg = payload.payload.message || "Warning from Ai. Please ensure your environment is clear.";
                            alert(`Security Warning (${next}/3): ${msg}`)
                        }
                        return next
                    })
                }
            })
            .on('broadcast', { event: 'webrtc_offer' }, async (payload) => {
                const { studentId, offer, organizerId } = payload.payload;
                if (studentId !== profile.id) return;

                try {
                    const pc = new RTCPeerConnection({
                        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                    });
                    
                    peerConnections.current[organizerId] = pc;

                    if (mediaStream) {
                        mediaStream.getTracks().forEach(track => {
                            pc.addTrack(track, mediaStream);
                        });
                    }

                    pc.onicecandidate = (event) => {
                        if (event.candidate) {
                            channel.send({
                                type: 'broadcast',
                                event: 'webrtc_ice_candidate',
                                payload: {
                                    target: 'organizer',
                                    organizerId,
                                    studentId: profile.id,
                                    candidate: event.candidate
                                }
                            });
                        }
                    };

                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    channel.send({
                        type: 'broadcast',
                        event: 'webrtc_answer',
                        payload: {
                            target: 'organizer',
                            organizerId,
                            studentId: profile.id,
                            answer
                        }
                    });

                } catch (err) {
                    console.error('WebRTC Answer Error:', err);
                }
            })
            .on('broadcast', { event: 'webrtc_ice_candidate' }, async (payload) => {
                const { target, studentId, organizerId, candidate } = payload.payload;
                if (target === 'student' && studentId === profile.id) {
                    const pc = peerConnections.current[organizerId];
                    if (pc && candidate) {
                        try {
                            await pc.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (err) {
                            console.error('Error adding ICE candidate:', err);
                        }
                    }
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
                    type: 'assessment'
                }
            }).catch(err => console.error(err))
        }, 3000)

        return () => {
            clearInterval(pingInterval)
            Object.values(peerConnections.current).forEach(pc => pc.close());
            peerConnections.current = {};
            channel.unsubscribe()
        }
    }, [isStarted, profile, assessmentId, mediaStream])

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
            if (isStarted && !document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement && !submitted) {
                setViolationCount(prev => {
                    const next = prev + 1
                    if (next < 3) {
                        setRequiresReentry(true)
                    }
                    return next
                })
            }
        }

        const handleVisibilityChange = () => {
            if (isStarted && document.hidden && !submitted) {
                setViolationCount(prev => {
                    const next = prev + 1
                    if (next < 3) {
                        alert(`Security Warning (${next}/3): You lost focus on the assessment window. Please stay on this page.`)
                    }
                    return next
                })
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

    const enterFullScreen = () => {
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
            setQuestions(qData || [])
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

            setResult({
                score: correctCount,
                total: questions.length,
                percentage: Math.round((correctCount / questions.length) * 100)
            })
            setSubmitted(true)

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

    if (requiresReentry && !submitted) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.98)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="glass-card animate-scale-in" style={{ maxWidth: 500, padding: '3rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ width: 80, height: 80, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#ef4444' }}>
                        <ShieldAlert size={40} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>Security Block</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', lineHeight: 1.6 }}>
                        You have exited <strong>Secure Mode</strong>. This is a security violation ({violationCount}/3). 
                        You must re-enter fullscreen to continue your assessment.
                    </p>
                    <button onClick={enterFullScreen} className="btn-primary" style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem', background: '#ef4444', border: 'none' }}>
                        Re-enter Secure Mode
                    </button>
                </div>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="animate-fade-in" style={{ maxWidth: 600, margin: '4rem auto', textAlign: 'center' }}>
                <div className="glass-card" style={{ padding: '3rem' }}>
                    <div style={{ width: 80, height: 80, background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#10b981' }}>
                        <CheckCircle2 size={40} />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Assessment Completed!</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>You have successfully submitted your answers for <strong>{assessment?.title}</strong>.</p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#6366f1' }}>{result.score} / {result.total}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Correct Answers</div>
                        </div>
                        <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0' }}>
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
        )
    }

    if (!isDesktop || isMobile || isTablet) {
        return <MobileBlocker />
    }

    if (!isStarted) {
        return (
            <div className="animate-fade-in" style={{ maxWidth: 600, margin: '4rem auto', textAlign: 'center' }}>
                <div className="glass-card" style={{ padding: '3rem' }}>
                    <div style={{ width: 80, height: 80, background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#6366f1' }}>
                        <Lock size={40} />
                    </div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Secure AI Proctored Assessment</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        This assessment will be taken in <strong>Fullscreen Mode</strong> with <strong>AI Webcam Monitoring</strong> to ensure a fair environment.
                    </p>
                    <div style={{ padding: '1rem', background: '#fff7ed', borderRadius: 12, border: '1px solid #fed7aa', color: '#9a3412', fontSize: '0.875rem', marginBottom: '2rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <strong>Security Rules:</strong>
                        <li>Exiting fullscreen or switching tabs will result in a warning strike.</li>
                        <li>An AI model will monitor your webcam to detect cell phones.</li>
                        <li>Receiving 3 violation strikes will result in automatic test failure.</li>
                    </div>
                    
                    {!cameraEnabled ? (
                        <button onClick={startCamera} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem', fontSize: '1.1rem', marginBottom: '1rem', border: '1px solid #6366f1', color: '#6366f1' }}>
                            <Camera size={20} style={{ marginRight: '0.5rem' }} /> Enable Webcam to Continue
                        </button>
                    ) : (
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ background: '#ecfdf5', color: '#059669', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 600 }}>
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
        )
    }

    const currentQ = questions[currentIdx]
    const progress = Math.round(((currentIdx + 1) / questions.length) * 100)

    const isMulti = (q) => {
        return q?.correct_answer?.startsWith('[') && q?.correct_answer?.endsWith(']')
    }

    const getCorrectArray = (q) => {
        try {
            if (isMulti(q)) return JSON.parse(q.correct_answer)
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

    return (
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
                    {violationCount > 0 && (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem', fontWeight: 700, background: '#fef2f2', padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px solid #fee2e2' }}>
                            Violations: {violationCount}/3
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Question {currentIdx + 1} of {questions.length}</div>
                        <div style={{ width: 120, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${progress}%`, height: '100%', background: '#6366f1', transition: 'width 0.3s ease' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Webcam Feed */}
            {cameraEnabled && (
                <div style={{ position: 'fixed', bottom: '20px', right: '20px', width: '150px', height: '112px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #ef4444', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: !faceDetected ? 10000 : 50, background: '#000', transition: 'all 0.3s ease', transform: !faceDetected ? 'scale(1.5) translate(-20px, -20px)' : 'none' }}>
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

            {/* Question Card */}
            <div className="glass-card" style={{ padding: '2.5rem', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {currentQ?.question_text}
                </h2>

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
                                    color: isSelected ? '#4f46e5' : 'var(--text-primary)',
                                    fontWeight: isSelected ? 600 : 500
                                }}
                            >
                                <div style={{
                                    width: 24, height: 24,
                                    borderRadius: isMulti(currentQ) ? '6px' : '50%',
                                    border: `2px solid ${isSelected ? '#6366f1' : '#cbd5e1'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: isSelected ? '#6366f1' : 'transparent',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    flexShrink: 0
                                }}>
                                    {isSelected ? <CheckCircle2 size={14} /> : String.fromCharCode(65 + i)}
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
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="btn-primary"
                        style={{ gap: '0.5rem', padding: '0.75rem 2rem' }}
                    >
                        {submitting ? 'Submitting...' : <><Send size={18} /> Finish Assessment</>}
                    </button>
                ) : (
                    <button
                        onClick={() => setCurrentIdx(p => Math.min(questions.length - 1, p + 1))}
                        className="btn-primary"
                        style={{ gap: '0.5rem' }}
                    >
                        Next Question <ChevronRight size={18} />
                    </button>
                )}
            </div>

            {/* Face Not Detected Overlay */}
            {!faceDetected && isStarted && cameraEnabled && !submitted && (
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
