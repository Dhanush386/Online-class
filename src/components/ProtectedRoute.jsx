import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children, requiredRole }) {
    const { user, profile, loading, signOut } = useAuth()
    const location = useLocation()

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0d1a' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 48, height: 48, border: '3px solid rgba(99,102,241,0.3)',
                        borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px'
                    }} />
                    <p style={{ color: '#6366f1', fontSize: '0.875rem' }}>Loading...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (requiredRole && profile?.role !== requiredRole) {
        // Redirect to correct dashboard IF a role exists
        if (profile?.role === 'organizer') return <Navigate to="/organizer" replace />
        if (profile?.role === 'student') return <Navigate to="/student" replace />

        // If we have a user but NO profile record, don't loop back to login.
        // Show a helpful message instead.
        if (!profile) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0d1a', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card" style={{ padding: '2rem', maxWidth: 400 }}>
                        <h2 style={{ color: '#ef4444', marginBottom: '1rem' }}>Profile Sync Issue</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            We found your account but couldn't load your profile record.
                            If you just registered, try refreshing. If you are using an old account,
                            please contact support.
                        </p>
                        <button onClick={() => window.location.reload()} className="btn-primary" style={{ width: '100%', marginBottom: '0.75rem' }}>Refresh Page</button>
                        <button onClick={() => signOut()} className="btn-secondary" style={{ width: '100%' }}>Sign Out</button>
                    </div>
                </div>
            )
        }

        return <Navigate to="/login" replace />
    }

    if (profile?.role === 'student') {
        if (profile.status === 'pending') {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0d1a', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card" style={{ padding: '2rem', maxWidth: 400 }}>
                        <div style={{ width: 64, height: 64, background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem' }}>⏳</div>
                        <h2 style={{ color: 'white', marginBottom: '1rem', fontWeight: 700 }}>Pending Approval</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                            Your account has been created successfully. An organizer must review and approve your registration before you can access the platform.
                        </p>
                        <button onClick={() => window.location.reload()} className="btn-primary" style={{ width: '100%', marginBottom: '0.75rem' }}>Refresh Status</button>
                        <button onClick={() => signOut()} className="btn-secondary" style={{ width: '100%' }}>Sign Out</button>
                    </div>
                </div>
            )
        }
        if (profile.status === 'rejected') {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0d1a', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card" style={{ padding: '2rem', maxWidth: 400 }}>
                        <div style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem' }}>❌</div>
                        <h2 style={{ color: '#ef4444', marginBottom: '1rem', fontWeight: 700 }}>Access Declined</h2>
                        <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                            Your registration has been declined by an organizer. Please contact support if you believe this is an error.
                        </p>
                        <button onClick={() => signOut()} className="btn-secondary" style={{ width: '100%' }}>Sign Out</button>
                    </div>
                </div>
            )
        }
    }

    return children
}
