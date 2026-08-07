import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import PropTypes from 'prop-types'

function LoadingView() {
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

function ProfileSyncIssue({ signOut }) {
    return (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0d1a', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card" style={{ padding: '2rem', maxWidth: 400 }}>
                <div style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem' }}>⚠️</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Profile Synchronization Issue</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    We could not retrieve your user profile or role correctly. Please try signing out and logging back in.
                </p>
                <button
                    onClick={signOut}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                >
                    Sign Out & Retry
                </button>
            </div>
        </div>
    )
}

function PendingApproval({ signOut }) {
    return (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0d1a', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card" style={{ padding: '2rem', maxWidth: 400 }}>
                <div style={{ width: 64, height: 64, background: 'rgba(234,179,8,0.1)', color: '#eab308', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem' }}>⏳</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Account Pending Approval</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    Your student account is currently pending approval from the organizer. Please check back later.
                </p>
                <button
                    onClick={signOut}
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                >
                    Sign Out
                </button>
            </div>
        </div>
    )
}

function AccessDeclined({ signOut }) {
    return (
        <div style={{ padding: '2rem', textAlign: 'center', background: '#0a0d1a', color: 'white', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card" style={{ padding: '2rem', maxWidth: 400 }}>
                <div style={{ width: 64, height: 64, background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem' }}>❌</div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Access Request Declined</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    Your access request to this platform has been declined by the administrator.
                </p>
                <button
                    onClick={signOut}
                    className="btn btn-secondary"
                    style={{ width: '100%' }}
                >
                    Sign Out
                </button>
            </div>
        </div>
    )
}

function getRoleRedirectPath(requiredRole, isAdmin, isStudent) {
    if (requiredRole === 'admin' && !isAdmin) return '/dashboard'
    if (requiredRole === 'student' && !isStudent) return '/organizer/dashboard'
    return null
}

function handleStudentState(profile, isProfileComplete, isExpired, currentPath, signOut) {
    if (profile.status === 'pending') return <PendingApproval signOut={signOut} />
    if (profile.status === 'declined') return <AccessDeclined signOut={signOut} />
    if (profile.status !== 'approved') return <AccessDeclined signOut={signOut} />

    if (!isProfileComplete) {
        if (currentPath !== '/complete-profile') return <Navigate to="/complete-profile" replace />
        return null
    }

    if (isExpired) {
        if (currentPath !== '/renew-access') return <Navigate to="/renew-access" replace />
        return null
    }

    if (currentPath === '/complete-profile' || currentPath === '/renew-access') {
        return <Navigate to="/dashboard" replace />
    }

    return null
}

export function ProtectedRoute({ children, requiredRole }) {
    const { user, profile, loading, signOut, isProfileComplete, isExpired } = useAuth()
    const location = useLocation()

    if (loading) return <LoadingView />
    if (!user) return <Navigate to="/login" state={{ from: location }} replace />

    const isAdmin = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)
    const isStudent = profile?.role === 'student'

    if (!profile || (!isAdmin && !isStudent)) {
        return <ProfileSyncIssue signOut={signOut} />
    }

    const roleRedirect = getRoleRedirectPath(requiredRole, isAdmin, isStudent)
    if (roleRedirect) return <Navigate to={roleRedirect} replace />

    if (isStudent) {
        const studentRedirect = handleStudentState(profile, isProfileComplete, isExpired, location.pathname, signOut)
        if (studentRedirect) return studentRedirect
    }

    return children
}

ProfileSyncIssue.propTypes = {
    signOut: PropTypes.func.isRequired,
}

PendingApproval.propTypes = {
    signOut: PropTypes.func.isRequired,
}

AccessDeclined.propTypes = {
    signOut: PropTypes.func.isRequired,
}

ProtectedRoute.propTypes = {
    children: PropTypes.node.isRequired,
    requiredRole: PropTypes.string,
}
