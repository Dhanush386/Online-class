import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getFaceDescriptor, compareFaces, loadModels } from '../../utils/faceRecognition'
import { Camera, ShieldCheck, ShieldAlert, RefreshCw, X, Fingerprint, Scan, AlertTriangle } from 'lucide-react'

export default function FaceVerificationModal() {
    const { profile, setIsFaceVerifiedToday, signOut } = useAuth()
    const [status, setStatus] = useState('loading') // loading, ready, scanning, success, failed, limit_reached
    const [mode, setMode] = useState(profile?.face_descriptor ? 'verify' : 'register')
    const [attempts, setAttempts] = useState(profile?.daily_face_attempts || 0)
    const [error, setError] = useState('')
    const videoRef = useRef(null)
    const streamRef = useRef(null)
    const [isModelsLoaded, setIsModelsLoaded] = useState(false)

    const MAX_ATTEMPTS = 15

    useEffect(() => {
        init()
        return () => stopCamera()
    }, [])

    async function init() {
        try {
            await loadModels()
            setIsModelsLoaded(true)
            await startCamera()
            setStatus('ready')
        } catch (err) {
            console.error('Face init error:', err)
            setError('Failed to initialize camera or models.')
            setStatus('failed')
        }
    }

    async function startCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                streamRef.current = stream
            }
        } catch (err) {
            console.error('Camera error:', err)
            setError('Could not access camera. Please check permissions.')
            throw err
        }
    }

    function stopCamera() {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
        }
    }

    async function handleAction() {
        if (status === 'scanning') return
        if (attempts >= MAX_ATTEMPTS) {
            setStatus('limit_reached')
            return
        }

        setStatus('scanning')
        setError('')

        try {
            const descriptor = await getFaceDescriptor(videoRef.current)
            
            if (!descriptor) {
                setError('No face detected. Please ensure you are well-lit and facing the camera.')
                setStatus('ready')
                return
            }

            if (mode === 'register') {
                const { error: regError } = await supabase
                    .from('users')
                    .update({ 
                        face_descriptor: descriptor,
                        last_face_verified_at: new Date().toISOString()
                    })
                    .eq('id', profile.id)
                
                if (regError) throw regError
                
                setStatus('success')
                setTimeout(() => setIsFaceVerifiedToday(true), 1500)
            } else {
                // Verify mode
                const matches = compareFaces(descriptor, profile.face_descriptor)
                
                if (matches) {
                    const { error: verError } = await supabase
                        .from('users')
                        .update({ 
                            last_face_verified_at: new Date().toISOString(),
                            daily_face_attempts: 0 // Reset on success
                        })
                        .eq('id', profile.id)
                    
                    if (verError) throw verError
                    
                    setStatus('success')
                    setTimeout(() => setIsFaceVerifiedToday(true), 1500)
                } else {
                    const newAttempts = attempts + 1
                    setAttempts(newAttempts)
                    
                    await supabase
                        .from('users')
                        .update({ daily_face_attempts: newAttempts })
                        .eq('id', profile.id)

                    if (newAttempts >= MAX_ATTEMPTS) {
                        setStatus('limit_reached')
                    } else {
                        setError(`Face does not match. Attempt ${newAttempts}/${MAX_ATTEMPTS}`)
                        setStatus('ready')
                    }
                }
            }
        } catch (err) {
            console.error('Action error:', err)
            setError(err.message || 'An error occurred during scanning.')
            setStatus('ready')
        }
    }

    return (
        <div style={{
            fixed: 'inset-0',
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
        }}>
            <div className="glass-card" style={{
                width: '100%',
                maxWidth: 500,
                padding: '2rem',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
                {/* Decorative scanning grid background */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.05) 0%, transparent 70%)',
                    zIndex: -1
                }} />

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{
                        width: 64,
                        height: 64,
                        background: 'rgba(99, 102, 241, 0.1)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem',
                        color: '#6366f1'
                    }}>
                        {mode === 'register' ? <Fingerprint size={32} /> : <Scan size={32} />}
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>
                        {mode === 'register' ? 'Register Face' : 'Daily Verification'}
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        {mode === 'register' 
                            ? 'Please register your face to secure your account and enable platform access.'
                            : 'Face verification is required once per day to maintain security.'}
                    </p>
                </div>

                <div style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '4/3',
                    background: '#000',
                    borderRadius: 20,
                    overflow: 'hidden',
                    border: '2px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 0 40px rgba(0, 0, 0, 0.5)'
                }}>
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        muted 
                        playsInline 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                    
                    {/* Scanning Overlay */}
                    {status === 'scanning' && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
                            boxShadow: '0 0 15px #6366f1',
                            animation: 'scan 2s linear infinite',
                            zIndex: 10
                        }} />
                    )}

                    {/* Status Overlays */}
                    {status === 'success' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
                            <div style={{ textAlign: 'center' }}>
                                <ShieldCheck size={80} color="#10b981" />
                                <p style={{ color: 'white', fontWeight: 700, marginTop: '1rem', fontSize: '1.2rem' }}>Verified</p>
                            </div>
                        </div>
                    )}

                    {status === 'limit_reached' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(239, 68, 68, 0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30, padding: '2rem' }}>
                            <div style={{ textAlign: 'center' }}>
                                <AlertTriangle size={80} color="white" />
                                <h3 style={{ color: 'white', fontWeight: 800, marginTop: '1rem', fontSize: '1.3rem' }}>Access Blocked</h3>
                                <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                    You have exceeded the maximum daily face verification attempts (15/15). 
                                    Please contact support or try again tomorrow.
                                </p>
                                <button 
                                    onClick={() => signOut()}
                                    className="btn-secondary" 
                                    style={{ marginTop: '1.5rem', width: '100%', background: 'white', color: '#ef4444' }}
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: 10, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                        <ShieldAlert size={16} />
                        {error}
                    </div>
                )}

                <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <button 
                        onClick={handleAction}
                        disabled={status === 'scanning' || status === 'loading' || status === 'success' || status === 'limit_reached'}
                        className="btn-primary" 
                        style={{ width: '100%', height: 52, fontSize: '1.1rem', fontWeight: 700 }}
                    >
                        {status === 'scanning' ? (
                            <><RefreshCw size={20} className="animate-spin" /> Analyzing Face...</>
                        ) : (
                            mode === 'register' ? 'Capture Face Data' : 'Verify Identity'
                        )}
                    </button>
                    
                    {status !== 'limit_reached' && (
                        <button 
                            onClick={() => signOut()}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.875rem', cursor: 'pointer', padding: '0.5rem' }}
                        >
                            Sign out of this session
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    0% { top: 0%; }
                    50% { top: 100%; }
                    100% { top: 0%; }
                }
                .animate-spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}
