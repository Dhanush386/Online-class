import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
    ChevronLeft, Play, Send, Layout, Eye, Sidebar as SidebarIcon,
    AlertCircle, CheckCircle2, XCircle, Clock, Info, Code as CodeIcon, Database, Globe, Lock
} from 'lucide-react'

const LANGUAGE_CONFIG = {
    python: { id: 100, name: 'Python 3', icon: <CodeIcon size={16} /> },
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
    const { profile } = useAuth()
    const [challenge, setChallenge] = useState(null)
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [result, setResult] = useState(null)
    const [activeTab, setActiveTab] = useState('problem') // 'problem', 'output', 'preview'
    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024)
    const [attemptCount, setAttemptCount] = useState(0)
    const [pastSubmissions, setPastSubmissions] = useState([])

    const iframeRef = useRef(null)
    const isReadOnly = attemptCount >= MAX_ATTEMPTS
    const [timeStatus, setTimeStatus] = useState('open') // 'upcoming' | 'open' | 'closed'
    const [isStarted, setIsStarted] = useState(false)
    const [violationCount, setViolationCount] = useState(0)
    const [isAutoSubmitted, setIsAutoSubmitted] = useState(false)

    useEffect(() => {
        if (violationCount >= 3 && isStarted && !isAutoSubmitted && attemptCount < MAX_ATTEMPTS) {
            handleAutoSubmit()
        }
    }, [violationCount, isStarted])

    async function handleAutoSubmit() {
        setIsAutoSubmitted(true)
        alert('Security Violation: 3 violations detected. Your work is being automatically submitted.')
        await handleSubmit()
    }

    useEffect(() => {
        const handleSecurity = (e) => {
            if (isStarted) {
                e.preventDefault()
            }
        }

        const handleFullScreenChange = () => {
            if (isStarted && !document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
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
            if (isStarted && document.hidden) {
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
        const [{ data, error }, { data: subs }] = await Promise.all([
            supabase.from('coding_challenges').select('*, courses(title)').eq('id', challengeId).single(),
            supabase.from('coding_submissions').select('*').eq('challenge_id', challengeId).eq('student_id', profile.id).order('created_at', { ascending: false })
        ])

        if (data) {
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
                setCode(subs[0].code || data.starter_code || '')
                // Show last submission results
                if (subs.length >= MAX_ATTEMPTS) {
                    setResult({ status: subs[0].status === 'accepted' ? 'success' : 'error', message: `${subs[0].tests_passed} test(s) passed — No attempts remaining`, testResults: subs[0].results })
                    setActiveTab('output')
                }
            } else {
                setCode(data.starter_code || '')
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
            // Judge0 API Implementation
            const response = await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_code: code,
                    language_id: LANGUAGE_CONFIG[challenge.language].id,
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
            { data: vids },
            { data: chls },
            { data: assessData },
            { data: progressData },
            { data: subData }
        ] = await Promise.all([
            supabase.from('videos').select('id').eq('course_id', courseId),
            supabase.from('coding_challenges').select('id').eq('course_id', courseId),
            supabase.from('assessments').select('id').eq('course_id', courseId),
            supabase.from('progress').select('*').eq('student_id', profile.id).eq('course_id', courseId).single(),
            supabase.from('coding_submissions').select('challenge_id, status').eq('student_id', profile.id)
        ])

        const { data: allAssessSubs } = await supabase.from('assessment_submissions').select('assessment_id').eq('student_id', profile.id)

        const totalSessions = (vids || []).length
        const totalCoding = (chls || []).length
        const totalAssessments = (assessData || []).length

        const completedSessions = progressData?.video_id ? 1 : 0
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

        await supabase.from('progress').upsert({
            student_id: profile.id,
            course_id: courseId,
            completion_percentage: finalPct,
            last_updated: new Date().toISOString()
        }, { onConflict: 'student_id, course_id' })
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
                const response = await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source_code: code,
                        language_id: LANGUAGE_CONFIG[challenge.language]?.id || 100,
                        stdin: tc.input || ''
                    })
                })

                const data = await response.json()
                const stdout = (data.stdout || '').trim()
                const expected = (tc.expected_output || '').trim()
                const passed = data.status?.id === 3 && stdout === expected

                testResults.push({
                    id: i + 1,
                    passed,
                    isHidden: tc.is_hidden,
                    input: tc.input,
                    expected: tc.expected_output,
                    actual: stdout,
                    status: data.status?.description,
                    error: data.stderr || data.compile_output
                })

                if (passed) passedCount++
                else allPassed = false
            }

            const score = allPassed ? (challenge.xp_reward || 15) : 0

            await supabase.from('coding_submissions').insert({
                challenge_id: challenge.id,
                student_id: profile.id,
                code: code,
                status: allPassed ? 'accepted' : 'wrong_answer',
                tests_passed: passedCount,
                score: score,
                results: testResults
            })

            setResult({
                status: allPassed ? 'success' : 'error',
                message: allPassed ? 'All test cases passed!' : `${passedCount}/${totalTests} test cases passed.`,
                testResults
            })

            // Update course progress if they passed
            if (allPassed) {
                updateOverallProgress(challenge.course_id)
            }
        } catch (err) {
            setResult({ status: 'error', message: 'Submission error: ' + err.message })
        } finally {
            setSubmitting(false)
            setRunning(false)
        }
    }

    const updatePreview = () => {
        if (iframeRef.current) {
            const document = iframeRef.current.contentDocument
            document.open()
            document.write(code)
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
        <div style={{ position: 'fixed', inset: 0, top: 60, display: 'flex', background: '#f8fafc', overflow: 'hidden' }}>
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
                    <Link to="/student/coding" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.8rem', textDecoration: 'none', marginBottom: '0.75rem' }}>
                        <ChevronLeft size={16} /> Back to Challenges
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1' }}>{challenge.language.toUpperCase()}</span>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', background: '#f1f5f9', borderRadius: 4, color: '#64748b' }}>{challenge.difficulty}</span>
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
                                <button onClick={handleSubmit} disabled={submitting || running} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#6366f1', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 10px rgba(99,102,241,0.2)' }}>
                                    <Send size={14} /> {submitting ? 'Submitting...' : 'Submit'}
                                </button>
                            </>
                        ))}
                    </div>
                </div>

                {/* Editor Area */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Left Pane: Code Editor */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e293b' }}>
                        <div style={{ padding: '0.5rem 1rem', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                solution.{challenge.language === 'python' ? 'py' : challenge.language === 'sql' ? 'sql' : 'java'}
                            </span>
                        </div>
                        <textarea
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            spellCheck={false}
                            style={{
                                flex: 1, width: '100%', background: '#1e293b', color: '#e2e8f0',
                                border: 'none', outline: 'none', padding: '1.5rem', fontSize: '1rem',
                                fontFamily: 'monospace', lineHeight: 1.5, resize: 'none'
                            }}
                        />
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
                        {activeTab === 'preview' ? (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <Eye size={16} color="#6366f1" />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Visual Output</span>
                                </div>
                                <iframe ref={iframeRef} style={{ flex: 1, width: '100%', border: '1px solid #e2e8f0', borderRadius: 12, background: 'white' }} />
                            </div>
                        ) : (
                            <div className="animate-fade-in">
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>Console Output</h4>
                                {!result ? (
                                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                        <Clock size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                        <p>Click Run to test your solution</p>
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
                                                            {tc.isHidden && (
                                                                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: '#e2e8f0', borderRadius: 4, color: '#64748b', fontWeight: 700 }}>HIDDEN</span>
                                                            )}
                                                        </div>

                                                        {(!tc.isHidden || !tc.passed) && (
                                                            <div style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                <div>
                                                                    <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.65rem', marginBottom: 2 }}>INPUT</div>
                                                                    <pre style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: 4, margin: 0, overflowX: 'auto' }}>{tc.input || '(empty)'}</pre>
                                                                </div>
                                                                <div>
                                                                    <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.65rem', marginBottom: 2 }}>EXPECTED</div>
                                                                    <pre style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: 4, margin: 0, overflowX: 'auto' }}>{tc.expected}</pre>
                                                                </div>
                                                                {!tc.passed && (
                                                                    <div>
                                                                        <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: '0.65rem', marginBottom: 2 }}>ACTUAL</div>
                                                                        <pre style={{ background: tc.passed ? '#f0fdf4' : '#fee2e2', padding: '0.5rem', borderRadius: 4, margin: 0, overflowX: 'auto', color: tc.passed ? '#166534' : '#991b1b' }}>{tc.actual || tc.status || '(no output)'}</pre>
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
        </div>
    )
}
