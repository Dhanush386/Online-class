import PropTypes from 'prop-types'
import { Maximize, RotateCcw, Save, Settings, Play, Code as CodeIcon } from 'lucide-react'
import CodeEditor from '../../../../components/CodeEditor'

const LANGUAGE_CONFIG = {
    python: { id: 25, name: 'Python 3', icon: <CodeIcon size={16} />, useExtra: true },
    python_ml: { id: 25, name: 'Python (Scientific)', icon: <CodeIcon size={16} />, useExtra: true },
    java: { id: 91, name: 'Java', icon: <CodeIcon size={16} /> },
    cpp: { id: 105, name: 'C++', icon: <CodeIcon size={16} /> },
    c: { id: 103, name: 'C', icon: <CodeIcon size={16} /> },
    sql: { id: 82, name: 'SQL', icon: <CodeIcon size={16} /> },
    html: { id: 'web', name: 'Web', icon: <CodeIcon size={16} /> }
}

export function WorkspaceEditor({
    challenge,
    webTab,
    setWebTab,
    htmlCode,
    setHtmlCode,
    cssCode,
    setCssCode,
    jsCode,
    setJsCode,
    genericCode,
    setGenericCode,
    isCombined,
    handleSubCodeChange,
    isReadOnly,
    runCode,
    handleSubmit,
    running,
    submitting
}) {
    return (
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
            <div style={{ height: 48, background: 'var(--text-primary)', borderTop: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '0.85rem' }}>
                <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Settings size={18} /></button>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.85rem' }}>
                    <button onClick={runCode} disabled={running} style={{ padding: '0.4rem 1.25rem', borderRadius: 6, background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Play size={14} fill="currentColor" /> Run
                    </button>
                    <button onClick={handleSubmit} disabled={submitting || running} style={{ padding: '0.4rem 1.5rem', borderRadius: 6, background: '#3b82f6', border: 'none', color: '#fff', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                        {submitting ? 'Verifying...' : 'Submit'}
                    </button>
                </div>
            </div>
        </div>
    )
}

WorkspaceEditor.propTypes = {
    challenge: PropTypes.shape({
        language: PropTypes.string
    }),
    webTab: PropTypes.string,
    setWebTab: PropTypes.func,
    htmlCode: PropTypes.string,
    setHtmlCode: PropTypes.func,
    cssCode: PropTypes.string,
    setCssCode: PropTypes.func,
    jsCode: PropTypes.string,
    setJsCode: PropTypes.func,
    genericCode: PropTypes.string,
    setGenericCode: PropTypes.func,
    isCombined: PropTypes.bool,
    handleSubCodeChange: PropTypes.func,
    isReadOnly: PropTypes.bool,
    runCode: PropTypes.func,
    handleSubmit: PropTypes.func,
    running: PropTypes.bool,
    submitting: PropTypes.bool
}
