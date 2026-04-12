import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { GraduationCap, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function Login() {
    const { signIn, user: authUser, role: authRole, loading: authLoading } = useAuth()
    const navigate = useNavigate()
    const [form, setForm] = useState({ email: '', password: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')


    const [infoMessage, setInfoMessage] = useState('')

 
    useEffect(() => {
        // Check for session replacement reason
        const params = new URLSearchParams(window.location.search)
        if (params.get('reason') === 'replaced') {
            setInfoMessage('You have been logged out because someone else logged into your account from a different device.')
        }


    }, [])

    async function handleSubmit(e) {
        e.preventDefault()
        setLoading(true)
        setError('')
        try {
            const cleanEmail = form.email.trim().toLowerCase()
            const { user: authedUser } = await signIn({ ...form, email: cleanEmail })
            
            // 1. Fetch user role
            const { data: userData, error: roleError } = await supabase
                .from('users')
                .select('role')
                .eq('id', authedUser.id)
                .single()
            
            if (roleError) throw roleError
            
            const role = userData?.role || 'student'
            const isAdmin = ['organizer', 'sub_admin', 'main_admin'].includes(role)
            
            if (isAdmin) navigate('/organizer')
            else navigate('/student')
        } catch (err) {
            setError(err.message || 'Invalid email or password')
            setLoading(false)
        }
    }


    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f172a',
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
                    filter: 'saturate(1.2) contrast(1.1)',
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
                            opacity: 0.7,
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
                    opacity: 1,
                    transition: 'opacity 1.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 1
                }} />
            </div>



            {/* Login Interface */}
            <div style={{
                position: 'relative',
                zIndex: 50,
                width: '100%',
                maxWidth: 420,
                opacity: 1,
                transform: 'translateY(0) scale(1)',
                transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)',
                pointerEvents: 'all'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <img 
                        src="/logo.png" 
                        alt="Learnova Logo" 
                        style={{ 
                            height: 100, 
                            width: 'auto',
                            margin: '0 auto 0.5rem',
                            display: 'block'
                        }} 
                    />
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginTop: '0rem' }}>Welcome back to the stream</p>
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
