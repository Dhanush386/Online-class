import { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
    LayoutDashboard, Radio, Calendar, Users, LogOut,
    GraduationCap, Menu, X, Bell, ChevronDown, BookOpen, ClipboardList, Code, Globe
} from 'lucide-react'

const navItems = [
    { to: '/organizer', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/organizer/courses', icon: BookOpen, label: 'Courses' },
    { to: '/organizer/assessments', icon: ClipboardList, label: 'Assessments' },
    { to: '/organizer/coding', icon: Code, label: 'Coding Practice' },
    { to: '/organizer/playground', icon: Globe, label: 'Code Playground' },
    { to: '/organizer/upload', icon: Radio, label: 'Live Class' },
    { to: '/organizer/schedule', icon: Calendar, label: 'Schedule' },
    { to: '/organizer/students', icon: Users, label: 'Students' },
]

export default function OrganizerLayout() {
    const { profile, signOut } = useAuth()
    const navigate = useNavigate()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
    const [showNotifications, setShowNotifications] = useState(false)

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

                {/* User / Sign Out */}
                <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--sidebar-border)' }}>
                    {(!collapsed || isMobile) && (
                        <div style={{ marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                                {profile?.name?.[0]?.toUpperCase() || 'O'}
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.name || 'Organizer'}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Admin</div>
                            </div>
                        </div>
                    )}
                    <button onClick={handleSignOut} className="nav-item" style={{ width: '100%', border: 'none', background: 'none', justifyContent: collapsed && !isMobile ? 'center' : 'flex-start', color: '#dc2626' }}>
                        <LogOut size={18} />
                        {(!collapsed || isMobile) && <span>Sign Out</span>}
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Top bar */}
                <header style={{ padding: '0 1rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--sidebar-border)', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
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
                                <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, background: '#6366f1', borderRadius: '50%' }} />
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
                                            <span style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 600 }}>Mark all as read</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'center', padding: '1rem 0' }}>
                                            <Bell size={24} color="var(--text-muted)" style={{ margin: '0 auto', opacity: 0.2 }} />
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No new notifications</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)' }}>
                            <div style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: 'white' }}>
                                {profile?.name?.[0]?.toUpperCase() || 'O'}
                            </div>
                            <span className="hide-mobile" style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{profile?.name || 'Organizer'}</span>
                            <ChevronDown size={14} color="var(--text-muted)" />
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
