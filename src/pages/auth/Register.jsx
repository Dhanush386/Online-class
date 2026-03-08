import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { GraduationCap, Mail, Lock, User, Eye, EyeOff, AlertCircle, BookOpen, Users } from 'lucide-react'

export default function Register() {
    const { signUp } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [isInvited, setIsInvited] = useState(false)

    useEffect(() => {
        const checkInvite = async () => {
            if (form.email.includes('@')) {
                const { data, error } = await supabase
                    .from('organizer_invites')
                    .select('email')
                    .eq('email', form.email.toLowerCase())
                    .single()

                if (data && !error) {
                    setIsInvited(true)
                } else {
                    setIsInvited(false)
                    if (form.role === 'organizer') setForm(p => ({ ...p, role: 'student' }))
                }
            } else {
                setIsInvited(false)
                if (form.role === 'organizer') setForm(p => ({ ...p, role: 'student' }))
            }
        }
        const timer = setTimeout(checkInvite, 500)
        return () => clearTimeout(timer)
    }, [form.email])

    async function handleSubmit(e) {
        e.preventDefault()
        if (form.password.length < 6) { setError('Password must be at least 6 characters'); return }
        setLoading(true)
        setError('')
        try {
            await signUp(form)
            navigate(form.role === 'organizer' ? '/organizer' : '/student')
        } catch (err) {
            setError(err.message || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

            <div className="animate-fade-in" style={{ width: '100%', maxWidth: 440 }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 10px 30px rgba(99,102,241,0.2)' }}>
                        <GraduationCap size={32} color="white" />
                    </div>
                    <h1 className="gradient-text" style={{ fontSize: '1.75rem', fontWeight: 800 }}>Create Account</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Join EduStream today</p>
                </div>

                <div className="glass-card" style={{ padding: '2rem' }}>
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: '1.25rem', color: '#f87171', fontSize: '0.85rem' }}>
                            <AlertCircle size={16} />{error}
                        </div>
                    )}

                    {/* Role Selector */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">I am a...</label>
                        <div style={{ display: 'grid', gridTemplateColumns: isInvited ? '1fr 1fr' : '1fr', gap: '0.75rem' }}>
                            {[
                                { value: 'student', label: 'Student', icon: BookOpen, color: '#10b981', show: true },
                                { value: 'organizer', label: 'Organizer', icon: Users, color: '#6366f1', show: isInvited },
                            ].filter(r => r.show).map(({ value, label, icon: Icon, color }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setForm(p => ({ ...p, role: value }))}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: 12,
                                        border: `2px solid ${form.role === value ? color : 'var(--card-border)'}`,
                                        background: form.role === value ? `rgba(${value === 'student' ? '16,185,129' : '99,102,241'},0.1)` : 'rgba(255,255,255,0.03)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <Icon size={24} color={form.role === value ? color : 'var(--text-muted)'} />
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: form.role === value ? color : 'var(--text-secondary)' }}>{label}</span>
                                </button>
                            ))}
                        </div>
                        {isInvited && form.role !== 'organizer' && (
                            <p style={{ fontSize: '0.7rem', color: '#6366f1', marginTop: '0.5rem', textAlign: 'center' }}>
                                ✨ You are invited to join as an Organizer!
                            </p>
                        )}
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                        <div>
                            <label className="form-label">Full Name</label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    className="form-input"
                                    placeholder="John Doe"
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    style={{ paddingLeft: '2.5rem' }}
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="form-label">Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    style={{ paddingLeft: '2.5rem' }}
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="form-label">Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    placeholder="Min. 6 characters"
                                    value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    style={{ paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                                    required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', height: 44, fontSize: '0.95rem', background: form.role === 'student' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                            {loading ? <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 1s linear infinite', display: 'inline-block' }} /> Creating...</> : 'Create Account'}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Already have an account?{' '}
                        <Link to="/login" style={{ color: 'var(--accent-light)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
                    </p>
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}
