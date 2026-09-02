import { useState, useRef, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Sun, Moon, Zap, Sparkles, Flame, Check, Palette } from 'lucide-react'
import useTheme from '../../hooks/useTheme'
import { THEMES } from '../../constants/themes'

const ICON_MAP = {
  Sun,
  Moon,
  Zap,
  Sparkles,
  Flame
}

export default function ThemeSelector() {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  const currentThemeObj = THEMES.find(t => t.id === theme) || THEMES[0]
  const CurrentIcon = ICON_MAP[currentThemeObj.icon] || Palette

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn-icon"
        title={`Current Theme: ${currentThemeObj.name} (Click to change)`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          color: theme === 'light' ? '#4f46e5' : 'var(--text-primary)',
          transition: 'all 0.2s'
        }}
        aria-label="Change Color Theme"
      >
        <CurrentIcon size={17} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div
            className="dropdown-menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 260,
              padding: '0.65rem',
              zIndex: 300,
              background: 'var(--card-bg)',
              border: '1px solid var(--sidebar-border)',
              borderRadius: '14px',
              boxShadow: 'var(--shadow-xl)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div style={{ padding: '0.35rem 0.5rem 0.65rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>
                Theme Appearance
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary-400)', fontWeight: 600 }}>
                {currentThemeObj.name}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
              {THEMES.map((t) => {
                const ItemIcon = ICON_MAP[t.icon] || Palette
                const isSelected = t.id === theme

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTheme(t.id)
                      setIsOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '8px',
                      border: isSelected ? `1px solid ${t.previewAccent}` : '1px solid transparent',
                      background: isSelected ? 'var(--bg-elevated)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface-hover)'
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {/* Color Preview Swatch */}
                      <div style={{
                        width: 24,
                        height: 24,
                        borderRadius: '6px',
                        background: t.previewBg,
                        border: `1.5px solid ${t.previewAccent}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: t.previewAccent,
                        flexShrink: 0
                      }}>
                        <ItemIcon size={12} />
                      </div>

                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: isSelected ? 700 : 500, color: 'var(--text-primary)' }}>
                          {t.name}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={15} color={t.previewAccent} style={{ strokeWidth: 3 }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
