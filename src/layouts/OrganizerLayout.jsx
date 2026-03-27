import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
    LayoutDashboard, Radio, Calendar, Users, LogOut,
    GraduationCap, Menu, X, Bell, ChevronDown, BookOpen, ClipboardList, Code, Globe, MessageSquare,
    Info, AlertTriangle, CheckCircle, Clock, Trophy
} from 'lucide-react'

const navItems = [
    { to: '/organizer', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/organizer/courses', icon: BookOpen, label: 'Courses' },
    { to: '/organizer/admins', icon: Users, label: 'Admins', role: 'main_admin' },
    { to: '/organizer/assessments', icon: ClipboardList, label: 'Assessments' },
    { to: '/organizer/coding', icon: Code, label: 'Coding Practice' },
    { to: '/organizer/playground', icon: Globe, label: 'Code Playground' },
    { to: '/organizer/upload', icon: Radio, label: 'Live Class' },
    { to: '/organizer/schedule', icon: Calendar, label: 'Schedule' },
    { to: '/organizer/students', icon: Users, label: 'Students' },
    { to: '/organizer/leaderboard', icon: Trophy, label: 'Leaderboard' },
    { to: '/organizer/notifications', icon: Bell, label: 'Notifications' },
    { to: '/organizer/support', icon: MessageSquare, label: 'Support' },
]

export default function OrganizerLayout() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
    const [showNotifications, setShowNotifications] = useState(false)
    const [notifications, setNotifications] = useState([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [showProfileMenu, setShowProfileMenu] = useState(false)

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    useEffect(() => {
        if (profile?.id) {
            fetchNotifications()
            
            // Subscribe to real-time notifications
            const channel = supabase
                .channel('organizer-notifications')
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'notifications' 
                }, (payload) => {
                    if (payload.new.target === 'all' || payload.new.target === 'organizers') {
                        setNotifications(prev => [payload.new, ...prev])
                        setUnreadCount(prev => prev + 1)
                    }
                })
                .subscribe()

            return () => supabase.removeChannel(channel)
        }
    }, [profile?.id])

    async function fetchNotifications() {
        if (!profile?.id) return
        try {
            // 1. Fetch relevant notifications
            const { data: notes, error: notesError } = await supabase
                .from('notifications')
                .select('*')
                .or(`target.eq.all,target.eq.organizers`)
                .order('created_at', { ascending: false })
                .limit(10)
            
            if (notesError) throw notesError

            // 2. Fetch read status
            const { data: reads, error: readsError } = await supabase
                .from('notification_reads')
                .select('notification_id')
                .eq('user_id', profile.id)
            
            if (readsError) throw readsError

            const readIds = new Set(reads.map(r => r.notification_id))
            const notesWithReadStatus = notes.map(n => ({
                ...n,
                isRead: readIds.has(n.id)
            }))

            setNotifications(notesWithReadStatus)
            setUnreadCount(notesWithReadStatus.filter(n => !n.isRead).length)
        } catch (err) {
            console.error('Error fetching notifications:', err)
        }
    }

    async function handleMarkAllAsRead() {
        if (!profile?.id || unreadCount === 0) return
        try {
            const unreadNotes = notifications.filter(n => !n.isRead)
            const newReads = unreadNotes.map(n => ({
                notification_id: n.id,
                user_id: profile.id
            }))

            const { error } = await supabase
                .from('notification_reads')
                .upsert(newReads)
            
            if (error) throw error
            
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
            setUnreadCount(0)
        } catch (err) {
            console.error('Error marking as read:', err)
        }
    }

    async function handleSignOut() {
        await signOut()
        navigate('/login')
    }

    return (
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-main)', position: 'relative' }}>
            {/* Sidebar Overlay (Mobile) */}
            {isMobile && mobileMenuOpen && (
                <div
                    onClick={() => setMobileMenuOpen(false)}
                    style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 40 }}
                />
            )}

            {/* Sidebar */}
            <aside style={{
                position: isMobile ? 'absolute' : 'relative',
                left: isMobile && !mobileMenuOpen ? -240 : 0,
                width: collapsed && !isMobile ? 70 : 240,
                minWidth: collapsed && !isMobile ? 70 : 240,
                height: '100%',
                background: 'var(--sidebar-bg)',
                borderRight: '1px solid var(--sidebar-border)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.25s ease',
                overflow: 'hidden',
                zIndex: 50,
            }}>
                {/* Logo */}
                <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GraduationCap size={20} color="white" />
                    </div>
                    {(!collapsed || isMobile) && (
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>EduStream</div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--accent-light)', fontWeight: 500 }}>ORGANIZER</div>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
                    {navItems.filter(item => !item.role || profile?.role === item.role).map(({ to, icon: Icon, label, end }) => (
                        <NavLink
                            key={to + label}
                            to={to}
                            end={end}
                            onClick={() => isMobile && setMobileMenuOpen(false)}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            style={{ justifyContent: collapsed && !isMobile ? 'center' : 'flex-start' }}
                            title={collapsed && !isMobile ? label : undefined}
                        >
                            <Icon size={18} style={{ flexShrink: 0 }} />
                            {(!collapsed || isMobile) && <span>{label}</span>}
                        </NavLink>
                    ))}
                </nav>

                {/* Sign Out removed from sidebar footer as it is already in the top header profile menu */}
            </aside>

            {/* Main */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Top bar */}
                <header style={{ padding: '0 1rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sidebar-border)', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', flexShrink: 0, zIndex: 100, position: 'relative' }}>
                    <button
                        onClick={() => isMobile ? setMobileMenuOpen(!mobileMenuOpen) : setCollapsed(!collapsed)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0.5rem', borderRadius: 8 }}
                    >
                        {isMobile ? <Menu size={20} /> : collapsed ? <Menu size={20} /> : <X size={20} />}
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="hide-mobile"
                                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '0.5rem', color: 'var(--text-secondary)', cursor: 'pointer', position: 'relative' }}
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, background: '#6366f1', borderRadius: '50%' }} />}
                            </button>

                            {showNotifications && (
                                <>
                                    <div
                                        onClick={() => setShowNotifications(false)}
                                        style={{ position: 'fixed', inset: 0, zIndex: 45 }}
                                    />
                                    <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 280, background: 'white', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--sidebar-border)', zIndex: 50, padding: '1rem', overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Notifications</span>
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={handleMarkAllAsRead}
                                                    style={{ border: 'none', background: 'none', fontSize: '0.7rem', color: '#6366f1', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                                >
                                                    Mark all as read
                                                </button>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto' }}>
                                            {notifications.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                                                    <Bell size={24} color="var(--text-muted)" style={{ margin: '0 auto', opacity: 0.2 }} />
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>No notifications</p>
                                                </div>
                                            ) : (
                                                notifications.map(n => (
                                                    <div key={n.id} style={{ 
                                                        padding: '0.75rem', 
                                                        borderRadius: 8, 
                                                        background: n.isRead ? 'transparent' : 'rgba(99,102,241,0.05)',
                                                        border: n.isRead ? '1px solid transparent' : '1px solid rgba(99,102,241,0.1)',
                                                        display: 'flex',
                                                        gap: '0.75rem',
                                                        position: 'relative'
                                                    }}>
                                                        <div style={{ marginTop: '0.2rem' }}>
                                                            {n.type === 'warning' ? <AlertTriangle size={16} color="#f59e0b" /> : 
                                                             n.type === 'success' ? <CheckCircle size={16} color="#10b981" /> : 
                                                             <Info size={16} color="#3b82f6" />}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>{n.title}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.1rem', lineHeight: 1.4 }}>{n.message}</div>
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                <Clock size={10} />
                                                                {new Date(n.created_at).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        {!n.isRead && <div style={{ position: 'absolute', top: 12, right: 12, width: 6, height: 6, background: '#6366f1', borderRadius: '50%' }} />}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {notifications.length > 0 && (
                                            <div style={{ borderTop: '1px solid var(--sidebar-border)', padding: '0.75rem 0 0', marginTop: '0.75rem', textAlign: 'center' }}>
                                                <button 
                                                    onClick={() => { setShowNotifications(false); navigate('/organizer/notifications') }}
                                                    style={{ border: 'none', background: 'none', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
                                                >
                                                    View all history
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <div 
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                className="nav-item-hover-org"
                            >
                                <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white' }}>
                                    {profile?.name?.[0]?.toUpperCase() || 'O'}
                                </div>
                                <span className="hide-mobile" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{profile?.name || 'Organizer'}</span>
                                <ChevronDown size={14} color="var(--text-muted)" style={{ transform: showProfileMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </div>

                            {showProfileMenu && (
                                <>
                                    <div 
                                        onClick={() => setShowProfileMenu(false)}
                                        style={{ position: 'fixed', inset: 0, zIndex: 45 }}
                                    />
                                    <div style={{ 
                                        position: 'absolute', 
                                        top: 'calc(100% + 10px)', 
                                        right: 0, 
                                        width: 220, 
                                        background: 'white', 
                                        borderRadius: 12, 
                                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)', 
                                        border: '1px solid var(--sidebar-border)', 
                                        zIndex: 100, 
                                        padding: '0.5rem',
                                        maxHeight: 'calc(100vh - 80px)',
                                        overflowY: 'auto',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '2px'
                                    }}>
                                        <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.25rem', borderBottom: '1px solid var(--sidebar-border)' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{profile?.name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{profile?.role?.replace('_', ' ').toUpperCase()}</div>
                                        </div>

                                        <button onClick={() => { navigate('/organizer'); setShowProfileMenu(false) }} className="dropdown-item-org">
                                            <LayoutDashboard size={16} /> <span>Dashboard</span>
                                        </button>
                                        <button onClick={() => { navigate('/organizer/courses'); setShowProfileMenu(false) }} className="dropdown-item-org">
                                            <BookOpen size={16} /> <span>My Courses</span>
                                        </button>
                                        <button onClick={() => setShowProfileMenu(false)} className="dropdown-item-org">
                                            <Users size={16} /> <span>Settings</span>
                                        </button>

                                        <div style={{ height: '1px', background: 'var(--sidebar-border)', margin: '0.4rem 0.5rem' }} />

                                        <button 
                                            onClick={() => { handleSignOut(); setShowProfileMenu(false) }} 
                                            className="dropdown-item-org" 
                                            style={{ color: '#dc2626' }}
                                        >
                                            <LogOut size={16} /> <span>Sign Out</span>
                                        </button>
                                    </div>

                                    <style>{`
                                        .dropdown-item-org {
                                            display: flex;
                                            align-items: center;
                                            gap: 0.75rem;
                                            padding: 0.6rem 0.75rem;
                                            border: none;
                                            background: none;
                                            width: 100%;
                                            text-align: left;
                                            font-size: 0.85rem;
                                            font-weight: 500;
                                            color: #475569;
                                            cursor: pointer;
                                            border-radius: 8px;
                                            transition: all 0.2s ease;
                                        }
                                        .dropdown-item-org:hover {
                                            background: #f8fafc;
                                            color: #6366f1;
                                        }
                                        .nav-item-hover-org:hover {
                                            background: rgba(99,102,241,0.12) !important;
                                            border-color: rgba(99,102,241,0.25) !important;
                                        }
                                    `}</style>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
