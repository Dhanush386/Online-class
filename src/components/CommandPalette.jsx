import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Search, LayoutDashboard, BookOpen, ClipboardList, Code,
  Trophy, Award, Calendar, Radio, Users, Bell, LogOut,
  Settings, HelpCircle, Zap, Globe, ChevronRight, Command,
  BarChart2, GraduationCap
} from 'lucide-react'

/**
 * CommandPalette — Linear/Notion-style Ctrl+K command palette.
 * Adapts commands based on user role (student vs organizer).
 */

const STUDENT_COMMANDS = [
  { id: 'dash',        label: 'Go to Dashboard',      icon: LayoutDashboard, path: '/student',              group: 'Navigate',  shortcut: 'G D' },
  { id: 'courses',     label: 'My Courses',            icon: BookOpen,        path: '/student/courses',      group: 'Navigate',  shortcut: 'G C' },
  { id: 'assessments', label: 'Assessments',           icon: ClipboardList,   path: '/student/assessments',  group: 'Navigate' },
  { id: 'coding',      label: 'Coding Practice',       icon: Code,            path: '/student/coding',       group: 'Navigate' },
  { id: 'leaderboard', label: 'Leaderboard',           icon: Trophy,          path: '/student/leaderboard',  group: 'Navigate' },
  { id: 'achievements',label: 'Achievements',          icon: Award,           path: '/student/achievements', group: 'Navigate' },
  { id: 'playground',  label: 'Code Playground',       icon: Globe,           path: '/student/playground',   group: 'Tools' },
  { id: 'profile',     label: 'My Profile',            icon: Users,           path: '/student/profile',      group: 'Account' },
  { id: 'renew',       label: 'Renew Access',          icon: Zap,             path: '/student/renew',        group: 'Account' },
  { id: 'support',     label: 'Help & Support',        icon: HelpCircle,      path: '/student/support',      group: 'Account' },
]

const ORGANIZER_COMMANDS = [
  { id: 'dash',        label: 'Dashboard Overview',   icon: LayoutDashboard, path: '/organizer',              group: 'Navigate', shortcut: 'G D' },
  { id: 'courses',     label: 'Course Management',    icon: BookOpen,        path: '/organizer/courses',      group: 'Navigate' },
  { id: 'students',    label: 'Student Management',   icon: GraduationCap,   path: '/organizer/students',     group: 'Navigate' },
  { id: 'assessments', label: 'Assessments',          icon: ClipboardList,   path: '/organizer/assessments',  group: 'Navigate' },
  { id: 'coding',      label: 'Coding Challenges',    icon: Code,            path: '/organizer/coding',       group: 'Navigate' },
  { id: 'live',        label: 'Live Class',           icon: Radio,           path: '/organizer/upload',       group: 'Teach',   shortcut: 'G L' },
  { id: 'schedule',    label: 'Schedule Manager',     icon: Calendar,        path: '/organizer/schedule',     group: 'Teach' },
  { id: 'leaderboard', label: 'Leaderboard',          icon: Trophy,          path: '/organizer/leaderboard',  group: 'Analytics' },
  { id: 'renewals',    label: 'Renewal Requests',     icon: BarChart2,       path: '/organizer/renewals',     group: 'Analytics' },
  { id: 'notif',       label: 'Send Notification',    icon: Bell,            path: '/organizer/notifications',group: 'Tools' },
  { id: 'profile',     label: 'My Profile',           icon: Users,           path: '/organizer/profile',      group: 'Account' },
  { id: 'admins',      label: 'Admin Management',     icon: Settings,        path: '/organizer/admins',       group: 'Account' },
  { id: 'support',     label: 'Help & Support',       icon: HelpCircle,      path: '/organizer/support',      group: 'Account' },
]

export default function CommandPalette({ role = 'student', onSignOut }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef  = useRef(null)
  const navigate  = useNavigate()
  const location  = useLocation()

  const commands = role === 'student' ? STUDENT_COMMANDS : ORGANIZER_COMMANDS

  // Filter commands
  const filtered = query.trim()
    ? commands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.group.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  // Group filtered commands
  const groups = filtered.reduce((acc, cmd) => {
    if (!acc[cmd.group]) acc[cmd.group] = []
    acc[cmd.group].push(cmd)
    return acc
  }, {})

  const flatFiltered = filtered // flat list for keyboard nav

  const openPalette = useCallback(() => {
    setOpen(true)
    setQuery('')
    setIndex(0)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    setQuery('')
    setIndex(0)
  }, [])

  const runCommand = useCallback((cmd) => {
    closePalette()
    if (cmd.id === 'signout') { onSignOut?.(); return }
    navigate(cmd.path)
  }, [closePalette, navigate, onSignOut])

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        open ? closePalette() : openPalette()
      }
      if (e.key === 'Escape' && open) closePalette()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, openPalette, closePalette])

  // Arrow key navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, flatFiltered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && flatFiltered[index]) runCommand(flatFiltered[index])
  }

  // Reset index when filter changes
  useEffect(() => setIndex(0), [query])

  return (
    <>
      {/* Trigger button (shown in header) */}
      <button
        onClick={openPalette}
        className="btn-icon hide-mobile"
        title="Command Palette (Ctrl+K)"
        style={{ gap: '0.4rem', width: 'auto', padding: '0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}
      >
        <Search size={15} />
        <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}>Search...</span>
        <span style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'rgba(100,116,139,0.1)', padding: '0.15rem 0.4rem',
          borderRadius: 5, fontSize: '0.68rem', fontWeight: 600,
          border: '1px solid rgba(100,116,139,0.15)',
        }}>
          <Command size={9} /> K
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              onClick={closePalette}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed', inset: 0,
                background: 'rgba(15,23,42,0.45)',
                backdropFilter: 'blur(6px)',
                zIndex: 9998,
              }}
            />

            {/* Palette */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: -16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -12 }}
              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              style={{
                position: 'fixed',
                top: '15vh',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '100%',
                maxWidth: 560,
                zIndex: 9999,
                padding: '0 1rem',
              }}
            >
              <div style={{
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(24px)',
                borderRadius: 20,
                border: '1px solid rgba(226,232,240,0.8)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)',
                overflow: 'hidden',
              }}>
                {/* Search input */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid rgba(226,232,240,0.6)',
                }}>
                  <Search size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search pages, features, actions..."
                    style={{
                      flex: 1, border: 'none', outline: 'none', background: 'transparent',
                      fontSize: '0.9375rem', fontFamily: 'var(--font-body)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <kbd style={{
                    background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.15)',
                    borderRadius: 6, padding: '0.2rem 0.5rem', fontSize: '0.7rem',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
                  }}>ESC</kbd>
                </div>

                {/* Results */}
                <div style={{ maxHeight: 380, overflowY: 'auto', padding: '0.5rem' }}>
                  {flatFiltered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      No results for "{query}"
                    </div>
                  ) : (
                    Object.entries(groups).map(([group, cmds]) => (
                      <div key={group}>
                        <div style={{
                          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                          textTransform: 'uppercase', color: 'var(--text-muted)',
                          padding: '0.5rem 0.75rem 0.25rem',
                        }}>{group}</div>

                        {cmds.map((cmd) => {
                          const flatIdx = flatFiltered.indexOf(cmd)
                          const isActive = flatIdx === index
                          return (
                            <motion.button
                              key={cmd.id}
                              onClick={() => runCommand(cmd)}
                              onMouseEnter={() => setIndex(flatIdx)}
                              whileTap={{ scale: 0.98 }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                width: '100%', padding: '0.65rem 0.75rem',
                                border: 'none', borderRadius: 10,
                                background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                                cursor: 'pointer', textAlign: 'left',
                                transition: 'background 0.1s ease',
                              }}
                            >
                              <div style={{
                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isActive ? 'rgba(99,102,241,0.12)' : 'rgba(100,116,139,0.07)',
                              }}>
                                <cmd.icon size={15} color={isActive ? 'var(--primary-500)' : 'var(--text-muted)'} />
                              </div>
                              <span style={{
                                flex: 1, fontSize: '0.875rem', fontWeight: 500,
                                color: isActive ? 'var(--primary-700)' : 'var(--text-primary)',
                                fontFamily: 'var(--font-body)',
                              }}>{cmd.label}</span>
                              {cmd.shortcut && (
                                <span style={{
                                  fontSize: '0.7rem', color: 'var(--text-muted)',
                                  background: 'rgba(100,116,139,0.08)',
                                  border: '1px solid rgba(100,116,139,0.12)',
                                  borderRadius: 5, padding: '0.15rem 0.4rem',
                                  fontFamily: 'var(--font-body)',
                                }}>{cmd.shortcut}</span>
                              )}
                              {isActive && <ChevronRight size={14} color="var(--primary-400)" />}
                            </motion.button>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div style={{
                  padding: '0.625rem 1.25rem',
                  borderTop: '1px solid rgba(226,232,240,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                    {flatFiltered.length} result{flatFiltered.length !== 1 ? 's' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {[
                      { key: '↑↓', label: 'Navigate' },
                      { key: 'Enter', label: 'Select' },
                      { key: 'Esc', label: 'Close' },
                    ].map(({ key, label }) => (
                      <span key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                        <kbd style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>{key}</kbd>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
