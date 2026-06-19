import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useMeeting } from '../contexts/MeetingContext'
import {
  LayoutDashboard, BookOpen, Calendar, ClipboardList, LogOut,
  GraduationCap, Menu, X, Bell, Award, Code, Globe,
  User, Zap, HelpCircle, MessageCircle, Mountain, ChevronRight,
  Flame, Star, Info, AlertTriangle, CheckCircle, Clock, Trophy, CreditCard,
  ChevronDown
} from 'lucide-react'
import AIChatbot from '../components/shared/AIChatbot'
import CommandPalette from '../components/CommandPalette'
import { Avatar } from '../design-system'
import { ProgressRing } from '../design-system'

const NAV_GROUPS = [
  {
    label: 'Learn',
    items: [
      { to: '/student',             icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/student/courses',     icon: BookOpen,        label: 'My Courses' },
      { to: '/student/assessments', icon: ClipboardList,   label: 'Assessments' },
      { to: '/student/coding',      icon: Code,            label: 'Coding Practice' },
    ],
  },
  {
    label: 'Compete',
    items: [
      { to: '/student/leaderboard',  icon: Trophy,  label: 'Leaderboard' },
      { to: '/student/achievements', icon: Award,   label: 'Achievements' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { to: '/student/playground', icon: Globe,        label: 'Code Playground' },
      { to: '/student/support',    icon: HelpCircle,   label: 'Help & Support' },
    ],
  },
]

// Rank thresholds
const RANK_LEVELS = [
  { name: 'Iron I',      min: 0,    max: 200,   color: 'var(--text-muted)' },
  { name: 'Iron II',     min: 200,  max: 400,   color: 'var(--text-muted)' },
  { name: 'Bronze I',    min: 400,  max: 700,   color: '#cd7c2f' },
  { name: 'Bronze II',   min: 700,  max: 1000,  color: '#cd7c2f' },
  { name: 'Silver I',    min: 1000, max: 1500,  color: 'var(--text-muted)' },
  { name: 'Silver II',   min: 1500, max: 2100,  color: 'var(--text-muted)' },
  { name: 'Gold I',      min: 2100, max: 2800,  color: '#f59e0b' },
  { name: 'Gold II',     min: 2800, max: 3600,  color: '#f59e0b' },
  { name: 'Platinum I',  min: 3600, max: 4500,  color: '#06b6d4' },
  { name: 'Diamond',     min: 4500, max: 99999, color: '#6366f1' },
]

function getRankInfo(xp = 0) {
  const rank = RANK_LEVELS.find(r => xp >= r.min && xp < r.max) || RANK_LEVELS[0]
  const next = RANK_LEVELS[RANK_LEVELS.indexOf(rank) + 1]
  const progress = next
    ? Math.round(((xp - rank.min) / (rank.max - rank.min)) * 100)
    : 100
  const xpToNext = next ? rank.max - xp : 0
  return { ...rank, progress, xpToNext, nextName: next?.name }
}

export default function StudentLayout() {
  const { profile, signOut, stats } = useAuth()
  const { requestNavigation } = useMeeting()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [collapsed,       setCollapsed]       = useState(false)
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false)
  const [isMobile,        setIsMobile]        = useState(window.innerWidth <= 768)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications,   setNotifications]   = useState([])
  const [unreadCount,     setUnreadCount]     = useState(0)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const isOrganizer = ['organizer', 'main_admin', 'sub_admin'].includes(profile?.role)

  const rankInfo = getRankInfo(stats?.xp || 0)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    if (profile?.id) {
      fetchNotifications()
      const channel = supabase.channel('global-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
          if (payload.new.target === 'all' || payload.new.target === 'students') {
            setNotifications(prev => [payload.new, ...prev])
            setUnreadCount(prev => prev + 1)
          }
        }).subscribe()
      return () => supabase.removeChannel(channel)
    }
  }, [profile?.id])

  async function fetchNotifications() {
    if (!profile?.id) return
    try {
      const { data: notes } = await supabase.from('notifications').select('*')
        .or('target.eq.all,target.eq.students').order('created_at', { ascending: false }).limit(10)
      const { data: reads } = await supabase.from('notification_reads').select('notification_id').eq('user_id', profile.id)
      const readIds = new Set((reads || []).map(r => r.notification_id))
      const notesWithRead = (notes || []).map(n => ({ ...n, isRead: readIds.has(n.id) }))
      setNotifications(notesWithRead)
      setUnreadCount(notesWithRead.filter(n => !n.isRead).length)
    } catch (err) { console.error('Notifications error:', err) }
  }

  async function handleMarkAllAsRead() {
    if (!profile?.id || unreadCount === 0) return
    try {
      const unread = notifications.filter(n => !n.isRead)
      await supabase.from('notification_reads').upsert(unread.map(n => ({ notification_id: n.id, user_id: profile.id })))
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) { console.error(err) }
  }

  async function handleSignOut() { 
    if (requestNavigation('/login')) return;
    await signOut(); navigate('/login') 
  }

  const navIconStyle = (isActive) => ({
    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
    transition: 'background 0.15s ease',
  })

  /* ── Mobile bottom nav (5 items) ── */
  const BOTTOM_NAV = [
    { to: '/student',             icon: LayoutDashboard, label: 'Home',     end: true },
    { to: '/student/courses',     icon: BookOpen,        label: 'Courses' },
    { to: '/student/leaderboard', icon: Trophy,          label: 'Rank' },
    { to: '/student/achievements',icon: Award,           label: 'Awards' },
    { to: '/student/profile',     icon: User,            label: 'Profile' },
  ]

  const inClassroomOnMobile = isMobile && location.pathname.includes('/classroom/')

  return (
    <div style={{ display: 'flex', height: '100dvh', background: 'var(--bg-primary)' }}>
      {/* ── Mobile Menu Overlay ── */}
      <AnimatePresence>
        {!inClassroomOnMobile && isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 40 }}
          />
        )}
      </AnimatePresence>

      {/* ══════════════ SIDEBAR ══════════════ */}
      {!inClassroomOnMobile && (
        <motion.aside
          animate={{
            width: isMobile ? (mobileMenuOpen ? 260 : 0) : collapsed ? 68 : 260,
            x: isMobile && !mobileMenuOpen ? -260 : 0,
          }}
        transition={{ type: 'spring', stiffness: 350, damping: 36 }}
        style={{
          position: isMobile ? 'absolute' : 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 50,
          flexShrink: 0,
          background: 'var(--sidebar-bg)',
          backdropFilter: 'blur(24px) saturate(200%)',
          WebkitBackdropFilter: 'blur(24px) saturate(200%)',
          borderRight: '1px solid var(--sidebar-border)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
          }}>
            <GraduationCap size={20} color="white" />
          </div>
          {(!collapsed || isMobile) && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>Learnova</div>
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--secondary-500)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>STUDENT</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.75rem 0.625rem' }}>
          {NAV_GROUPS.map(({ label, items }) => (
            <div key={label}>
              {(!collapsed || isMobile) && (
                <div className="nav-section-label">{label}</div>
              )}
              {items.map(({ to, icon: Icon, label: itemLabel, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={(e) => {
                    if (requestNavigation(to)) e.preventDefault();
                    if (isMobile) setMobileMenuOpen(false);
                  }}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  style={{ justifyContent: collapsed && !isMobile ? 'center' : 'flex-start' }}
                  title={collapsed && !isMobile ? itemLabel : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <div style={navIconStyle(isActive)}>
                        <Icon size={16} />
                      </div>
                      {(!collapsed || isMobile) && <span>{itemLabel}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* XP Progress footer */}
        {(!collapsed || isMobile) && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
            {isOrganizer && (
              <button onClick={() => { if (requestNavigation('/organizer')) return; navigate('/organizer'); }} className="btn-secondary" style={{ width: '100%', marginBottom: '1rem', padding: '0.5rem', fontSize: '0.8rem', gap: '0.5rem', background: 'rgba(99,102,241,0.1)', color: 'var(--primary-600)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10 }}>
                <LayoutDashboard size={14} /> Back to Organizer
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
              <ProgressRing value={rankInfo.progress} size={40} stroke={3} color={rankInfo.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rankInfo.name}
                </div>
                {rankInfo.xpToNext > 0 && (
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 1 }}>
                    {rankInfo.xpToNext} XP to {rankInfo.nextName}
                  </div>
                )}
              </div>
            </div>
            <button onClick={handleSignOut} className="btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', padding: '0.5rem 0.6rem' }}>
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        )}
      </motion.aside>
      )}

      {/* ══════════════ MAIN CONTENT AREA ══════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {/* ── Header ── */}
        {!inClassroomOnMobile && (
        <header style={{
          height: 60, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1.25rem',
          background: 'var(--bg-overlay)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--sidebar-border)',
          zIndex: 100, position: 'relative',
        }}>
          {/* Left: hamburger / collapse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => isMobile ? setMobileMenuOpen(!mobileMenuOpen) : setCollapsed(!collapsed)}
              className="btn-icon" style={{ border: 'none', background: 'transparent' }}
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>
          </div>

          {/* Right: gamification chips + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>

            {/* XP Chips */}
            {profile?.role === 'student' && (
              <div className="hide-mobile" style={{ display: 'flex', gap: '0.4rem', marginRight: '0.5rem' }}>
                <span className="xp-chip xp-chip-rank" title="Current Rank">
                  <Trophy size={13} fill="currentColor" /> {stats?.rankName || rankInfo.name}
                </span>
                <span className="xp-chip xp-chip-streak" title="Day Streak">
                  <Flame size={13} fill={stats?.streak > 0 ? 'currentColor' : 'none'} /> {stats?.streak || 0}
                </span>
                <span className="xp-chip xp-chip-xp" title="Total XP">
                  <Star size={13} fill="currentColor" /> {(stats?.xp || 0).toLocaleString()} <span style={{ fontSize: '0.65rem', opacity: 0.7, fontWeight: 600 }}>XP</span>
                </span>
              </div>
            )}

            {/* Command Palette */}
            <CommandPalette role="student" onSignOut={handleSignOut} />

            {/* Achievements shortcut */}
            <button onClick={() => { if (requestNavigation('/student/achievements')) return; navigate('/student/achievements'); }} className="btn-icon hide-mobile" title="Achievements">
              <Award size={16} color="var(--secondary-500)" />
            </button>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowNotifications(!showNotifications)} className="btn-icon" title="Notifications" style={{ position: 'relative' }}>
                <Bell size={16} />
                {unreadCount > 0 && <span className="notif-dot" />}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div onClick={() => setShowNotifications(false)} style={{ position: 'fixed', inset: 0, zIndex: 45 }} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="dropdown-menu"
                      style={{ top: 'calc(100% + 8px)', right: 0, width: 300, zIndex: 200 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem 0.75rem' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</span>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllAsRead} style={{ border: 'none', background: 'none', fontSize: '0.72rem', color: 'var(--secondary-500)', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {notifications.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            <Bell size={24} style={{ opacity: 0.25, marginBottom: '0.5rem' }} />
                            <div>No notifications yet</div>
                          </div>
                        ) : notifications.map(n => (
                          <div key={n.id} style={{
                            padding: '0.65rem 0.75rem', borderRadius: 8, position: 'relative',
                            background: n.isRead ? 'transparent' : 'rgba(16,185,129,0.05)',
                            border: `1px solid ${n.isRead ? 'transparent' : 'rgba(16,185,129,0.12)'}`,
                          }}>
                            <div style={{ display: 'flex', gap: '0.6rem' }}>
                              {n.type === 'warning' ? <AlertTriangle size={14} color="#f59e0b" />
                                : n.type === 'success' ? <CheckCircle size={14} color="#10b981" />
                                : <Info size={14} color="#3b82f6" />}
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
                                <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Clock size={9} /> {new Date(n.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              {!n.isRead && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0, marginTop: 4 }} />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Profile menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.35rem 0.625rem 0.35rem 0.35rem',
                  borderRadius: 10, cursor: 'pointer', border: 'none',
                  background: 'rgba(16,185,129,0.08)', transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.14)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.08)'}
              >
                <Avatar name={profile?.name || 'S'} size="sm" />
                <span className="hide-mobile" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                  {profile?.name?.split(' ')[0] || 'Student'} ({profile?.role || 'no role'})
                </span>
                <ChevronDown size={13} color="var(--text-muted)" style={{ transform: showProfileMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <>
                    <div onClick={() => setShowProfileMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 145 }} />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="dropdown-menu"
                      style={{ top: 'calc(100% + 8px)', right: 0, width: 240, zIndex: 150 }}
                    >
                      {/* Profile header */}
                      <div style={{ padding: '0.75rem', marginBottom: '0.25rem', borderBottom: '1px solid var(--card-border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <Avatar name={profile?.name || 'S'} size="md" />
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{profile?.name}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{profile?.email}</div>
                          </div>
                        </div>
                        <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.4rem' }}>
                          <span className="xp-chip xp-chip-streak" style={{ fontSize: '0.65rem' }}><Flame size={11} /> {stats?.streak || 0} day</span>
                          <span className="xp-chip xp-chip-xp" style={{ fontSize: '0.65rem' }}><Star size={11} /> {(stats?.xp || 0).toLocaleString()} XP</span>
                        </div>
                      </div>

                      <button onClick={() => { if (requestNavigation('/student/profile')) return; navigate('/student/profile'); setShowProfileMenu(false) }} className="dropdown-item"><User size={15} /> My Profile</button>
                      {isOrganizer && <button onClick={() => { if (requestNavigation('/organizer')) return; navigate('/organizer'); setShowProfileMenu(false) }} className="dropdown-item" style={{ color: 'var(--primary-600)', fontWeight: 700 }}><LayoutDashboard size={15} /> Back to Organizer</button>}
                      <button onClick={() => { if (requestNavigation('/student')) return; navigate('/student'); setShowProfileMenu(false) }} className="dropdown-item"><Mountain size={15} /> My Journey</button>
                      <button onClick={() => { if (requestNavigation('/student/playground')) return; navigate('/student/playground'); setShowProfileMenu(false) }} className="dropdown-item"><Globe size={15} /> Playground</button>
                      <button onClick={() => { if (requestNavigation('/student/renew')) return; navigate('/student/renew'); setShowProfileMenu(false) }} className="dropdown-item" style={{ color: 'var(--primary-600)' }}><CreditCard size={15} /> Renew Access</button>

                      <div className="dropdown-divider" />
                      <button onClick={() => { if (requestNavigation('/student/support')) return; navigate('/student/support'); setShowProfileMenu(false) }} className="dropdown-item"><MessageCircle size={15} /> Contact Us</button>
                      <div className="dropdown-divider" />
                      <button onClick={() => { handleSignOut(); setShowProfileMenu(false) }} className="dropdown-item danger"><LogOut size={15} /> Sign Out</button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>
        )}

        {/* ── Page Content ── */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: location.pathname.includes('/classroom/') ? 0 : (isMobile ? '1rem 1rem 5rem' : '1.75rem 2rem'), display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>

        {/* ── Mobile Bottom Nav ── */}
        {!inClassroomOnMobile && isMobile && (
          <nav style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            height: 60,
            background: 'var(--bg-elevated)',
            backdropFilter: 'blur(16px)',
            borderTop: '1px solid var(--sidebar-border)',
            display: 'flex', alignItems: 'center',
            padding: '0 0.5rem',
            zIndex: 200,
            paddingBottom: 'var(--safe-area-bottom)',
          }}>
            {BOTTOM_NAV.map(({ to, icon: Icon, label, end }) => (
              <NavLink key={to} to={to} end={end} onClick={(e) => { if (requestNavigation(to)) e.preventDefault(); }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '0.5rem 0', textDecoration: 'none' }}>
                {({ isActive }) => (
                  <>
                    <div style={{
                      width: 36, height: 28, borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isActive ? 'rgba(99,102,241,0.12)' : 'transparent',
                      transition: 'background 0.15s ease',
                    }}>
                      <Icon size={17} color={isActive ? 'var(--primary-600)' : 'var(--text-muted)'} />
                    </div>
                    <span style={{ fontSize: '0.6rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--primary-600)' : 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        )}
      </div>

      {!location.pathname.includes('/classroom/') && <AIChatbot />}
    </div>
  )
}
