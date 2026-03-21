import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { GraduationCap, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function Login() {
    const { signIn, user, role, loading: authLoading } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ email: '', password: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [isLampOn, setIsLampOn] = useState(false)
    const [infoMessage, setInfoMessage] = useState('')
 
    useEffect(() => {
        // Check for session replacement reason
        const params = new URLSearchParams(window.location.search)
        if (params.get('reason') === 'replaced') {
            setInfoMessage('You have been logged out because someone else logged into your account from a different device.')
        }

        const timer = setTimeout(() => {
            setIsLampOn(true)
        }, 3000)
        return () => clearTimeout(timer)
    }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const cleanEmail = form.email.trim().toLowerCase()
            const { user: authUser } = await signIn({ ...form, email: cleanEmail })
            const { data } = await supabase
                .from('users')
                .select('role')
                .eq('id', authUser.id)
                .maybeSingle()
            
            const role = data?.role || authUser.user_metadata?.role || 'student'

            const isAdmin = ['organizer', 'sub_admin', 'main_admin'].includes(role)
            if (isAdmin) navigate('/organizer')
            else navigate('/student')
        } catch (err) {
            setError(err.message || 'Invalid email or password')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: isLampOn ? '#0f172a' : '#020617',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            position: 'relative',
            overflow: 'hidden',
            transition: 'background 0.8s ease'
        }}>
            {/* The Cinematic Scene */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                {/* Full Screen Lamp Background */}
                <div className="lamp-bg" style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 0,
                    filter: isLampOn ? 'saturate(1.2) contrast(1.1)' : 'brightness(0.15) grayscale(0.5)',
                    transition: 'filter 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden'
                }}>
                    <img 
                        src="/lamp.png" 
                        alt="Cinematic Lamp" 
                        style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover', 
                            display: 'block',
                            opacity: isLampOn ? 0.7 : 0.4,
                            transition: 'opacity 1.2s ease'
                        }} 
                    />
                </div>

                {/* Light Glow Effect - Adjusted for full screen */}
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '150vw',
                    height: '150vw',
                    background: 'radial-gradient(circle at 50% 50%, rgba(253, 224, 71, 0.15) 0%, rgba(253, 224, 71, 0.08) 25%, transparent 60%)',
                    opacity: isLampOn ? 1 : 0,
                    transition: 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 1
                }} />
            </div>

            {/* The Switch Component */}
            <div style={{
                position: 'fixed',
                top: 40,
                right: 40,
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12
            }}>
                <button
                    onClick={() => setIsLampOn(!isLampOn)}
                    aria-label="Toggle cinematic lamp"
                    style={{
                        width: 64,
                        height: 32,
                        borderRadius: '20px',
                        background: isLampOn ? '#6366f1' : '#1e293b',
                        border: '2px solid rgba(255,255,255,0.1)',
                        position: 'relative',
                        cursor: 'pointer',
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        padding: 2,
                        boxShadow: isLampOn ? '0 0 20px rgba(99, 102, 241, 0.4)' : 'none'
                    }}
                >
                    <div style={{
                        width: 24,
                        height: 24,
                        background: 'white',
                        borderRadius: '50%',
                        position: 'absolute',
                        left: isLampOn ? 'calc(100% - 28px)' : 4,
                        top: 2,
                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                </button>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {isLampOn ? 'Light On' : 'Light Off'}
                </span>
            </div>

            {/* Login Interface */}
            <div style={{
                position: 'relative',
                zIndex: 50,
                width: '100%',
                maxWidth: 420,
                opacity: isLampOn ? 1 : 0,
                transform: isLampOn ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
                transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                pointerEvents: isLampOn ? 'all' : 'none'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 10px 30px rgba(99,102,241,0.2)' }}>
                        <GraduationCap size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'white' }} className="gradient-text">EduStream</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Welcome back to the stream</p>
                </div>

                <div className="glass-card" style={{
                    padding: '2.5rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(24px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}>
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, marginBottom: '1.5rem', color: '#f87171', fontSize: '0.85rem' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {infoMessage && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 10, marginBottom: '1.5rem', color: '#818cf8', fontSize: '0.85rem' }}>
                            <AlertCircle size={16} />
                            {infoMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label htmlFor="email" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, display: 'block' }}>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    className="form-input"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                                    style={{
                                        paddingLeft: '3rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white',
                                        height: 48
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="password" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 8, display: 'block' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }} />
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    className="form-input"
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                                    style={{
                                        paddingLeft: '3rem',
                                        paddingRight: '3rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: 'white',
                                        height: 48
                                    }}
                                    required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', height: 48, fontSize: '1rem', fontWeight: 600, background: 'white', color: '#0f172a' }}>
                            {loading ? 'Joining Stream...' : 'Sign In'}
                        </button>
                    </form>

                    <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)' }}>
                        Don't have an account?{' '}
                        <Link to="/register" style={{ color: 'white', fontWeight: 700, textDecoration: 'none' }}>Create one</Link>
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0) translateX(-50%); }
                    50% { transform: translateY(-10px) translateX(-50%); }
                }
                .lamp-container {
                    animation: float 6s ease-in-out infinite;
                }
                .form-input::placeholder { color: rgba(255,255,255,0.2); }
            `}</style>
        </div>
    )
}
