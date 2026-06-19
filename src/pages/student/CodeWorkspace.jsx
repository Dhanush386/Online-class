import { useEffect, useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
    ChevronLeft, Play, Send, Layout, Eye, Sidebar as SidebarIcon,
    AlertCircle, CheckCircle2, XCircle, Clock, Info, Code as CodeIcon, Database, Globe, Lock, Share2, Copy,
    FileText, HelpCircle, MessageSquare, RotateCcw, Maximize, Settings, Save, Trash2, ShieldAlert, Camera
} from 'lucide-react'
import * as tf from '@tensorflow/tfjs'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import CodeEditor from '../../components/CodeEditor'
import { useLiveKitProctoring } from '../../hooks/useLiveKitProctoring'
import CodingDiscussions from '../../components/CodingDiscussions'
import MobileBlocker from '../../components/MobileBlocker'
import { useDeviceType } from '../../hooks/useDeviceType'
import { useToast } from '../../components/Toast'

const LANGUAGE_CONFIG = {
    python: { id: 25, name: 'Python 3', icon: <CodeIcon size={16} />, useExtra: true },
    python_ml: { id: 25, name: 'Python (Scientific)', icon: <CodeIcon size={16} />, useExtra: true },
    java: { id: 91, name: 'Java', icon: <CodeIcon size={16} /> },
    cpp: { id: 105, name: 'C++', icon: <CodeIcon size={16} /> },
    c: { id: 103, name: 'C', icon: <CodeIcon size={16} /> },
    sql: { id: 82, name: 'SQL', icon: <Database size={16} /> },
    html: { id: 'web', name: 'Web', icon: <Globe size={16} /> }
}

const MAX_ATTEMPTS = 2
const BYPASS_PROCTORING = false // Set to false to enable AI proctoring violations in production

export default function CodeWorkspace() {
    const { challengeId } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const queryParams = new URLSearchParams(window.location.search)
    const isAdminMode = queryParams.get('admin') === 'true'
    const { profile, refreshStats, user } = useAuth()
    const isOrganizer = profile?.role === 'organizer'
    const canBypass = isAdminMode && isOrganizer
    const { isMobile, isTablet, isDesktop } = useDeviceType()
    
    const [challenge, setChallenge] = useState(null)
    const [code, setCode] = useState('')
    const [htmlCode, setHtmlCode] = useState('<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="main">\n    <h1>Hello World</h1>\n  </div>\n</body>\n</html>')
    const [cssCode, setCssCode] = useState('/* Write your CSS here */\n.main {\n  text-align: center;\n  font-family: sans-serif;\n}')
    const [jsCode, setJsCode] = useState('// JavaScript here')
    const [genericCode, setGenericCode] = useState('')
    const [webTab, setWebTab] = useState('html')
    const [leftTab, setLeftTab] = useState('description')

    // Combined Challenge State
    const [currentSubIndex, setCurrentSubIndex] = useState(0)
    const [subCodes, setSubCodes] = useState({})
    const [solvedSubIds, setSolvedSubIds] = useState([])
    
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [attemptCount, setAttemptCount] = useState(0)
    const [allChallenges, setAllChallenges] = useState([])
    const [currentIndex, setCurrentIndex] = useState(-1)
    
    const iframeRef = useRef(null)
    const isReadOnly = attemptCount >= MAX_ATTEMPTS && !canBypass
    const [timeStatus, setTimeStatus] = useState('open')
    const [isStarted, setIsStarted] = useState(false)
    const [violationCount, setViolationCount] = useState(0)
    const [requiresReentry, setRequiresReentry] = useState(false)
    const [securityAlert, setSecurityAlert] = useState(null)
    const [faceDetected, setFaceDetected] = useState(true)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [cameraEnabled, setCameraEnabled] = useState(false)
    const [mediaStream, setMediaStream] = useState(null)
    const [aiModel, setAiModel] = useState(null)
    const videoRef = useRef(null)
    const proctorInterval = useRef(null)

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

    const { connectionQuality } = useLiveKitProctoring(isStarted ? challengeId : null, isStarted ? profile?.id : null, false, null, mediaStream);

    const [timeLeft, setTimeLeft] = useState(30 * 60)
    const [hasRequestedHelp, setHasRequestedHelp] = useState(false)
    const [hasUnlockedAnswer, setHasUnlockedAnswer] = useState(false)
    const [showUnlockModal, setShowUnlockModal] = useState(false)

    const isCombined = challenge?.test_cases?.is_combined === true;
    const currentQuestion = isCombined ? challenge.test_cases.sub_questions[currentSubIndex] : challenge;
    const currentTestCases = isCombined ? currentQuestion.test_cases : (challenge?.test_cases || []);

    // ── Web Testcase Engine ──
    const webTestcases = challenge?.web_testcases || null
    const referenceIframeUrl = challenge?.reference_iframe_url || null

    const hasWebTcs = !!(webTestcases && (
        webTestcases.html?.length || webTestcases.css?.length || webTestcases.js?.length
    ))

    // Flat list for the left-panel testcase display
    const flatWebTcs = hasWebTcs ? [
        ...(webTestcases.html || []).map(t => ({ description: t.description || `Check: ${t.selector}`, _wtype: 'html', _spec: t })),
        ...(webTestcases.css  || []).map(t => ({ description: t.description || `${t.selector} → ${t.property}${t.value ? ': ' + t.value : ''}`, _wtype: 'css',  _spec: t })),
        ...(webTestcases.js   || []).map(t => ({ description: t.description || `Uses: ${t.keyword}`, _wtype: 'js',   _spec: t }))
    ] : null

    /**
     * Run all web testcases and return [{description, passed, type, expected, actual}]
     * HTML: DOMParser on htmlCode
     * CSS:  getComputedStyle via iframe (after updatePreview)
     * JS:   word-boundary regex on jsCode
     */
    const runWebTestcases = async () => {
        const results = []

        // ── HTML DOM checks (no iframe needed) ──
        for (const tc of (webTestcases?.html || [])) {
            try {
                const parser = new DOMParser()
                const doc = parser.parseFromString(htmlCode, 'text/html')
                const found = doc.querySelectorAll(tc.selector)
                const minCount = tc.minCount || 1
                const passed = found.length >= minCount
                results.push({
                    description: tc.description || `Check: ${tc.selector}`,
                    passed,
                    type: 'html',
                    expected: minCount > 1 ? `≥ ${minCount} × "${tc.selector}"` : `element "${tc.selector}" exists`,
                    actual: found.length === 0 ? 'not found' : `found ${found.length}`
                })
            } catch {
                results.push({ description: tc.description || tc.selector, passed: false, type: 'html', expected: tc.selector, actual: 'selector error' })
            }
        }

        // ── CSS computed style checks (needs rendered iframe) ──
        if (webTestcases?.css?.length) {
            updatePreview()
            await new Promise(r => setTimeout(r, 450)) // wait for render
            for (const tc of webTestcases.css) {
                try {
                    const iDoc = iframeRef.current?.contentDocument
                    const iWin = iframeRef.current?.contentWindow
                    if (!iDoc || !iWin) { results.push({ description: tc.description || tc.selector, passed: false, type: 'css', expected: `${tc.property}${tc.value ? ': ' + tc.value : ''}`, actual: 'iframe not ready' }); continue }
                    const el = iDoc.querySelector(tc.selector)
                    if (!el) { results.push({ description: tc.description || tc.selector, passed: false, type: 'css', expected: `"${tc.selector}" exists`, actual: 'element not found' }); continue }
                    const style = iWin.getComputedStyle(el)
                    // support camelCase and kebab-case property names
                    const camel = tc.property.replace(/-([a-z])/g, (_, l) => l.toUpperCase())
                    const actualVal = (style[camel] || style.getPropertyValue(tc.property) || '').trim()
                    const passed = tc.value
                        ? actualVal.toLowerCase().includes(tc.value.toLowerCase())
                        : (actualVal !== '' && actualVal !== 'none' && actualVal !== 'normal' && actualVal !== '0px')
                    results.push({
                        description: tc.description || `${tc.selector} → ${tc.property}`,
                        passed, type: 'css',
                        expected: tc.value ? `${tc.property}: ${tc.value}` : `${tc.property} to be set`,
                        actual: actualVal || 'not set'
                    })
                } catch (err) {
                    results.push({ description: tc.description || tc.selector, passed: false, type: 'css', expected: `${tc.property}${tc.value ? ': ' + tc.value : ''}`, actual: 'evaluation error' })
                }
            }
        }

        // ── JS code checks (word-boundary regex on jsCode) ──
        for (const tc of (webTestcases?.js || [])) {
            try {
                const pattern = new RegExp(`\\b${tc.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
                const passed = pattern.test(jsCode)
                results.push({
                    description: tc.description || `Uses: ${tc.keyword}`,
                    passed, type: 'js',
                    expected: `"${tc.keyword}" used in JS`,
                    actual: passed ? 'found ✓' : 'not found'
                })
            } catch {
                const passed = jsCode.includes(tc.keyword)
                results.push({ description: tc.description || tc.keyword, passed, type: 'js', expected: `"${tc.keyword}"`, actual: passed ? 'found' : 'not found' })
            }
        }

        return results
    }

    const handleSubCodeChange = (val) => {
        setGenericCode(val);
        setSubCodes(prev => ({ ...prev, [currentSubIndex]: val }));
    }

    const handleSwitchSubQuestion = (index) => {
        setCurrentSubIndex(index);
        setGenericCode(subCodes[index] || '');
        setResult(null);
    }

    useEffect(() => {
        if (!challengeId) return;
        const savedEndTime = localStorage.getItem(`challenge_endTime_${challengeId}`);
        if (savedEndTime) {
            const remaining = Math.floor((parseInt(savedEndTime) - Date.now()) / 1000);
            if (remaining > 0) {
                setTimeLeft(remaining);
                if (canBypass) setIsStarted(true);
            } else {
                setTimeLeft(0);
                if (canBypass) setIsStarted(true);
            }
        }
    }, [challengeId, canBypass]);

    // Check Device
    // Device check is now handled via useDeviceType and MobileBlocker


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
    }, [canBypass])

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
    }, [isStarted, cameraEnabled, aiModel, canBypass])

    const stopProctoring = async () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop())
            setMediaStream(null)
            setCameraEnabled(false)
        }
        if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
            if (document.exitFullscreen) document.exitFullscreen()
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen()
            else if (document.msExitFullscreen) document.msExitFullscreen()
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
            alert('Camera and microphone permissions are required to take this proctored challenge.')
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


    useEffect(() => {
        if (violationCount >= 3 && isStarted && !canBypass && !BYPASS_PROCTORING) {
            alert('Security Violation: 3 violations detected. You are being removed from the coding session.')
            navigate('/student/coding')
        }
    }, [violationCount, isStarted, canBypass, navigate])

    useEffect(() => {
        const handleFullScreenChange = () => {
            if (BYPASS_PROCTORING) return;
            if (isStarted && !document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement && !canBypass) {
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
            if (isStarted && document.hidden && !canBypass) {
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
            document.addEventListener('fullscreenchange', handleFullScreenChange)
            document.addEventListener('webkitfullscreenchange', handleFullScreenChange)
            document.addEventListener('mozfullscreenchange', handleFullScreenChange)
            document.addEventListener('MSFullscreenChange', handleFullScreenChange)
            document.addEventListener('visibilitychange', handleVisibilityChange)
        }
        return () => {
            document.removeEventListener('fullscreenchange', handleFullScreenChange)
            document.removeEventListener('webkitfullscreenchange', handleFullScreenChange)
            document.removeEventListener('mozfullscreenchange', handleFullScreenChange)
            document.removeEventListener('MSFullscreenChange', handleFullScreenChange)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
        }
    }, [isStarted, canBypass])

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
        if (!localStorage.getItem(`challenge_endTime_${challengeId}`)) {
            localStorage.setItem(`challenge_endTime_${challengeId}`, Date.now() + 30 * 60 * 1000);
        }

        try {
            await supabase.from('coding_sessions').insert({
                student_id: profile.id,
                student_name: profile.name || 'Student',
                challenge_id: challengeId
            });
        } catch (e) {
            console.error("Failed to log coding session", e);
        }

        if (!sessionId) {
            try {
                const { data: sessionData } = await supabase.from('proctoring_sessions').insert({
                    student_id: profile.id,
                    challenge_id: challengeId,
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

    const handleStartChallenge = async () => {
        setIsStarted(true);
        if (!localStorage.getItem(`challenge_endTime_${challengeId}`)) {
            localStorage.setItem(`challenge_endTime_${challengeId}`, Date.now() + 30 * 60 * 1000);
        }

        try {
            await supabase.from('coding_sessions').insert({
                student_id: profile.id,
                student_name: profile.name || 'Student',
                challenge_id: challengeId
            });
        } catch (e) {
            console.error("Failed to log coding session", e);
        }

        if (!sessionId) {
            try {
                const { data: sessionData } = await supabase.from('proctoring_sessions').insert({
                    student_id: profile.id,
                    challenge_id: challengeId,
                    status: 'active'
                }).select().single();
                
                if (sessionData) {
                    setSessionId(sessionData.id);
                }
            } catch (err) {
                console.error('Error starting proctoring session:', err);
            }
        }
    };

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
    }, [isStarted, canBypass, profile, challengeId, mediaStream, connectionQuality])

    useEffect(() => {
        if (!isStarted || canBypass || hasUnlockedAnswer) return
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    if (hasRequestedHelp && !hasUnlockedAnswer) {
                        setShowUnlockModal(true)
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [isStarted, canBypass, hasUnlockedAnswer, hasRequestedHelp])

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0')
        const s = (secs % 60).toString().padStart(2, '0')
        return `${m}:${s}`
    }

    useEffect(() => {
        fetchChallenge()
    }, [challengeId])

    const fetchChallenge = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase.from('coding_challenges').select('*').eq('id', challengeId).single()
            if (error) throw error
            setChallenge(data)
            
            const isCombinedData = data.test_cases?.is_combined === true;
            if (isCombinedData) {
                const initialSubCodes = {};
                data.test_cases.sub_questions.forEach((q, i) => {
                    initialSubCodes[i] = q.starter_code || '';
                });
                setSubCodes(initialSubCodes);
                setGenericCode(initialSubCodes[0] || '');
            } else if (data.language !== 'html' && data.starter_code) {
                setGenericCode(data.starter_code)
            } else if (data.language === 'html' && data.starter_code) {
                try {
                    const parsed = JSON.parse(data.starter_code)
                    if (parsed.html) setHtmlCode(parsed.html)
                    if (parsed.css) setCssCode(parsed.css)
                    if (parsed.js) setJsCode(parsed.js)
                } catch (e) {
                    setHtmlCode(data.starter_code)
                }
            }

            // Check attempts and solved status
            const { data: userData } = await supabase.from('coding_submissions').select('id, code, status').eq('challenge_id', challengeId).eq('student_id', profile.id)
            setAttemptCount(userData ? userData.length : 0)

            if (userData && userData.some(sub => sub.code === 'Unlocked answer without submission')) {
                setHasUnlockedAnswer(true)
            }

            if (userData && isCombinedData) {
                const solved = [];
                userData.forEach(sub => {
                    if (sub.status === 'accepted') {
                        try {
                            const parsed = JSON.parse(sub.code);
                            if (parsed.isCombined && parsed.subId) solved.push(parsed.subId);
                        } catch(e) {}
                    }
                });
                setSolvedSubIds(solved);
            }

            // Fetch all for context
            const { data: all } = await supabase.from('coding_challenges').select('id, title').order('created_at')
            setAllChallenges(all)
            setCurrentIndex(all.findIndex(c => c.id === challengeId))
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const updatePreview = () => {
        if (!iframeRef.current) return
        const combined = `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>${cssCode}</style>
                </head>
                <body>
                    ${htmlCode}
                    <script>${jsCode}<\/script>
                </body>
            </html>
        `
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow.document
        doc.open()
        doc.write(combined)
        doc.close()
    }

    useEffect(() => {
        if (challenge?.language === 'html') {
            const timer = setTimeout(updatePreview, 500)
            return () => clearTimeout(timer)
        }
    }, [htmlCode, cssCode, jsCode, challenge])

    const getVisualSimilarity = async (targetUrl) => {
        if (!iframeRef.current) return { total: 0, foreground: 0, diffImage: null }
        
        try {
            const iframe = iframeRef.current
            const studentCanvas = await html2canvas(iframe.contentDocument.body, { useCORS: true, scale: 1 })
            
            const targetImg = new Image()
            targetImg.crossOrigin = "anonymous"
            targetImg.src = targetUrl
            await new Promise((resolve, reject) => {
                targetImg.onload = resolve
                targetImg.onerror = reject
            })

            // VER-7.1 Normalized Resilient Comparison
            const width = 200
            const height = 150
            const canvas1 = document.createElement('canvas')
            const canvas2 = document.createElement('canvas')
            canvas1.width = width; canvas1.height = height
            canvas2.width = width; canvas2.height = height
            
            const ctx1 = canvas1.getContext('2d')
            const ctx2 = canvas2.getContext('2d')
            
            ctx1.drawImage(studentCanvas, 0, 0, width, height)
            ctx2.drawImage(targetImg, 0, 0, width, height)
            
            const data1 = ctx1.getImageData(0, 0, width, height).data
            const data2 = ctx2.getImageData(0, 0, width, height).data

            const diffCanvas = document.createElement('canvas')
            diffCanvas.width = width; diffCanvas.height = height
            const diffCtx = diffCanvas.getContext('2d')
            const diffData = diffCtx.createImageData(width, height)

            let matches = 0
            let foregroundMatches = 0
            let foregroundTotal = 0
            const totalPixels = width * height

            for (let i = 0; i < data1.length; i += 4) {
                const r1 = data1[i], g1 = data1[i+1], b1 = data1[i+2]
                const r2 = data2[i], g2 = data2[i+1], b2 = data2[i+2]
                
                // Color tolerance 25
                const isMatch = Math.abs(r1 - r2) < 25 && Math.abs(g1 - g2) < 25 && Math.abs(b1 - b2) < 25
                if (isMatch) matches++
                
                // Foreground Detection
                const isTargetForeground = r2 < 245 || g2 < 245 || b2 < 245
                if (isTargetForeground) {
                    foregroundTotal++
                    if (isMatch) foregroundMatches++
                }

                const pxIdx = i
                diffData.data[pxIdx] = isMatch ? 0 : 255
                diffData.data[pxIdx+1] = isMatch ? 200 : 0
                diffData.data[pxIdx+2] = 0
                diffData.data[pxIdx+3] = 255
            }

            diffCtx.putImageData(diffData, 0, 0)
            return {
                total: matches / totalPixels,
                foreground: foregroundTotal > 0 ? foregroundMatches / foregroundTotal : 0,
                diffImage: diffCanvas.toDataURL()
            }
        } catch (err) {
            console.error("Visual similarity error:", err)
            return { total: 0, foreground: 0, diffImage: null }
        }
    }

    const initPyodide = async () => {
        if (!window.pyodideInstance) {
            if (!document.querySelector('#pyodide-script')) {
                const script = document.createElement('script')
                script.id = 'pyodide-script'
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js'
                document.body.appendChild(script)
                await new Promise((resolve) => script.onload = resolve)
            }
            let outputBuffer = []
            window.pyodideInstance = await window.loadPyodide({
                stdout: (text) => outputBuffer.push(text),
                stderr: (text) => outputBuffer.push(text)
            })
            window.pyodideOutputBuffer = outputBuffer
        }
    }

    const runCode = async () => {
        setRunning(true)
        setResult({ status: 'running', message: 'Running code...' })
        // Basic local run for HTML, Pyodide for Python, mock for others
        if (challenge.language === 'html') {
            updatePreview()
            if (hasWebTcs) {
                // Run testcases (CSS checks need the preview rendered)
                const tcResults = await runWebTestcases()
                const passed = tcResults.filter(r => r.passed).length
                const allPassed = tcResults.every(r => r.passed)
                setResult({
                    status: allPassed ? 'success' : 'warning',
                    message: allPassed
                        ? `✅ All ${tcResults.length} testcases passed!`
                        : `🔍 ${passed}/${tcResults.length} passed — fix the failing tests before submitting.`,
                    testResults: tcResults
                })
            } else {
                setResult({ status: 'success', message: 'Rendered successfully ✓' })
            }
        } else if (challenge.language.startsWith('python')) {
            try {
                setResult({ status: 'running', message: 'Initializing Python Engine (this takes a few seconds on the first run)...' })
                await initPyodide()
                window.pyodideOutputBuffer.length = 0 // clear buffer
                
                const defaultInput = currentTestCases?.[0]?.input || ""
                window.pyodideInstance.globals.set("test_input", defaultInput)
                await window.pyodideInstance.runPythonAsync(`
import sys
from io import StringIO
sys.stdin = StringIO(test_input)
                `)
                await window.pyodideInstance.runPythonAsync(genericCode)
                
                const output = window.pyodideOutputBuffer.join('\n')
                setResult({ status: 'success', message: output || 'Code executed successfully (no output)' })
            } catch (err) {
                setResult({ status: 'error', message: err.toString() })
            }
        } else {
            // Mock execution for other languages
            setTimeout(() => setResult({ status: 'success', message: 'Output: Success\nCode executed successfully.' }), 1000)
        }
        setRunning(false)
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        setResult({ status: 'running', message: 'Running tests...' })
        try {
            // ── Web Testcase Engine (HTML only) ──
            if (challenge.language === 'html' && hasWebTcs) {
                setResult({ status: 'running', message: 'Running testcases...' })
                const tcResults = await runWebTestcases()
                const failedTcs = tcResults.filter(r => !r.passed)

                if (failedTcs.length > 0) {
                    setResult({
                        status: 'error',
                        message: `Submission blocked — ${failedTcs.length} testcase${failedTcs.length > 1 ? 's' : ''} failed.\nFix the highlighted tests and try again.`,
                        testResults: tcResults
                    })
                    setSubmitting(false)
                    return
                }
                // All web testcases passed — continue to XP award
                setResult({ status: 'success', message: `✅ All ${tcResults.length} testcases passed!`, testResults: tcResults })
                // Skip the visual comparison loop below for pure web-testcase challenges
                if (overallPassed !== undefined) {}
                // Award XP
                let alreadySolved = false
                const { data: previousSubs } = await supabase.from('coding_submissions')
                    .select('id').eq('challenge_id', challengeId).eq('student_id', profile.id).eq('status', 'accepted')
                alreadySolved = previousSubs && previousSubs.length > 0
                const finalScore = (hasUnlockedAnswer || alreadySolved) ? 0 : (currentQuestion.xp_reward || 15)
                await supabase.from('coding_submissions').insert({
                    student_id: profile.id, challenge_id: challengeId,
                    status: 'accepted', score: finalScore,
                    code: JSON.stringify({ html: htmlCode, css: cssCode, js: jsCode })
                })
                if (!alreadySolved && !hasUnlockedAnswer) {
                    const { data: userData } = await supabase.from('users').select('xp').eq('id', profile.id).single()
                    if (userData) {
                        await supabase.from('users').update({ xp: (userData.xp || 0) + finalScore }).eq('id', profile.id)
                        if (refreshStats) refreshStats()
                        toast.success(`Congratulations! You earned ${finalScore} XP!`)
                    }
                }
                stopProctoring()
                setSubmitting(false)
                return
            }
            if (challenge.language.startsWith('python')) {
                setResult({ status: 'running', message: 'Initializing Python Engine for tests...' })
                await initPyodide()
            }

            const testResults = []
            let overallPassed = true

            for (let i = 0; i < currentTestCases.length; i++) {
                const tc = currentTestCases[i]
                let passed = false
                let stdout = ''

                if (challenge.language === 'html' && tc.output_image_url) {
                    const result = await getVisualSimilarity(tc.output_image_url)
                    passed = result.total > 0.85 && result.foreground > 0.05
                    stdout = `[VER-7.1] Visual Match: ${(result.total * 100).toFixed(2)}%\nForeground: ${(result.foreground * 100).toFixed(2)}% (Target: 5%+)`
                    tc.actual_image = result.diffImage
                } else if (challenge.language.startsWith('python')) {
                    try {
                        window.pyodideOutputBuffer.length = 0
                        window.pyodideInstance.globals.set("test_input", tc.input || "")
                        await window.pyodideInstance.runPythonAsync(`
import sys
from io import StringIO
sys.stdin = StringIO(test_input)
                        `)
                        await window.pyodideInstance.runPythonAsync(genericCode)
                        stdout = window.pyodideOutputBuffer.join('\n').trim()
                        const expected = (tc.expected_output || "").trim()
                        passed = stdout === expected
                    } catch (err) {
                        stdout = err.toString()
                        passed = false
                    }
                } else {
                    passed = true // Mock
                }

                testResults.push({ id: i + 1, passed, actual: stdout, actual_image: tc.actual_image })
                if (!passed) overallPassed = false
            }

            setResult({ status: overallPassed ? 'success' : 'error', message: overallPassed ? 'Success: All tests passed!' : 'Error: Some tests failed', testResults })
            
            if (overallPassed && !canBypass) {
                // Check if already solved
                let alreadySolved = false;
                if (isCombined) {
                    alreadySolved = solvedSubIds.includes(currentQuestion.id);
                } else {
                    const { data: previousSubs } = await supabase.from('coding_submissions')
                        .select('id')
                        .eq('challenge_id', challengeId)
                        .eq('student_id', profile.id)
                        .eq('status', 'accepted');
                    alreadySolved = previousSubs && previousSubs.length > 0;
                }

                // Submit to DB
                const finalCodePayload = isCombined 
                    ? JSON.stringify({ isCombined: true, subId: currentQuestion.id, code: genericCode })
                    : (challenge.language === 'html' ? JSON.stringify({html: htmlCode, css: cssCode, js: jsCode}) : genericCode);

                const finalScore = (hasUnlockedAnswer || alreadySolved) ? 0 : (currentQuestion.xp_reward || 15);

                await supabase.from('coding_submissions').insert({
                    student_id: profile.id,
                    challenge_id: challengeId,
                    status: 'accepted',
                    score: finalScore,
                    code: finalCodePayload
                })

                if (isCombined && !alreadySolved && !hasUnlockedAnswer) {
                    setSolvedSubIds(prev => [...prev, currentQuestion.id]);
                }

                // Award XP if it's their first time passing and they haven't unlocked the answer
                if (!alreadySolved && !hasUnlockedAnswer) {
                    const earnedXp = currentQuestion.xp_reward || 15;
                    const { data: userData } = await supabase.from('users').select('xp').eq('id', profile.id).single();
                    if (userData) {
                        const newXp = (userData.xp || 0) + earnedXp;
                        await supabase.from('users').update({ xp: newXp }).eq('id', profile.id);
                        if (refreshStats) refreshStats();
                        toast.success(`Congratulations! You earned ${earnedXp} XP for solving this challenge.`);
                    }
                }

                let isFullyCompleted = true;
                if (isCombined && (solvedSubIds.length + (!alreadySolved && !hasUnlockedAnswer ? 1 : 0)) < challenge.test_cases.sub_questions.length) {
                    isFullyCompleted = false;
                }

                if (isFullyCompleted) {
                    stopProctoring();
                }
            }
        } catch (err) {
            console.error(err)
            setResult({ status: 'error', message: err.message })
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: 'var(--text-primary)' }}>Loading workspace...</div>
    if (!challenge) return <div>Challenge not found</div>

    if ((!isDesktop || isMobile || isTablet) && !canBypass) {
        return <MobileBlocker />
    }

    const handleUnlockAnswer = async () => {
        setHasUnlockedAnswer(true);
        setShowUnlockModal(false);
        setLeftTab('help');

        if (!canBypass) {
            try {
                await supabase.from('coding_submissions').insert({
                    student_id: profile.id,
                    challenge_id: challengeId,
                    status: 'accepted',
                    score: 0,
                    code: 'Unlocked answer without submission',
                });
            } catch (e) {
                console.error("Failed to mark answer as unlocked", e);
            }
        }
    }

    if (!isStarted && !canBypass) {
        return (
            <div style={{ height: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="glass-card" style={{ maxWidth: 600, padding: '3rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: 80, height: 80, background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#6366f1' }}>
                        <Lock size={40} />
                    </div>
                    <h1 style={{ color: 'var(--text-primary)', fontSize: '1.8rem', marginBottom: '1rem', fontWeight: 800 }}>Secure AI Proctored Coding</h1>
                    <p style={{ color: 'var(--card-border)', marginBottom: '1.5rem' }}>
                        This challenge will be taken in <strong>Fullscreen Mode</strong> with <strong>AI Webcam Monitoring</strong>.
                    </p>
                    <div style={{ padding: '1rem', background: '#fff7ed', borderRadius: 12, border: '1px solid #fed7aa', color: '#9a3412', fontSize: '0.875rem', marginBottom: '2rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <strong>Security Rules:</strong>
                        <li>Exiting fullscreen or switching tabs will result in a warning strike.</li>
                        <li>An AI model will monitor your webcam to detect cell phones.</li>
                        <li><strong>Live Monitoring May Be Used:</strong> Proctors may periodically review your video and screen.</li>
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
                            <button onClick={enterFullScreen} className="btn-primary" style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem', justifyContent: 'center' }}>
                                Enter Secure Mode & Start
                            </button>
                        </div>
                    )}
                    <Link to="/student/coding" style={{ display: 'block', marginTop: '1.5rem', color: 'var(--text-muted)' }}>Cancel and Go Back</Link>
                </div>
            </div>
        )
    }

    if (!isStarted && canBypass) {
        return (
            <div style={{ height: '100vh', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="glass-card" style={{ maxWidth: 600, padding: '3rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <h1 style={{ color: 'var(--text-primary)', fontSize: '2rem', marginBottom: '1.5rem' }}>{challenge.title}</h1>
                    <div style={{ background: '#ffffff', padding: '1.5rem', borderRadius: 12, textAlign: 'left', marginBottom: '2rem' }}>
                        <p style={{ color: 'var(--card-border)', marginBottom: '1rem' }}>You are testing in <strong>Organizer Admin Mode</strong>. AI Proctoring is bypassed.</p>
                    </div>
                    <button onClick={handleStartChallenge} className="btn-primary" style={{ width: '100%', height: '3.5rem' }}>Start Challenge</button>
                    <Link to="/organizer/coding" style={{ display: 'block', marginTop: '1.5rem', color: 'var(--text-muted)' }}>Go Back</Link>
                </div>
            </div>
        )
    }

    if ((requiresReentry || securityAlert) && !canBypass && !BYPASS_PROCTORING) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.98)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="glass-card animate-scale-in" style={{ maxWidth: 500, padding: '3rem', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div style={{ width: 80, height: 80, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#ef4444' }}>
                        <ShieldAlert size={40} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>{securityAlert ? 'Security Warning' : 'Security Block'}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', lineHeight: 1.6 }}>
                        {securityAlert || `You have exited Secure Mode. This is a security violation (${violationCount}/3). You must re-enter fullscreen to continue your challenge.`}
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

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: '#f1f5f9', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <header style={{ height: 48, background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                <Link to={canBypass ? "/organizer/coding" : "/student/coding"} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                    <ChevronLeft size={18} /> CODING PRACTICE - {currentIndex + 1}
                </Link>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {violationCount > 0 && !canBypass && (
                        <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, background: '#fef2f2', padding: '4px 10px', borderRadius: 4, border: '1px solid #fee2e2' }}>
                            Violations: {violationCount}/3
                        </div>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{challenge.title}</span>
                    {isStarted && !canBypass && (
                        <div style={{ padding: '4px 10px', background: '#e2e8f0', borderRadius: 4, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 600, color: timeLeft <= 300 ? '#ef4444' : 'var(--text-primary)' }}>
                            <Clock size={14} /> {formatTime(timeLeft)}
                        </div>
                    )}
                    <div style={{ padding: '2px 8px', background: '#10b981', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>VER 7.1</div>
                </div>
            </header>

            {cameraEnabled && !canBypass && (
                <div style={{ position: 'fixed', top: '20px', right: '20px', width: '150px', height: '112px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #ef4444', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: !faceDetected ? 10000 : 1000, background: '#000', transition: 'all 0.3s ease', transform: !faceDetected ? 'scale(1.5) translate(-20px, 20px)' : 'none' }}>
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

            <div style={{ flex: 1, display: 'flex', gap: '8px', padding: '8px', overflow: 'hidden' }}>
                
                {/* Column 1: Description */}
                <div style={{ width: '28%', minWidth: 320, background: '#ffffff', borderRadius: 8, display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0' }}>
                    <div style={{ height: 40, borderBottom: '1px solid #e2e8f0', display: 'flex', padding: '0 4px' }}>
                        <button onClick={() => setLeftTab('description')} style={{ flex: 1, background: 'none', border: 'none', color: leftTab === 'description' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderBottom: leftTab === 'description' ? '2px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <FileText size={14} /> Description
                        </button>
                        <button onClick={() => setLeftTab('help')} style={{ flex: 1, background: 'none', border: 'none', color: leftTab === 'help' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderBottom: leftTab === 'help' ? '2px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <HelpCircle size={14} /> Get Help
                        </button>
                        <button onClick={() => setLeftTab('discuss')} style={{ flex: 1, background: 'none', border: 'none', color: leftTab === 'discuss' ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderBottom: leftTab === 'discuss' ? '2px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <MessageSquare size={14} /> Discuss
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                        {leftTab === 'description' ? (
                            <div className="animate-fade-in">
                                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>{isCombined ? `${challenge.title} - ${currentQuestion.title}` : challenge.title}</h1>
                                {isCombined && (
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', background: '#f8fafc', padding: '0.5rem', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                        {challenge.test_cases.sub_questions.map((q, idx) => {
                                            const isSolved = solvedSubIds.includes(q.id);
                                            return (
                                                <button 
                                                    key={q.id} 
                                                    onClick={() => handleSwitchSubQuestion(idx)}
                                                    style={{ padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, border: '1px solid', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                                        background: currentSubIndex === idx ? '#3b82f6' : (isSolved ? '#10b981' : '#ffffff'),
                                                        color: currentSubIndex === idx || isSolved ? '#ffffff' : 'var(--text-muted)',
                                                        borderColor: currentSubIndex === idx ? '#2563eb' : (isSolved ? '#059669' : '#cbd5e1')
                                                    }}
                                                >
                                                    {isSolved && <CheckCircle2 size={12} />}
                                                    Part {idx + 1} ({q.xp_reward || 15} XP)
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.9rem', color: 'var(--card-border)', lineHeight: 1.6, marginBottom: '2rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{currentQuestion.problem_statement}</div>

                                {currentQuestion.input_format && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Input Format</h4>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--card-border)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{currentQuestion.input_format}</div>
                                    </div>
                                )}

                                {currentQuestion.output_format && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Output Format</h4>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--card-border)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{currentQuestion.output_format}</div>
                                    </div>
                                )}

                                {currentQuestion.constraints && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Constraints</h4>
                                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.9rem', color: 'var(--card-border)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                            {currentQuestion.constraints}
                                        </div>
                                    </div>
                                )}

                                {challenge.target_visual_url && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: '#3b82f6' }}>Refer to the below image.</p>
                                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f1f5f9' }}>
                                            <img src={challenge.target_visual_url} alt="Goal" style={{ width: '100%', display: 'block' }} />
                                        </div>
                                    </div>
                                )}

                                {/* ── Reference iFrame (HTML challenges only) ── */}
                                {referenceIframeUrl && referenceIframeUrl.startsWith('https://') && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                                            <div style={{ width: 20, height: 20, background: '#3b82f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ color: 'white', fontSize: '0.55rem', fontWeight: 800 }}>{'<>'}</span>
                                            </div>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>Reference Demo</span>
                                            <a
                                                href={referenceIframeUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}
                                            >
                                                Open ↗
                                            </a>
                                        </div>
                                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '2px solid #bfdbfe', background: '#f1f5f9', height: 220 }}>
                                            <iframe
                                                src={referenceIframeUrl}
                                                title="Reference Demo"
                                                sandbox="allow-scripts allow-same-origin allow-forms"
                                                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                                                loading="lazy"
                                            />
                                        </div>
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>This is the reference page your output should resemble.</p>
                                    </div>
                                )}

                                {/* ── Live Keyword Checklist (HTML challenges only) ── */}
                                {(() => {
                                    const kwStatus = getKeywordStatus()
                                    if (!kwStatus) return null
                                    const LANG_STYLES = {
                                        html: { label: 'HTML', color: '#e34c26', bg: '#fff5f2', border: '#fca89a' },
                                        css:  { label: 'CSS',  color: '#264de4', bg: '#eff4ff', border: '#bfdbfe' },
                                        js:   { label: 'JS',   color: '#c9a800', bg: '#fffbeb', border: '#fde68a' }
                                    }
                                    const allPassed = Object.values(kwStatus).flat().every(k => k.pass)
                                    return (
                                        <div style={{ marginBottom: '2rem', border: `1px solid ${allPassed ? '#bbf7d0' : '#e9d5ff'}`, borderRadius: 10, overflow: 'hidden' }}>
                                            <div style={{ padding: '0.6rem 0.9rem', background: allPassed ? '#f0fdf4' : 'linear-gradient(135deg, #fdf4ff, #fefce8)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.8rem' }}>{allPassed ? '✅' : '🔑'}</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: allPassed ? '#15803d' : '#6d28d9' }}>Requirements Checklist</span>
                                                {allPassed && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#16a34a', fontWeight: 600 }}>All met ✓</span>}
                                            </div>
                                            <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'white' }}>
                                                {Object.entries(kwStatus).map(([lang, items]) => {
                                                    const st = LANG_STYLES[lang] || LANG_STYLES.html
                                                    return (
                                                        <div key={lang}>
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: st.color, textTransform: 'uppercase', marginBottom: '0.3rem', letterSpacing: '0.05em' }}>{st.label}</div>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                                {items.map(({ kw, pass }) => (
                                                                    <span
                                                                        key={kw}
                                                                        style={{
                                                                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                                                            fontSize: '0.7rem', fontWeight: 600,
                                                                            padding: '0.2rem 0.5rem', borderRadius: 5,
                                                                            background: pass ? '#dcfce7' : st.bg,
                                                                            color: pass ? '#15803d' : st.color,
                                                                            border: `1px solid ${pass ? '#bbf7d0' : st.border}`,
                                                                            transition: 'all 0.2s ease'
                                                                        }}
                                                                    >
                                                                        {pass ? '✓' : '×'} {kw}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })()}

                                {/* Testcases Section */}
                                {(() => {
                                    return (
                                        <div style={{ marginTop: '2.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                                            {/* Collapsible Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', cursor: 'default' }}>
                                                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Testcases</h4>
                                                <ChevronLeft size={16} style={{ transform: 'rotate(-90deg)', color: 'var(--text-muted)' }} />
                                            </div>

                                            {/* Summary Badges */}
                                            {(()=>{
                                                const effectiveTcs = flatWebTcs || currentTestCases
                                                const cases = result?.testResults || effectiveTcs
                                                const total = cases?.length || 0
                                                const hasResults = !!(result?.testResults?.length)
                                                const passedCount = hasResults ? cases.filter(t => t.passed).length : 0
                                                const failedCount = hasResults ? total - passedCount : 0
                                                return (
                                                    <>
                                                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                                            <CodeIcon size={14} color="var(--text-muted)" />
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total</span>
                                                            <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{total}</span>
                                                        </div>
                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #05966930', background: '#05966910' }}>
                                                            <CheckCircle2 size={14} color="#10b981" />
                                                            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Passed</span>
                                                            <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>{hasResults ? passedCount : '-'}</span>
                                                        </div>
                                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #ef444430', background: '#ef444410' }}>
                                                            <XCircle size={14} color="#ef4444" />
                                                            <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>Failed</span>
                                                            <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>{hasResults ? failedCount : '-'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Individual Test Case Cards */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {cases?.map((tc, idx) => {
                                                            const tcData = effectiveTcs?.[idx] || tc
                                                            const passed = hasResults ? tc.passed : null
                                                            const isWebTc = !!(tc.type || tcData._wtype)
                                                            const wtype = tc.type || tcData._wtype
                                                            const typeColor = wtype === 'html' ? '#ef4444' : wtype === 'css' ? '#3b82f6' : '#f59e0b'
                                                            const typeLabel = wtype ? wtype.toUpperCase() : null

                                                            let displayContent;
                                                            if (tcData.is_hidden) {
                                                                displayContent = (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: passed === true ? '#059669' : passed === false ? '#dc2626' : 'var(--text-muted)' }}>
                                                                        <Lock size={14} />
                                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Hidden Test Case</span>
                                                                    </div>
                                                                );
                                                            } else if (tcData.description || isWebTc) {
                                                                displayContent = (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                                        {typeLabel && (
                                                                            <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '0.1rem 0.4rem', background: typeColor, color: typeColor === '#f59e0b' ? '#000' : '#fff', borderRadius: 4, flexShrink: 0 }}>{typeLabel}</span>
                                                                        )}
                                                                        <span style={{ fontSize: '0.85rem', color: passed === true ? '#059669' : passed === false ? '#dc2626' : 'var(--text-muted)', lineHeight: 1.5, fontWeight: 500 }}>{tcData.description || tc.description}</span>
                                                                    </div>
                                                                );
                                                            } else if (tcData.input || tcData.expected_output) {
                                                                displayContent = (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%', padding: '0.5rem 0' }}>
                                                                        {tcData.input && (
                                                                            <div>
                                                                                <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 400, color: 'var(--text-primary)' }}>Sample Input {idx + 1}</h5>
                                                                                <div style={{ background: '#f4f6fc', padding: '1rem', borderRadius: 6, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{tcData.input}</div>
                                                                            </div>
                                                                        )}
                                                                        {tcData.expected_output && (
                                                                            <div>
                                                                                <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 400, color: 'var(--text-primary)' }}>Sample Output {idx + 1}</h5>
                                                                                <div style={{ background: '#f4f6fc', padding: '1rem', borderRadius: 6, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{tcData.expected_output}</div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            } else {
                                                                displayContent = <span style={{ fontSize: '0.85rem', color: passed === true ? '#059669' : passed === false ? '#dc2626' : 'var(--text-muted)', lineHeight: 1.5, fontWeight: 500 }}>Test Case {idx + 1}</span>;
                                                            }

                                                            return (
                                                                <div key={idx} style={{ padding: '1rem 1.25rem', borderRadius: 8, background: '#f8fafc', borderLeft: `3px solid ${passed === true ? '#10b981' : passed === false ? '#ef4444' : '#cbd5e1'}`, transition: 'all 0.2s ease' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                                                        {passed === true ? <CheckCircle2 size={18} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} /> : passed === false ? <XCircle size={18} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} /> : <Info size={18} color="var(--text-secondary)" style={{ marginTop: 2, flexShrink: 0 }} />}
                                                                        <div style={{ flex: 1 }}>{displayContent}</div>
                                                                    </div>
                                                                    {/* Web testcase: Expected vs Found detail */}
                                                                    {hasResults && isWebTc && (
                                                                        <div style={{ marginLeft: '2.2rem', marginTop: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', width: 56 }}>Expected</span>
                                                                                <code style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: '#ecfdf5', color: '#059669', borderRadius: 4, border: '1px solid #d1fae5' }}>{tc.expected}</code>
                                                                            </div>
                                                                            {!tc.passed && (
                                                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', width: 56 }}>Found</span>
                                                                                    <code style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', background: '#fef2f2', color: '#dc2626', borderRadius: 4, border: '1px solid #fecaca' }}>{tc.actual}</code>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                    {/* Classic testcase: stdout output */}
                                                                    {hasResults && !isWebTc && tc.actual && (
                                                                        <div style={{ marginLeft: '2.2rem', marginTop: '0.75rem' }}>
                                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Your Output:</span>
                                                                            <pre style={{ background: '#f1f5f9', padding: '0.5rem 0.75rem', borderRadius: 6, marginTop: '0.25rem', fontSize: '0.7rem', color: passed ? '#059669' : '#dc2626', overflowX: 'auto', border: '1px solid #1f2937' }}>{tc.actual}</pre>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    )
                                })()}
                            </div>
                        ) : leftTab === 'discuss' ? (
                            <CodingDiscussions challengeId={challengeId} currentCode={challenge?.language === 'html' ? {html: htmlCode, css: cssCode, js: jsCode} : genericCode} />
                        ) : leftTab === 'help' ? (
                            <div style={{ color: 'var(--card-border)', fontSize: '0.9rem', lineHeight: 1.6 }}>
                                {!hasRequestedHelp ? (
                                    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                                        <HelpCircle size={40} style={{ margin: '0 auto 1rem', opacity: 0.5, color: 'var(--text-muted)' }} />
                                        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>Stuck on this problem? You can request help to see hints.</p>
                                        <button onClick={() => setHasRequestedHelp(true)} className="btn-primary" style={{ padding: '0.5rem 1rem' }}>Get Help</button>
                                    </div>
                                ) : (
                                    <div className="animate-fade-in">
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Help & Hints</h3>
                                        <p style={{ marginBottom: '1rem' }}>Review the problem constraints and testcases carefully. Often, missing edge cases is the reason for failure.</p>
                                        
                                        {hasUnlockedAnswer ? (
                                            <div style={{ marginTop: '2rem', padding: '1rem', background: '#d1fae5', border: '1px solid #10b981', borderRadius: 8 }}>
                                                <h4 style={{ color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={16} /> Solution Unlocked</h4>
                                                <pre style={{ background: '#ecfdf5', padding: '1rem', borderRadius: 6, color: '#064e3b', overflowX: 'auto', fontSize: '0.8rem' }}>
                                                    {(isCombined ? currentQuestion.solution_code : challenge.solution_code) || "No solution provided by organizer."}
                                                </pre>
                                                <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#6ee7b7' }}>You will not receive XP for this challenge.</p>
                                            </div>
                                        ) : (
                                            <div style={{ marginTop: '2rem', padding: '1rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>If you are still stuck when the timer expires, you will have the option to unlock the correct answer. Note that unlocking the answer forfeits XP for this challenge.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Column 2: Editor */}
                <div style={{ flex: 1.5, background: 'var(--text-primary)', borderRadius: 8, display: 'flex', flexDirection: 'column', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                    <div style={{ height: 40, borderBottom: '1px solid var(--card-border)', display: 'flex', background: 'var(--text-primary)', padding: '0 4px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', height: '100%' }}>
                            {challenge.language === 'html' ? (
                                <>
                                    <button onClick={() => setWebTab('html')} style={{ padding: '0 1rem', background: webTab === 'html' ? 'var(--text-primary)' : 'transparent', border: 'none', color: webTab === 'html' ? '#e34c26' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 14, height: 14, background: '#e34c26', color: '#fff', borderRadius: 2, fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>H</div> HTML
                                    </button>
                                    <button onClick={() => setWebTab('css')} style={{ padding: '0 1rem', background: webTab === 'css' ? 'var(--text-primary)' : 'transparent', border: 'none', color: webTab === 'css' ? '#264de4' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 14, height: 14, background: '#264de4', color: '#fff', borderRadius: 2, fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>C</div> CSS
                                    </button>
                                    <button onClick={() => setWebTab('js')} style={{ padding: '0 1rem', background: webTab === 'js' ? 'var(--text-primary)' : 'transparent', border: 'none', color: webTab === 'js' ? '#f0db4f' : 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <div style={{ width: 14, height: 14, background: '#f0db4f', color: '#000', borderRadius: 2, fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>JS</div> JS
                                    </button>
                                </>
                            ) : (
                                <button style={{ padding: '0 1rem', background: 'var(--text-primary)', border: 'none', color: '#e2e8f0', fontSize: '0.7rem', fontWeight: 800, cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {LANGUAGE_CONFIG[challenge.language]?.icon || <CodeIcon size={14} />} {LANGUAGE_CONFIG[challenge.language]?.name || challenge.language}
                                </button>
                            )}
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', paddingRight: '0.5rem' }}>
                            <button title="Reset" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><RotateCcw size={14} /></button>
                            <button title="Save" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Save size={14} /></button>
                            <button title="Expand" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Maximize size={14} /></button>
                        </div>
                    </div>

                    <div style={{ flex: 1, background: 'var(--text-primary)' }}>
                        {challenge.language === 'html' ? (
                            <>
                                {webTab === 'html' && <CodeEditor value={htmlCode} onChange={e => setHtmlCode(e.target.value)} language="html" readOnly={isReadOnly} />}
                                {webTab === 'css' && <CodeEditor value={cssCode} onChange={e => setCssCode(e.target.value)} language="css" readOnly={isReadOnly} />}
                                {webTab === 'js' && <CodeEditor value={jsCode} onChange={e => setJsCode(e.target.value)} language="js" readOnly={isReadOnly} />}
                            </>
                        ) : (
                            <CodeEditor value={genericCode} onChange={e => isCombined ? handleSubCodeChange(e.target.value) : setGenericCode(e.target.value)} language={challenge.language} readOnly={isReadOnly} />
                        )}
                    </div>

                    <div style={{ height: 48, background: 'var(--text-primary)', borderTop: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '0.75rem' }}>
                        <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Settings size={18} /></button>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                            <button onClick={runCode} disabled={running} style={{ padding: '0.4rem 1.25rem', borderRadius: 6, background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Play size={14} fill="currentColor" /> Run
                            </button>
                            <button onClick={handleSubmit} disabled={submitting || running} style={{ padding: '0.4rem 1.5rem', borderRadius: 6, background: '#3b82f6', border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                                {submitting ? 'Verifying...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Column 3: Preview/Output */}
                <div style={{ width: '32%', background: 'var(--text-primary)', borderRadius: 8, display: 'flex', flexDirection: 'column', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                    <div style={{ height: 40, borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', padding: '0 1rem', background: 'var(--text-primary)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>{challenge.language === 'html' ? 'PREVIEW' : 'OUTPUT'}</span>
                        <div style={{ marginLeft: 'auto' }}>
                            <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><Maximize size={14} /></button>
                        </div>
                    </div>
                    
                    {challenge.language === 'html' ? (
                        <>
                            <div style={{ flex: 1, background: '#fff', margin: '1rem 1rem 0 1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--card-border)', minHeight: 0 }}>
                                <iframe ref={iframeRef} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" />
                            </div>
                            {/* Keyword hint / result message strip */}
                            {result && result.message && (
                                <div style={{ margin: '0 1rem', padding: '0.6rem 0.75rem', background: result.status === 'error' ? '#450a0a' : result.status === 'warning' ? '#451a03' : '#052e16', borderRadius: 6, maxHeight: 90, overflowY: 'auto' }}>
                                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem', color: result.status === 'error' ? '#fca5a5' : result.status === 'warning' ? '#fcd34d' : '#86efac', margin: 0, lineHeight: 1.5 }}>{result.message}</pre>
                                </div>
                            )}
                            <div style={{ padding: '0.75rem 1.25rem 1.25rem', background: 'var(--text-primary)', borderTop: '1px solid var(--card-border)', textAlign: 'center' }}>
                                <button onClick={handleSubmit} disabled={submitting || running} style={{ width: '100%', padding: '0.75rem', borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <Layout size={16} /> {submitting ? 'Comparing...' : 'Compare & Submit'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div style={{ flex: 1, padding: '1rem', background: 'var(--text-primary)', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#e2e8f0' }}>
                            {result ? (
                                <div style={{ color: result.status === 'success' ? '#10b981' : result.status === 'warning' ? '#fcd34d' : (result.status === 'error' ? '#ef4444' : 'var(--text-muted)') }}>
                                    <pre style={{ whiteSpace: 'pre-wrap' }}>{result.message}</pre>
                                </div>
                            ) : (
                                <div style={{ color: 'var(--text-muted)' }}>Code output will appear here...</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Visual Result Map Overlay */}
            {result && result.testResults?.some(t => t.actual_image) && (
                <div style={{ position: 'fixed', bottom: 20, right: 20, width: 280, background: '#ffffff', borderRadius: 12, border: '1px solid #3b82f6', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', padding: '1rem', zIndex: 1000 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#3b82f6' }}>VISUAL COMPARISON (RED = MISMATCH)</span>
                        <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><XCircle size={14} /></button>
                    </div>
                    <img src={result.testResults.find(t => t.actual_image).actual_image} style={{ width: '100%', borderRadius: 6, border: '1px solid #e2e8f0' }} />
                </div>
            )}

            {/* Unlock Modal */}
            {showUnlockModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#ffffff', padding: '2rem', borderRadius: 12, border: '1px solid #e2e8f0', maxWidth: 450, textAlign: 'center' }}>
                        <AlertCircle size={48} color="#f59e0b" style={{ margin: '0 auto 1rem' }} />
                        <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>Time's Up!</h2>
                        <p style={{ color: 'var(--card-border)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.5 }}>
                            The 30-minute timer has expired. Since you requested help, you can now unlock the correct answer. 
                            <br/><br/>
                            <strong style={{ color: '#f87171' }}>Warning:</strong> Unlocking the answer means you will not earn any XP for this challenge.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button onClick={() => setShowUnlockModal(false)} style={{ padding: '0.5rem 1.5rem', background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--card-border)', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                            <button onClick={handleUnlockAnswer} style={{ padding: '0.5rem 1.5rem', background: '#f59e0b', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Unlock Answer</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Face Not Detected Overlay */}
            {!faceDetected && isStarted && cameraEnabled && !canBypass && !BYPASS_PROCTORING && (
                <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(15px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', flexDirection: 'column' }}>
                    <div style={{ width: 100, height: 100, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', color: '#ef4444', animation: 'pulse 2s infinite' }}>
                        <Camera size={50} />
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Face Not Detected</h1>
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.2rem', maxWidth: 600, textAlign: 'center', lineHeight: 1.6 }}>
                        AI Proctoring has lost track of your face. Please ensure you are looking directly at the camera and your face is well-lit to continue.
                    </p>
                </div>
            )}
        </div>
    )
}
