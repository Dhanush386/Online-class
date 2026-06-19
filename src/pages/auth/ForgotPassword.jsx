import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Key, Mail, Lock, CheckCircle, ArrowLeft, Send } from 'lucide-react'

export default function ForgotPassword() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [otpSent, setOtpSent] = useState(false)
    const [resetCode, setResetCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)

    useEffect(() => {
        let timer;
        if (resendCooldown > 0) {
            timer = setTimeout(() => setResendCooldown(c => c - 1), 1000)
        }
        return () => clearTimeout(timer)
    }, [resendCooldown])

    const handleSendOtp = async (e) => {
        e.preventDefault()
        if (!email) {
            setError("Please enter your email first.")
            return
        }
        setLoading(true)
        setError(null)

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())
            if (resetError) throw resetError
            
            setOtpSent(true)
            setResendCooldown(60)
            setError(null)
        } catch (err) {
            setError(err.message || 'Failed to send OTP.')
        } finally {
            setLoading(false)
        }
    }

    const handleResendOtp = async () => {
        if (resendCooldown > 0 || !email) return
        setLoading(true)
        setError(null)
        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase())
            if (resetError) throw resetError
            setResendCooldown(60)
            setError(null)
        } catch (err) {
            setError(err.message || 'Failed to resend OTP.')
        } finally {
            setLoading(false)
        }
    }

    const handleResetPassword = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            // Verify the OTP
            const { data, error: verifyError } = await supabase.auth.verifyOtp({
                email: email.trim().toLowerCase(),
                token: resetCode.trim(),
                type: 'recovery'
            })

            if (verifyError) throw verifyError

            // Update to the new password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            })

            if (updateError) throw updateError

            setSuccess(true)
            // Sign out the user so they can log in normally, as verifyOtp creates a session
            await supabase.auth.signOut()
            setTimeout(() => navigate('/login'), 2500)

        } catch (err) {
            setError(err.message || 'Invalid OTP or an error occurred.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '1.5rem' }}>
            <div className="glass-card animate-scale-up" style={{ width: '100%', maxWidth: 420, padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: 56, height: 56, background: 'rgba(99,102,241,0.1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <Key size={28} color="#6366f1" />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>Reset Password</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        {otpSent ? "Enter the OTP sent to your email and your new password." : "Enter your email to receive a password reset OTP."}
                    </p>
                </div>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', marginBottom: '0.5rem' }}>Password Updated!</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Redirecting to login...</p>
                    </div>
                ) : (
                    <form onSubmit={otpSent ? handleResetPassword : handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {error && (
                            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.85rem', border: '1px solid #fee2e2' }}>
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="email" className="form-label">Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
                                <input
                                    id="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    disabled={otpSent}
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="form-input"
                                    placeholder="Enter your registered email"
                                    style={{ paddingLeft: '2.5rem' }}
                                />
                            </div>
                        </div>

                        {otpSent && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="resetCode" className="form-label">6-Digit OTP</label>
                                    <div style={{ position: 'relative' }}>
                                        <Key size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
                                        <input
                                            id="resetCode"
                                            type="text"
                                            required
                                            value={resetCode}
                                            onChange={e => setResetCode(e.target.value)}
                                            className="form-input"
                                            placeholder="e.g. 123456"
                                            style={{ paddingLeft: '2.5rem', letterSpacing: '2px', fontFamily: 'monospace', fontWeight: 700 }}
                                        />
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Check your inbox (and spam folder) for the OTP.</span>
                                        <button 
                                            type="button" 
                                            onClick={handleResendOtp}
                                            disabled={resendCooldown > 0 || loading}
                                            style={{ 
                                                background: 'none', border: 'none', padding: 0, 
                                                color: resendCooldown > 0 ? 'var(--text-muted)' : '#6366f1', 
                                                cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                                                fontWeight: 600, fontSize: '0.75rem'
                                            }}
                                        >
                                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="newPassword" className="form-label">New Password</label>
                                    <div style={{ position: 'relative' }}>
                                        <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: 11 }} />
                                        <input
                                            id="newPassword"
                                            type="password"
                                            autoComplete="new-password"
                                            required
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                            className="form-input"
                                            placeholder="Must be at least 6 characters"
                                            minLength={6}
                                            style={{ paddingLeft: '2.5rem' }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                            style={{ padding: '0.875rem', marginTop: '0.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                            {loading ? 'Processing...' : (otpSent ? 'Reset Password' : <><Send size={18} /> Send OTP</>)}
                        </button>

                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <Link to="/login" style={{ fontSize: '0.85rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                <ArrowLeft size={14} /> Back to Login
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}

