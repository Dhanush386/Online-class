import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import {
  GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight, Zap,
  BookOpen, Trophy, Users, AlertCircle, CheckCircle2,
  MailCheck, RefreshCw, ShieldCheck, ArrowLeft
} from 'lucide-react'
import AnimatedBackground from '../../components/background/AnimatedBackground'
import learnovaLogo from '../../assets/learnova-logo.png'
import { useAuth } from '../../contexts/AuthContext'

const FEATURES = [
  { icon: BookOpen, title: 'Smart Learning', desc: 'AI-powered course recommendations tailored to your pace.' },
  { icon: Zap,      title: 'Live Classes',   desc: 'Real-time interactive sessions with screen sharing.' },
  { icon: Trophy,   title: 'Gamified XP',    desc: 'Earn XP, climb ranks, and unlock achievements.' },
  { icon: Users,    title: 'AI Proctoring',  desc: 'Fair and transparent exam monitoring for all.' },
]

export default function Login() {
  const navigate = useNavigate()
  const { user, profile, verifyOtp, resendOtp, fetchProfile } = useAuth()
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [featureIdx,  setFeatureIdx]  = useState(0)
  const [remember,    setRemember]    = useState(false)

  // OTP Verification State for unconfirmed users
  const [showOtp,     setShowOtp]     = useState(false)
  const [otp,         setOtp]         = useState(['', '', '', '', '', ''])
  const [otpLoading,  setOtpLoading]  = useState(false)
  const [otpError,    setOtpError]    = useState('')
  const [countdown,   setCountdown]   = useState(60)
  const [canResend,   setCanResend]   = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const inputRefs = useRef([])

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      const role = profile?.role || user.user_metadata?.role || 'student'
      const target = ['organizer', 'sub_admin', 'main_admin'].includes(role) ? '/organizer' : '/student'
      navigate(target, { replace: true })
    }
  }, [user, profile, navigate])

  // Rotate feature card
  useEffect(() => {
    const id = setInterval(() => setFeatureIdx(i => (i + 1) % FEATURES.length), 3500)
    return () => clearInterval(id)
  }, [])

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer
    if (showOtp && countdown > 0) {
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
  }, [showOtp, countdown])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (err) {
        if (err.message && err.message.toLowerCase().includes('email not confirmed')) {
          setShowOtp(true)
          setCountdown(60)
          setCanResend(false)
          setOtp(['', '', '', '', '', ''])
          setOtpError('')
          setTimeout(() => inputRefs.current[0]?.focus(), 100)
          return
        }
        throw err
      }
      if (data?.user?.id) {
        const prof = await fetchProfile(data.user.id)
        const role = prof?.role || data.user.user_metadata?.role || 'student'
        const target = ['organizer', 'sub_admin', 'main_admin'].includes(role) ? '/organizer' : '/student'
        navigate(target, { replace: true })
      } else {
        navigate('/student', { replace: true })
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
        email: email.trim().toLowerCase(),
        token,
        type: 'signup'
      })
      navigate('/', { replace: true })
    } catch (err) {
      setOtpError(err.message || 'Invalid or expired verification code.')
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
        email: email.trim().toLowerCase(),
        type: 'signup'
      })
      setResendSuccess(true)
      setCanResend(false)
      setCountdown(60)
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (err) {
      setOtpError(err.message || 'Failed to resend verification code.')
    }
  }

  const { icon: FeatureIcon, title, desc } = FEATURES[featureIdx]
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
          flex: '0 0 48%',
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
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            Learn smarter.<br />
            <span className="gradient-text">Grow faster.</span>
          </motion.h1>
          <motion.p
            style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 400, marginBottom: '2.5rem' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            The all-in-one learning platform with live classes, interactive coding playgrounds, and AI-powered study assistance.
          </motion.p>

          {/* Rotating feature card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={featureIdx}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35 }}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1rem',
                padding: '1.25rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                maxWidth: 420,
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(99,102,241,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary-400)', flexShrink: 0,
              }}>
                <FeatureIcon size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{title}</div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '2.5rem' }}>
          {[
            { value: '10,000+', label: 'Active Students' },
            { value: '98%',     label: 'Satisfaction Rate' },
            { value: '24/7',    label: 'AI Assistance' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem', color: 'var(--text-primary)' }}>{value}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Right Panel — Login / OTP Form ── */}
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
          style={{ width: '100%', maxWidth: 440 }}
        >
          {/* Mobile-only logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }} className="show-mobile-flex">
            <img src={learnovaLogo} alt="Learnova" style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Learnova</span>
          </div>

          {!showOtp ? (
            /* ══════════ STANDARD LOGIN ══════════ */
            <>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: '0.375rem' }}>
                  Welcome back 👋
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sign in to continue your learning journey.</p>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Email */}
                <div className="form-group">
                  <label className="form-label" htmlFor="login-email">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      id="login-email"
                      type="email"
                      className="form-input"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="form-label" htmlFor="login-pass" style={{ margin: 0 }}>Password</label>
                    <Link to="/forgot-password" style={{ fontSize: '0.78rem', color: 'var(--primary-500)', fontWeight: 600, textDecoration: 'none' }}>Forgot password?</Link>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      id="login-pass"
                      type={showPass ? 'text' : 'password'}
                      className="form-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={e => setRemember(e.target.checked)}
                    style={{ accentColor: '#6366f1', width: 15, height: 15 }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Remember me</span>
                </label>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#dc2626' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertCircle size={16} />
                        <span>{error}</span>
                      </div>
                      {error.toLowerCase().includes('email not confirmed') && (
                        <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(239,68,68,0.15)', paddingTop: '0.6rem' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setShowOtp(true)
                              setCountdown(60)
                              setCanResend(false)
                              setTimeout(() => inputRefs.current[0]?.focus(), 100)
                            }}
                            style={{ background: 'var(--primary-600)', color: '#fff', border: 'none', padding: '0.4rem 0.85rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Enter 6-Digit Verification Code
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

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
                    : <><span>Sign In</span><ArrowRight size={16} /></>
                  }
                </motion.button>

                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Don't have an account?{' '}
                  <Link to="/register" style={{ color: 'var(--primary-500)', fontWeight: 600, textDecoration: 'none' }}>Create one</Link>
                </p>
              </form>
            </>
          ) : (
            /* ══════════ EMAIL OTP VERIFICATION SCREEN ══════════ */
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
                  Enter the 6-digit verification code sent to:
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(99,102,241,0.1)', padding: '0.35rem 0.85rem', borderRadius: 20, marginTop: '0.5rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Mail size={13} color="var(--primary-400)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{email}</span>
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
                        maxWidth: '54px',
                        height: '58px',
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
                    : <><span>Verify & Sign In</span><ShieldCheck size={16} /></>
                  }
                </motion.button>
              </form>

              {/* Resend & Timer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setShowOtp(false)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                >
                  <ArrowLeft size={14} /> Back to Sign In
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

              {/* Spam Guidance */}
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
                💡 <strong>Tip:</strong> If you don't see the email within a minute, check your <strong>Promotions</strong> or <strong>Spam</strong> folder and mark it as <em>"Not Spam"</em>.
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
