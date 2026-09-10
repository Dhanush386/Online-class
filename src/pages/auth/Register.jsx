import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
    Mail, Lock, User, Eye, EyeOff, AlertCircle,
    BookOpen, Users, ArrowRight, Sparkles, CheckCircle2, Shield
} from 'lucide-react'
import AnimatedBackground from '../../components/background/AnimatedBackground'
import learnovaLogo from '../../assets/learnova-logo.png'
import { validatePassword, validateEmail, sanitizeEmail } from '../../utils/security'

export default function Register() {
    const { signIn } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isInvited, setIsInvited] = useState(false)
    const [botField, setBotField] = useState('')

    // Server-side invite check via secure RPC for organizer / admin roles
    useEffect(() => {
        const cleanEmail = sanitizeEmail(form.email)
        const checkInvite = async () => {
            if (validateEmail(cleanEmail)) {
                try {
                    const { data } = await supabase.rpc('check_organizer_invite', { p_email: cleanEmail })
                    if (data?.valid) {
                        setIsInvited(true)
                        setForm(p => ({ ...p, role: data.role || 'organizer' }))
                    } else {
                        setIsInvited(false)
                        if (['organizer', 'sub_admin', 'main_admin'].includes(form.role)) {
                            setForm(p => ({ ...p, role: 'student' }))
                        }
                    }
                } catch {
                    setIsInvited(false)
                }
            } else {
                setIsInvited(false)
                if (['organizer', 'sub_admin', 'main_admin'].includes(form.role)) {
                    setForm(p => ({ ...p, role: 'student' }))
                }
            }
        }
        const timer = setTimeout(checkInvite, 400)
        return () => clearTimeout(timer)
    }, [form.email, form.role])

    async function handleSubmit(e) {
        e.preventDefault()
        if (botField) {
            // Silently drop bot submission
            setLoading(false)
            return
        }

        const cleanEmail = sanitizeEmail(form.email)
        const cleanName = form.name.trim()

        if (!cleanName) { setError('Please enter your full name'); return }
        if (!validateEmail(cleanEmail)) { setError('Please enter a valid email address'); return }

        // Strict password complexity enforcement
        const passCheck = validatePassword(form.password)
        if (!passCheck.isValid) {
            setError(passCheck.message)
            return
        }

        setLoading(true)
        setError('')

        try {
            // 1. Rate-limit account registration
            try {
                const { data: limitCheck } = await supabase.rpc('check_rate_limit', {
                    p_identifier: cleanEmail,
                    p_action: 'register',
                    p_max_attempts: 5,
                    p_window_seconds: 3600
                })
                if (limitCheck && !limitCheck.allowed) {
                    throw new Error(limitCheck.message || 'Too many registration requests. Please wait.')
                }
            } catch (limErr) {
                if (limErr.message?.includes('Too many')) throw limErr
            }

            // 2. Sign up user via Supabase
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

            // 3. Establish active session if email confirmation is not strictly blocking
            if (!data?.session) {
                try {
                    await signIn({ email: cleanEmail, password: form.password })
                } catch {
                    // Handled if email confirmation is required
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
                            alt="Learnova"
                            style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                objectFit: 'cover'
                            }}
                        />
                    </div>
                    <h1 style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '1.75rem',
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.03em',
                        marginBottom: '0.25rem'
                    }}>
                        Create your account
                    </h1>
                    <p style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.875rem'
                    }}>
                        Join Learnova to start your interactive learning path
                    </p>
                </div>

                {/* Form Card */}
                <div className="glass-card" style={{
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
                        {/* Honeypot field for bot deterrence */}
                        <input
                            type="text"
                            name="website_url_hp"
                            value={botField}
                            onChange={e => setBotField(e.target.value)}
                            style={{ display: 'none', position: 'absolute', opacity: 0, height: 0, pointerEvents: 'none' }}
                            tabIndex="-1"
                            autoComplete="off"
                            aria-hidden="true"
                        />

                        {/* Full Name */}
                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-name">Full Name</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                <input
                                    id="reg-name" type="text" autoComplete="name" className="form-input"
                                    placeholder="Jane Doe" value={form.name}
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
                                    placeholder="At least 8 chars, uppercase, digit & symbol" value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    style={{ paddingLeft: '2.5rem', paddingRight: '2.75rem' }} required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                        color: 'var(--text-muted)', display: 'flex', alignItems: 'center'
                                    }}
                                    tabIndex="-1"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                                Must be ≥ 8 chars with uppercase, lowercase, number, and special character.
                            </span>
                        </div>

                        {/* Role selection / Verified invite notice */}
                        {isInvited ? (
                            <div style={{
                                padding: '0.875rem 1rem',
                                background: 'rgba(16, 185, 129, 0.1)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: 10,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <CheckCircle2 size={20} color="#10b981" />
                                <div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#10b981' }}>
                                        Verified Staff Invitation
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        Registering with verified role: <strong>{form.role}</strong>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.625rem 0.75rem',
                                background: 'rgba(99, 102, 241, 0.05)',
                                borderRadius: 8,
                                border: '1px solid rgba(99, 102, 241, 0.15)',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)'
                            }}>
                                <Shield size={14} color="var(--primary-400)" />
                                <span>Standard Student Account. Staff roles require an official invitation.</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{
                                marginTop: '0.5rem',
                                height: 44,
                                fontSize: '0.95rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                width: '100%'
                            }}
                        >
                            {loading ? 'Creating account...' : (
                                <>
                                    <span>Get Started</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Link */}
                <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: 'var(--primary-400)', fontWeight: 600, textDecoration: 'none' }}>
                            Sign in
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    )
}
