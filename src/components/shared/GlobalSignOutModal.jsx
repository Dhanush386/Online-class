import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function GlobalSignOutModal() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const isOrganizer = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)
  const roleName = isOrganizer ? 'Organizer' : 'Student'

  // Intercept browser back button on all authenticated routes
  useEffect(() => {
    if (!user) return

    const isClassroom = location.pathname.includes('/classroom/')
    if (isClassroom) return // Live classroom has its own meeting guard

    const isAuthRoute = location.pathname.startsWith('/organizer') || location.pathname.startsWith('/student')
    if (!isAuthRoute) return

    // Ensure a trap state exists on the history stack
    if (!window.history.state?.__backTrap) {
      window.history.pushState({ ...window.history.state, __backTrap: true }, '')
    }

    const handlePopState = (e) => {
      // Re-push trap state immediately to prevent exiting the current page
      window.history.pushState({ ...window.history.state, __backTrap: true }, '')
      setIsOpen(true)
    }

    const handleOpenModal = () => {
      setIsOpen(true)
    }

    window.addEventListener('popstate', handlePopState)
    window.addEventListener('open-signout-modal', handleOpenModal)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('open-signout-modal', handleOpenModal)
    }
  }, [user, location.pathname])

  const handleConfirmSignOut = useCallback(async () => {
    setIsOpen(false)
    await signOut()
    navigate('/login', { replace: true })
  }, [signOut, navigate])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <AnimatePresence>
      {isOpen && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          style={{
            width: '100%', maxWidth: '420px',
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--card-border, rgba(0,0,0,0.12))',
            borderRadius: '20px',
            padding: '2rem 1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            textAlign: 'center',
            color: 'var(--text-primary, #0f172a)'
          }}
        >
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.25rem'
          }}>
            <LogOut size={28} />
          </div>

          <h3 style={{ 
            fontSize: '1.35rem', 
            fontWeight: 800, 
            marginBottom: '0.6rem', 
            color: 'var(--text-primary, #0f172a)',
            fontFamily: 'var(--font-display, inherit)'
          }}>
            Sign Out Confirmation
          </h3>
          <p style={{ 
            fontSize: '0.925rem', 
            color: 'var(--text-secondary, #475569)', 
            marginBottom: '1.75rem', 
            lineHeight: 1.55 
          }}>
            Are you sure you want to sign out of your <strong style={{ color: 'var(--text-primary, #0f172a)' }}>{roleName}</strong> account? You will need your password to log back in.
          </p>

          <div style={{ display: 'flex', gap: '0.85rem' }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                flex: 1, 
                padding: '0.75rem 1rem', 
                borderRadius: '12px',
                background: 'var(--bg-elevated, #f1f5f9)',
                border: '1px solid var(--sidebar-border, #cbd5e1)',
                color: 'var(--text-primary, #1e293b)', 
                fontWeight: 600, 
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSignOut}
              style={{
                flex: 1, 
                padding: '0.75rem 1rem', 
                borderRadius: '12px',
                background: '#dc2626', 
                border: 'none',
                color: '#ffffff', 
                fontWeight: 700, 
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
                transition: 'all 0.2s'
              }}
            >
              Sign Out
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  )
}
