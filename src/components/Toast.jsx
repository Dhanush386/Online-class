import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

// ─── Context ─────────────────────────────────────────────────────────────────
const ToastContext = createContext(null)

const ICONS = {
  success: <CheckCircle size={18} />,
  error:   <XCircle size={18} />,
  warning: <AlertTriangle size={18} />,
  info:    <Info size={18} />,
}

const COLORS = {
  success: { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46', icon: '#10b981' },
  error:   { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b', icon: '#ef4444' },
  warning: { bg: '#fef3c7', border: '#fcd34d', text: '#92400e', icon: '#f59e0b' },
  info:    { bg: '#e0e7ff', border: '#a5b4fc', text: '#3730a3', icon: '#6366f1' },
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info:    (msg, dur) => addToast(msg, 'info',    dur),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div style={{
        position: 'fixed', bottom: '1.5rem', right: '1.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
        zIndex: 99999, pointerEvents: 'none',
        maxWidth: 'min(380px, calc(100vw - 2rem))',
      }}>
        {toasts.map(t => {
          const c = COLORS[t.type] || COLORS.info
          return (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              background: c.bg, border: `1px solid ${c.border}`,
              borderRadius: 12, padding: '0.875rem 1rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              animation: 'toastIn 0.3s ease',
              pointerEvents: 'all',
            }}>
              <span style={{ color: c.icon, flexShrink: 0, marginTop: 1 }}>
                {ICONS[t.type]}
              </span>
              <span style={{ fontSize: '0.875rem', color: c.text, flex: 1, lineHeight: 1.5 }}>
                {t.message}
              </span>
              <button
                onClick={() => dismiss(t.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: c.text, opacity: 0.6, padding: 0, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>
          )
        })}
      </div>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────
// Usage: const toast = useToast(); toast.success('Done!')
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
