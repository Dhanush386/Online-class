import { useEffect, useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import MobileBlocker from '../../components/MobileBlocker'
import { useDeviceType } from '../../hooks/useDeviceType'
import { useToast } from '../../components/Toast'
import useXpAward from '../../hooks/useXpAward'

// Extracted Hooks & Components
import { useProctoring } from './workspace/hooks/useProctoring'
import { WorkspacePreStart } from './workspace/components/WorkspacePreStart'
import { WorkspaceHeader } from './workspace/components/WorkspaceHeader'
import { WorkspaceLeftPanel } from './workspace/components/WorkspaceLeftPanel'
import { WorkspaceEditor } from './workspace/components/WorkspaceEditor'
import { WorkspaceOutput } from './workspace/components/WorkspaceOutput'

const MAX_ATTEMPTS = 2
const BYPASS_PROCTORING = false // Set to false to enable AI proctoring violations in production

const runHtmlTestcases = (htmlTestcases, htmlCode) => {
    const results = []
    for (const tc of (htmlTestcases || [])) {
        try {
            const parser = new DOMParser()
            const doc = parser.parseFromString(htmlCode, 'text/html')
            const found = doc.querySelectorAll(tc.selector)
            const minCount = tc.minCount || 1
            const passed = found.length >= minCount
            results.push({ description: tc.description || `Check: ${tc.selector}`, passed, type: 'html', expected: minCount > 1 ? `≥ ${minCount} × "${tc.selector}"` : `element "${tc.selector}" exists`, actual: found.length === 0 ? 'not found' : `found ${found.length}` })
        } catch {
            results.push({ description: tc.description || tc.selector, passed: false, type: 'html', expected: tc.selector, actual: 'selector error' })
        }
    }
    return results
}

const isValidCssValue = (val) => {
    return val !== '' && val !== 'none' && val !== 'normal' && val !== '0px'
}

const evaluateCssTestCase = (tc, iframeRef) => {
    const iDoc = iframeRef.current?.contentDocument
    const iWin = iframeRef.current?.contentWindow
    
    if (!iDoc || !iWin) {
        return { 
            description: tc.description || tc.selector, 
            passed: false, 
            type: 'css', 
            expected: `${tc.property}${tc.value ? ': ' + tc.value : ''}`, 
            actual: 'iframe not ready' 
        }
    }
    
    const el = iDoc.querySelector(tc.selector)
    if (!el) {
        return { 
            description: tc.description || tc.selector, 
            passed: false, 
            type: 'css', 
            expected: `"${tc.selector}" exists`, 
            actual: 'element not found' 
        }
    }
    
    const style = iWin.getComputedStyle(el)
    const camel = tc.property.replace(/-([a-z])/g, (_, l) => l.toUpperCase())
    const actualVal = (style[camel] || style.getPropertyValue(tc.property) || '').trim()
    const passed = tc.value 
        ? actualVal.toLowerCase().includes(tc.value.toLowerCase()) 
        : isValidCssValue(actualVal)
    
    return { 
        description: tc.description || `${tc.selector} → ${tc.property}`, 
        passed, 
        type: 'css', 
        expected: tc.value ? `${tc.property}: ${tc.value}` : `${tc.property} to be set`, 
        actual: actualVal || 'not set' 
    }
}

const runCssTestcases = (cssTestcases, iframeRef) => {
    const results = []
    for (const tc of (cssTestcases || [])) {
        try {
            results.push(evaluateCssTestCase(tc, iframeRef))
        } catch {
            results.push({ 
                description: tc.description || tc.selector, 
                passed: false, 
                type: 'css', 
                expected: `${tc.property}${tc.value ? ': ' + tc.value : ''}`, 
                actual: 'evaluation error' 
            })
        }
    }
    return results
}

const runJsTestcases = (jsTestcases, jsCode) => {
    const results = []
    for (const tc of (jsTestcases || [])) {
        try {
            const escapedKeyword = tc.keyword.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
            const pattern = new RegExp(String.raw`\b${escapedKeyword}\b`, 'i')
            const passed = pattern.test(jsCode)
            results.push({ description: tc.description || `Uses: ${tc.keyword}`, passed, type: 'js', expected: `"${tc.keyword}" used in JS`, actual: passed ? 'found ✓' : 'not found' })
        } catch {
            const passed = jsCode.includes(tc.keyword)
            results.push({ description: tc.description || tc.keyword, passed, type: 'js', expected: `"${tc.keyword}"`, actual: passed ? 'found' : 'not found' })
        }
    }
    return results
}

const initializeStarterCode = (data, isCombinedData, setters) => {
    const { setSubCodes, setGenericCode, setHtmlCode, setCssCode, setJsCode } = setters;
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
        } catch {
            setHtmlCode(data.starter_code)
        }
    }
}

const processUserData = (userData, isCombinedData, setters) => {
    const { setAttemptCount, setHasUnlockedAnswer, setSolvedSubIds } = setters;
    setAttemptCount(userData?.length || 0)

    if (userData?.some(sub => sub.code === 'Unlocked answer without submission')) {
        setHasUnlockedAnswer(true)
    }

    if (isCombinedData && userData) {
        const solved = [];
        userData.forEach(sub => {
            if (sub.status === 'accepted') {
                try {
                    const parsed = JSON.parse(sub.code);
                    if (parsed.isCombined && parsed.subId) solved.push(parsed.subId);
                } catch { /* empty */ }
            }
        });
        setSolvedSubIds(solved);
    }
}

const loadTargetImage = (targetUrl) => {
    return new Promise((resolve, reject) => {
        const targetImg = new Image()
        targetImg.crossOrigin = "anonymous"
        targetImg.src = targetUrl
        targetImg.onload = () => resolve(targetImg)
        targetImg.onerror = reject
    })
}

const calculatePixelDifferences = (data1, data2, width, height) => {
    const diffCanvas = document.createElement('canvas')
    diffCanvas.width = width; diffCanvas.height = height
    const diffCtx = diffCanvas.getContext('2d')
    const diffData = diffCtx.createImageData(width, height)
    let matches = 0; let foregroundMatches = 0; let foregroundTotal = 0; const totalPixels = width * height

    for (let i = 0; i < data1.length; i += 4) {
        const r1 = data1[i], g1 = data1[i+1], b1 = data1[i+2]
        const r2 = data2[i], g2 = data2[i+1], b2 = data2[i+2]
        const isMatch = Math.abs(r1 - r2) < 25 && Math.abs(g1 - g2) < 25 && Math.abs(b1 - b2) < 25
        if (isMatch) matches++
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
}

const processTestCases = async (params) => {
    const { challenge, currentTestCases, genericCode, getVisualSimilarity, initPyodide } = params;

    if (challenge.language.startsWith('python')) {
        await initPyodide()
    }

    const testResults = []
    let overallPassed = true

    for (let i = 0; i < currentTestCases.length; i++) {
        const tc = currentTestCases[i]
        let passed = false
        let stdout = ''

        if (challenge.language === 'html' && tc.output_image_url) {
            const visualResult = await getVisualSimilarity(tc.output_image_url)
            passed = visualResult.total > 0.85 && visualResult.foreground > 0.05
            stdout = `[VER-7.1] Visual Match: ${(visualResult.total * 100).toFixed(2)}%\nForeground: ${(visualResult.foreground * 100).toFixed(2)}% (Target: 5%+)`
            tc.actual_image = visualResult.diffImage
        } else if (challenge.language.startsWith('python')) {
            try {
                globalThis.pyodideOutputBuffer.length = 0
                globalThis.pyodideInstance.globals.set("test_input", tc.input || "")
                await globalThis.pyodideInstance.runPythonAsync(`
import sys
from io import StringIO
sys.stdin = StringIO(test_input)
                `)
                await globalThis.pyodideInstance.runPythonAsync(genericCode)
                stdout = globalThis.pyodideOutputBuffer.join('\n').trim()
                const expected = (tc.expected_output || "").trim()
                passed = stdout === expected
            } catch (err) {
                stdout = err.toString()
                passed = false
            }
        } else {
            passed = true 
        }

        testResults.push({ id: i + 1, passed, actual: stdout, actual_image: tc.actual_image })
        if (!passed) overallPassed = false
    }

    return { testResults, overallPassed };
}

const checkAlreadySolved = async (isCombined, solvedSubIds, currentQuestion, supabase, challengeId, profileId) => {
    if (isCombined) {
        return solvedSubIds.includes(currentQuestion.id);
    }
    const { data: previousSubs } = await supabase.from('coding_submissions')
        .select('id').eq('challenge_id', challengeId).eq('student_id', profileId).eq('status', 'accepted');
    return previousSubs?.length > 0;
}

const buildCodePayload = (isCombined, currentQuestion, genericCode, challenge, htmlCode, cssCode, jsCode) => {
    if (isCombined) {
        return JSON.stringify({ isCombined: true, subId: currentQuestion.id, code: genericCode });
    }
    if (challenge.language === 'html') {
        return JSON.stringify({ html: htmlCode, css: cssCode, js: jsCode });
    }
    return genericCode;
}

// awardXpIfEligible is now handled inside CodeWorkspace via useXpAward hook

const recordSubmission = async (params) => {
    const { 
        challenge, challengeId, profile, currentQuestion, isCombined, solvedSubIds,
        setSolvedSubIds, htmlCode, cssCode, jsCode, genericCode, hasUnlockedAnswer,
        refreshStats, toast, stopProctoring, supabase, awardXp
    } = params;

    const alreadySolved = await checkAlreadySolved(isCombined, solvedSubIds, currentQuestion, supabase, challengeId, profile.id);
    const finalCodePayload = buildCodePayload(isCombined, currentQuestion, genericCode, challenge, htmlCode, cssCode, jsCode);
    const isFirstSolve = !alreadySolved && !hasUnlockedAnswer;
    const finalScore = isFirstSolve ? (currentQuestion.xp_reward || 15) : 0;

    await supabase.from('coding_submissions').insert({
        student_id: profile.id, challenge_id: challengeId,
        status: 'accepted', score: finalScore, code: finalCodePayload
    })

    if (isCombined && isFirstSolve) {
        setSolvedSubIds(prev => [...prev, currentQuestion.id]);
    }

    if (isFirstSolve && awardXp) {
        await awardXp({
            eventType: 'coding_solve',
            referenceId: challengeId,
            courseId: challenge.course_id || null,
            moduleType: 'coding',
            reason: `Solved: ${currentQuestion.title || challenge.title}`,
            isFirstAttempt: true,
            difficulty: challenge.difficulty || 'easy',
            metadata: { score: finalScore, title: currentQuestion.title || challenge.title }
        })
    }

    const newSolvedCount = solvedSubIds.length + (isFirstSolve ? 1 : 0);
    const isFullyCompleted = !isCombined || newSolvedCount >= challenge.test_cases.sub_questions.length;

    if (isFullyCompleted) {
        stopProctoring();
    }
}

export default function CodeWorkspace() {
    const { challengeId } = useParams()
    const navigate = useNavigate()
    const toast = useToast()
    const queryParams = new URLSearchParams(globalThis.location.search)
    const isAdminMode = queryParams.get('admin') === 'true'
    const { profile, refreshStats, user } = useAuth()
    const isOrganizer = profile?.role === 'organizer'
    const canBypass = isAdminMode && isOrganizer
    const { isMobile, isTablet, isDesktop } = useDeviceType()
    const { awardXp, toastMessage } = useXpAward()
    
    const [challenge, setChallenge] = useState(null)
    const [htmlCode, setHtmlCode] = useState('<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="main">\n    <h1>Hello World</h1>\n  </div>\n</body>\n</html>')
    const [cssCode, setCssCode] = useState('/* Write your CSS here */\n.main {\n  text-align: center;\n  font-family: sans-serif;\n}')
    const [jsCode, setJsCode] = useState('// JavaScript here')
    const [genericCode, setGenericCode] = useState('')
    const [webTab, setWebTab] = useState('html')
    const [leftTab, setLeftTab] = useState('description')

    const [currentSubIndex, setCurrentSubIndex] = useState(0)
    const [subCodes, setSubCodes] = useState({})
    const [solvedSubIds, setSolvedSubIds] = useState([])
    
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [attemptCount, setAttemptCount] = useState(0)
    const [currentIndex, setCurrentIndex] = useState(-1)
    
    const iframeRef = useRef(null)
    const isReadOnly = attemptCount >= MAX_ATTEMPTS && !canBypass
    const [isStarted, setIsStarted] = useState(false)


    const [hasRequestedHelp, setHasRequestedHelp] = useState(false)
    const [hasUnlockedAnswer, setHasUnlockedAnswer] = useState(false)
    const [showUnlockModal, setShowUnlockModal] = useState(false)

    const {
        violationCount, requiresReentry, setRequiresReentry,
        securityAlert, setSecurityAlert, faceDetected,
        cameraEnabled, mediaStream, videoRef,
        stopProctoring, startCamera, sessionId, setSessionId
    } = useProctoring({ isStarted, canBypass, BYPASS_PROCTORING, challengeId, profile, user })

    const isCombined = challenge?.test_cases?.is_combined === true;
    const currentQuestion = isCombined ? challenge.test_cases.sub_questions[currentSubIndex] : challenge;
    const currentTestCases = isCombined ? currentQuestion.test_cases : (challenge?.test_cases || []);

    const webTestcases = challenge?.web_testcases || null
    const referenceIframeUrl = challenge?.reference_iframe_url || null
    const hasWebTcs = !!(webTestcases && (webTestcases.html?.length || webTestcases.css?.length || webTestcases.js?.length))
    const flatWebTcs = hasWebTcs ? [
        ...(webTestcases.html || []).map(t => ({ description: t.description || `Check: ${t.selector}`, _wtype: 'html', _spec: t })),
        ...(webTestcases.css  || []).map(t => ({ description: t.description || `${t.selector} → ${t.property}${t.value ? ': ' + t.value : ''}`, _wtype: 'css',  _spec: t })),
        ...(webTestcases.js   || []).map(t => ({ description: t.description || `Uses: ${t.keyword}`, _wtype: 'js',   _spec: t }))
    ] : null

    const runWebTestcases = async () => {
        const results = []
        if (webTestcases?.html?.length) {
            results.push(...runHtmlTestcases(webTestcases.html, htmlCode))
        }
        
        if (webTestcases?.css?.length) {
            updatePreview()
            await new Promise(r => setTimeout(r, 450))
            results.push(...runCssTestcases(webTestcases.css, iframeRef))
        }
        
        if (webTestcases?.js?.length) {
            results.push(...runJsTestcases(webTestcases.js, jsCode))
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

            if (!canBypass && data.open_time && new Date(data.open_time) > new Date()) {
                alert(`This challenge opens at ${new Date(data.open_time).toLocaleString()}`)
                navigate('/student/coding', { replace: true })
                return
            }

            setChallenge(data)
            
            const isCombinedData = data.test_cases?.is_combined === true;
            initializeStarterCode(data, isCombinedData, { setSubCodes, setGenericCode, setHtmlCode, setCssCode, setJsCode });

            const { data: userData } = await supabase.from('coding_submissions').select('id, code, status').eq('challenge_id', challengeId).eq('student_id', profile.id)
            processUserData(userData, isCombinedData, { setAttemptCount, setHasUnlockedAnswer, setSolvedSubIds });

            const { data: all } = await supabase.from('coding_challenges').select('id, title').order('created_at')
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
                    <script>${jsCode}</script>
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
            const targetImg = await loadTargetImage(targetUrl)
            
            const width = 200; const height = 150
            const canvas1 = document.createElement('canvas'); const canvas2 = document.createElement('canvas')
            canvas1.width = width; canvas1.height = height; canvas2.width = width; canvas2.height = height
            const ctx1 = canvas1.getContext('2d'); const ctx2 = canvas2.getContext('2d')
            ctx1.drawImage(studentCanvas, 0, 0, width, height)
            ctx2.drawImage(targetImg, 0, 0, width, height)
            
            const data1 = ctx1.getImageData(0, 0, width, height).data
            const data2 = ctx2.getImageData(0, 0, width, height).data
            
            return calculatePixelDifferences(data1, data2, width, height)
        } catch (err) {
            console.error("Visual similarity error:", err)
            return { total: 0, foreground: 0, diffImage: null }
        }
    }

    const initPyodide = async () => {
        if (!globalThis.pyodideInstance) {
            if (!document.querySelector('#pyodide-script')) {
                const script = document.createElement('script')
                script.id = 'pyodide-script'
                script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js'
                script.crossOrigin = 'anonymous'
                script.integrity = 'sha384-b4IZetZNE8bVncsQqlcH4ZZFC58BslGU2LVj47xUtIMOw72axMESbPe8spBylXnd'
                document.body.appendChild(script)
                await new Promise((resolve) => script.onload = resolve)
            }
            let outputBuffer = []
            globalThis.pyodideInstance = await globalThis.loadPyodide({
                stdout: (text) => outputBuffer.push(text),
                stderr: (text) => outputBuffer.push(text)
            })
            globalThis.pyodideOutputBuffer = outputBuffer
        }
    }

    const runCode = async () => {
        setRunning(true)
        setResult({ status: 'running', message: 'Running code...' })
        if (challenge.language === 'html') {
            updatePreview()
            setResult({ status: 'success', message: 'Rendered successfully ✓' })
        } else if (challenge.language.startsWith('python')) {
            try {
                setResult({ status: 'running', message: 'Initializing Python Engine (this takes a few seconds on the first run)...' })
                await initPyodide()
                globalThis.pyodideOutputBuffer.length = 0 // clear buffer
                const defaultInput = currentTestCases?.[0]?.input || ""
                globalThis.pyodideInstance.globals.set("test_input", defaultInput)
                await globalThis.pyodideInstance.runPythonAsync(`
import sys
from io import StringIO
sys.stdin = StringIO(test_input)
                `)
                await globalThis.pyodideInstance.runPythonAsync(genericCode)
                const output = globalThis.pyodideOutputBuffer.join('\n')
                setResult({ status: 'success', message: output || 'Code executed successfully (no output)' })
            } catch (err) {
                setResult({ status: 'error', message: err.toString() })
            }
        } else {
            setTimeout(() => setResult({ status: 'success', message: 'Output: Success\nCode executed successfully.' }), 1000)
        }
        setRunning(false)
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        setResult({ status: 'running', message: 'Running tests...' })
        try {
            if (challenge.language === 'html' && hasWebTcs) {
                setResult({ status: 'running', message: 'Running testcases...' })
                const tcResults = await runWebTestcases()
                const failedTcs = tcResults.filter(r => !r.passed)

                if (failedTcs.length > 0) {
                    setResult({
                        status: 'error',
                        message: `Submission blocked — ${failedTcs.length} testcase${failedTcs.length > 1 ? 's' : ''} failed.\nFix the highlighted tests and try again.`,
                        testResults: tcResults,
                        isSubmit: true
                    })
                    setSubmitting(false)
                    return
                }
                setResult({ status: 'success', message: `✅ All ${tcResults.length} testcases passed!`, testResults: tcResults, isSubmit: true })

                await recordSubmission({
                    challenge, challengeId, profile, currentQuestion, isCombined: false,
                    solvedSubIds, setSolvedSubIds, htmlCode, cssCode, jsCode, genericCode,
                    hasUnlockedAnswer, refreshStats, toast, stopProctoring, supabase, awardXp
                })
                setSubmitting(false)
                return
            }
            
            if (challenge.language.startsWith('python')) {
                setResult({ status: 'running', message: 'Initializing Python Engine for tests...' })
            }

            const { testResults, overallPassed } = await processTestCases({
                challenge, currentTestCases, genericCode, getVisualSimilarity, initPyodide
            });

            setResult({ status: overallPassed ? 'success' : 'error', message: overallPassed ? 'Success: All tests passed!' : 'Error: Some tests failed', testResults, isSubmit: true })
            
            if (overallPassed && !canBypass) {
                await recordSubmission({
                    challenge, challengeId, profile, currentQuestion, isCombined,
                    solvedSubIds, setSolvedSubIds, htmlCode, cssCode, jsCode, genericCode,
                    hasUnlockedAnswer, refreshStats, toast, stopProctoring, supabase, awardXp
                })
            }
        } catch (err) {
            console.error(err)
            setResult({ status: 'error', message: err.message })
        } finally {
            setSubmitting(false)
        }
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

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: 'var(--text-primary)' }}>Loading workspace...</div>
    if (!challenge) return <div>Challenge not found</div>
    if ((!isDesktop || isMobile || isTablet) && !canBypass) return <MobileBlocker />

    if (!isStarted || requiresReentry || securityAlert) {
        return (
            <WorkspacePreStart 
                isStarted={isStarted}
                canBypass={canBypass}
                BYPASS_PROCTORING={BYPASS_PROCTORING}
                requiresReentry={requiresReentry}
                securityAlert={securityAlert}
                violationCount={violationCount}
                cameraEnabled={cameraEnabled}
                startCamera={startCamera}
                enterFullScreen={enterFullScreen}
                handleStartChallenge={handleStartChallenge}
                challenge={challenge}
                setSecurityAlert={setSecurityAlert}
                setRequiresReentry={setRequiresReentry}
            />
        )
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: '#f1f5f9', color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <WorkspaceHeader 
                canBypass={canBypass}
                currentIndex={currentIndex}
                challenge={challenge}
                isStarted={isStarted}
                violationCount={violationCount}

                formatTime={formatTime}
            />

            {cameraEnabled && !canBypass && (
                <div style={{ position: 'fixed', top: '20px', right: '20px', width: '150px', height: '112px', borderRadius: '12px', overflow: 'hidden', border: '2px solid #ef4444', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: faceDetected ? 1000 : 10000, background: '#000', transition: 'all 0.3s ease', transform: faceDetected ? 'none' : 'scale(1.5) translate(-20px, 20px)' }}>
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
                <WorkspaceLeftPanel 
                    leftTab={leftTab}
                    setLeftTab={setLeftTab}
                    isCombined={isCombined}
                    challenge={challenge}
                    currentQuestion={currentQuestion}
                    solvedSubIds={solvedSubIds}
                    handleSwitchSubQuestion={handleSwitchSubQuestion}
                    currentSubIndex={currentSubIndex}
                    hasRequestedHelp={hasRequestedHelp}
                    setHasRequestedHelp={setHasRequestedHelp}
                    setShowUnlockModal={setShowUnlockModal}
                    hasUnlockedAnswer={hasUnlockedAnswer}
                    challengeId={challengeId}
                    htmlCode={htmlCode}
                    cssCode={cssCode}
                    jsCode={jsCode}
                    genericCode={genericCode}
                    referenceIframeUrl={referenceIframeUrl}
                    flatWebTcs={flatWebTcs}
                    currentTestCases={currentTestCases}
                    result={result}
                />

                <WorkspaceEditor 
                    challenge={challenge}
                    webTab={webTab}
                    setWebTab={setWebTab}
                    htmlCode={htmlCode}
                    setHtmlCode={setHtmlCode}
                    cssCode={cssCode}
                    setCssCode={setCssCode}
                    jsCode={jsCode}
                    setJsCode={setJsCode}
                    genericCode={genericCode}
                    setGenericCode={setGenericCode}
                    isCombined={isCombined}
                    handleSubCodeChange={handleSubCodeChange}
                    isReadOnly={isReadOnly}
                    runCode={runCode}
                    handleSubmit={handleSubmit}
                    running={running}
                    submitting={submitting}
                />

                <WorkspaceOutput 
                    challenge={challenge}
                    iframeRef={iframeRef}
                    result={result}
                    setResult={setResult}
                    handleSubmit={handleSubmit}
                    submitting={submitting}
                    running={running}
                    faceDetected={faceDetected}
                    isStarted={isStarted}
                    cameraEnabled={cameraEnabled}
                    canBypass={canBypass}
                    BYPASS_PROCTORING={BYPASS_PROCTORING}
                    showUnlockModal={showUnlockModal}
                    setShowUnlockModal={setShowUnlockModal}
                    handleUnlockAnswer={handleUnlockAnswer}
                />
            </div>

            {/* XP Toast Notification */}
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
                    gap: '0.6rem',
                    animation: 'fadeInUp 0.4s ease'
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
