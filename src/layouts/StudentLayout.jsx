import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
    LayoutDashboard, BookOpen, Calendar, ClipboardList, LogOut,
    GraduationCap, Menu, X, Bell, Award, Code, Globe,
    User, MessageSquare, Zap, Bookmark, HelpCircle, Gift, MessageCircle, Mountain, ChevronRight, ExternalLink
} from 'lucide-react'

const navItems = [
    { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/student/courses', icon: BookOpen, label: 'My Courses' },
    { to: '/student/achievements', icon: Award, label: 'Achievements' },
    { to: '/student/playground', icon: Globe, label: 'Code Playground' },
    { to: '/student/schedule', icon: Calendar, label: 'Schedule' },
]

export default function StudentLayout() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
    const [showNotifications, setShowNotifications] = useState(false)
    const [unreadCount, setUnreadCount] = useState(1) // Simulate 1 unread notification
    const [showProfileMenu, setShowProfileMenu] = useState(false)

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

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
                    <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GraduationCap size={20} color="white" />
                    </div>
                    {(!collapsed || isMobile) && (
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>EduStream</div>
                            <div style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 500 }}>STUDENT</div>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
                    {navItems.map(({ to, icon: Icon, label, end }) => (
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
                        <button
                            onClick={() => navigate('/student/achievements')}
                            className="hide-mobile"
                            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '0.5rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            title="Achievements"
                        >
                            <Award size={18} color="#10b981" />
                        </button>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="hide-mobile"
                                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 8, padding: '0.5rem', color: 'var(--text-secondary)', cursor: 'pointer', position: 'relative' }}
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, background: '#10b981', borderRadius: '50%' }} />}
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
                                            <button
                                                onClick={() => setUnreadCount(0)}
                                                style={{ border: 'none', background: 'none', fontSize: '0.7rem', color: '#10b981', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                            >
                                                Mark all as read
                                            </button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'center', padding: '1rem 0' }}>
                                            <Bell size={24} color="var(--text-muted)" style={{ margin: '0 auto', opacity: 0.2 }} />
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                {unreadCount > 0 ? 'You have new notifications' : 'No new notifications'}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <div 
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)', cursor: 'pointer', transition: 'all 0.2s ease' }}
                                className="nav-item-hover"
                            >
                                <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #10b981, #059669)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white' }}>
                                    {profile?.name?.[0]?.toUpperCase() || 'S'}
                                </div>
                                <span className="hide-mobile" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{profile?.name || 'Student'}</span>
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
                                        width: 240, 
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
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{profile?.email}</div>
                                        </div>

                                        <button onClick={() => { navigate('/student'); setShowProfileMenu(false) }} className="dropdown-item">
                                            <Mountain size={16} /> <span>My Journey</span>
                                        </button>
                                        <button onClick={() => { navigate('/student/playground'); setShowProfileMenu(false) }} className="dropdown-item">
                                            <Globe size={16} /> <span>Playground</span>
                                        </button>
                                        <button onClick={() => { navigate('/student/playground?view=saved'); setShowProfileMenu(false) }} className="dropdown-item">
                                            <Zap size={16} /> <span>Saved Snippets</span>
                                        </button>

                                        <div style={{ height: '1px', background: 'var(--sidebar-border)', margin: '0.4rem 0.5rem' }} />

                                        <button onClick={() => setShowProfileMenu(false)} className="dropdown-item">
                                            <User size={16} /> <span>Profile</span>
                                        </button>

                                        <div style={{ height: '1px', background: 'var(--sidebar-border)', margin: '0.4rem 0.5rem' }} />

                                        <button onClick={() => { navigate('/student/support'); setShowProfileMenu(false) }} className="dropdown-item">
                                            <MessageCircle size={16} /> <span>Contact Us</span>
                                        </button>

                                        <div style={{ height: '1px', background: 'var(--sidebar-border)', margin: '0.4rem 0.5rem' }} />

                                        <button 
                                            onClick={() => { handleSignOut(); setShowProfileMenu(false) }} 
                                            className="dropdown-item" 
                                            style={{ color: '#dc2626' }}
                                        >
                                            <LogOut size={16} /> <span>Log Out</span>
                                        </button>
                                    </div>

                                    <style>{`
                                        .dropdown-item {
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
                                        .dropdown-item:hover {
                                            background: #f8fafc;
                                            color: #10b981;
                                        }
                                        .dropdown-item-container:hover .dropdown-item {
                                            background: #f8fafc;
                                            color: #10b981;
                                        }
                                        .nav-item-hover:hover {
                                            background: rgba(16,185,129,0.12) !important;
                                            border-color: rgba(16,185,129,0.25) !important;
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
