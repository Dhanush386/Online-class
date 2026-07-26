import { useState, useRef, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { useSearchParams } from 'react-router-dom'
import {
    Play, Settings, RotateCcw, Maximize2, Minimize2,
    Save, Folder, Trash2, X, Share2, Copy, Globe,
    Code as CodeIcon, Database, CheckCircle2, XCircle, Clock, Info
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import CodeEditor from '../../components/CodeEditor'

const LANGUAGE_CONFIG = {
    html: { id: 'web', name: 'Web', label: 'Web' },
    python: { id: 25, name: 'Python 3', label: 'Python 3', useExtra: true },
    java: { id: 91, name: 'Java', label: 'Java' },
    cpp: { id: 105, name: 'C++', label: 'C++' },
    c: { id: 103, name: 'C', label: 'C' },
    sql: { id: 82, name: 'SQL', label: 'SQL' }
}

const STARTER_CODE = {
    html: `<!DOCTYPE html>\n<html>\n  <head></head>\n  <body>\n    code\n  </body>\n</html>`,
    css: `body {\n  font-family: sans-serif;\n  padding: 20px;\n}`,
    js: `console.log("Ready to code!");`,
    python: `print("Hello, World!")`,
    java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`,
    cpp: `#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}`,
    c: `#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}`,
    sql: `-- Type your SQL query here\nSELECT * FROM users;`
}

// Icon for HTML5 Badge
function HtmlIcon() {
    return (
        <span style={{
            background: '#e34c26',
            color: 'white',
            fontWeight: 900,
            fontSize: '0.65rem',
            padding: '1px 4px',
            borderRadius: '3px',
            lineHeight: 1
        }}>
            5
        </span>
    )
}

// Icon for CSS3 Badge
function CssIcon() {
    return (
        <span style={{
            background: '#264de4',
            color: 'white',
            fontWeight: 900,
            fontSize: '0.65rem',
            padding: '1px 4px',
            borderRadius: '3px',
            lineHeight: 1
        }}>
            3
        </span>
    )
}

// Icon for JS Badge
function JsIcon() {
    return (
        <span style={{
            background: '#f7df1e',
            color: '#000000',
            fontWeight: 900,
            fontSize: '0.65rem',
            padding: '1px 4px',
            borderRadius: '3px',
            lineHeight: 1
        }}>
            JS
        </span>
    )
}

function WebTabButton({ activeTab, tabId, label, icon, onClick }) {
    const isActive = activeTab === tabId
    return (
        <button
            onClick={() => onClick(tabId)}
            style={{
                padding: '0.6rem 1.1rem',
                background: isActive ? '#0f172a' : 'transparent',
                border: 'none',
                color: isActive ? '#ffffff' : '#94a3b8',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                transition: 'all 0.15s ease'
            }}
        >
            {icon} {label}
        </button>
    )
}

WebTabButton.propTypes = {
    activeTab: PropTypes.string.isRequired,
    tabId: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    icon: PropTypes.node,
    onClick: PropTypes.func.isRequired,
}

function ResultView({ result, language }) {
    if (!result) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <Info size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.9rem' }}>Click "Run Code" to execute and see console output</p>
            </div>
        )
    }

    const isSuccess = result.status === 'success'
    const isError = result.status === 'error'

    let bg = '#0f172a'
    let borderColor = 'rgba(255,255,255,0.1)'
    let textColor = '#f8fafc'
    let Icon = <Clock className="animate-spin" color="#6366f1" />

    if (isSuccess) {
        bg = 'rgba(16, 185, 129, 0.1)'
        borderColor = 'rgba(16, 185, 129, 0.2)'
        textColor = '#10b981'
        Icon = <CheckCircle2 color="#10b981" />
    } else if (isError) {
        bg = 'rgba(239, 68, 68, 0.1)'
        borderColor = 'rgba(239, 68, 68, 0.2)'
        textColor = '#ef4444'
        Icon = <XCircle color="#ef4444" />
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
                padding: '1rem', borderRadius: 10,
                background: bg,
                border: `1px solid ${borderColor}`,
                display: 'flex', alignItems: 'center', gap: '0.85rem'
            }}>
                {Icon}
                <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: textColor }}>
                        {result.message || result.status.toUpperCase()}
                    </div>
                    {result.time && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Time: {result.time}s · Memory: {result.memory}KB</div>}
                </div>
            </div>
            {result.output && (
                <pre style={{ background: '#0b0f19', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: 8, fontSize: '0.85rem', overflowX: 'auto', fontFamily: 'monospace' }}>{result.output}</pre>
            )}
            {result.compile_output && (
                <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>Console Output</h4>
                        {language === 'python' && (
                            <div style={{ fontSize: '0.7rem', color: '#818cf8', background: 'rgba(99, 102, 241, 0.1)', padding: '0.25rem 0.6rem', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Info size={12} /> Memory Limit: 256MB
                            </div>
                        )}
                    </div>
                    <pre style={{ background: '#0b0f19', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.1)', padding: '1rem', borderRadius: 8, fontSize: '0.8rem', overflowX: 'auto' }}>{result.compile_output}</pre>
                </div>
            )}
        </div>
    )
}

ResultView.propTypes = {
    result: PropTypes.shape({
        status: PropTypes.string.isRequired,
        message: PropTypes.string,
        time: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        memory: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        output: PropTypes.string,
        compile_output: PropTypes.string,
    }),
    language: PropTypes.string,
}

export default function CodePlayground() {
    const [language, setLanguage] = useState('html')
    const [code, setCode] = useState(STARTER_CODE.python)
    const [htmlCode, setHtmlCode] = useState(STARTER_CODE.html)
    const [cssCode, setCssCode] = useState(STARTER_CODE.css)
    const [jsCode, setJsCode] = useState(STARTER_CODE.js)

    const [webTab, setWebTab] = useState('html') // 'html' | 'css' | 'js'
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState(null)
    const [stdin, setStdin] = useState('')

    // Settings
    const [fontSize, setFontSize] = useState('14px')
    const [showSettingsModal, setShowSettingsModal] = useState(false)

    // Fullscreen state
    const [isFullscreen, setIsFullscreen] = useState(false)
    const containerRef = useRef(null)

    // Resizable Splitter State
    const [leftWidthPercent, setLeftWidthPercent] = useState(50)
    const isDraggingRef = useRef(false)

    const { profile } = useAuth()
    const [savedSnippets, setSavedSnippets] = useState([])
    const [showSaveModal, setShowSaveModal] = useState(false)
    const [showLoadModal, setShowLoadModal] = useState(false)
    const [snippetTitle, setSnippetTitle] = useState('')
    const [saving, setSaving] = useState(false)

    const [showPublishModal, setShowPublishModal] = useState(false)
    const [publishTitle, setPublishTitle] = useState('')
    const [publishDesc, setPublishDesc] = useState('')
    const [publishSlug, setPublishSlug] = useState('')
    const [slugStatus, setSlugStatus] = useState('idle')
    const [publishing, setPublishing] = useState(false)
    const [publishedUrl, setPublishedUrl] = useState(null)

    const iframeRef = useRef(null)
    const [searchParams, setSearchParams] = useSearchParams()

    useEffect(() => {
        if (searchParams.get('view') === 'saved') {
            fetchSnippets()
            setShowLoadModal(true)
            const newParams = new URLSearchParams(searchParams)
            newParams.delete('view')
            setSearchParams(newParams, { replace: true })
        }
    }, [searchParams, profile])

    // Slug check for publishing
    useEffect(() => {
        if (!publishSlug) {
            setSlugStatus('idle')
            return
        }

        const isValid = /^[a-z0-9-]+$/.test(publishSlug)
        if (!isValid) {
            setSlugStatus('invalid')
            return
        }

        setSlugStatus('checking')
        const timer = setTimeout(async () => {
            try {
                const { data, error } = await supabase.rpc('check_slug_availability', { p_slug: publishSlug })
                if (error) throw error
                setSlugStatus(data ? 'available' : 'taken')
            } catch (err) {
                console.error('Slug check failed', err)
                setSlugStatus('idle')
            }
        }, 500)

        return () => clearTimeout(timer)
    }, [publishSlug])

    const fetchSnippets = async () => {
        if (!profile?.id) return
        const { data } = await supabase
            .from('saved_code_snippets')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
        if (data) setSavedSnippets(data)
    }

    const handleSave = async (e) => {
        e.preventDefault()
        if (!snippetTitle.trim() || !profile?.id) return
        setSaving(true)
        try {
            const codeToSave = language === 'html'
                ? JSON.stringify({ html: htmlCode, css: cssCode, js: jsCode })
                : code

            await supabase.from('saved_code_snippets').insert({
                user_id: profile.id,
                title: snippetTitle.trim(),
                language,
                code: codeToSave
            })
            setShowSaveModal(false)
            setSnippetTitle('')
            globalThis.alert('Code saved successfully!')
        } catch (err) {
            globalThis.alert('Failed to save code: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleLoad = (snippet) => {
        if (globalThis.confirm(`Load "${snippet.title}"? Your current code will be overwritten.`)) {
            setLanguage(snippet.language)
            if (snippet.language === 'html') {
                try {
                    const parsed = JSON.parse(snippet.code)
                    setHtmlCode(parsed.html || '')
                    setCssCode(parsed.css || '')
                    setJsCode(parsed.js || '')
                } catch (e) {
                    console.warn('Could not parse snippet as JSON', e)
                    setHtmlCode(snippet.code)
                }
            } else {
                setCode(snippet.code)
            }
            setShowLoadModal(false)
            setResult(null)
        }
    }

    const handleDeleteSnippet = async (id) => {
        if (globalThis.confirm('Delete this saved snippet?')) {
            await supabase.from('saved_code_snippets').delete().eq('id', id)
            fetchSnippets()
        }
    }

    const publishProject = async (e) => {
        e.preventDefault()
        if (!publishTitle.trim() || !profile?.id) return
        if (slugStatus !== 'available') {
            globalThis.alert('Please choose a valid and available URL slug.')
            return
        }

        setPublishing(true)

        try {
            const finalUrl = `https://${publishSlug}.learnovas.in`
            const { data, error } = await supabase.from('published_projects').insert({
                user_id: profile.id,
                title: publishTitle.trim(),
                description: publishDesc.trim() || null,
                slug: publishSlug,
                subdomain: publishSlug,
                published_url: finalUrl,
                html: htmlCode,
                css: cssCode,
                js: jsCode
            }).select('id, slug').single()

            if (error) throw error
            if (data) {
                const isLocalhost = globalThis.location.hostname === 'localhost' || globalThis.location.hostname === '127.0.0.1'
                const successUrl = isLocalhost
                    ? `${globalThis.location.origin}/p/${data.slug}`
                    : finalUrl

                setPublishedUrl(successUrl)
                setPublishTitle('')
                setPublishDesc('')
                setPublishSlug('')
                setSlugStatus('idle')
            }
        } catch (err) {
            globalThis.alert('Failed to publish project: ' + err.message)
        } finally {
            setPublishing(false)
        }
    }

    const handleLanguageChange = (newLang) => {
        setLanguage(newLang)
        if (newLang === 'html') {
            setHtmlCode(STARTER_CODE.html)
            setCssCode(STARTER_CODE.css)
            setJsCode(STARTER_CODE.js)
        } else {
            setCode(STARTER_CODE[newLang] || '')
        }
        setResult(null)
    }

    const handleReset = () => {
        if (globalThis.confirm('Reset current code to starter template?')) {
            if (language === 'html') {
                setHtmlCode(STARTER_CODE.html)
                setCssCode(STARTER_CODE.css)
                setJsCode(STARTER_CODE.js)
                updatePreview()
            } else {
                setCode(STARTER_CODE[language] || '')
                setResult(null)
            }
        }
    }

    const getCombinedWebCode = useCallback(() => {
        let finalHtml = htmlCode || ''
        const cssInject = `<style>\n${cssCode || ''}\n</style>`
        const jsInject = `<script>\n${jsCode || ''}\n</script>`

        if (finalHtml.includes('</head>')) {
            finalHtml = finalHtml.replace('</head>', `${cssInject}</head>`)
        } else if (finalHtml.includes('<body>')) {
            finalHtml = finalHtml.replace('<body>', `<body>${cssInject}`)
        } else {
            finalHtml = cssInject + finalHtml
        }

        if (finalHtml.includes('</body>')) {
            finalHtml = finalHtml.replace('</body>', `${jsInject}</body>`)
        } else {
            finalHtml = finalHtml + jsInject
        }
        return finalHtml
    }, [htmlCode, cssCode, jsCode])

    const updatePreview = useCallback(() => {
        if (iframeRef.current) {
            const doc = iframeRef.current.contentDocument
            if (doc) {
                doc.open()
                doc.write(getCombinedWebCode())
                doc.close()
            }
        }
    }, [getCombinedWebCode])

    // Update iframe preview when web code changes or run is triggered
    useEffect(() => {
        if (language === 'html') {
            updatePreview()
        }
    }, [language, updatePreview])

    const runCode = async () => {
        if (language === 'html') {
            updatePreview()
            return
        }

        setRunning(true)
        setResult({ status: 'running', message: 'Executing code...' })

        try {
            const config = LANGUAGE_CONFIG[language] || { id: 100 }
            const baseUrl = config.useExtra ? 'https://extra-ce.judge0.com' : 'https://ce.judge0.com'

            const response = await fetch(`${baseUrl}/submissions?base64_encoded=false&wait=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_code: code,
                    language_id: config.id,
                    stdin: stdin
                })
            })

            const data = await response.json()

            if (data.status?.id === 3) {
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

    const toggleFullscreen = () => {
        setIsFullscreen(prev => !prev)
    }

    // Splitter Dragging handlers
    const handleMouseDown = (e) => {
        e.preventDefault()
        isDraggingRef.current = true
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    const handleMouseMove = (e) => {
        if (!isDraggingRef.current || !containerRef.current) return
        const containerRect = containerRef.current.getBoundingClientRect()
        const newLeftPx = e.clientX - containerRect.left
        let newPercent = (newLeftPx / containerRect.width) * 100
        if (newPercent < 20) newPercent = 20
        if (newPercent > 80) newPercent = 80
        setLeftWidthPercent(newPercent)
    }

    const handleMouseUp = () => {
        isDraggingRef.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
    }

    return (
        <div
            ref={containerRef}
            className="animate-fade-in"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: isFullscreen ? '100vh' : 'calc(100vh - 100px)',
                position: isFullscreen ? 'fixed' : 'relative',
                inset: isFullscreen ? 0 : 'auto',
                zIndex: isFullscreen ? 9999 : 1,
                background: '#090d16',
                color: '#ffffff',
                overflow: 'hidden'
            }}
        >
            {/* TOP HEADER BAR */}
            <div style={{
                height: '48px',
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                padding: '0 1rem',
                color: '#1e293b',
                flexShrink: 0
            }}>
                {/* Left: Language Select Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <select
                            value={language}
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            style={{
                                appearance: 'none',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '0.35rem 2rem 0.35rem 0.85rem',
                                fontSize: '0.875rem',
                                fontWeight: 600,
                                color: '#0f172a',
                                cursor: 'pointer',
                                outline: 'none'
                            }}
                        >
                            {Object.entries(LANGUAGE_CONFIG).map(([id, config]) => (
                                <option key={id} value={id}>{config.name}</option>
                            ))}
                        </select>
                        <span style={{ position: 'absolute', right: '0.65rem', pointerEvents: 'none', fontSize: '0.75rem', color: '#64748b' }}>
                            ▼
                        </span>
                    </div>
                </div>

                {/* Right: Header Icons Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {language === 'html' && (
                        <button
                            onClick={() => { setPublishedUrl(null); setShowPublishModal(true); }}
                            title="Publish Project"
                            style={{
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                            }}
                        >
                            <Share2 size={14} /> Publish
                        </button>
                    )}

                    <button
                        onClick={() => setShowSaveModal(true)}
                        title="Save Snippet"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#475569',
                            padding: '0.4rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <Save size={18} />
                    </button>

                    <button
                        onClick={() => { fetchSnippets(); setShowLoadModal(true); }}
                        title="My Code Snippets"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#475569',
                            padding: '0.4rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <Folder size={18} />
                    </button>

                    <button
                        onClick={() => setShowSettingsModal(true)}
                        title="Settings"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#475569',
                            padding: '0.4rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <Settings size={18} />
                    </button>

                    <button
                        onClick={handleReset}
                        title="Reset Code"
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#475569',
                            padding: '0.4rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <RotateCcw size={18} />
                    </button>

                    <button
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#475569',
                            padding: '0.4rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                </div>
            </div>

            {/* MAIN WORKSPACE AREA */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {/* LEFT PANE: CODE EDITOR */}
                <div
                    style={{
                        width: `${leftWidthPercent}%`,
                        display: 'flex',
                        flexDirection: 'column',
                        background: '#0b0f19',
                        position: 'relative'
                    }}
                >
                    {/* Editor Tab Bar (For Web Mode) */}
                    {language === 'html' ? (
                        <div style={{
                            background: '#090d16',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            display: 'flex',
                            alignItems: 'center'
                        }}>
                            <WebTabButton activeTab={webTab} tabId="html" label="HTML" icon={<HtmlIcon />} onClick={setWebTab} />
                            <WebTabButton activeTab={webTab} tabId="css" label="CSS" icon={<CssIcon />} onClick={setWebTab} />
                            <WebTabButton activeTab={webTab} tabId="js" label="JAVASCRIPT" icon={<JsIcon />} onClick={setWebTab} />
                        </div>
                    ) : (
                        <div style={{
                            background: '#090d16',
                            padding: '0.6rem 1.1rem',
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#94a3b8',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            {LANGUAGE_CONFIG[language]?.name || 'Editor'}
                        </div>
                    )}

                    {/* Code Editor Container */}
                    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                        {language === 'html' ? (
                            <>
                                {webTab === 'html' && (
                                    <CodeEditor
                                        value={htmlCode}
                                        onChange={e => setHtmlCode(e.target.value)}
                                        language="html"
                                        placeholder="<!-- Write HTML code here -->"
                                        fontSize={fontSize}
                                    />
                                )}
                                {webTab === 'css' && (
                                    <CodeEditor
                                        value={cssCode}
                                        onChange={e => setCssCode(e.target.value)}
                                        language="css"
                                        placeholder="/* Write CSS code here */"
                                        fontSize={fontSize}
                                    />
                                )}
                                {webTab === 'js' && (
                                    <CodeEditor
                                        value={jsCode}
                                        onChange={e => setJsCode(e.target.value)}
                                        language="js"
                                        placeholder="// Write JavaScript code here"
                                        fontSize={fontSize}
                                    />
                                )}
                            </>
                        ) : (
                            <CodeEditor
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                language={language}
                                placeholder="Write your code here..."
                                fontSize={fontSize}
                            />
                        )}

                        {/* FLOATING RUN CODE BUTTON (Bottom Right of Left Pane) */}
                        <div style={{ position: 'absolute', bottom: '1rem', right: '1.25rem', zIndex: 10 }}>
                            <button
                                onClick={runCode}
                                disabled={running}
                                style={{
                                    background: '#2563eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '24px',
                                    padding: '0.55rem 1.4rem',
                                    fontSize: '0.875rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                                    transition: 'transform 0.15s ease, background 0.15s ease'
                                }}
                            >
                                {running ? <Clock size={16} className="animate-spin" /> : <Play size={16} fill="white" />} Run Code
                            </button>
                        </div>
                    </div>

                    {/* STDIN Input for non-web code */}
                    {language !== 'html' && (
                        <div style={{ height: '110px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '0.35rem 1rem', background: '#090d16', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8' }}>
                                STDIN (PROGRAM INPUT)
                            </div>
                            <textarea
                                value={stdin}
                                onChange={e => setStdin(e.target.value)}
                                placeholder="Enter input values here..."
                                style={{ flex: 1, padding: '0.75rem', border: 'none', outline: 'none', resize: 'none', fontSize: '0.85rem', background: '#0b0f19', color: '#f8fafc', fontFamily: 'monospace' }}
                            />
                        </div>
                    )}
                </div>

                {/* RESIZABLE SPLITTER */}
                <div
                    onMouseDown={handleMouseDown}
                    style={{
                        width: '8px',
                        background: '#1e293b',
                        borderLeft: '1px solid rgba(255,255,255,0.06)',
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                        cursor: 'col-resize',
                        display: 'flex',
                        alignItems: 'center',
                        justify: 'center',
                        userSelect: 'none',
                        zIndex: 5
                    }}
                    title="Drag to resize panels"
                >
                    <div style={{ width: '2px', height: '24px', background: '#475569', borderRadius: '1px' }} />
                </div>

                {/* RIGHT PANE: LIVE PREVIEW / CONSOLE */}
                <div
                    style={{
                        width: `${100 - leftWidthPercent}%`,
                        display: 'flex',
                        flexDirection: 'column',
                        background: '#ffffff',
                        position: 'relative'
                    }}
                >
                    {language === 'html' ? (
                        <iframe
                            ref={iframeRef}
                            title="live-preview"
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                background: '#ffffff'
                            }}
                        />
                    ) : (
                        <div style={{ flex: 1, background: '#0b0f19', padding: '1.25rem', overflowY: 'auto' }}>
                            <ResultView result={result} language={language} />
                        </div>
                    )}
                </div>
            </div>

            {/* SETTINGS MODAL */}
            {showSettingsModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="glass-card animate-scale-up" style={{ width: 380, padding: '1.75rem', background: '#0f172a', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Editor Settings</h3>
                            <button onClick={() => setShowSettingsModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>Font Size</label>
                                <select
                                    value={fontSize}
                                    onChange={e => setFontSize(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: 'white', outline: 'none' }}
                                >
                                    <option value="12px">12px - Small</option>
                                    <option value="14px">14px - Normal (Default)</option>
                                    <option value="16px">16px - Medium</option>
                                    <option value="18px">18px - Large</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button onClick={() => setShowSettingsModal(false)} style={{ padding: '0.5rem 1.25rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                                    Done
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SAVE CODE MODAL */}
            {showSaveModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="glass-card animate-scale-up" style={{ width: 400, padding: '1.75rem', background: '#0f172a', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Save Code Snippet</h2>
                        <form onSubmit={handleSave}>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label htmlFor="snippet-title-input" className="form-label" style={{ color: '#94a3b8' }}>Snippet Title</label>
                                <input
                                    id="snippet-title-input"
                                    name="title"
                                    type="text"
                                    required
                                    className="form-input"
                                    style={{ background: '#1e293b', color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}
                                    value={snippetTitle}
                                    onChange={e => setSnippetTitle(e.target.value)}
                                    placeholder="e.g. My Web Component"
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setShowSaveModal(false)} className="btn-secondary">Cancel</button>
                                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Snippet'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LOAD CODE MODAL */}
            {showLoadModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="glass-card animate-scale-up" style={{ width: 600, maxHeight: '80vh', padding: '1.75rem', background: '#0f172a', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>My Saved Snippets</h2>
                            <button onClick={() => setShowLoadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                            {savedSnippets.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                    <Folder size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                    <p>You haven't saved any code snippets yet.</p>
                                </div>
                            ) : (
                                savedSnippets.map(snippet => (
                                    <div key={snippet.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>{snippet.title}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                                                {LANGUAGE_CONFIG[snippet.language]?.name || snippet.language} • {new Date(snippet.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button onClick={() => handleLoad(snippet)} className="btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Load</button>
                                            <button onClick={() => handleDeleteSnippet(snippet.id)} className="btn-danger" style={{ padding: '0.4rem', fontSize: '0.8rem' }} title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* PUBLISH MODAL */}
            {showPublishModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
                    <div className="glass-card animate-scale-up" style={{ width: 450, padding: '1.75rem', background: '#0f172a', color: '#ffffff', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Globe size={20} color="#10b981" /> Publish Web Project
                        </h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            Make your project public. Anyone with the link will be able to view it.
                        </p>

                        {publishedUrl ? (
                            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1.5rem', borderRadius: 12, textAlign: 'center' }}>
                                <h3 style={{ color: '#10b981', fontWeight: 700, marginBottom: '1rem' }}>Project Published! 🎉</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', marginBottom: '1rem' }}>
                                    <input type="text" readOnly value={publishedUrl} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8rem', color: '#ffffff' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                    <button onClick={() => { globalThis.navigator.clipboard.writeText(publishedUrl); globalThis.alert("Copied!"); }} className="btn-primary" style={{ padding: '0.5rem 1.5rem', background: '#10b981' }}>
                                        <Copy size={16} /> Copy Link
                                    </button>
                                    <button onClick={() => setShowPublishModal(false)} className="btn-secondary">Close</button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={publishProject}>
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label htmlFor="publish-name-input" className="form-label" style={{ color: '#94a3b8' }}>Project Name</label>
                                    <input
                                        id="publish-name-input"
                                        name="title"
                                        type="text"
                                        required
                                        className="form-input"
                                        style={{ background: '#1e293b', color: 'white', borderColor: 'rgba(255,255,255,0.1)' }}
                                        value={publishTitle}
                                        onChange={e => setPublishTitle(e.target.value)}
                                        placeholder="Weather App"
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label htmlFor="publish-slug-input" className="form-label" style={{ color: '#94a3b8' }}>Custom URL Slug</label>
                                    <div style={{ display: 'flex', alignItems: 'center', background: '#1e293b', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', paddingRight: '1rem', overflow: 'hidden' }}>
                                        <input
                                            id="publish-slug-input"
                                            name="slug"
                                            type="text"
                                            required
                                            className="form-input"
                                            style={{ border: 'none', background: 'transparent', flex: 1, color: 'white' }}
                                            value={publishSlug}
                                            onChange={e => setPublishSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                            placeholder="weather-app"
                                        />
                                        <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>.learnovas.in</span>
                                    </div>
                                    {publishSlug && (
                                        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {slugStatus === 'checking' && <span style={{ color: '#9ca3af' }}>Checking availability...</span>}
                                            {slugStatus === 'invalid' && <span style={{ color: '#ef4444' }}>❌ Invalid format</span>}
                                            {slugStatus === 'taken' && <span style={{ color: '#ef4444' }}>❌ Already taken</span>}
                                            {slugStatus === 'available' && <span style={{ color: '#10b981' }}>✅ Available!</span>}
                                        </div>
                                    )}
                                </div>
                                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                    <label htmlFor="publish-desc-input" className="form-label" style={{ color: '#94a3b8' }}>Description (Optional)</label>
                                    <textarea
                                        id="publish-desc-input"
                                        name="description"
                                        className="form-input"
                                        style={{ background: '#1e293b', color: 'white', borderColor: 'rgba(255,255,255,0.1)', minHeight: 70, resize: 'vertical' }}
                                        value={publishDesc}
                                        onChange={e => setPublishDesc(e.target.value)}
                                        placeholder="What is this project about?"
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
            )}
        </div>
    )
}
