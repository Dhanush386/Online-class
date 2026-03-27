import { useEffect, useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
    ChevronLeft, Play, Send, Layout, Eye, Sidebar as SidebarIcon,
    AlertCircle, CheckCircle2, XCircle, Clock, Info, Code as CodeIcon, Database, Globe, Lock, Share2, Copy
} from 'lucide-react'
import CodeEditor from '../../components/CodeEditor'

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

// Student Code Workspace Page
export default function CodeWorkspace() {
    const { challengeId } = useParams()
    const navigate = useNavigate()
    const queryParams = new URLSearchParams(window.location.search)
    const isAdminMode = queryParams.get('admin') === 'true'
    const { profile } = useAuth()
    const isOrganizer = profile?.role === 'organizer'
    const canBypass = isAdminMode && isOrganizer
    const [challenge, setChallenge] = useState(null)
    const [code, setCode] = useState('')
    const [htmlCode, setHtmlCode] = useState('<!DOCTYPE html>\n<html>\n<head>\n  <title>My Web Page</title>\n  <!-- Link your style.css here -->\n\n</head>\n<body>\n  <h1>Hello World</h1>\n\n  <!-- Link your script.js here -->\n\n</body>\n</html>')
    const [cssCode, setCssCode] = useState('/* Write your CSS here */\nbody {\n  font-family: sans-serif;\n}')
    const [jsCode, setJsCode] = useState('// Write your JavaScript here\nconsole.log("Script loaded!");')
    const [webTab, setWebTab] = useState('html') // HTML, CSS, JS
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [activeTab, setActiveTab] = useState('problem') // 'problem', 'output', 'preview'
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024)
    const [attemptCount, setAttemptCount] = useState(0)
    const [pastSubmissions, setPastSubmissions] = useState([])
    const [allChallenges, setAllChallenges] = useState([])
    const [currentIndex, setCurrentIndex] = useState(-1)

    const iframeRef = useRef(null)
    const isReadOnly = attemptCount >= MAX_ATTEMPTS
    const [timeStatus, setTimeStatus] = useState('open') // 'upcoming' | 'open' | 'closed'
    const [isStarted, setIsStarted] = useState(false)
    const [violationCount, setViolationCount] = useState(0)
    const [isAutoSubmitted, setIsAutoSubmitted] = useState(false)

    // Publish States
    const [showPublishModal, setShowPublishModal] = useState(false)
    const [publishTitle, setPublishTitle] = useState('')
    const [publishDesc, setPublishDesc] = useState('')
    const [publishing, setPublishing] = useState(false)
    const [publishedUrl, setPublishedUrl] = useState(null)

    useEffect(() => {
        if (violationCount >= 3 && isStarted && !isAutoSubmitted && attemptCount < MAX_ATTEMPTS) {
            handleAutoSubmit()
        }
    }, [violationCount, isStarted])

    async function getVisualSimilarity(targetUrl) {
        const previewFrame = iframeRef.current
        if (!previewFrame) return 0

        try {
            // 1. Capture student preview
            const studentCanvas = await html2canvas(previewFrame.contentDocument.body, {
                useCORS: true,
                allowTaint: true,
                scale: 0.5,
                logging: true, // Enable logging for debugging
                backgroundColor: '#ffffff'
            })

            // 2. Load target image
            const targetImg = new Image()
            targetImg.crossOrigin = "anonymous"
            targetImg.src = targetUrl
            
            await new Promise((resolve, reject) => {
                targetImg.onload = resolve
                targetImg.onerror = reject
            })

            // 3. Compare on a fixed-size canvas
            const width = studentCanvas.width
            const height = studentCanvas.height
            const canvas1 = document.createElement('canvas')
            const canvas2 = document.createElement('canvas')
            canvas1.width = width; canvas1.height = height
            canvas2.width = width; canvas2.height = height
            
            const ctx1 = canvas1.getContext('2d')
            const ctx2 = canvas2.getContext('2d')
            
            // Draw both into the SAME pixel dimensions to ensure alignment
            ctx1.drawImage(studentCanvas, 0, 0)
            ctx2.drawImage(targetImg, 0, 0, width, height)
            
            const data1 = ctx1.getImageData(0, 0, width, height).data
            const data2 = ctx2.getImageData(0, 0, width, height).data

            const diffCanvas = document.createElement('canvas')
            diffCanvas.width = width
            diffCanvas.height = height
            const diffCtx = diffCanvas.getContext('2d')
            const diffData = diffCtx.createImageData(width, height)
            
            let diff = 0
            let foregroundDiff = 0
            let foregroundTotal = 0
            let totalChecked = 0
            
            // Compare EVERY pixel (RGBA) for maximum accuracy
            for (let i = 0; i < data1.length; i += 4) {
                totalChecked++
                
                const r1 = data1[i], g1 = data1[i+1], b1 = data1[i+2]
                const r2 = data2[i], g2 = data2[i+1], b2 = data2[i+2]
                
                const dr = Math.abs(r1 - r2), dg = Math.abs(g1 - g2), db = Math.abs(b1 - b2)
                const isMatch = (dr + dg + db <= 40) // Slightly more lenient color threshold
                
                if (!isMatch) diff++
                
                // Difference Map Generation
                if (isMatch) {
                    diffData.data[i] = 200; diffData.data[i+1] = 255; diffData.data[i+2] = 200; diffData.data[i+3] = 255 // Greenish for match
                } else {
                    diffData.data[i] = 255; diffData.data[i+1] = 100; diffData.data[i+2] = 100; diffData.data[i+3] = 255 // Reddish for diff
                }

                // Foreground Sensitivity: Check if TARGET is NOT white/transparent
                const isTargetWhite = (r2 > 240 && g2 > 240 && b2 > 240)
                const isTargetTransparent = (data2[i+3] < 10)
                
                if (!isTargetWhite && !isTargetTransparent) {
                    foregroundTotal++
                    if (!isMatch) foregroundDiff++
                }
            }
            
            diffCtx.putImageData(diffData, 0, 0)
            
            const totalSimilarity = 1 - (diff / totalChecked)
            const foregroundSimilarity = foregroundTotal > 0 ? (1 - (foregroundDiff / foregroundTotal)) : 1.0
            
            return {
                total: totalSimilarity,
                foreground: foregroundSimilarity,
                diffImage: diffCanvas.toDataURL('image/png')
            }
        } catch (err) {
            console.error("Visual comparison error:", err)
            return 0
        }
    }

    async function handleAutoSubmit() {
        setIsAutoSubmitted(true)
        alert('Security Violation: 3 violations detected. Your work is being automatically submitted.')
        await handleSubmit()
    }

    useEffect(() => {
        const handleSecurity = (e) => {
            if (isStarted && !canBypass) {
                e.preventDefault()
            }
        }

        const handleFullScreenChange = () => {
            if (isStarted && !canBypass && !document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
                setViolationCount(prev => {
                    const next = prev + 1
                    if (next < 3) {
                        alert(`Security Warning (${next}/3): Fullscreen mode is required. Please reentry fullscreen.`)
                        enterFullScreen()
                    }
                    return next
                })
            }
        }

        const handleVisibilityChange = () => {
            if (isStarted && !canBypass && document.hidden) {
                setViolationCount(prev => {
                    const next = prev + 1
                    if (next < 3) {
                        alert(`Security Warning (${next}/3): Focus lost. Please stay on the challenge window.`)
                    }
                    return next
                })
            }
        }

        if (isStarted) {
            document.addEventListener('contextmenu', handleSecurity)
            document.addEventListener('copy', handleSecurity)
            // Only block paste for non-web challenges
            if (challenge?.language !== 'html') {
                document.addEventListener('paste', handleSecurity)
            }
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
    }, [isStarted])

    const enterFullScreen = () => {
        if (canBypass) {
            setIsStarted(true)
            return
        }
        const elem = document.documentElement
        if (elem.requestFullscreen) {
            elem.requestFullscreen()
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen()
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen()
        }
        setIsStarted(true)
    }

    useEffect(() => {
        if (challengeId) {
            loadChallenge()
        }
    }, [challengeId])

    async function loadChallenge() {
        setLoading(true)
        const [
            { data, error },
            { data: subs },
            { data: memberships },
            { data: locks },
            { data: locksDay },
            { data: allChallengesData }
        ] = await Promise.all([
            supabase.from('coding_challenges').select('*, courses(title)').eq('id', challengeId).single(),
            supabase.from('coding_submissions').select('*').eq('challenge_id', challengeId).eq('student_id', profile.id).order('created_at', { ascending: false }),
            supabase.from('group_members').select('group_id').eq('student_id', profile.id),
            supabase.from('resource_access').select('*').eq('resource_id', challengeId).eq('resource_type', 'coding').eq('is_locked', true),
            supabase.from('day_access').select('*'),
            supabase.from('coding_challenges').select('id, title, course_id, day_number').order('created_at', { ascending: true })
        ])

        if (data) {
            // Filter all challenges to get sequence for same course/day
            const sameDayChallenges = (allChallengesData || []).filter(c => c.course_id === data.course_id && (c.day_number || 1) === (data.day_number || 1))
            setAllChallenges(sameDayChallenges)
            setCurrentIndex(sameDayChallenges.findIndex(c => c.id === challengeId))
            // Check if locked for student's groups
            const userGroupIds = memberships?.map(m => m.group_id) || []

            // Check manual resource-level lock
            const isResourceLocked = !canBypass && locks?.some(l => userGroupIds.includes(l.group_id))

            // Check day-level lock/schedule
            const dayAccess = locksDay?.find(a => a.course_id === data.course_id && a.day_number === data.day_number && userGroupIds.includes(a.group_id))
            const isDayLocked = !canBypass && (dayAccess?.is_locked || (dayAccess?.open_time && new Date(dayAccess.open_time) > new Date()))

            if (isResourceLocked || isDayLocked) {
                alert(isDayLocked && dayAccess?.open_time ? `This day opens at ${new Date(dayAccess.open_time).toLocaleString()}` : 'This coding challenge is currently locked for your group.')
                navigate('/student/coding', { replace: true })
                return
            }

            setChallenge(data)
            setPastSubmissions(subs || [])
            setAttemptCount((subs || []).length)

            // Enforce time window
            const now = new Date()
            if (data.open_time && now < new Date(data.open_time)) {
                setTimeStatus('upcoming')
            } else if (data.close_time && now > new Date(data.close_time)) {
                setTimeStatus('closed')
            } else {
                setTimeStatus('open')
            }

            // If they have attempts, load their last code as default
            if (subs && subs.length > 0) {
                const prevCode = subs[0].code || data.starter_code || ''
                if (data.language === 'html') {
                    try {
                        const parsed = JSON.parse(prevCode)
                        setHtmlCode(parsed.html || '')
                        setCssCode(parsed.css || '')
                        setJsCode(parsed.js || '')
                    } catch (e) {
                        setHtmlCode(prevCode) // Fallback for old records
                    }
                } else {
                    setCode(prevCode)
                }

                // Show last submission results
                if (subs.length >= MAX_ATTEMPTS && !canBypass) {
                    setResult({ status: subs[0].status === 'accepted' ? 'success' : 'error', message: `${subs[0].tests_passed} test(s) passed — No attempts remaining`, testResults: subs[0].results })
                    setActiveTab('output')
                }
            } else {
                if (data.language === 'html') {
                    try {
                        const parsed = JSON.parse(data.starter_code || '{}')
                        setHtmlCode(parsed.html || '')
                        setCssCode(parsed.css || '')
                        setJsCode(parsed.js || '')
                    } catch (e) {
                        setHtmlCode(data.starter_code || '')
                    }
                } else {
                    setCode(data.starter_code || '')
                }
            }
        } else {
            navigate('/student/coding')
        }
        setLoading(false)
    }

    const runCode = async () => {
        if (!challenge) return
        setRunning(true)
        setResult({ status: 'running', message: 'Executing code...' })
        setActiveTab('output')

        if (challenge.language === 'html') {
            updatePreview()
            setResult({ status: 'success', message: 'Preview updated' })
            setRunning(false)
            setActiveTab('preview')
            return
        }

        try {
            const config = LANGUAGE_CONFIG[challenge.language] || { id: 100 }
            const baseUrl = config.useExtra ? 'https://extra-ce.judge0.com' : 'https://ce.judge0.com'

            // Judge0 API Implementation
            const response = await fetch(`${baseUrl}/submissions?base64_encoded=false&wait=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_code: code,
                    language_id: config.id,
                    stdin: challenge.test_cases?.[0]?.input || ''
                })
            })

            const data = await response.json()

            if (data.status?.id === 3) { // Accepted
                setResult({
                    status: 'success',
                    output: data.stdout || 'Execution finished successfully',
                    compile_output: data.compile_output,
                    time: data.time,
                    memory: data.memory
                })
            } else {
                setResult({
                    status: 'error',
                    message: data.status?.description || 'Execution failed',
                    output: data.stderr || data.stdout || data.compile_output,
                })
            }
        } catch (err) {
            setResult({ status: 'error', message: 'Server error: ' + err.message })
        } finally {
            setRunning(false)
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

    const handleSubmit = async () => {
        if (!challenge || running || submitting) return
        setSubmitting(true)
        setRunning(true)
        setResult({ status: 'running', message: 'Submitting and verifying all test cases...' })
        setActiveTab('output')

        try {
            const testResults = []
            let allPassed = true
            let passedCount = 0
            const totalTests = challenge.test_cases?.length || 0

            for (let i = 0; i < totalTests; i++) {
                const tc = challenge.test_cases[i]
                const config = LANGUAGE_CONFIG[challenge.language] || { id: 100 }
                const baseUrl = config.useExtra ? 'https://extra-ce.judge0.com' : 'https://ce.judge0.com'
                let passed = false
                let stdout = ''

                if (challenge.language === 'html' && tc.output_image_url) {
                    updatePreview() // Ensure the preview is up-to-date before capturing
                    await new Promise(resolve => setTimeout(resolve, 1500)) // Give iframe a moment to render
                    const result = await getVisualSimilarity(tc.output_image_url)
                    // VER-4.5 Thresholds: Lenient for Alignment Issues
                    passed = result.total > 0.80 && result.foreground > 0.10
                    stdout = `[VER-4.5] Visual Match: ${(result.total * 100).toFixed(2)}%\nForeground: ${(result.foreground * 100).toFixed(2)}% (Goal: 10%+)`
                    tc.actual_image = result.diffImage
                } else if (challenge.language === 'html') {
                    // Fallback to basic submission if no image
                    const res = await fetch(`${baseUrl}/submissions?base64_encoded=false&wait=true`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            language_id: 100, // generic for web
                            source_code: getCombinedWebCode(),
                            stdin: tc.input || '',
                            expected_output: tc.expected_output || ''
                        })
                    })
                    const data = await res.json()
                    stdout = data.stdout || ''
                    passed = data.status?.id === 3
                } else {
                    const res = await fetch(`${baseUrl}/submissions?base64_encoded=false&wait=true`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            language_id: LANGUAGE_CONFIG[challenge.language].id,
                            source_code: code,
                            stdin: tc.input || '',
                            expected_output: tc.expected_output || ''
                        })
                    })
                    const data = await res.json()
                    stdout = (data.stdout || '').trim()
                    const expected = (tc.expected_output || '').trim()
                    passed = data.status?.id === 3 && stdout === expected
                }

                testResults.push({
                    id: i + 1,
                    passed,
                    isHidden: tc.is_hidden,
                    input: tc.input,
                    expected: tc.expected_output,
                    actual: stdout,
                    status: passed ? 'Accepted' : 'Wrong Answer',
                    error: '',
                    input_image_url: tc.input_image_url || '',
                    output_image_url: tc.output_image_url || ''
                })

                if (passed) passedCount++
                else allPassed = false
            }

            const score = allPassed ? (challenge.xp_reward || 15) : 0

            if (!canBypass) {
                await supabase.from('coding_submissions').insert({
                    challenge_id: challenge.id,
                    student_id: profile.id,
                    code: challenge.language === 'html' ? JSON.stringify({ html: htmlCode, css: cssCode, js: jsCode }) : code,
                    status: allPassed ? 'accepted' : 'wrong_answer',
                    tests_passed: passedCount,
                    score: score,
                    results: testResults
                })
            }

            setResult({
                status: allPassed ? 'success' : 'error',
                message: allPassed ? (canBypass ? 'Verification Complete: All test cases passed!' : 'All test cases passed!') : `${passedCount}/${totalTests} test cases passed.`,
                testResults
            })

            // Update course progress if they passed
            if (allPassed && !canBypass) {
                updateOverallProgress(challenge.course_id)

                // Logic for "Next Question" or "Completion"
                const nextChallenge = allChallenges[currentIndex + 1]
                if (nextChallenge) {
                    setResult(prev => ({ ...prev, message: 'All test cases passed! Moving to next question in 2 seconds...' }))
                    setTimeout(() => {
                        navigate(`/student/coding/${nextChallenge.id}`)
                    }, 2000)
                } else {
                    setResult(prev => ({ ...prev, message: 'Congratulations! You have completed all challenges for today. Finishing in 2 seconds...' }))
                    setTimeout(() => {
                        navigate('/student/dashboard')
                    }, 2000)
                }
            }
        } catch (err) {
            setResult({ status: 'error', message: 'Submission error: ' + err.message })
        } finally {
            setSubmitting(false)
            setRunning(false)
        }
    }

    const publishProject = async (e) => {
        e.preventDefault()
        if (!publishTitle.trim() || !profile?.id) return
        setPublishing(true)

        try {
            const { data, error } = await supabase.from('published_projects').insert({
                user_id: profile.id,
                title: publishTitle.trim(),
                description: publishDesc.trim() || null,
                html: htmlCode,
                css: cssCode,
                js: jsCode
            }).select('id').single()

            if (error) throw error
            if (data) {
                setPublishedUrl(`${window.location.origin}/p/${data.id}`)
                setPublishTitle('')
                setPublishDesc('')
            }
        } catch (err) {
            alert('Failed to publish project: ' + err.message)
        } finally {
            setPublishing(false)
        }
    }

    const getCombinedWebCode = () => {
        const cssInject = `<style>
            body { background: white; }
            ${cssCode}
        </style>`
        const jsInject = `<script>${jsCode}</script>`
        
        let finalHtml = htmlCode.trim() || '<div style="padding: 20px; color: #64748b; font-family: sans-serif;">Empty HTML</div>'

        // Wrap in a full scaffold if it's not already there
        if (!finalHtml.toLowerCase().includes('<html')) {
            finalHtml = `
                <!DOCTYPE html>
                <html>
                    <head>
                        <meta charset="UTF-8">
                        ${cssInject}
                    </head>
                    <body>
                        ${finalHtml}
                        ${jsInject}
                    </body>
                </html>
            `
        }

        // Manual Linking Logic: Only inject CSS if they linked style.css
        const cssLinkRegex = /<link[^>]*href=["']style\.css["'][^>]*>/i
        if (cssLinkRegex.test(finalHtml)) {
            finalHtml = finalHtml.replace(cssLinkRegex, cssInject)
        }

        // Manual Linking Logic: Only inject JS if they linked script.js
        const jsScriptRegex = /<script[^>]*src=["']script\.js["'][^>]*><\/script>/i
        if (jsScriptRegex.test(finalHtml)) {
            finalHtml = finalHtml.replace(jsScriptRegex, jsInject)
        }

        return finalHtml
    }

    const updatePreview = () => {
        if (iframeRef.current) {
            const document = iframeRef.current.contentDocument
            document.open()
            document.write(getCombinedWebCode())
            document.close()
        }
    }

    if (loading) return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
            <div className="spinner"></div>
        </div>
    )

    if (!challenge) return null

    if (!isStarted) {
        return (
            <div className="animate-fade-in" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
                <div className="glass-card" style={{ maxWidth: 500, width: '100%', padding: '3rem', textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, background: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', color: '#6366f1' }}>
                        <Lock size={40} />
                    </div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Secure Code Workspace</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        To maintain integrity, this coding challenge requires **Fullscreen Mode**.
                        Copy-pasting and right-clicking are restricted.
                    </p>
                    <div style={{ padding: '1rem', background: '#fff7ed', borderRadius: 12, border: '1px solid #fed7aa', color: '#9a3412', fontSize: '0.875rem', marginBottom: '2rem', textAlign: 'left' }}>
                        <strong>Note:</strong> Attempting to leave fullscreen or switching tabs will be flagged.
                    </div>
                    <button onClick={enterFullScreen} className="btn-primary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem', fontSize: '1.1rem' }}>
                        Enter Secure Mode & Start Coding
                    </button>
                    <Link to="/student/coding" style={{ display: 'block', marginTop: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        Go Back
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', background: '#f8fafc', overflow: 'hidden' }}>
            {/* Sidebar (Brief Challenge Overview) */}
            <aside style={{
                width: sidebarOpen ? (window.innerWidth <= 768 ? '100%' : 320) : 0,
                opacity: sidebarOpen ? 1 : 0,
                visibility: sidebarOpen ? 'visible' : 'hidden',
                background: 'white',
                borderRight: sidebarOpen ? '1px solid #e2e8f0' : 'none',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                position: window.innerWidth <= 768 && sidebarOpen ? 'absolute' : 'relative',
                zIndex: 50,
                height: '100%'
            }}>
                <div style={{ padding: '1.25rem', borderBottom: '1px solid #f1f5f9' }}>
                    <Link to={canBypass ? "/organizer/coding" : "/student/coding"} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem', textDecoration: 'none', marginBottom: '0.75rem' }}>
                        <ChevronLeft size={16} /> Back to {canBypass ? "Management" : "Challenges"}
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                        {challenge.language === 'html' ? 'Web Mode' : 'Standard Mode'}
                    </span>
                    <span style={{ fontSize: '0.65rem', background: '#ec4899', color: '#ffffff', padding: '2px 8px', borderRadius: 4, fontWeight: 800 }}>
                        VER 4.5 (DEBUG)
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: '#f1f5f9', borderRadius: 4, color: '#64748b' }}>{challenge.difficulty}</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.25rem' }}>
                        QUESTION {currentIndex + 1} OF {allChallenges.length}
                    </div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{challenge.title}</h2>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Instructions</h4>
                        <div style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6 }}>{challenge.problem_statement}</div>
                    </div>

                    {challenge.constraints && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Constraints</h4>
                            <pre style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 8, fontSize: '0.8rem', color: '#64748b', whiteSpace: 'pre-wrap' }}>{challenge.constraints}</pre>
                        </div>
                    )}

                    {challenge.target_visual_url && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Reference Goal</h4>
                            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                {challenge.target_visual_url.match(/\.(mp4|webm|ogg)$/i) ? (
                                    <video src={challenge.target_visual_url} controls style={{ width: '100%', display: 'block' }} />
                                ) : (
                                    <img src={challenge.target_visual_url} alt="Goal" style={{ width: '100%', display: 'block' }} />
                                )}
                            </div>
                        </div>
                    )}

                    {challenge.allowed_assets && challenge.allowed_assets.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>Assets & Links</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {challenge.allowed_assets.map((asset, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: '#f1f5f9', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                        <div style={{ flex: 1, fontSize: '0.75rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset}</div>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(asset);
                                                alert('Link copied to clipboard!');
                                            }}
                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
                                        >
                                            Copy
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <p style={{ fontSize: '0.65rem', color: '#6366f1', marginTop: '0.5rem', fontWeight: 600 }}>Tip: Pasting is allowed for HTML challenges.</p>
                        </div>
                    )}
                </div>
            </aside>

            {/* Workspace */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
                {/* Internal Toolbar */}
                <div style={{ height: 50, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem', background: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.25rem' }}
                            title="Toggle Sidebar"
                        >
                            <SidebarIcon size={18} color={sidebarOpen ? '#6366f1' : '#64748b'} />
                        </button>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => setActiveTab('problem')} className={`tab-btn ${activeTab === 'problem' ? 'active' : ''}`}>Workspace</button>
                            <button onClick={() => setActiveTab('output')} className={`tab-btn ${activeTab === 'output' ? 'active' : ''}`}>Console</button>
                            {challenge.language === 'html' && (
                                <button onClick={() => setActiveTab('preview')} className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}>Live Preview</button>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        {/* Time-window badges */}
                        {timeStatus === 'upcoming' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#d97706', background: '#fffbeb', padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid #fde68a' }}>
                                <Clock size={13} /> Opens {new Date(challenge.open_time).toLocaleString()}
                            </span>
                        )}
                        {timeStatus === 'closed' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', background: '#fef2f2', padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid #fecaca' }}>
                                <Lock size={13} /> Closed {new Date(challenge.close_time).toLocaleString()}
                            </span>
                        )}
                        {timeStatus === 'open' && (isReadOnly ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600, color: '#dc2626', background: '#fef2f2', padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid #fecaca' }}>
                                <Lock size={13} /> Attempts Exhausted (2/2)
                            </span>
                        ) : (
                            <>
                                {violationCount > 0 && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', background: '#fef2f2', padding: '0.35rem 0.75rem', borderRadius: 8, border: '1px solid #fee2e2' }}>
                                        Violations: {violationCount}/3
                                    </span>
                                )}
                                <button onClick={runCode} disabled={running} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', padding: '0.4rem 0.8rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                                    <Play size={14} /> Run
                                </button>
                                {challenge.language === 'html' && (
                                    <button onClick={() => { setPublishedUrl(null); setShowPublishModal(true); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(16,185,129,0.2)' }}>
                                        <Share2 size={14} /> Publish
                                    </button>
                                )}
                                <button onClick={handleSubmit} disabled={submitting || running} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: canBypass ? '#10b981' : '#6366f1', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(99,102,241,0.2)' }}>
                                    <Send size={14} /> {submitting ? 'Verifying...' : (canBypass ? 'Verify All Tests' : 'Submit')}
                                </button>
                            </>
                        ))}
                    </div>
                </div>

                {/* Editor Area */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Left Pane: Code Editor */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e293b' }}>
                        {challenge.language === 'html' ? (
                            <>
                                <div style={{ padding: '0', background: '#0f172a', display: 'flex', borderBottom: '1px solid #334155' }}>
                                    <div style={{ display: 'flex' }}>
                                        <button onClick={() => setWebTab('html')} style={{ padding: '0.6rem 1rem', background: webTab === 'html' ? '#1e293b' : 'transparent', border: 'none', color: webTab === 'html' ? '#e2e8f0' : '#64748b', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderTop: webTab === 'html' ? '2px solid #e34c26' : '2px solid transparent' }}>
                                            <div style={{ width: 14, height: 14, background: '#e34c26', color: 'white', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800 }}>5</div> HTML
                                        </button>
                                        <button onClick={() => setWebTab('css')} style={{ padding: '0.6rem 1rem', background: webTab === 'css' ? '#1e293b' : 'transparent', border: 'none', color: webTab === 'css' ? '#e2e8f0' : '#64748b', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderTop: webTab === 'css' ? '2px solid #264de4' : '2px solid transparent' }}>
                                            <div style={{ width: 14, height: 14, background: '#264de4', color: 'white', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800 }}>3</div> CSS
                                        </button>
                                        <button onClick={() => setWebTab('js')} style={{ padding: '0.6rem 1rem', background: webTab === 'js' ? '#1e293b' : 'transparent', border: 'none', color: webTab === 'js' ? '#e2e8f0' : '#64748b', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, borderTop: webTab === 'js' ? '2px solid #f0db4f' : '2px solid transparent' }}>
                                            <div style={{ width: 14, height: 14, background: '#f0db4f', color: '#323330', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.55rem', fontWeight: 800 }}>JS</div> JAVASCRIPT
                                        </button>
                                    </div>
                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '1rem', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                            Web <ChevronLeft size={14} style={{ transform: 'rotate(-90deg)' }} />
                                        </div>
                                    </div>
                                </div>
                            {webTab === 'html' && (
                                <CodeEditor
                                    value={htmlCode}
                                    onChange={e => setHtmlCode(e.target.value)}
                                    language="html"
                                    placeholder="<!-- HTML code here -->"
                                    readOnly={isReadOnly}
                                />
                            )}
                            {webTab === 'css' && (
                                <CodeEditor
                                    value={cssCode}
                                    onChange={e => setCssCode(e.target.value)}
                                    language="css"
                                    placeholder="/* CSS code here */"
                                    readOnly={isReadOnly}
                                />
                            )}
                            {webTab === 'js' && (
                                <CodeEditor
                                    value={jsCode}
                                    onChange={e => setJsCode(e.target.value)}
                                    language="js"
                                    placeholder="// JS code here"
                                    readOnly={isReadOnly}
                                />
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ padding: '0.5rem 1rem', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                    solution.{challenge.language === 'python' ? 'py' : challenge.language === 'sql' ? 'sql' : 'java'}
                                </span>
                            </div>
                            <CodeEditor
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                language={challenge.language}
                                placeholder="Write your solution here..."
                                readOnly={isReadOnly}
                            />
                        </>
                    )}
                    </div>

                    {/* Right Pane: Results / Preview */}
                    <div style={{
                        width: window.innerWidth <= 1024 ? (activeTab === 'problem' ? 0 : '100%') : '35%',
                        display: window.innerWidth <= 1024 && activeTab === 'problem' ? 'none' : 'block',
                        borderLeft: '1px solid #e2e8f0',
                        overflowY: 'auto',
                        padding: '1.5rem',
                        background: '#fcfdfe'
                    }}>
                        {/* Preview Tab (Always rendered to allow background similarity checks) */}
                        <div style={{ 
                            height: '100%', 
                            opacity: activeTab === 'preview' ? 1 : 0,
                            pointerEvents: activeTab === 'preview' ? 'auto' : 'none',
                            position: activeTab === 'preview' ? 'relative' : 'absolute',
                            zIndex: activeTab === 'preview' ? 1 : -1,
                            width: '100%',
                            display: 'flex',
                            flexDirection: 'column' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Eye size={16} color="#6366f1" />
                                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Visual Output</span>
                            </div>
                            <iframe ref={iframeRef} style={{ flex: 1, width: '100%', border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' }} />
                        </div>

                        {/* Console Tab */}
                        {activeTab !== 'preview' && (
                            <div className="animate-fade-in">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Console Output</h4>
                                    {(challenge.language === 'python' || challenge.language === 'python_ml') && (
                                        <div style={{ fontSize: '0.7rem', color: '#6366f1', background: '#eef2ff', padding: '0.25rem 0.6rem', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Info size={12} /> Memory Limit: 256MB
                                        </div>
                                    )}
                                </div>
                                {!result ? (
                                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8' }}>
                                            <Clock size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                                            <p style={{ fontSize: '0.85rem' }}>Test Cases & Mockups</p>
                                        </div>
                                        {challenge.test_cases?.map((tc, idx) => (
                                            <div key={idx} style={{ padding: '1rem', borderRadius: 12, background: 'white', border: '1px solid #e2e8f0' }}>
                                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <Info size={14} color="#6366f1" /> Case {idx + 1} {tc.is_hidden && <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>(HIDDEN)</span>}
                                                </div>
                                                
                                                {(!tc.is_hidden || canBypass) ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                        {tc.input && (
                                                            <div>
                                                                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>INPUT</div>
                                                                <pre style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: 6, fontSize: '0.75rem', overflowX: 'auto' }}>{tc.input}</pre>
                                                            </div>
                                                        )}
                                                        {challenge.language === 'html' && (tc.input_image_url || tc.output_image_url) && (
                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                                {tc.input_image_url && (
                                                                    <div>
                                                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>INPUT MOCKUP</div>
                                                                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                                            <img src={tc.input_image_url} alt="Input" style={{ width: '100%', display: 'block' }} />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {tc.output_image_url && (
                                                                    <div>
                                                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', marginBottom: 4 }}>TARGET DESIGN</div>
                                                                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                                            <img src={tc.output_image_url} alt="Target" style={{ width: '100%', display: 'block' }} />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>EXPECTED OUTPUT</div>
                                                            <pre style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: 6, fontSize: '0.75rem', overflowX: 'auto' }}>{tc.expected_output}</pre>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Details hidden for security. This test case will be evaluated upon submission.</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{
                                            padding: '1rem', borderRadius: 12,
                                            background: result.status === 'success' ? '#f0fdf4' : result.status === 'error' ? '#fef2f2' : '#f8fafc',
                                            border: `1px solid ${result.status === 'success' ? '#10b98140' : result.status === 'error' ? '#ef444440' : '#e2e8f0'}`,
                                            display: 'flex', alignItems: 'center', gap: '0.75rem'
                                        }}>
                                            {result.status === 'success' ? <CheckCircle2 color="#10b981" /> : result.status === 'error' ? <XCircle color="#ef4444" /> : <Clock className="animate-spin" color="#6366f1" />}
                                            <div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{result.status.toUpperCase()}</div>
                                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{result.message || 'Execution Complete'}</div>
                                            </div>
                                        </div>
                                        {result.testResults ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {result.testResults.map(tc => (
                                                    <div key={tc.id} style={{
                                                        padding: '0.75rem',
                                                        borderRadius: 8,
                                                        background: tc.passed ? '#f0fdf4' : '#fef2f2',
                                                        border: `1px solid ${tc.passed ? '#10b98120' : '#ef444420'}`
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                {tc.passed ? <CheckCircle2 size={14} color="#10b981" /> : <XCircle size={14} color="#ef4444" />}
                                                                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Test Case {tc.id}</span>
                                                            </div>
                                                            {(tc.isHidden || canBypass) && (
                                                                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: canBypass && tc.isHidden ? '#fee2e2' : '#e2e8f0', borderRadius: 4, color: canBypass && tc.isHidden ? '#b91c1c' : '#64748b', fontWeight: 700 }}>{tc.isHidden ? 'HIDDEN' : 'VISIBLE'}</span>
                                                            )}
                                                        </div>

                                                        {(!tc.isHidden || !tc.passed || canBypass) && (
                                                            <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                {challenge.language === 'html' && (tc.input_image_url || tc.output_image_url) && (
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                                                        {tc.input_image_url && (
                                                                            <div>
                                                                                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>INPUT MOCKUP</div>
                                                                                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                                                    <img src={tc.input_image_url} alt="Input" style={{ width: '100%', display: 'block' }} />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {tc.output_image_url && (
                                                                            <div>
                                                                                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981', marginBottom: 4 }}>TARGET DESIGN</div>
                                                                                <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                                                    <img src={tc.output_image_url} alt="Target" style={{ width: '100%', display: 'block' }} />
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.65rem', marginBottom: 2 }}>INPUT</div>
                                                                    <pre style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: 4, margin: 0, overflowX: 'auto' }}>{tc.input || '(empty)'}</pre>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.65rem', marginBottom: 2 }}>EXPECTED</div>
                                                                    <pre style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: 4, margin: 0, overflowX: 'auto' }}>{tc.expected}</pre>
                                                                </div>
                                                                 {(true) && (
                                                                    <div>
                                                                        <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.65rem', marginBottom: 2 }}>ACTUAL</div>                                                                         <pre style={{ background: tc.passed ? '#f0fdf4' : '#fee2e2', padding: '0.5rem', borderRadius: 4, margin: 0, overflowX: 'auto', color: tc.passed ? '#166534' : '#991b1b', fontSize: '0.7rem' }}>{tc.actual || tc.status || '(no output)'}</pre>
                                                                         {tc.actual_image && (
                                                                             <div style={{ marginTop: '0.5rem' }}>
                                                                                 <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginBottom: 4, fontWeight: 700 }}>DIFFERENCE MAP (RED = MISMATCH)</div>
                                                                                 <img src={tc.actual_image} alt="Diff" style={{ width: '100%', borderRadius: 4, border: '1px solid #e2e8f0' }} />
                                                                             </div>
                                                                         )}

                                                                    </div>
                                                                )}
                                                                 {tc.error && (
                                                                    <div style={{ color: '#ef4444', fontSize: '0.7rem', marginTop: 4, fontFamily: 'monospace' }}>{tc.error}</div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {tc.isHidden && tc.passed && (
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Details hidden for security</div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            result.output && (
                                                <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '1rem', borderRadius: 10, fontSize: '0.85rem', overflowX: 'auto' }}>{result.output}</pre>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <style>{`
                .tab-btn {
                    padding: 0.35rem 0.75rem; border: none; background: transparent;
                    color: #64748b; font-size: 0.8rem; font-weight: 600; cursor: pointer;
                    border-radius: 6px; transition: all 0.2s ease;
                }
                .tab-btn.active { background: #f1f5f9; color: #1e293b; }
            `}</style>

            {/* Publish Modal */}
            {
                showPublishModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                        <div className="glass-card animate-scale-up" style={{ width: 450, padding: '2rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Globe size={20} color="#10b981" /> Publish Web Project
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                                Make your project public. Anyone with the link will be able to view it.
                            </p>

                            {publishedUrl ? (
                                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1.5rem', borderRadius: 12, textAlign: 'center' }}>
                                    <h3 style={{ color: '#166534', fontWeight: 700, marginBottom: '1rem' }}>Project Published! 🎉</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'white', padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #dcfce3', marginBottom: '1rem' }}>
                                        <input type="text" readOnly value={publishedUrl} style={{ flex: 1, border: 'none', outline: 'none', fontSize: '0.8rem', color: '#1e293b' }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                        <button onClick={() => { navigator.clipboard.writeText(publishedUrl); alert("Copied!"); }} className="btn-primary" style={{ padding: '0.5rem 1.5rem', background: '#10b981' }}>
                                            <Copy size={16} /> Copy Link
                                        </button>
                                        <button onClick={() => setShowPublishModal(false)} className="btn-secondary">Close</button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={publishProject}>
                                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                        <label htmlFor="publish-title" className="form-label">Project Title</label>
                                        <input
                                            id="publish-title"
                                            type="text"
                                            required
                                            className="form-input"
                                            value={publishTitle}
                                            onChange={e => setPublishTitle(e.target.value)}
                                            placeholder="My Awesome Website"
                                        />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                        <label htmlFor="publish-desc" className="form-label">Description (Optional)</label>
                                        <textarea
                                            id="publish-desc"
                                            className="form-input"
                                            value={publishDesc}
                                            onChange={e => setPublishDesc(e.target.value)}
                                            placeholder="What is this project about?"
                                            style={{ minHeight: 80, resize: 'vertical' }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                        <button type="button" onClick={() => setShowPublishModal(false)} className="btn-secondary">Cancel</button>
                                        <button type="submit" disabled={publishing} className="btn-primary" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                            {publishing ? 'Publishing...' : 'Publish to World'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )
            }
        </div>
    )
}
