import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useMeeting } from '../contexts/MeetingContext'
import {
  LayoutDashboard, Radio, Calendar, Users, LogOut,
  GraduationCap, Menu, Bell, BookOpen, ClipboardList, Code,
  MessageSquare, Info, AlertTriangle, CheckCircle, Clock, Trophy,
  CreditCard, ChevronDown, Settings, BarChart2, Shield, FolderOpen
} from 'lucide-react'
import AIChatbot from '../components/shared/AIChatbot'
import CommandPalette from '../components/CommandPalette'
import { Avatar } from '../design-system'

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/organizer',            icon: LayoutDashboard, label: 'Dashboard',        end: true },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/organizer/students',   icon: Users,           label: 'Students' },
      { to: '/organizer/courses',    icon: BookOpen,        label: 'Courses' },
      { to: '/organizer/renewals',   icon: CreditCard,      label: 'Renewals' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/organizer/assessments',icon: ClipboardList,   label: 'Assessments' },
      { to: '/organizer/coding',     icon: Code,            label: 'Coding Practice' },
      { to: '/organizer/upload',     icon: Radio,           label: 'Live Class' },
      { to: '/organizer/recordings', icon: FolderOpen,      label: 'Recording History' },
      { to: '/organizer/schedule',   icon: Calendar,        label: 'Schedule' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/organizer/analytics',  icon: BarChart2,       label: 'Overview' },
      { to: '/organizer/leaderboard',icon: Trophy,          label: 'Leaderboard' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/organizer/admins',     icon: Shield,          label: 'Admins',           role: 'main_admin' },
      { to: '/organizer/notifications', icon: Bell,         label: 'Notifications' },
      { to: '/organizer/support',    icon: MessageSquare,   label: 'Support' },
      { to: '/organizer/profile',    icon: Users,           label: 'My Profile' },
    ],
  },
]

function getRoleColor(role) {
  if (role === 'main_admin') {
    return '#8b5cf6'
  }
  if (role === 'sub_admin') {
    return '#6366f1'
  }
  return '#10b981'
}

function getNotificationIcon(type) {
  if (type === 'warning') return <AlertTriangle size={14} color="#f59e0b" />;
  if (type === 'success') return <CheckCircle size={14} color="#10b981" />;
  return <Info size={14} color="#3b82f6" />;
}

function useOrganizerNotifications(profileId) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!profileId) return
    
    fetchNotifications()
    const channel = supabase.channel('organizer-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (payload.new.target === 'all' || payload.new.target === 'organizers') {
          setNotifications(prev => [payload.new, ...prev])
          setUnreadCount(prev => prev + 1)
        }
      }).subscribe()
    return () => supabase.removeChannel(channel)
  }, [profileId])

  async function fetchNotifications() {
    if (!profileId) return
    try {
      const { data: notes } = await supabase.from('notifications').select('*')
        .or('target.eq.all,target.eq.organizers').order('created_at', { ascending: false }).limit(10)
      const { data: reads } = await supabase.from('notification_reads').select('notification_id').eq('user_id', profileId)
      const readIds = new Set((reads || []).map(r => r.notification_id))
      const notesWithRead = (notes || []).map(n => ({ ...n, isRead: readIds.has(n.id) }))
      setNotifications(notesWithRead)
      setUnreadCount(notesWithRead.filter(n => !n.isRead).length)
    } catch (err) { console.error(err) }
  }

  async function handleMarkAllAsRead() {
    if (!profileId || unreadCount === 0) return
    try {
      const unread = notifications.filter(n => !n.isRead)
      await supabase.from('notification_reads').upsert(unread.map(n => ({ notification_id: n.id, user_id: profileId })))
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) { console.error(err) }
  }

  return { notifications, unreadCount, handleMarkAllAsRead }
}

export default function OrganizerLayout() {
  const { profile, signOut } = useAuth()
  const { requestNavigation } = useMeeting()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [collapsed,         setCollapsed]         = useState(false)
  const [mobileMenuOpen,    setMobileMenuOpen]    = useState(false)
  const [isMobile,          setIsMobile]          = useState(window.innerWidth <= 768)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfileMenu,   setShowProfileMenu]   = useState(false)

  const { notifications, unreadCount, handleMarkAllAsRead } = useOrganizerNotifications(profile?.id)

  const roleLabel = (profile?.role || 'organizer').replace('_', ' ').toUpperCase()
  const roleColor = getRoleColor(profile?.role)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  async function handleSignOut() { 
    if (requestNavigation('/login')) {
      return;
    }
    await signOut(); navigate('/login') 
  }

  const inClassroomOnMobile = isMobile && location.pathname.includes('/classroom/')

  function getMainPadding() {
    if (location.pathname.includes('/classroom/')) return 0;
    return isMobile ? '1rem' : '1.75rem 2rem';
  }

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--bg-base)', position: 'relative' }}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {!inClassroomOnMobile && isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            role="button" tabIndex={0} aria-label="Close mobile menu"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setMobileMenuOpen(false); } }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 40 }}
          />
        )}
      </AnimatePresence>

      {!inClassroomOnMobile && (
        <OrganizerSidebar
          isMobile={isMobile}
          mobileMenuOpen={mobileMenuOpen}
          collapsed={collapsed}
          roleColor={roleColor}
          roleLabel={roleLabel}
          profile={profile}
          setMobileMenuOpen={setMobileMenuOpen}
          requestNavigation={requestNavigation}
          navigate={navigate}
          handleSignOut={handleSignOut}
        />
      )}

      {/* ══════════════ MAIN ══════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {!inClassroomOnMobile && (
          <OrganizerHeader
            isMobile={isMobile}
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            profile={profile}
            roleLabel={roleLabel}
            handleSignOut={handleSignOut}
            showNotifications={showNotifications}
            setShowNotifications={setShowNotifications}
            unreadCount={unreadCount}
            handleMarkAllAsRead={handleMarkAllAsRead}
            notifications={notifications}
            showProfileMenu={showProfileMenu}
            setShowProfileMenu={setShowProfileMenu}
            requestNavigation={requestNavigation}
            navigate={navigate}
          />
        )}

        {/* ── Page Content ── */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: getMainPadding(), display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
      </div>

      {!location.pathname.includes('/classroom/') && <AIChatbot />}
    </div>
  )
}

function OrganizerSidebar({
  isMobile, mobileMenuOpen, collapsed, roleColor, roleLabel, profile,
  setMobileMenuOpen, requestNavigation, navigate, handleSignOut
}) {
  function getSidebarWidth() {
    if (isMobile) return mobileMenuOpen ? 260 : 0;
    return collapsed ? 68 : 260;
  }

  const navIconStyle = (isActive) => ({
    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
    transition: 'background 0.15s ease',
  })

  return (
    <motion.aside
      animate={{
        width: getSidebarWidth(),
        x: isMobile && !mobileMenuOpen ? -260 : 0,
      }}
      transition={{ type: 'spring', stiffness: 350, damping: 36 }}
      style={{
        position: isMobile ? 'absolute' : 'relative',
        height: '100%',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', zIndex: 50, flexShrink: 0,
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
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: roleColor, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{roleLabel}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.75rem 0.625rem' }}>
        {NAV_GROUPS.map(({ label, items }) => {
          const filtered = items.filter(item => !item.role || profile?.role === item.role)
          if (!filtered.length) return null
          return (
            <div key={label}>
              {(!collapsed || isMobile) && <div className="nav-section-label">{label}</div>}
              {filtered.map(({ to, icon: Icon, label: itemLabel, end }) => (
                <NavLink
                  key={to} to={to} end={end}
                  onClick={(e) => {
                    if (requestNavigation(to)) {
                      e.preventDefault();
                    }
                    if (isMobile) {
                      setMobileMenuOpen(false);
                    }
                  }}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  style={{ justifyContent: collapsed && !isMobile ? 'center' : 'flex-start' }}
                  title={collapsed && !isMobile ? itemLabel : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <div style={navIconStyle(isActive)}><Icon size={16} /></div>
                      {(!collapsed || isMobile) && <span>{itemLabel}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      {(!collapsed || isMobile) && (
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
          <button onClick={() => { if (requestNavigation('/student')) { return; } navigate('/student'); }} className="dropdown-item" style={{ background: 'rgba(16,185,129,0.06)', borderRadius: 8, color: '#10b981', fontWeight: 700, marginBottom: '0.25rem', border: '1px solid rgba(16,185,129,0.15)' }}>
            <GraduationCap size={14} /> Student View
          </button>
          <button onClick={handleSignOut} className="btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', gap: '0.6rem', fontSize: '0.8rem', padding: '0.5rem 0.6rem' }}>
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      )}
    </motion.aside>
  )
}

function OrganizerHeader({
  isMobile, mobileMenuOpen, setMobileMenuOpen, collapsed, setCollapsed,
  profile, roleLabel, handleSignOut, showNotifications, setShowNotifications,
  unreadCount, handleMarkAllAsRead, notifications, showProfileMenu, setShowProfileMenu,
  requestNavigation, navigate
}) {
  return (
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button onClick={() => isMobile ? setMobileMenuOpen(!mobileMenuOpen) : setCollapsed(!collapsed)} className="btn-icon" style={{ border: 'none', background: 'transparent' }} aria-label="Toggle sidebar">
          <Menu size={18} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Command Palette */}
        <CommandPalette role="organizer" onSignOut={handleSignOut} />

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowNotifications(!showNotifications)} className="btn-icon" style={{ position: 'relative' }} title="Notifications">
            <Bell size={16} />
            {unreadCount > 0 && <span className="notif-dot" />}
          </button>
          <AnimatePresence>
            {showNotifications && (
              <>
                <div 
                  onClick={() => setShowNotifications(false)} 
                  role="button" tabIndex={0} aria-label="Close notifications menu"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowNotifications(false); } }}
                  style={{ position: 'fixed', inset: 0, zIndex: 45 }} 
                />
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
                      <button onClick={handleMarkAllAsRead} style={{ border: 'none', background: 'none', fontSize: '0.72rem', color: 'var(--primary-500)', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: 'var(--font-body)' }}>Mark all read</button>
                    )}
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        <Bell size={24} style={{ opacity: 0.25, marginBottom: '0.5rem' }} /><div>No notifications yet</div>
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id} style={{
                        padding: '0.65rem 0.75rem', borderRadius: 8, position: 'relative',
                        background: n.isRead ? 'transparent' : 'rgba(99,102,241,0.05)',
                        border: `1px solid ${n.isRead ? 'transparent' : 'rgba(99,102,241,0.12)'}`,
                      }}>
                        <div style={{ display: 'flex', gap: '0.6rem' }}>
                          {getNotificationIcon(n.type)}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{n.title}</div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.4 }}>{n.message}</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={9} /> {new Date(n.created_at).toLocaleDateString()}</div>
                          </div>
                          {!n.isRead && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary-500)', flexShrink: 0, marginTop: 4 }} />}
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
              background: 'rgba(99,102,241,0.08)', transition: 'background 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
            onFocus={e => e.currentTarget.style.background = 'rgba(99,102,241,0.14)'}
            onBlur={e => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
          >
            <Avatar name={profile?.name || 'O'} size="sm" />
            <span className="hide-mobile" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
              {profile?.name?.split(' ')[0] || 'Organizer'}
            </span>
            <ChevronDown size={13} color="var(--text-muted)" style={{ transform: showProfileMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <>
                <div 
                  onClick={() => setShowProfileMenu(false)} 
                  role="button" tabIndex={0} aria-label="Close profile menu"
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setShowProfileMenu(false); } }}
                  style={{ position: 'fixed', inset: 0, zIndex: 145 }} 
                />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="dropdown-menu"
                  style={{ top: 'calc(100% + 8px)', right: 0, width: 220, zIndex: 150 }}
                >
                  <div style={{ padding: '0.75rem', marginBottom: '0.25rem', borderBottom: '1px solid var(--card-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <Avatar name={profile?.name || 'O'} size="md" />
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{profile?.name}</div>
                        <span className="badge badge-primary" style={{ fontSize: '0.62rem', marginTop: 3 }}>{roleLabel}</span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { if (requestNavigation('/student')) { return; } navigate('/student'); setShowProfileMenu(false) }} className="dropdown-item" style={{ color: '#10b981', fontWeight: 600 }}><GraduationCap size={15} /> Student View</button>
                  <button onClick={() => { if (requestNavigation('/organizer')) { return; } navigate('/organizer'); setShowProfileMenu(false) }} className="dropdown-item"><LayoutDashboard size={15} /> Dashboard</button>
                  <button onClick={() => { if (requestNavigation('/organizer/profile')) { return; } navigate('/organizer/profile'); setShowProfileMenu(false) }} className="dropdown-item"><Settings size={15} /> My Profile</button>
                  <div className="dropdown-divider" />
                  <button onClick={() => { handleSignOut(); setShowProfileMenu(false) }} className="dropdown-item danger"><LogOut size={15} /> Sign Out</button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
