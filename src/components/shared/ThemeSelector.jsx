import { Sun, Moon } from 'lucide-react'
import useTheme from '../../hooks/useTheme'

export default function ThemeSelector() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="btn-icon"
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        color: isDark ? '#fbbf24' : '#6366f1',
        transition: 'all 0.25s ease',
        borderRadius: '8px'
      }}
    >
      {isDark ? (
        <Moon size={18} style={{ transform: 'rotate(-10deg)', transition: 'transform 0.2s' }} />
      ) : (
        <Sun size={18} style={{ transform: 'rotate(0deg)', transition: 'transform 0.2s' }} />
      )}
    </button>
  )
}
