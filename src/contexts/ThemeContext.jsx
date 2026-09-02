import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { ThemeContext } from './themeContextDef'
import { THEMES } from '../constants/themes'

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('learnova-theme')
      if (saved && THEMES.some(t => t.id === saved)) {
        return saved
      }
    } catch { /* ignore */ }
    return 'dark'
  })

  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('learnova-theme', theme)
    } catch (e) {
      console.error('Failed to set theme:', e)
    }
  }, [theme])

  const setTheme = (newTheme) => {
    if (THEMES.some(t => t.id === newTheme)) {
      setThemeState(newTheme)
    }
  }

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, availableThemes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired
}
