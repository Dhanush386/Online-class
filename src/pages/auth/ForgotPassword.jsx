import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Key, Mail, Lock, CheckCircle, ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [resetCode, setResetCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            // Call the custom RPC function securely
            const { data, error: rpcError } = await supabase.rpc('reset_student_password', {
                p_email: email.trim().toLowerCase(),
                p_reset_code: resetCode.trim(),
                p_new_password: newPassword
            })

            if (rpcError) throw rpcError

            if (data === true) {
                setSuccess(true)
                setTimeout(() => navigate('/login'), 2500)
            } else {
                throw new Error("Invalid or expired reset code. If this code was already used, ask your Organizer for the new one.")
            }

        } catch (err) {
            setError(err.message || 'An unexpected error occurred.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '1.5rem' }}>
            <div className="glass-card animate-scale-up" style={{ width: '100%', maxWidth: 420, padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: 56, height: 56, background: 'rgba(99,102,241,0.1)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <Key size={28} color="#6366f1" />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>Reset Password</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>Enter the unique code provided by your Organizer.</p>
                </div>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
                        <CheckCircle size={48} color="#10b981" style={{ margin: '0 auto 1rem' }} />
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', marginBottom: '0.5rem' }}>Password Updated!</h2>
                        <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Redirecting to login...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {error && (
                            <div style={{ background: '#fef2f2', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: 8, fontSize: '0.85rem', border: '1px solid #fee2e2' }}>
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 11 }} />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="form-input"
                                    placeholder="Enter your registered email"
                                    style={{ paddingLeft: '2.5rem' }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Organizer Reset Code</label>
                            <div style={{ position: 'relative' }}>
                                <Key size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 11 }} />
                                <input
                                    type="text"
                                    required
                                    value={resetCode}
                                    onChange={e => setResetCode(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. 123456"
                                    style={{ paddingLeft: '2.5rem', letterSpacing: '2px', fontFamily: 'monospace', fontWeight: 700 }}
                                />
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>Ask your organizer to generate this code from their dashboard.</div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 11 }} />
                                <input
                                    type="password"
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

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                            style={{ padding: '0.875rem', marginTop: '0.5rem', fontSize: '1rem' }}
                        >
                            {loading ? 'Verifying...' : 'Reset Password'}
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
