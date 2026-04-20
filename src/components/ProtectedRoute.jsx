import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import FaceVerificationModal from './shared/FaceVerificationModal'

export function ProtectedRoute({ children, requiredRole }) {
    const { user, profile, loading, signOut, isProfileComplete, isExpired, isFaceVerifiedToday } = useAuth()
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

    const isAdmin = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)
    const isStudent = profile?.role === 'student'

    // If we have a user but NO profile record/role after loading is finished,
    // don't enter a redirect loop. Show a sync issue message.
    if (!profile || (!isAdmin && !isStudent)) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0d1a', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="glass-card" style={{ padding: '2rem', maxWidth: 400 }}>
                    <div style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem' }}>⚠️</div>
                    <h2 style={{ color: '#ef4444', marginBottom: '1rem', fontWeight: 700 }}>Profile Sync Issue</h2>
                    <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                        We found your account but couldn't determine your role or load your profile.
                        Try refreshing the page or signing out and back in.
                    </p>
                    <button onClick={() => window.location.reload()} className="btn-primary" style={{ width: '100%', marginBottom: '0.75rem' }}>Refresh Page</button>
                    <button onClick={() => signOut()} className="btn-secondary" style={{ width: '100%' }}>Sign Out</button>
                </div>
            </div>
        )
    }

    // Strict Role Enforcement
    if (requiredRole === 'organizer' && !isAdmin) {
        return <Navigate to="/student" replace />
    }

    // Allow admins to access student routes for testing/previewing
    if (requiredRole === 'student' && !isStudent && !isAdmin) {
        return <Navigate to="/organizer" replace />
    }

    // Role-specific secondary checks
    if (isStudent) {
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

        // Mandatory Profile Check for Students
        if (!isProfileComplete && location.pathname !== '/student/profile') {
            return <Navigate to="/student/profile" replace />
        }

        if (isExpired && location.pathname !== '/student/renew') {
            return <Navigate to="/student/renew" replace />
        }
    }

    // Global Face Verification Check (for everyone: Student, Organizer, Admin)
    if (user && profile && !isFaceVerifiedToday) {
        return <FaceVerificationModal />
    }

    // Default: allow access
    return children
}
