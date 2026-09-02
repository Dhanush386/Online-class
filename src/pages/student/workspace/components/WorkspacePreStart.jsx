import { Link } from 'react-router-dom'
import { Lock, Camera, CheckCircle2, ShieldAlert } from 'lucide-react'
import PropTypes from 'prop-types'

export function WorkspacePreStart({
    isStarted,
    canBypass,
    BYPASS_PROCTORING,
    requiresReentry,
    securityAlert,
    violationCount,
    cameraEnabled,
    startCamera,
    enterFullScreen,
    handleStartChallenge,
    challenge,
    setSecurityAlert,
    setRequiresReentry
}) {
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
                    
                    {cameraEnabled ? (
                        <div style={{ marginBottom: '1rem' }}>
                            <div style={{ background: '#ecfdf5', color: '#059669', padding: '0.85rem', borderRadius: 8, fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 600 }}>
                                <CheckCircle2 size={18} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.25rem' }} /> Webcam Enabled & AI Ready
                            </div>
                            <button onClick={enterFullScreen} className="btn-primary" style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem', justifyContent: 'center' }}>
                                Enter Secure Mode & Start
                            </button>
                        </div>
                    ) : (
                        <button onClick={startCamera} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', height: '3.5rem', fontSize: '1.1rem', marginBottom: '1rem', border: '1px solid #6366f1', color: '#6366f1' }}>
                            <Camera size={20} style={{ marginRight: '0.5rem' }} /> Enable Webcam to Continue
                        </button>
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

    return null;
}

WorkspacePreStart.propTypes = {
    isStarted: PropTypes.bool,
    canBypass: PropTypes.bool,
    BYPASS_PROCTORING: PropTypes.bool,
    requiresReentry: PropTypes.bool,
    securityAlert: PropTypes.string,
    violationCount: PropTypes.number,
    cameraEnabled: PropTypes.bool,
    startCamera: PropTypes.func,
    enterFullScreen: PropTypes.func,
    handleStartChallenge: PropTypes.func,
    challenge: PropTypes.shape({
        title: PropTypes.string
    }),
    setSecurityAlert: PropTypes.func,
    setRequiresReentry: PropTypes.func
}
