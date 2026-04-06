import { useEffect, useRef, useState } from 'react'
import * as faceapi from '@vladmandic/face-api'
import { Camera, ShieldCheck, Loader2, X, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function FaceVerificationOverlay({ user, onVerified, onCancel, isMandatory = false }) {
    const videoRef = useRef(null)
    const [status, setStatus] = useState('initializing') // initializing, loading_models, ready, scanning, matching, success, failed
    const [error, setError] = useState('')
    const [progress, setProgress] = useState(0)
    const [hasDescriptor, setHasDescriptor] = useState(false)
    const [stream, setStream] = useState(null)

    useEffect(() => {
        const init = async () => {
            try {
                setStatus('loading_models')
                const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/'
                
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ])

                // Check if user has stored face descriptor
                const { data, error: fetchError } = await supabase
                    .from('users')
                    .select('face_descriptor')
                    .eq('id', user.id)
                    .maybeSingle()

                if (fetchError) throw fetchError
                setHasDescriptor(!!data?.face_descriptor)
                
                setStatus('ready')
                startCamera()
            } catch (err) {
                console.error('FaceAPI Init Error:', err)
                setError('Failed to load Face Recognition engine.')
                setStatus('failed')
            }
        }
        init()
        return () => stopCamera()
    }, [user.id])

    const startCamera = async () => {
        try {
            const s = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                } 
            })
            setStream(s)
            if (videoRef.current) videoRef.current.srcObject = s
        } catch (err) {
            setError('Camera access denied. Please enable camera permissions.')
            setStatus('failed')
        }
    }

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
            setStream(null)
        }
    }

    const handleScan = async () => {
        if (!videoRef.current) return
        setStatus('scanning')
        setError('')
        setProgress(0)

        const interval = setInterval(() => {
            setProgress(prev => Math.min(prev + 5, 95))
        }, 100)

        try {
            // Detect face
            const detection = await faceapi
                .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor()

            clearInterval(interval)
            
            if (!detection) {
                setError('No face detected. Please position yourself clearly.')
                setStatus('ready')
                return
            }

            setProgress(100)
            
            if (hasDescriptor) {
                // Verification Mode
                setStatus('matching')
                const { data } = await supabase
                    .from('users')
                    .select('face_descriptor')
                    .eq('id', user.id)
                    .single()

                const storedDescriptor = new Float32Array(Object.values(data.face_descriptor))
                const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor)
                
                if (distance < 0.5) { // Confidence threshold
                    setStatus('success')
                    stopCamera() // Close camera immediately on success
                    setTimeout(() => onVerified(), 1000)
                } else {
                    setError('Face mismatch. Identity not verified.')
                    setStatus('ready')
                }
            } else {
                // Registration Mode
                setStatus('matching')
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ face_descriptor: Array.from(detection.descriptor) })
                    .eq('id', user.id)

                if (updateError) throw updateError
                
                setStatus('success')
                stopCamera() // Close camera immediately on success
                setTimeout(() => onVerified(), 1500)
            }
        } catch (err) {
            clearInterval(interval)
            setError('Scanning error. Please try again.')
            setStatus('ready')
        }
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.95)',
            backdropFilter: 'blur(20px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: 500,
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 32,
                padding: '2.5rem',
                textAlign: 'center',
                position: 'relative',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
            }}>
                {!isMandatory && (
                    <button 
                        onClick={() => {
                            stopCamera()
                            onCancel()
                        }}
                        style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.05)', border: 'none', padding: '0.75rem', borderRadius: '50%', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }}
                    >
                        <X size={20} />
                    </button>
                )}

                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <ShieldCheck size={32} color="white" />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', marginBottom: '0.5rem' }}>
                        {hasDescriptor ? 'Identity Verification' : 'Register Face Lock'}
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
                        {status === 'loading_models' ? 'Initializing security engines...' : 
                         hasDescriptor ? 'Scan your face to authorize this session.' : 
                         'First-time check: Let’s secure your account with biometrics.'}
                    </p>
                </div>

                <div style={{ 
                    position: 'relative', 
                    width: '100%', 
                    aspectRatio: '4/3', 
                    background: '#000', 
                    borderRadius: 24, 
                    overflow: 'hidden',
                    marginBottom: '2rem',
                    border: '2px solid rgba(99, 102, 241, 0.2)'
                }}>
                    <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} 
                    />
                    
                    {/* Futuristic Scanning Overlay */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        border: '2px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: 20,
                        pointerEvents: 'none'
                    }} />

                    {/* Scanning Circle */}
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '70%',
                        height: '70%',
                        border: `4px solid ${status === 'success' ? '#10b981' : 'rgba(99, 102, 241, 0.4)'}`,
                        borderRadius: '50%',
                        transition: 'all 0.3s ease'
                    }}>
                        {status === 'scanning' && (
                            <div style={{
                                position: 'absolute',
                                top: `${progress}%`,
                                left: 0,
                                right: 0,
                                height: 2,
                                background: '#6366f1',
                                boxShadow: '0 0 15px #6366f1',
                                transition: 'top 0.1s linear'
                            }} />
                        )}
                    </div>

                    {status === 'loading_models' && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
                            <Loader2 className="animate-spin" color="#6366f1" size={40} />
                            <span style={{ color: 'white', fontWeight: 600 }}>Loading Models...</span>
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 16, marginBottom: '2rem', color: '#f87171', textAlign: 'left', fontSize: '0.9rem' }}>
                        <AlertCircle size={20} flexShrink={0} />
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem' }}>
                    {!isMandatory && (
                        <button 
                            onClick={() => {
                                stopCamera()
                                onCancel()
                            }}
                            disabled={status === 'scanning' || status === 'matching'}
                            style={{ flex: 1, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 600, border: 'none', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    )}
                    <button 
                        onClick={handleScan}
                        disabled={status !== 'ready' && status !== 'scanning' && status !== 'matching'}
                        style={{ 
                            flex: 2, 
                            height: 56, 
                            borderRadius: 16, 
                            background: status === 'success' ? '#10b981' : 'white', 
                            color: status === 'success' ? 'white' : '#0f172a', 
                            fontWeight: 700, 
                            border: 'none', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            fontSize: '1rem',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {status === 'scanning' || status === 'matching' ? (
                            <><Loader2 className="animate-spin" size={20} /> Processing...</>
                        ) : status === 'success' ? (
                            <>Verified Successfully!</>
                        ) : (
                            <><Camera size={20} /> Start Biometric Scan</>
                        )}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.5; }
                    50% { opacity: 1; }
                }
                .animate-pulse-custom {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
            `}</style>
        </div>
    )
}
