import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, Users, Shield, Trash2, BookOpen, AlertCircle, X, Check, Search } from 'lucide-react'

export default function AdminManagement() {
    const { profile } = useAuth()
    const [subAdmins, setSubAdmins] = useState([])
    const [courses, setCourses] = useState([])
    const [loading, setLoading] = useState(true)
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [selectedAdmin, setSelectedAdmin] = useState(null)
    const [inviteData, setInviteData] = useState({ name: '', email: '' })
    const [stats, setStats] = useState({ totalCourses: 0, totalQuestions: 0, totalSubAdmins: 0 })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (profile?.role === 'main_admin') {
            loadData()
            loadStats()
        }
    }, [profile])

    async function loadStats() {
        const [
            { count: courseCount },
            { count: challengeCount },
            { count: assessCount },
            { count: subAdminCount }
        ] = await Promise.all([
            supabase.from('courses').select('*', { count: 'exact', head: true }),
            supabase.from('coding_challenges').select('*', { count: 'exact', head: true }),
            supabase.from('assessments').select('*', { count: 'exact', head: true }),
            supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'sub_admin')
        ])

        setStats({
            totalCourses: courseCount || 0,
            totalQuestions: (challengeCount || 0) + (assessCount || 0),
            totalSubAdmins: subAdminCount || 0
        })
    }

    async function loadData() {
        setLoading(true)
        const [
            { data: admins },
            { data: crs },
            { data: assignments }
        ] = await Promise.all([
            supabase.from('users').select('*').eq('role', 'sub_admin'),
            supabase.from('courses').select('id, title'),
            supabase.from('admin_course_assignments').select('*')
        ])

        const adminsWithCourses = (admins || []).map(admin => ({
            ...admin,
            assignedCourses: (crs || []).filter(c => 
                (assignments || []).some(a => a.admin_id === admin.id && a.course_id === c.id)
            )
        }))

        setSubAdmins(adminsWithCourses)
        setCourses(crs || [])
        setLoading(false)
    }

    async function handleInviteSubAdmin(e) {
        e.preventDefault()
        setSaving(true)
        setError('')

        try {
            // 1. Create invite record (reusing organizer_invites table logic)
            const { error: inviteError } = await supabase
                .from('organizer_invites')
                .insert({ email: inviteData.email.toLowerCase(), role: 'sub_admin' })

            if (inviteError) throw inviteError

            alert(`Invite sent to ${inviteData.email}. They can now register as a sub-admin.`)
            setShowInviteModal(false)
            setInviteData({ name: '', email: '' })
        } catch (err) {
            setError(err.message || 'Failed to send invite')
        } finally {
            setSaving(false)
        }
    }

    async function toggleCourseAssignment(adminId, courseId, isAssigned) {
        if (isAssigned) {
            // Unassign
            const { error } = await supabase
                .from('admin_course_assignments')
                .delete()
                .match({ admin_id: adminId, course_id: courseId })
            if (error) alert(error.message)
        } else {
            // Assign
            const { error } = await supabase
                .from('admin_course_assignments')
                .insert({ admin_id: adminId, course_id: courseId })
            if (error) alert(error.message)
        }
        loadData()
    }

    async function deleteSubAdmin(id) {
        if (!confirm('Are you sure you want to remove this sub-admin? This will not delete their account but they will lose admin privileges.')) return
        
        const { error } = await supabase
            .from('users')
            .update({ role: 'student' })
            .eq('id', id)

        if (!error) loadData()
    }

    if (profile?.role !== 'main_admin') return <div style={{ padding: '2rem', color: 'red' }}>Access Denied</div>

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Admin Management</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Platform-wide stats and sub-admin control</p>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Courses</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#6366f1' }}>{stats.totalCourses}</div>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Questions</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981' }}>{stats.totalQuestions}</div>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Sub Admins</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#f59e0b' }}>{stats.totalSubAdmins}</div>
                </div>
            </div>

            {/* Sub Admin Table */}
            <div className="glass-card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sub Administrators</h2>
                    <button onClick={() => setShowInviteModal(true)} className="btn-primary" style={{ gap: '0.5rem' }}>
                        <Plus size={18} /> Invite Sub Admin
                    </button>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>
                ) : subAdmins.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>No sub-admins found.</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', background: '#f8fafc', borderBottom: '1px solid var(--card-border)' }}>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ADMIN NAME</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>EMAIL</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>ASSIGNED COURSES</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'right' }}>ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {subAdmins.map(admin => (
                                <tr key={admin.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <div style={{ width: 32, height: 32, background: 'rgba(99,102,241,0.1)', color: '#6366f1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                                                {admin.name?.[0]?.toUpperCase()}
                                            </div>
                                            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{admin.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{admin.email}</td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                            {admin.assignedCourses.map(c => (
                                                <span key={c.id} className="badge badge-info" style={{ fontSize: '0.7rem' }}>{c.title}</span>
                                            ))}
                                            <button 
                                                onClick={() => { setSelectedAdmin(admin); setShowAssignModal(true); }}
                                                style={{ border: 'none', background: 'none', color: '#6366f1', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', padding: '0.2rem 0.4rem' }}
                                            >
                                                Edit Assignments
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                                        <button onClick={() => deleteSubAdmin(admin.id)} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 450, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Invite Sub Admin</h2>
                            <button onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleInviteSubAdmin} style={{ padding: '1.5rem' }}>
                            {error && <div style={{ color: '#ef4444', background: '#fef2f2', padding: '0.75rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
                            <div style={{ marginBottom: '1rem' }}>
                                <label className="form-label">Email Address</label>
                                <input 
                                    type="email" 
                                    className="form-input" 
                                    placeholder="admin@example.com" 
                                    value={inviteData.email}
                                    onChange={e => setInviteData(p => ({ ...p, email: e.target.value }))}
                                    required 
                                />
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>This email will be authorized to sign up as a sub-admin. They will only see courses you assign to them.</p>
                            <button type="submit" disabled={saving} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                                {saving ? 'Sending...' : 'Send Authorization'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Modal */}
            {showAssignModal && selectedAdmin && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 500, padding: 0, overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Assign Courses</h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Managing access for {selectedAdmin.name}</p>
                            </div>
                            <button onClick={() => setShowAssignModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {courses.map(course => {
                                    const isAssigned = selectedAdmin.assignedCourses.some(c => c.id === course.id)
                                    return (
                                        <div 
                                            key={course.id} 
                                            onClick={() => toggleCourseAssignment(selectedAdmin.id, course.id, isAssigned)}
                                            style={{ 
                                                padding: '1rem', 
                                                borderRadius: 12, 
                                                border: isAssigned ? '1px solid #6366f1' : '1px solid var(--card-border)',
                                                background: isAssigned ? 'rgba(99,102,241,0.03)' : 'white',
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ width: 36, height: 36, background: isAssigned ? '#6366f1' : '#f1f5f9', color: isAssigned ? 'white' : '#94a3b8', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <BookOpen size={18} />
                                                </div>
                                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isAssigned ? '#1e1b4b' : 'var(--text-primary)' }}>{course.title}</span>
                                            </div>
                                            {isAssigned ? <Check size={20} color="#6366f1" /> : <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderRadius: '50%' }} />}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
