import { Maximize, Layout, XCircle, Camera, AlertCircle } from 'lucide-react'
import PropTypes from 'prop-types'

const getResultColors = (status) => {
    if (status === 'error') return { bg: '#450a0a', text: '#fca5a5', genericText: '#ef4444' }
    if (status === 'warning') return { bg: '#451a03', text: '#fcd34d', genericText: '#fcd34d' }
    if (status === 'success') return { bg: '#052e16', text: '#86efac', genericText: '#10b981' }
    return { bg: '#052e16', text: '#86efac', genericText: 'var(--text-muted)' }
}

export function WorkspaceOutput({
    challenge,
    iframeRef,
    result,
    setResult,
    handleSubmit,
    submitting,
    running,
    faceDetected,
    isStarted,
    cameraEnabled,
    canBypass,
    BYPASS_PROCTORING,
    showUnlockModal,
    setShowUnlockModal,
    handleUnlockAnswer
}) {
    const colors = result ? getResultColors(result.status) : {};

    const renderHtmlOutput = () => (
        <>
            <div style={{ flex: 1, background: '#fff', margin: '1rem 1rem 0 1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--card-border)', minHeight: 0 }}>
                <iframe ref={iframeRef} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" />
            </div>
            {/* Keyword hint / result message strip */}
            {result?.message && (
                <div style={{ margin: '0 1rem', padding: '0.6rem 0.85rem', background: colors.bg, borderRadius: 6, maxHeight: 90, overflowY: 'auto' }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.7rem', color: colors.text, margin: 0, lineHeight: 1.5 }}>{result.message}</pre>
                </div>
            )}
            <div style={{ padding: '0.85rem 1.25rem 1.25rem', background: 'var(--text-primary)', borderTop: '1px solid var(--card-border)', textAlign: 'center' }}>
                <button onClick={handleSubmit} disabled={submitting || running} style={{ width: '100%', padding: '0.85rem', borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <Layout size={16} /> {submitting ? 'Comparing...' : 'Compare & Submit'}
                </button>
            </div>
        </>
    );

    const renderClassicOutput = () => (
        <div style={{ flex: 1, padding: '1rem', background: 'var(--text-primary)', overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.85rem', color: '#e2e8f0' }}>
            {result ? (
                <div style={{ color: colors.genericText }}>
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{result.message}</pre>
                </div>
            ) : (
                <div style={{ color: 'var(--text-muted)' }}>Code output will appear here...</div>
            )}
        </div>
    );

    const renderVisualResultOverlay = () => {
        if (!result?.testResults?.some(t => t.actual_image)) return null;
        return (
            <div style={{ position: 'fixed', bottom: 20, right: 20, width: 280, background: '#ffffff', borderRadius: 12, border: '1px solid #3b82f6', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', padding: '1rem', zIndex: 1000 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#3b82f6' }}>VISUAL COMPARISON (RED = MISMATCH)</span>
                    <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><XCircle size={14} /></button>
                </div>
                <img src={result.testResults.find(t => t.actual_image).actual_image} style={{ width: '100%', borderRadius: 6, border: '1px solid #e2e8f0' }} alt="Diff" />
            </div>
        );
    };

    const renderUnlockModal = () => {
        if (!showUnlockModal) return null;
        return (
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
        );
    };

    const renderFaceNotDetected = () => {
        if (faceDetected || !isStarted || !cameraEnabled || canBypass || BYPASS_PROCTORING) return null;
        return (
            <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.95)', backdropFilter: 'blur(15px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', flexDirection: 'column' }}>
                <div style={{ width: 100, height: 100, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', color: '#ef4444', animation: 'pulse 2s infinite' }}>
                    <Camera size={50} />
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', marginBottom: '1rem', textAlign: 'center' }}>Face Not Detected</h1>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.2rem', maxWidth: 600, textAlign: 'center', lineHeight: 1.6 }}>
                    AI Proctoring has lost track of your face. Please ensure you are looking directly at the camera and your face is well-lit to continue.
                </p>
            </div>
        );
    };

    return (
        <>
            <div style={{ width: '32%', background: 'var(--text-primary)', borderRadius: 8, display: 'flex', flexDirection: 'column', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
                <div style={{ height: 40, borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', padding: '0 1rem', background: 'var(--text-primary)' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)' }}>{challenge.language === 'html' ? 'PREVIEW' : 'OUTPUT'}</span>
                    <div style={{ marginLeft: 'auto' }}>
                        <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><Maximize size={14} /></button>
                    </div>
                </div>
                
                {challenge.language === 'html' ? renderHtmlOutput() : renderClassicOutput()}
            </div>

            {renderVisualResultOverlay()}
            {renderUnlockModal()}
            {renderFaceNotDetected()}
        </>
    )
}

WorkspaceOutput.propTypes = {
    challenge: PropTypes.shape({
        language: PropTypes.string
    }),
    iframeRef: PropTypes.oneOfType([
        PropTypes.func, 
        PropTypes.shape({ current: PropTypes.any })
    ]),
    result: PropTypes.shape({
        status: PropTypes.string,
        message: PropTypes.string,
        testResults: PropTypes.arrayOf(PropTypes.shape({
            actual_image: PropTypes.string
        }))
    }),
    setResult: PropTypes.func,
    handleSubmit: PropTypes.func,
    submitting: PropTypes.bool,
    running: PropTypes.bool,
    faceDetected: PropTypes.bool,
    isStarted: PropTypes.bool,
    cameraEnabled: PropTypes.bool,
    canBypass: PropTypes.bool,
    BYPASS_PROCTORING: PropTypes.bool,
    showUnlockModal: PropTypes.bool,
    setShowUnlockModal: PropTypes.func,
    handleUnlockAnswer: PropTypes.func
}
