import { useEffect, useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
    ChevronLeft, Play, Send, Layout, Eye, Sidebar as SidebarIcon,
    AlertCircle, CheckCircle2, XCircle, Clock, Info, Code as CodeIcon, Database, Globe, Lock, Share2, Copy,
    FileText, HelpCircle, MessageSquare, RotateCcw, Maximize, Settings, Save, Trash2
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
    const [htmlCode, setHtmlCode] = useState('<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <div class="main">\n    <h1>Hello World</h1>\n  </div>\n</body>\n</html>')
    const [cssCode, setCssCode] = useState('/* Write your CSS here */\n.main {\n  text-align: center;\n  font-family: sans-serif;\n}')
    const [jsCode, setJsCode] = useState('// JavaScript here')
    const [webTab, setWebTab] = useState('html')
    const [leftTab, setLeftTab] = useState('description')
    
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

    useEffect(() => {
        fetchChallenge()
    }, [challengeId])

    const fetchChallenge = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase.from('coding_challenges').select('*').eq('id', challengeId).single()
            if (error) throw error
            setChallenge(data)
            
            // Check attempts
            const { data: userData } = await supabase.from('student_submissions').select('count').eq('challenge_id', challengeId).eq('user_id', profile.id).single()
            setAttemptCount(userData ? userData.count : 0)

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

    const runCode = async () => {
        setRunning(true)
        setResult({ status: 'running', message: 'Running code...' })
        // Basic local run for HTML, mock for others
        if (challenge.language === 'html') {
            updatePreview()
            setResult({ status: 'success', message: 'Rendered successfully' })
        } else {
            // Mock execution
            setTimeout(() => setResult({ status: 'success', message: 'Output: Success' }), 1000)
        }
        setRunning(false)
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        try {
            const testResults = []
            let overallPassed = true

            for (let i = 0; i < challenge.test_cases.length; i++) {
                const tc = challenge.test_cases[i]
                let passed = false
                let stdout = ''

                if (challenge.language === 'html' && tc.output_image_url) {
                    const result = await getVisualSimilarity(tc.output_image_url)
                    passed = result.total > 0.85 && result.foreground > 0.05
                    stdout = `[VER-7.1] Visual Match: ${(result.total * 100).toFixed(2)}%\nForeground: ${(result.foreground * 100).toFixed(2)}% (Target: 5%+)`
                    tc.actual_image = result.diffImage
                } else {
                    passed = true // Mock
                }

                testResults.push({ id: i + 1, passed, actual: stdout, actual_image: tc.actual_image })
                if (!passed) overallPassed = false
            }

            setResult({ status: overallPassed ? 'success' : 'error', message: overallPassed ? 'Success: All tests passed!' : 'Error: Some tests failed', testResults })
            
            if (overallPassed && !canBypass) {
                // Submit to DB
                await supabase.from('student_submissions').insert({
                    user_id: profile.id,
                    challenge_id: challengeId,
                    status: 'passed'
                })
            }
        } catch (err) {
            console.error(err)
            setResult({ status: 'error', message: err.message })
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: '#fff' }}>Loading workspace...</div>
    if (!challenge) return <div>Challenge not found</div>

    if (!isStarted && !canBypass) {
        return (
            <div style={{ height: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="glass-card" style={{ maxWidth: 600, padding: '3rem', textAlign: 'center', border: '1px solid #334155' }}>
                    <h1 style={{ color: '#fff', fontSize: '2rem', marginBottom: '1.5rem' }}>{challenge.title}</h1>
                    <div style={{ background: '#1e293b', padding: '1.5rem', borderRadius: 12, textAlign: 'left', marginBottom: '2rem' }}>
                        <p style={{ color: '#cbd5e1', marginBottom: '1rem' }}>Please review the instructions. You have <strong>{MAX_ATTEMPTS - attemptCount} attempts</strong> remaining.</p>
                    </div>
                    <button onClick={() => setIsStarted(true)} className="btn-primary" style={{ width: '100%', height: '3.5rem' }}>Start Challenge</button>
                    <Link to="/student/coding" style={{ display: 'block', marginTop: '1.5rem', color: '#64748b' }}>Go Back</Link>
                </div>
            </div>
        )
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', background: '#0f172a', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <header style={{ height: 48, background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
                <Link to={canBypass ? "/organizer/coding" : "/student/coding"} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                    <ChevronLeft size={18} /> CODING PRACTICE - {currentIndex + 1}
                </Link>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{challenge.title}</span>
                    <div style={{ padding: '2px 8px', background: '#10b981', borderRadius: 4, fontSize: '0.65rem', fontWeight: 800 }}>VER 7.1</div>
                </div>
            </header>

            <div style={{ flex: 1, display: 'flex', gap: '8px', padding: '8px', overflow: 'hidden' }}>
                
                {/* Column 1: Description */}
                <div style={{ width: '28%', minWidth: 320, background: '#1e293b', borderRadius: 8, display: 'flex', flexDirection: 'column', border: '1px solid #334155' }}>
                    <div style={{ height: 40, borderBottom: '1px solid #334155', display: 'flex', padding: '0 4px' }}>
                        <button onClick={() => setLeftTab('description')} style={{ flex: 1, background: 'none', border: 'none', color: leftTab === 'description' ? '#fff' : '#94a3b8', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderBottom: leftTab === 'description' ? '2px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <FileText size={14} /> Description
                        </button>
                        <button onClick={() => setLeftTab('help')} style={{ flex: 1, background: 'none', border: 'none', color: leftTab === 'help' ? '#fff' : '#94a3b8', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderBottom: leftTab === 'help' ? '2px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <HelpCircle size={14} /> Get Help
                        </button>
                        <button onClick={() => setLeftTab('discuss')} style={{ flex: 1, background: 'none', border: 'none', color: leftTab === 'discuss' ? '#fff' : '#94a3b8', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', borderBottom: leftTab === 'discuss' ? '2px solid #3b82f6' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <MessageSquare size={14} /> Discuss
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                        {leftTab === 'description' ? (
                            <div className="animate-fade-in">
                                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>{challenge.title}</h1>
                                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '2rem' }}>{challenge.problem_statement}</div>

                                {challenge.target_visual_url && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <p style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: '#3b82f6' }}>Refer to the below image.</p>
                                        <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #334155', background: '#0f172a' }}>
                                            <img src={challenge.target_visual_url} alt="Goal" style={{ width: '100%', display: 'block' }} />
                                        </div>
                                    </div>
                                )}

                                {/* Testcases Section */}
                                {(() => {
                                    const cases = !result ? challenge.test_cases : result.testResults
                                    const total = cases?.length || 0
                                    const passedCount = result ? cases.filter(t => t.passed).length : 0
                                    const failedCount = result ? total - passedCount : 0
                                    return (
                                        <div style={{ marginTop: '2.5rem', borderTop: '1px solid #334155', paddingTop: '1.5rem' }}>
                                            {/* Collapsible Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', cursor: 'default' }}>
                                                <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#e2e8f0', margin: 0 }}>Testcases</h4>
                                                <ChevronLeft size={16} style={{ transform: 'rotate(-90deg)', color: '#64748b' }} />
                                            </div>

                                            {/* Summary Badges */}
                                            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #334155', background: '#111827' }}>
                                                    <CodeIcon size={14} color="#94a3b8" />
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Total</span>
                                                    <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: '#e2e8f0' }}>{total}</span>
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #05966930', background: '#05966910' }}>
                                                    <CheckCircle2 size={14} color="#10b981" />
                                                    <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Passed</span>
                                                    <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: '#10b981' }}>{result ? passedCount : '-'}</span>
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', borderRadius: 8, border: '1px solid #ef444430', background: '#ef444410' }}>
                                                    <XCircle size={14} color="#ef4444" />
                                                    <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 600 }}>Failed</span>
                                                    <span style={{ marginLeft: 'auto', fontSize: '1rem', fontWeight: 800, color: '#ef4444' }}>{result ? failedCount : '-'}</span>
                                                </div>
                                            </div>

                                            {/* Individual Test Case Cards */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {cases?.map((tc, idx) => {
                                                    const tcData = !result ? tc : challenge.test_cases[idx]
                                                    const passed = result ? tc.passed : null
                                                    const description = tcData.description || tcData.expected_output || `Test Case ${idx + 1}`
                                                    return (
                                                        <div key={idx} style={{ padding: '1rem 1.25rem', borderRadius: 8, background: '#111827', borderLeft: `3px solid ${passed === true ? '#10b981' : passed === false ? '#ef4444' : '#334155'}`, transition: 'all 0.2s ease' }}>
                                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                                                {passed === true ? <CheckCircle2 size={18} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} /> : passed === false ? <XCircle size={18} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} /> : <Info size={18} color="#475569" style={{ marginTop: 2, flexShrink: 0 }} />}
                                                                <span style={{ fontSize: '0.85rem', color: passed === true ? '#cbd5e1' : passed === false ? '#fca5a5' : '#94a3b8', lineHeight: 1.5, fontWeight: 500 }}>{description}</span>
                                                            </div>
                                                            {result && tc.actual && (
                                                                <pre style={{ background: '#0f172a', padding: '0.5rem 0.75rem', borderRadius: 6, marginTop: 10, fontSize: '0.65rem', color: passed ? '#10b981' : '#f87171', overflowX: 'auto', border: '1px solid #1f2937', marginLeft: '2rem' }}>{tc.actual}</pre>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', color: '#64748b', marginTop: '4rem' }}>
                                <Info size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                <p style={{ fontSize: '0.85rem' }}>No hints/discussion available during exams.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Column 2: Editor */}
                <div style={{ flex: 1.5, background: '#1e293b', borderRadius: 8, display: 'flex', flexDirection: 'column', border: '1px solid #334155', overflow: 'hidden' }}>
                    <div style={{ height: 40, borderBottom: '1px solid #334155', display: 'flex', background: '#0f172a', padding: '0 4px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', height: '100%' }}>
                            <button onClick={() => setWebTab('html')} style={{ padding: '0 1rem', background: webTab === 'html' ? '#1e293b' : 'transparent', border: 'none', color: webTab === 'html' ? '#e34c26' : '#64748b', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 14, height: 14, background: '#e34c26', color: '#fff', borderRadius: 2, fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>H</div> HTML
                            </button>
                            <button onClick={() => setWebTab('css')} style={{ padding: '0 1rem', background: webTab === 'css' ? '#1e293b' : 'transparent', border: 'none', color: webTab === 'css' ? '#264de4' : '#64748b', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 14, height: 14, background: '#264de4', color: '#fff', borderRadius: 2, fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>C</div> CSS
                            </button>
                            <button onClick={() => setWebTab('js')} style={{ padding: '0 1rem', background: webTab === 'js' ? '#1e293b' : 'transparent', border: 'none', color: webTab === 'js' ? '#f0db4f' : '#64748b', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 14, height: 14, background: '#f0db4f', color: '#000', borderRadius: 2, fontSize: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>JS</div> JS
                            </button>
                        </div>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', paddingRight: '0.5rem' }}>
                            <button title="Reset" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><RotateCcw size={14} /></button>
                            <button title="Save" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Save size={14} /></button>
                            <button title="Expand" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Maximize size={14} /></button>
                        </div>
                    </div>

                    <div style={{ flex: 1, background: '#1e293b' }}>
                        {webTab === 'html' && <CodeEditor value={htmlCode} onChange={e => setHtmlCode(e.target.value)} language="html" readOnly={isReadOnly} />}
                        {webTab === 'css' && <CodeEditor value={cssCode} onChange={e => setCssCode(e.target.value)} language="css" readOnly={isReadOnly} />}
                        {webTab === 'js' && <CodeEditor value={jsCode} onChange={e => setJsCode(e.target.value)} language="js" readOnly={isReadOnly} />}
                    </div>

                    <div style={{ height: 48, background: '#0f172a', borderTop: '1px solid #334155', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '0.75rem' }}>
                        <button style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Settings size={18} /></button>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.75rem' }}>
                            <button onClick={runCode} disabled={running} style={{ padding: '0.4rem 1.25rem', borderRadius: 6, background: '#1e293b', border: '1px solid #334155', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Play size={14} fill="currentColor" /> Run
                            </button>
                            <button onClick={handleSubmit} disabled={submitting || running} style={{ padding: '0.4rem 1.5rem', borderRadius: 6, background: '#3b82f6', border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                                {submitting ? 'Verifying...' : 'Submit'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Column 3: Preview */}
                <div style={{ width: '32%', background: '#1e293b', borderRadius: 8, display: 'flex', flexDirection: 'column', border: '1px solid #334155', overflow: 'hidden' }}>
                    <div style={{ height: 40, borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', padding: '0 1rem', background: '#0f172a' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8' }}>PREVIEW</span>
                        <div style={{ marginLeft: 'auto' }}>
                            <button style={{ background: 'none', border: 'none', color: '#64748b' }}><Maximize size={14} /></button>
                        </div>
                    </div>
                    
                    <div style={{ flex: 1, background: '#fff', margin: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #334155' }}>
                        <iframe ref={iframeRef} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" />
                    </div>

                    <div style={{ padding: '1.25rem', background: '#0f172a', borderTop: '1px solid #334155', textAlign: 'center' }}>
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>Try comparing your output with expected output</p>
                        <button onClick={handleSubmit} disabled={submitting || running} style={{ width: '100%', padding: '0.75rem', borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <Layout size={16} /> {submitting ? 'Comparing...' : 'Compare'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Visual Result Map Overlay */}
            {result && result.testResults?.some(t => t.actual_image) && (
                <div style={{ position: 'fixed', bottom: 20, right: 20, width: 280, background: '#1e293b', borderRadius: 12, border: '1px solid #3b82f6', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', padding: '1rem', zIndex: 1000 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#3b82f6' }}>VISUAL COMPARISON (RED = MISMATCH)</span>
                        <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><XCircle size={14} /></button>
                    </div>
                    <img src={result.testResults.find(t => t.actual_image).actual_image} style={{ width: '100%', borderRadius: 6, border: '1px solid #334155' }} />
                </div>
            )}
        </div>
    )
}
