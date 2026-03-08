import { useState, useRef } from 'react'
import {
    Play, Eye, Code as CodeIcon, Database, Globe,
    CheckCircle2, XCircle, Clock, Info, RotateCcw
} from 'lucide-react'

const LANGUAGE_CONFIG = {
    python: { id: 100, name: 'Python 3', icon: <CodeIcon size={16} /> },
    java: { id: 91, name: 'Java', icon: <CodeIcon size={16} /> },
    cpp: { id: 105, name: 'C++', icon: <CodeIcon size={16} /> },
    c: { id: 103, name: 'C', icon: <CodeIcon size={16} /> },
    sql: { id: 82, name: 'SQL', icon: <Database size={16} /> },
    html: { id: 'web', name: 'Web', icon: <Globe size={16} /> }
}

const STARTER_CODE = {
    python: 'print("Hello, World!")',
    java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
    cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
    c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
    sql: '-- Type your SQL query here\nSELECT * FROM users;',
    html: '<!DOCTYPE html>\n<html>\n<head>\n<style>\n  body { font-family: sans-serif; text-align: center; }\n  h1 { color: #6366f1; }\n</style>\n</head>\n<body>\n  <h1>Hello from Playground!</h1>\n</body>\n</html>'
}

export default function CodePlayground() {
    const [language, setLanguage] = useState('python')
    const [code, setCode] = useState(STARTER_CODE.python)
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState(null)
    const [activeTab, setActiveTab] = useState('output') // 'output', 'preview'
    const [stdin, setStdin] = useState('')

    const iframeRef = useRef(null)

    const handleLanguageChange = (newLang) => {
        if (confirm('Switching languages will reset your current code. Continue?')) {
            setLanguage(newLang)
            setCode(STARTER_CODE[newLang])
            setResult(null)
            if (newLang === 'html') setActiveTab('preview')
            else setActiveTab('output')
        }
    }

    const runCode = async () => {
        setRunning(true)
        setResult({ status: 'running', message: 'Executing code...' })
        if (language !== 'html') setActiveTab('output')

        if (language === 'html') {
            updatePreview()
            setResult({ status: 'success', message: 'Preview updated' })
            setRunning(false)
            setActiveTab('preview')
            return
        }

        try {
            const response = await fetch('https://ce.judge0.com/submissions?base64_encoded=false&wait=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_code: code,
                    language_id: LANGUAGE_CONFIG[language].id,
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

    const updatePreview = () => {
        if (iframeRef.current) {
            const document = iframeRef.current.contentDocument
            document.open()
            document.write(code)
            document.close()
        }
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Code Playground</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Experiment and test your code snippets instantly</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select
                        value={language}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                        className="form-input"
                        style={{ width: 'auto', padding: '0.5rem 2rem 0.5rem 1rem', background: '#fff' }}
                    >
                        {Object.entries(LANGUAGE_CONFIG).map(([id, config]) => (
                            <option key={id} value={id}>{config.name}</option>
                        ))}
                    </select>
                    <button onClick={runCode} disabled={running} className="btn-primary" style={{ gap: '0.5rem' }}>
                        {running ? <Clock size={18} className="animate-spin" /> : <Play size={18} />} Run Code
                    </button>
                </div>
            </div>

            <div className="glass-card" style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 0 }}>
                {/* Left: Input (Code and Stdin) */}
                <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e293b' }}>
                        <div style={{ padding: '0.6rem 1rem', background: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
                                Playground Editor
                            </span>
                            <button onClick={() => setCode(STARTER_CODE[language])} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem' }}>
                                <RotateCcw size={12} /> Reset
                            </button>
                        </div>
                        <textarea
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            spellCheck={false}
                            style={{
                                flex: 1, width: '100%', background: '#1e293b', color: '#e2e8f0',
                                border: 'none', outline: 'none', padding: '1.5rem', fontSize: '1rem',
                                fontFamily: 'monospace', lineHeight: 1.5, resize: 'none',
                                whiteSpace: 'pre',
                                overflowX: 'auto'
                            }}
                        />
                    </div>
                    {language !== 'html' && (
                        <div style={{ height: '120px', borderTop: '4px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '0.4rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>
                                STDIN (INPUT)
                            </div>
                            <textarea
                                value={stdin}
                                onChange={e => setStdin(e.target.value)}
                                placeholder="Paste input here if your code expects any..."
                                style={{ flex: 1, padding: '0.75rem', border: 'none', outline: 'none', resize: 'none', fontSize: '0.85rem' }}
                            />
                        </div>
                    )}
                </div>

                {/* Right: Output/Preview */}
                <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', background: '#fff' }}>
                    <div style={{ height: 44, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', gap: '1rem', height: '100%', px: '1rem', marginLeft: '1rem' }}>
                            <button
                                onClick={() => setActiveTab('output')}
                                style={{
                                    border: 'none', background: 'none',
                                    color: activeTab === 'output' ? 'var(--accent)' : '#64748b',
                                    fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                                    height: '100%', borderBottom: activeTab === 'output' ? '2px solid var(--accent)' : 'none',
                                    padding: '0 0.5rem'
                                }}
                            >
                                CONSOLE
                            </button>
                            {language === 'html' && (
                                <button
                                    onClick={() => setActiveTab('preview')}
                                    style={{
                                        border: 'none', background: 'none',
                                        color: activeTab === 'preview' ? 'var(--accent)' : '#64748b',
                                        fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                                        height: '100%', borderBottom: activeTab === 'preview' ? '2px solid var(--accent)' : 'none',
                                        padding: '0 0.5rem'
                                    }}
                                >
                                    PREVIEW
                                </button>
                            )}
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                        {activeTab === 'preview' ? (
                            <iframe ref={iframeRef} style={{ width: '100%', height: '100%', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white' }} title="playground-preview" />
                        ) : (
                            <div>
                                {!result ? (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                        <Info size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                                        <p style={{ fontSize: '0.9rem' }}>Run your code to see results here</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{
                                            padding: '1rem', borderRadius: 10,
                                            background: result.status === 'success' ? '#f0fdf4' : result.status === 'error' ? '#fef2f2' : '#f8fafc',
                                            border: `1px solid ${result.status === 'success' ? '#10b98140' : result.status === 'error' ? '#ef444440' : '#e2e8f0'}`,
                                            display: 'flex', alignItems: 'center', gap: '0.75rem'
                                        }}>
                                            {result.status === 'success' ? <CheckCircle2 color="#10b981" /> : result.status === 'error' ? <XCircle color="#ef4444" /> : <Clock className="animate-spin" color="#6366f1" />}
                                            <div>
                                                <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{result.message || result.status.toUpperCase()}</div>
                                                {result.time && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Time: {result.time}s · Memory: {result.memory}KB</div>}
                                            </div>
                                        </div>
                                        {result.output && (
                                            <pre style={{ background: '#f1f5f9', color: '#1e293b', padding: '1rem', borderRadius: 8, fontSize: '0.85rem', overflowX: 'auto', fontFamily: 'monospace' }}>{result.output}</pre>
                                        )}
                                        {result.compile_output && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>COMPILATION</div>
                                                <pre style={{ background: '#1e293b', color: '#e2e8f0', padding: '1rem', borderRadius: 8, fontSize: '0.8rem', overflowX: 'auto' }}>{result.compile_output}</pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
