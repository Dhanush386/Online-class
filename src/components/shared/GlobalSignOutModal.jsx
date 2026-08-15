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

  // Intercept browser back button on root dashboard pages
  useEffect(() => {
    if (!user) return

    const isDashboardRoot = 
      location.pathname === '/organizer' || 
      location.pathname === '/organizer/' ||
      location.pathname === '/student' || 
      location.pathname === '/student/'

    if (!isDashboardRoot) return

    // Push dummy state so browser back button triggers popstate instead of exiting
    try {
      window.history.pushState({ ...window.history.state, __dashboardTrap: true }, '', location.pathname)
    } catch (e) {
      console.warn("History push failed:", e)
    }

    const handlePopState = (e) => {
      e.preventDefault()
      setIsOpen(true)
      try {
        window.history.pushState({ ...window.history.state, __dashboardTrap: true }, '', location.pathname)
      } catch (err) {
        console.warn("History push failed:", err)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
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

  if (!isOpen) return null

  return (
    <AnimatePresence>
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
            width: '100%', maxWidth: '400px',
            background: 'var(--bg-overlay, #0f172a)',
            border: '1px solid var(--sidebar-border, rgba(255,255,255,0.12))',
            borderRadius: '20px',
            padding: '1.75rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            textAlign: 'center',
            color: '#ffffff'
          }}
        >
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <LogOut size={28} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: '#ffffff' }}>
            Sign Out Confirmation
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Are you sure you want to sign out of your {roleName} account? You will need your password to log back in.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSignOut}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '12px',
                background: '#ef4444', border: 'none',
                color: '#ffffff', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              Sign Out
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
