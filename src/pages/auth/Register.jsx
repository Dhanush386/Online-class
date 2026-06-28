import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, AlertCircle, BookOpen, Users, ArrowRight, Sparkles } from 'lucide-react'
import AnimatedBackground from '../../components/background/AnimatedBackground'

export default function Register() {
    const { signUp } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isInvited, setIsInvited] = useState(false)

    useEffect(() => {
        const cleanEmail = form.email.trim().toLowerCase()
        const checkInvite = async () => {
            if (cleanEmail.includes('@')) {
                const { data, error } = await supabase
                    .from('organizer_invites')
                    .select('role')
                    .eq('email', cleanEmail)
                    .maybeSingle()
                if (data && !error) {
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
    }, [form.email])

    async function handleSubmit(e) {
        e.preventDefault()
        const cleanEmail = form.email.trim().toLowerCase()
        const cleanName = form.name.trim()
        if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
        setLoading(true)
        setError('')
        try {
            await signUp({ ...form, email: cleanEmail, name: cleanName })
            const isAdmin = ['organizer', 'sub_admin', 'main_admin'].includes(form.role)
            navigate(isAdmin ? '/organizer' : '/student/profile')
        } catch (err) {
            setError(err.message || 'Registration failed')
        } finally {
            setLoading(false)
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
                    <div style={{
                        width: 42, height: 42, borderRadius: 12,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
                    }}>
                        <GraduationCap size={22} color="white" />
                    </div>
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

            {/* ── Right Panel — Register Form ── */}
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
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <GraduationCap size={18} color="white" />
                        </div>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Learnova</span>
                    </div>

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
                </motion.div>
            </div>
        </div>
    )
}
