import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getCurrentFacePeriod, getFaceCheckDate } from '../../utils/facePeriodUtils'
import FaceVerificationOverlay from './FaceVerificationOverlay'
import { ShieldCheck, Camera, AlertCircle } from 'lucide-react'

export default function FaceCheckGuard({ children }) {
    const { profile, user } = useAuth()
    const location = useLocation()
    const [isVerified, setIsVerified] = useState(false)
    const [loading, setLoading] = useState(true)
    const [showOverlay, setShowOverlay] = useState(false)
    const [error, setError] = useState(null)

    // Bypass for profile setup
    if (location.pathname === '/student/profile') {
        return children
    }

    const period = getCurrentFacePeriod()
    const date = getFaceCheckDate()

    useEffect(() => {
        if (user && profile) {
            checkVerification()
        }
    }, [user, profile, period, date])

    async function checkVerification() {
        try {
            setLoading(true)
            
            // 1. Check if user has face ID set up
            if (!profile.face_descriptor) {
                setError('face_not_enrolled')
                setLoading(false)
                return
            }

            // 2. Check if already verified for this shift
            const { data, error: fetchError } = await supabase
                .from('face_verifications')
                .select('id')
                .eq('user_id', user.id)
                .eq('period', period)
                .eq('date', date)
                .single()

            if (data) {
                setIsVerified(true)
            } else {
                setIsVerified(false)
                setShowOverlay(true)
            }
        } catch (err) {
            console.error('Error checking face verification:', err)
            // If error is "not found", it just means not verified yet
            setIsVerified(false)
            setShowOverlay(true)
        } finally {
            setLoading(false)
        }
    }

    async function handleVerificationSuccess() {
        try {
            // Log the verification to DB
            const { error: insertError } = await supabase
                .from('face_verifications')
                .insert({
                    user_id: user.id,
                    period: period,
                    date: date
                })

            if (insertError) throw insertError

            setIsVerified(true)
            setShowOverlay(false)
        } catch (err) {
            console.error('Error logging face verification:', err)
            alert('Verification succeeded but failed to log. Please try again or contact support.')
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0d1a' }}>
                 <div style={{
                    width: 40, height: 40, border: '3px solid rgba(99,102,241,0.2)',
                    borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    if (error === 'face_not_enrolled') {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0d1a', padding: '2rem' }}>
                <div className="glass-card" style={{ maxWidth: 450, padding: '2.5rem', textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Camera size={40} />
                    </div>
                    <h2 style={{ color: 'white', marginBottom: '1rem', fontWeight: 700 }}>Face ID Required</h2>
                    <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: '2rem' }}>
                        Periodic verification is enabled. You must set up your Face ID in your profile settings before you can access the platform.
                    </p>
                    <a href="/student/profile" className="btn-primary" style={{ display: 'block', textDecoration: 'none' }}>
                        Go to Profile
                    </a>
                </div>
            </div>
        )
    }

    if (!isVerified) {
        return (
            <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0d1a', padding: '2rem' }}>
                    <div className="glass-card" style={{ maxWidth: 450, padding: '2.5rem', textAlign: 'center' }}>
                        <div style={{ width: 80, height: 80, background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                            <ShieldCheck size={40} />
                        </div>
                        <h2 style={{ color: 'white', marginBottom: '1rem', fontWeight: 700 }}>Periodic Verification</h2>
                        <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: '2rem' }}>
                            Please verify your identity for the <strong style={{ color: 'white', textTransform: 'capitalize' }}>{period}</strong> shift. This is required 4 times daily to ensure secure access.
                        </p>
                        <button onClick={() => setShowOverlay(true)} className="btn-primary" style={{ width: '100%' }}>
                            Verify Now
                        </button>
                    </div>
                </div>

                {showOverlay && (
                    <FaceVerificationOverlay 
                        onSuccess={handleVerificationSuccess}
                        onCancel={() => {}} // Disallow cancel for mandatory check
                        isMandatory={true}
                    />
                )}
            </>
        )
    }

    return children
}
