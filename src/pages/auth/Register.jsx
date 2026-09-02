import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
    Mail, Lock, User, Eye, EyeOff, AlertCircle,
    BookOpen, Users, ArrowRight, Sparkles, CheckCircle2
} from 'lucide-react'
import AnimatedBackground from '../../components/background/AnimatedBackground'
import learnovaLogo from '../../assets/learnova-logo.png'

export default function Register() {
    const { signIn } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isInvited, setIsInvited] = useState(false)

    // Invite check for organizer / admin roles
    useEffect(() => {
        const cleanEmail = form.email.trim().toLowerCase()
        const checkInvite = async () => {
            if (cleanEmail.includes('@')) {
                const { data, error: err } = await supabase
                    .from('organizer_invites')
                    .select('role')
                    .eq('email', cleanEmail)
                    .maybeSingle()
                if (data && !err) {
                    setIsInvited(true)
                    setForm(p => ({ ...p, role: data.role || 'organizer' }))
                } else {
                    setIsInvited(false)
                    if (['organizer', 'sub_admin', 'main_admin'].includes(form.role)) {
                        setForm(p => ({ ...p, role: 'student' }))
                    }
                }
            } else {
                setIsInvited(false)
                if (['organizer', 'sub_admin', 'main_admin'].includes(form.role)) {
                    setForm(p => ({ ...p, role: 'student' }))
                }
            }
        }
        const timer = setTimeout(checkInvite, 500)
        return () => clearTimeout(timer)
    }, [form.email, form.role])

    // Direct Form Submit (No email OTP required)
    async function handleSubmit(e) {
        e.preventDefault()
        const cleanEmail = form.email.trim().toLowerCase()
        const cleanName = form.name.trim()

        if (!cleanName) { setError('Please enter your full name'); return }
        if (!cleanEmail || !cleanEmail.includes('@')) { setError('Please enter a valid email address'); return }
        if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }

        setLoading(true)
        setError('')

        try {
            // 1. Sign up user directly in Supabase
            const { data, error: err } = await supabase.auth.signUp({
                email: cleanEmail,
                password: form.password,
                options: {
                    data: {
                        name: cleanName,
                        role: form.role
                    }
                }
            })

            if (err) throw err

            // 2. Clean up invite if organizer/admin
            if (['organizer', 'sub_admin', 'main_admin'].includes(form.role)) {
                await supabase.from('organizer_invites').delete().eq('email', cleanEmail).catch(() => {})
            }

            // 3. Establish active session if not auto-signed in
            if (!data?.session) {
                try {
                    await signIn({ email: cleanEmail, password: form.password })
                } catch {
                    // If email confirmation is strictly enforced in Supabase settings
                    // we show informative fallback
                }
            }

            const isAdmin = ['organizer', 'sub_admin', 'main_admin'].includes(form.role)
            navigate(isAdmin ? '/organizer' : '/student', { replace: true })
        } catch (err) {
            console.error('Registration error:', err)
            const msg = err.message || ''
            if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
                setError('This email is already registered. Please sign in below!')
            } else {
                setError(msg || 'Registration failed. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            position: 'relative',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1rem',
            overflow: 'hidden',
            background: 'var(--bg-primary)'
        }}>
            <AnimatedBackground />

            {/* Background glowing gradients */}
            <div style={{
                position: 'absolute',
                top: '15%',
                left: '20%',
                width: 450,
                height: 450,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />
            <div style={{
                position: 'absolute',
                bottom: '15%',
                right: '20%',
                width: 400,
                height: 400,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)',
                pointerEvents: 'none'
            }} />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                    width: '100%',
                    maxWidth: 480,
                    position: 'relative',
                    zIndex: 10
                }}
            >
                {/* Brand Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '0.75rem',
                    }}>
                        <img
                            src={learnovaLogo}
                            alt="Learnova Logo"
                            style={{
                                width: 56,
                                height: 56,
                                borderRadius: 16,
                                objectFit: 'cover',
                                boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
                            }}
                        />
                    </div>
                    <h1 style={{
                        fontSize: '1.75rem',
                        fontWeight: 900,
                        letterSpacing: '-0.025em',
                        color: 'var(--text-primary)',
                        margin: 0
                    }}>
                        Create Account
                    </h1>
                    <p style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.875rem',
                        marginTop: '0.25rem'
                    }}>
                        Join Learnova to accelerate your learning journey
                    </p>
                </div>

                {/* Main Card */}
                <div style={{
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid var(--card-border)',
                    borderRadius: 20,
                    padding: '2rem',
                    boxShadow: 'var(--card-shadow)'
                }}>
                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.625rem',
                            padding: '0.75rem 1rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: 10,
                            color: '#ef4444',
                            fontSize: '0.875rem',
                            marginBottom: '1.25rem'
                        }}>
                            <AlertCircle size={18} style={{ flexShrink: 0 }} />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                        {/* Full Name */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-name">Full Name</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                <input
                                    id="reg-name" type="text" autoComplete="name" className="form-input"
                                    placeholder="John Doe" value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    style={{ paddingLeft: '2.5rem' }} required
                                />
                            </div>
                        </div>

                        {/* Email Address */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-email">Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                <input
                                    id="reg-email" type="email" autoComplete="email" className="form-input"
                                    placeholder="you@example.com" value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    style={{ paddingLeft: '2.5rem' }} required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-pass">Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                <input
                                    id="reg-pass" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="form-input"
                                    placeholder="Min. 6 characters" value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }} required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem', display: 'flex' }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Role selection indicator if invited */}
                        {isInvited && (
                            <div style={{
                                padding: '0.75rem 1rem',
                                background: 'rgba(99, 102, 241, 0.1)',
                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                color: 'var(--primary-400)',
                                fontSize: '0.82rem',
                                fontWeight: 600
                            }}>
                                <CheckCircle2 size={16} color="#10b981" />
                                <span>Invited Role: <strong>{form.role.toUpperCase()}</strong></span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                marginTop: '0.5rem',
                                width: '100%',
                                padding: '0.875rem',
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-700) 100%)',
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                                transition: 'all 0.2s ease',
                                opacity: loading ? 0.8 : 1
                            }}
                        >
                            {loading ? (
                                <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                            ) : (
                                <>
                                    <span>Create Account</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Bottom Sign In Link */}
                    <div style={{ textAlign: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--card-border)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                            Already have an account?{' '}
                        </span>
                        <Link to="/login" style={{ color: 'var(--primary-400)', fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
                            Sign in
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    )
}
