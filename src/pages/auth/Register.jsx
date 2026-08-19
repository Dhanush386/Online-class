import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
    Mail, Lock, User, Eye, EyeOff, AlertCircle,
    BookOpen, Users, ArrowRight, Sparkles, RefreshCw,
    CheckCircle2, ShieldCheck, MailCheck, Send, Check
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

    // OTP Verification Inline State
    const [otpSent, setOtpSent] = useState(false)
    const [sendingOtp, setSendingOtp] = useState(false)
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [verifyingOtp, setVerifyingOtp] = useState(false)
    const [isEmailVerified, setIsEmailVerified] = useState(false)
    const [otpError, setOtpError] = useState('')
    const [countdown, setCountdown] = useState(60)
    const [canResend, setCanResend] = useState(false)
    const [resendSuccess, setResendSuccess] = useState(false)
    const inputRefs = useRef([])

    // Countdown timer for OTP
    useEffect(() => {
        let timer
        if (otpSent && !isEmailVerified && countdown > 0) {
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
    }, [otpSent, isEmailVerified, countdown])

    // Invite check
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

    // 1. Send OTP to user email using Confirm Signup template
    const handleSendOtp = async () => {
        const cleanEmail = form.email.trim().toLowerCase()
        if (!cleanEmail || !cleanEmail.includes('@')) {
            setError('Please enter a valid email address first')
            return
        }

        if (!form.password || form.password.length < 6) {
            setError('Please enter a password (min. 6 characters) before requesting OTP')
            return
        }

        setError('')
        setOtpError('')
        setSendingOtp(true)
        setResendSuccess(false)

        try {
            // Call signUp with the Confirm Signup template
            let signupSuccess = false
            try {
                const data = await signUp({
                    email: cleanEmail,
                    password: form.password,
                    name: form.name.trim() || 'Student',
                    role: form.role
                })
                signupSuccess = true
            } catch (err) {
                // If user is already registered in auth.users (e.g. unverified or resending)
                if (err.message && (err.message.toLowerCase().includes('already registered') || err.message.toLowerCase().includes('already exists'))) {
                    // Resend confirmation OTP
                    const { error: resendErr } = await supabase.auth.resend({
                        type: 'signup',
                        email: cleanEmail
                    })
                    if (resendErr) {
                        // If resend says already confirmed
                        if (resendErr.message && resendErr.message.toLowerCase().includes('already confirmed')) {
                            throw new Error('This account is already verified! Please sign in.')
                        }
                        throw resendErr
                    }
                    signupSuccess = true
                } else {
                    throw err
                }
            }

            if (signupSuccess) {
                setOtpSent(true)
                setCanResend(false)
                setCountdown(60)
                setOtp(['', '', '', '', '', ''])
                setTimeout(() => inputRefs.current[0]?.focus(), 150)
            }
        } catch (err) {
            setError(err.message || 'Failed to send OTP code. Please check your Supabase SMTP / Email settings.')
        } finally {
            setSendingOtp(false)
        }
    }

    // 2. Handle 6-digit OTP input
    const handleOtpChange = (index, value) => {
        const cleaned = value.replace(/\D/g, '')
        if (!cleaned) {
            const newOtp = [...otp]
            newOtp[index] = ''
            setOtp(newOtp)
            return
        }

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

        if (digit && index < 5) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus()
        }
    }

    // 3. Verify OTP code
    const handleVerifyOtp = async () => {
        const cleanEmail = form.email.trim().toLowerCase()
        const token = otp.join('').trim()
        if (token.length < 6) {
            setOtpError('Please enter all 6 digits')
            return
        }

        setVerifyingOtp(true)
        setOtpError('')
        try {
            const { error: err } = await supabase.auth.verifyOtp({
                email: cleanEmail,
                token,
                type: 'signup'
            })
            if (err) throw err

            setIsEmailVerified(true)
            setOtpError('')
        } catch (err) {
            setOtpError(err.message || 'Invalid or expired verification code.')
        } finally {
            setVerifyingOtp(false)
        }
    }

    // 4. Final Form Submit (Only clickable after isEmailVerified is true)
    async function handleSubmit(e) {
        e.preventDefault()
        if (!isEmailVerified) {
            setError('Please verify your email address using OTP before registering.')
            return
        }

        const cleanEmail = form.email.trim().toLowerCase()
        const cleanName = form.name.trim()

        if (!cleanName) { setError('Please enter your full name'); return }
        if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }

        setLoading(true)
        setError('')

        try {
            // Update profile metadata for the verified session
            await supabase.auth.updateUser({
                password: form.password,
                data: {
                    name: cleanName,
                    role: form.role
                }
            })

            if (['organizer', 'main_admin', 'sub_admin'].includes(form.role)) {
                await supabase.from('organizer_invites').delete().eq('email', cleanEmail)
            }

            const isAdmin = ['organizer', 'sub_admin', 'main_admin'].includes(form.role)
            navigate(isAdmin ? '/organizer' : '/student', { replace: true })
        } catch (err) {
            setError(err.message || 'Registration completed. Please sign in.')
        } finally {
            setLoading(false)
        }
    }

    const isSubmitReady = isEmailVerified && form.name.trim() && form.password.length >= 6

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
                        Join thousands of students and educators. Verified accounts get instant access to courses, live sessions, and coding playgrounds.
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
                    {[{ value: '10K+', label: 'Students' }, { value: '200+', label: 'Courses' }, { value: '98%', label: 'Satisfaction' }].map(({ value, label }) => (
                        <div key={label}>
                            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{value}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ── Right Panel — Form ── */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
                position: 'relative',
                zIndex: 1,
                overflowY: 'auto',
            }}>
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                    style={{ width: '100%', maxWidth: 460, margin: 'auto 0' }}
                >
                    {/* Mobile-only logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }} className="show-mobile-flex">
                        <img src={learnovaLogo} alt="Learnova" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Learnova</span>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.375rem' }}>
                            Create Account ✨
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Verify your email to unlock registration.</p>
                    </div>

                    {/* Main Error */}
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
                                            padding: '0.85rem',
                                            borderRadius: 12,
                                            border: `2px solid ${isSelected ? color : 'var(--card-border)'}`,
                                            background: isSelected ? `${color}12` : 'var(--bg-elevated)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <Icon size={22} color={isSelected ? color : 'var(--text-muted)'} />
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isSelected ? color : 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{label}</span>
                                    </motion.button>
                                )
                            })}
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
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

                        {/* Email with Send/Verified OTP button */}
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <label className="form-label" htmlFor="reg-email" style={{ margin: 0 }}>Email Address</label>
                                {isEmailVerified ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: '#10b981', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.5rem', borderRadius: 6, border: '1px solid rgba(16,185,129,0.2)' }}>
                                        <Check size={13} /> Verified
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '0.75rem', color: 'var(--primary-400)', fontWeight: 600 }}>
                                        OTP Verification Required
                                    </span>
                                )}
                            </div>

                            <div style={{ position: 'relative', display: 'flex', gap: '0.5rem' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Mail size={16} color={isEmailVerified ? '#10b981' : 'var(--text-muted)'} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                                    <input
                                        id="reg-email" type="email" autoComplete="email" className="form-input"
                                        placeholder="you@example.com" value={form.email}
                                        disabled={isEmailVerified}
                                        onChange={e => {
                                            setForm(p => ({ ...p, email: e.target.value }))
                                            if (otpSent) setOtpSent(false)
                                            if (isEmailVerified) setIsEmailVerified(false)
                                        }}
                                        style={{
                                            paddingLeft: '2.5rem',
                                            borderColor: isEmailVerified ? '#10b981' : undefined,
                                            background: isEmailVerified ? 'rgba(16,185,129,0.04)' : undefined
                                        }}
                                        required
                                    />
                                </div>

                                {!isEmailVerified ? (
                                    <button
                                        type="button"
                                        disabled={sendingOtp || !form.email.includes('@')}
                                        onClick={handleSendOtp}
                                        style={{
                                            padding: '0 1rem',
                                            borderRadius: 10,
                                            background: form.email.includes('@') ? 'var(--primary-600)' : 'var(--bg-elevated)',
                                            color: form.email.includes('@') ? '#fff' : 'var(--text-muted)',
                                            border: '1px solid var(--card-border)',
                                            fontWeight: 700,
                                            fontSize: '0.82rem',
                                            cursor: form.email.includes('@') ? 'pointer' : 'not-allowed',
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        {sendingOtp ? (
                                            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                                        ) : (
                                            <>
                                                <Send size={13} />
                                                <span>{otpSent ? 'Resend OTP' : 'Send OTP'}</span>
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEmailVerified(false)
                                            setOtpSent(false)
                                        }}
                                        style={{
                                            padding: '0 0.75rem',
                                            borderRadius: 10,
                                            background: 'none',
                                            border: '1px solid var(--card-border)',
                                            color: 'var(--text-muted)',
                                            fontSize: '0.75rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Change
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── Inline 6-Digit OTP Verification Box ── */}
                        <AnimatePresence>
                            {otpSent && !isEmailVerified && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0, y: -10 }}
                                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                                    exit={{ opacity: 0, height: 0, y: -10 }}
                                    style={{
                                        background: 'rgba(99,102,241,0.06)',
                                        border: '1px solid rgba(99,102,241,0.25)',
                                        borderRadius: 12,
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.75rem'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary-400)', fontSize: '0.82rem', fontWeight: 700 }}>
                                            <MailCheck size={15} />
                                            <span>Enter 6-Digit OTP Code sent to email</span>
                                        </div>
                                        {canResend ? (
                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                style={{ background: 'none', border: 'none', color: 'var(--primary-400)', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                            >
                                                <RefreshCw size={11} /> Resend
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                Resend in <strong>{countdown}s</strong>
                                            </span>
                                        )}
                                    </div>

                                    {/* 6 Digit Grid */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
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
                                                    maxWidth: '48px',
                                                    height: '48px',
                                                    textAlign: 'center',
                                                    fontSize: '1.25rem',
                                                    fontWeight: 800,
                                                    color: 'var(--text-primary)',
                                                    background: 'var(--bg-elevated)',
                                                    border: digit ? '2px solid var(--primary-500)' : '1px solid var(--card-border)',
                                                    borderRadius: '8px',
                                                    outline: 'none',
                                                }}
                                                required
                                            />
                                        ))}
                                    </div>

                                    {otpError && (
                                        <div style={{ color: '#dc2626', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            <AlertCircle size={13} /> {otpError}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        disabled={verifyingOtp || otp.join('').length < 6}
                                        onClick={handleVerifyOtp}
                                        style={{
                                            height: 38,
                                            borderRadius: 8,
                                            background: otp.join('').length === 6 ? '#10b981' : 'var(--bg-elevated)',
                                            color: otp.join('').length === 6 ? '#fff' : 'var(--text-muted)',
                                            border: 'none',
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                            cursor: otp.join('').length === 6 ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.4rem',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {verifyingOtp ? (
                                            <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                                        ) : (
                                            <>
                                                <ShieldCheck size={15} />
                                                <span>Verify OTP & Unlock Register Button</span>
                                            </>
                                        )}
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── REGISTER SUBMIT BUTTON (Disabled until OTP verified) ── */}
                        <div style={{ marginTop: '0.5rem' }}>
                            <motion.button
                                type="submit"
                                disabled={loading || !isSubmitReady}
                                className={isSubmitReady ? "btn-primary" : ""}
                                style={{
                                    width: '100%',
                                    height: 50,
                                    fontSize: '0.95rem',
                                    borderRadius: 12,
                                    border: 'none',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem',
                                    background: isSubmitReady ? undefined : 'rgba(255,255,255,0.06)',
                                    color: isSubmitReady ? undefined : 'var(--text-muted)',
                                    cursor: isSubmitReady ? 'pointer' : 'not-allowed',
                                    boxShadow: isSubmitReady ? '0 4px 16px rgba(99,102,241,0.35)' : 'none',
                                    transition: 'all 0.25s ease'
                                }}
                                whileHover={isSubmitReady ? { scale: 1.01 } : {}}
                                whileTap={isSubmitReady ? { scale: 0.99 } : {}}
                            >
                                {loading ? (
                                    <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite' }} />
                                ) : isEmailVerified ? (
                                    <>
                                        <span>Create Account & Start Learning</span>
                                        <ArrowRight size={16} />
                                    </>
                                ) : (
                                    <>
                                        <Lock size={15} />
                                        <span>Verify Email with OTP to Enable Register</span>
                                    </>
                                )}
                            </motion.button>

                            {!isEmailVerified && (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                                    🔒 Enter details, click <strong>"Send OTP"</strong> & enter the 6-digit code to enable this button.
                                </p>
                            )}
                        </div>
                    </form>

                    <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1.25rem' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: 'var(--primary-500)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
                    </p>
                </motion.div>
            </div>
        </div>
    )
}
