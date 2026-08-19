import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
    Mail, Lock, User, Eye, EyeOff, AlertCircle,
    BookOpen, Users, ArrowRight, Sparkles, RefreshCw,
    ArrowLeft, CheckCircle2, ShieldCheck, MailCheck
} from 'lucide-react'
import AnimatedBackground from '../../components/background/AnimatedBackground'
import learnovaLogo from '../../assets/learnova-logo.png'

export default function Register() {
    const { signUp, verifyOtp, resendOtp } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isInvited, setIsInvited] = useState(false)

    // OTP Verification State
    const [step, setStep] = useState('form') // 'form' | 'otp'
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [otpLoading, setOtpLoading] = useState(false)
    const [otpError, setOtpError] = useState('')
    const [countdown, setCountdown] = useState(60)
    const [canResend, setCanResend] = useState(false)
    const [resendSuccess, setResendSuccess] = useState(false)
    const inputRefs = useRef([])

    // Countdown timer for Resend OTP
    useEffect(() => {
        let timer
        if (step === 'otp' && countdown > 0) {
            timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        setCanResend(true)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        }
        return () => clearInterval(timer)
    }, [step, countdown])

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

    async function handleSubmit(e) {
        e.preventDefault()
        const cleanEmail = form.email.trim().toLowerCase()
        const cleanName = form.name.trim()
        if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
        setLoading(true)
        setError('')
        try {
            const data = await signUp({ ...form, email: cleanEmail, name: cleanName })
            
            // If session is established immediately (e.g. email confirmations disabled on Supabase)
            if (data?.session) {
                const isAdmin = ['organizer', 'sub_admin', 'main_admin'].includes(form.role)
                navigate(isAdmin ? '/organizer' : '/student', { replace: true })
                return
            }

            // If email confirmation is required, switch to OTP verification step
            setStep('otp')
            setCountdown(60)
            setCanResend(false)
            setOtp(['', '', '', '', '', ''])
            setOtpError('')
            setTimeout(() => inputRefs.current[0]?.focus(), 100)
        } catch (err) {
            setError(err.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    const handleOtpChange = (index, value) => {
        const cleaned = value.replace(/\D/g, '') // only digits
        if (!cleaned) {
            const newOtp = [...otp]
            newOtp[index] = ''
            setOtp(newOtp)
            return
        }

        // Paste full 6 digits
        if (cleaned.length >= 6) {
            const digits = cleaned.slice(0, 6).split('')
            setOtp(digits)
            inputRefs.current[5]?.focus()
            return
        }

        const digit = cleaned[cleaned.length - 1]
        const newOtp = [...otp]
        newOtp[index] = digit
        setOtp(newOtp)

        // Auto-advance to next input
        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    const handleVerifyOtp = async (e) => {
        e?.preventDefault()
        const token = otp.join('').trim()
        if (token.length < 6) {
            setOtpError('Please enter the full 6-digit verification code')
            return
        }

        setOtpLoading(true)
        setOtpError('')
        try {
            await verifyOtp({
                email: form.email.trim().toLowerCase(),
                token,
                type: 'signup'
            })

            const isAdmin = ['organizer', 'sub_admin', 'main_admin'].includes(form.role)
            navigate(isAdmin ? '/organizer' : '/student', { replace: true })
        } catch (err) {
            setOtpError(err.message || 'Invalid or expired verification code. Please try again.')
        } finally {
            setOtpLoading(false)
        }
    }

    const handleResend = async () => {
        if (!canResend) return
        setOtpError('')
        setResendSuccess(false)
        try {
            await resendOtp({
                email: form.email.trim().toLowerCase(),
                type: 'signup'
            })
            setResendSuccess(true)
            setCanResend(false)
            setCountdown(60)
            setTimeout(() => setResendSuccess(false), 5000)
        } catch (err) {
            setOtpError(err.message || 'Failed to resend code. Please try again in a moment.')
        }
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
            <AnimatedBackground variant="auth" />

            {/* ── Left Panel — Hero ── */}
            <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="hide-mobile"
                style={{
                    flex: '0 0 46%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '2.5rem',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <img src={learnovaLogo} alt="Learnova" style={{
                        width: 42, height: 42, borderRadius: 12,
                        objectFit: 'cover',
                        boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
                    }} />
                    <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Learnova</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--secondary-500)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Learning Platform</div>
                    </div>
                </div>

                {/* Hero content */}
                <div>
                    <motion.h1
                        style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.15, letterSpacing: '-0.04em', marginBottom: '1rem' }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        Start your<br />
                        <span className="gradient-text">learning journey.</span>
                    </motion.h1>
                    <motion.p
                        style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 380, marginBottom: '2rem' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.35 }}
                    >
                        Join thousands of students and educators. Earn XP, climb ranks, and master new skills every day.
                    </motion.p>

                    {/* Features list */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
                    >
                        {[
                            { emoji: '🎓', text: 'Interactive courses with real-time live classes' },
                            { emoji: '🏆', text: 'Gamified XP system with ranks & achievements' },
                            { emoji: '💻', text: 'Built-in code editor with 10+ languages' },
                            { emoji: '🤖', text: 'AI-powered study assistant (Learnova AI)' },
                        ].map(({ emoji, text }) => (
                            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                <span style={{ fontSize: '1.2rem' }}>{emoji}</span>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{text}</span>
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: '2rem' }}>
                    {[{ n: '10K+', l: 'Students' }, { n: '200+', l: 'Courses' }, { n: '98%', l: 'Satisfaction' }].map(({ n, l }) => (
                        <div key={l}>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{n}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{l}</div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ── Right Panel — Form / OTP ── */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                position: 'relative',
                zIndex: 1,
            }}>
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                    style={{ width: '100%', maxWidth: 460 }}
                >
                    {/* Mobile-only logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }} className="show-mobile-flex">
                        <img src={learnovaLogo} alt="Learnova" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Learnova</span>
                    </div>

                    {step === 'form' ? (
                        /* ══════════ REGISTRATION FORM ══════════ */
                        <>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.375rem' }}>
                                    Create Account ✨
                                </h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Join the Learnova community today.</p>
                            </div>

                            {/* Error */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#dc2626' }}
                                    >
                                        <AlertCircle size={16} />{error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Role Selector */}
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div className="form-label">I am a...</div>
                                <div style={{ display: 'grid', gridTemplateColumns: isInvited ? '1fr 1fr' : '1fr', gap: '0.85rem' }}>
                                    {[
                                        { value: 'student', label: 'Student', icon: BookOpen, color: '#10b981', show: true },
                                        {
                                            value: isInvited && form.role !== 'student' ? form.role : 'organizer',
                                            label: isInvited && form.role !== 'student'
                                                ? form.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
                                                : 'Organizer',
                                            icon: Users,
                                            color: '#6366f1',
                                            show: isInvited
                                        },
                                    ].filter(r => r.show).map(({ value, label, icon: Icon, color }) => {
                                        const isSelected = value === 'student' ? form.role === 'student' : ['organizer', 'sub_admin', 'main_admin'].includes(form.role)
                                        return (
                                            <motion.button
                                                key={value}
                                                type="button"
                                                onClick={() => setForm(p => ({ ...p, role: value }))}
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                style={{
                                                    padding: '1rem',
                                                    borderRadius: 14,
                                                    border: `2px solid ${isSelected ? color : 'var(--card-border)'}`,
                                                    background: isSelected ? `${color}12` : 'var(--bg-elevated)',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    gap: '0.5rem',
                                                    transition: 'all 0.2s ease',
                                                }}
                                            >
                                                <Icon size={24} color={isSelected ? color : 'var(--text-muted)'} />
                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? color : 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{label}</span>
                                            </motion.button>
                                        )
                                    })}
                                </div>
                                {isInvited && !['student'].includes(form.role) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.85rem', justifyContent: 'center' }}>
                                        <Sparkles size={14} color="#6366f1" />
                                        <span style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: 600 }}>
                                            You're invited as {form.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}!
                                        </span>
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* Name */}
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

                                {/* Email */}
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

                                {/* Submit */}
                                <motion.button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-primary"
                                    style={{ width: '100%', height: 48, fontSize: '0.95rem', marginTop: '0.25rem' }}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                >
                                    {loading
                                        ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                                        : <><span>Get Started</span><ArrowRight size={16} /></>
                                    }
                                </motion.button>
                            </form>

                            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
                                Already have an account?{' '}
                                <Link to="/login" style={{ color: 'var(--primary-500)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
                            </p>
                        </>
                    ) : (
                        /* ══════════ 6-DIGIT EMAIL OTP SCREEN ══════════ */
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4 }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                                <div style={{
                                    width: 64, height: 64, borderRadius: 20,
                                    background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
                                    border: '1px solid rgba(99,102,241,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    margin: '0 auto 1.25rem',
                                    color: 'var(--primary-400)',
                                    boxShadow: '0 8px 32px rgba(99,102,241,0.2)'
                                }}>
                                    <MailCheck size={32} />
                                </div>
                                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
                                    Verify Your Email
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, maxWidth: 360, margin: '0 auto' }}>
                                    We've sent a 6-digit verification code to:
                                </p>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.1)', padding: '0.35rem 0.85rem', borderRadius: 20, marginTop: '0.5rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                                    <Mail size={13} color="var(--primary-400)" />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{form.email}</span>
                                    <button
                                        type="button"
                                        onClick={() => setStep('form')}
                                        style={{ background: 'none', border: 'none', color: 'var(--primary-400)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                                    >
                                        Edit
                                    </button>
                                </div>
                            </div>

                            {/* OTP Error */}
                            <AnimatePresence>
                                {otpError && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#dc2626' }}
                                    >
                                        <AlertCircle size={16} />{otpError}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Resend Success Alert */}
                            <AnimatePresence>
                                {resendSuccess && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#10b981' }}
                                    >
                                        <CheckCircle2 size={16} /> New verification code sent to your email!
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* 6 Digit Input Grid */}
                            <form onSubmit={handleVerifyOtp}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                    {otp.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={el => (inputRefs.current[index] = el)}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            value={digit}
                                            onChange={e => handleOtpChange(index, e.target.value)}
                                            onKeyDown={e => handleOtpKeyDown(index, e)}
                                            style={{
                                                width: '100%',
                                                maxWidth: '56px',
                                                height: '60px',
                                                textAlign: 'center',
                                                fontSize: '1.5rem',
                                                fontWeight: 800,
                                                color: 'var(--text-primary)',
                                                background: 'var(--bg-elevated)',
                                                border: digit ? '2px solid var(--primary-500)' : '1px solid var(--card-border)',
                                                borderRadius: '12px',
                                                outline: 'none',
                                                boxShadow: digit ? '0 0 12px rgba(99,102,241,0.25)' : 'none',
                                                transition: 'all 0.15s ease',
                                            }}
                                            required
                                        />
                                    ))}
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={otpLoading || otp.join('').length < 6}
                                    className="btn-primary"
                                    style={{ width: '100%', height: 48, fontSize: '0.95rem', marginBottom: '1rem', opacity: otp.join('').length < 6 ? 0.6 : 1 }}
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                >
                                    {otpLoading
                                        ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                                        : <><span>Verify & Complete Registration</span><ShieldCheck size={16} /></>
                                    }
                                </motion.button>
                            </form>

                            {/* Resend & Timer */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.85rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setStep('form')}
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                                >
                                    <ArrowLeft size={14} /> Change details
                                </button>

                                {canResend ? (
                                    <button
                                        type="button"
                                        onClick={handleResend}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: 'var(--primary-400)', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                                    >
                                        <RefreshCw size={13} /> Resend Code
                                    </button>
                                ) : (
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        Resend in <strong style={{ color: 'var(--primary-400)' }}>{countdown}s</strong>
                                    </span>
                                )}
                            </div>

                            {/* Spam Guidance Box */}
                            <div style={{
                                marginTop: '1.75rem',
                                padding: '0.85rem 1rem',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '12px',
                                fontSize: '0.78rem',
                                color: 'var(--text-muted)',
                                lineHeight: 1.5,
                            }}>
                                💡 <strong>Tip:</strong> If you don't see the email within a minute, check your <strong>Promotions</strong> or <strong>Spam</strong> folder and mark it as <em>"Not Spam"</em> so you never miss class reminders.
                            </div>
                        </motion.div>
                    )}
                </motion.div>
            </div>
        </div>
    )
}
