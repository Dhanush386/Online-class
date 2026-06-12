import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
    User, Mail, Phone, MapPin, Briefcase, GraduationCap,
    Linkedin, Github, Globe, Camera, Upload, X, Save,
    CheckCircle2, AlertCircle, Loader2, BookOpen, Users,
    ClipboardList, Code, Calendar, Shield, Award
} from 'lucide-react'

export default function OrganizerProfile() {
    const { profile, user, refreshProfileStatus } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [toast, setToast] = useState(null)
    const fileInputRef = useRef(null)

    // Platform stats
    const [stats, setStats] = useState({ courses: 0, students: 0, assessments: 0, challenges: 0 })

    // Form
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        bio: '',
        organization: '',
        designation: '',
        linkedin_url: '',
        github_url: '',
        website_url: '',
        avatar_url: ''
    })

    useEffect(() => {
        if (profile?.id) {
            loadProfile()
            loadStats()
        }
    }, [profile])

    useEffect(() => {
        if (toast) {
            const t = setTimeout(() => setToast(null), 4000)
            return () => clearTimeout(t)
        }
    }, [toast])

    async function loadProfile() {
        try {
            setLoading(true)
            setFormData({
                name: profile?.name || '',
                email: user?.email || '',
                phone: profile?.phone || '',
                bio: profile?.bio || '',
                organization: profile?.organization || '',
                designation: profile?.designation || '',
                linkedin_url: profile?.linkedin_url || '',
                github_url: profile?.github_url || '',
                website_url: profile?.website_url || '',
                avatar_url: profile?.avatar_url || ''
            })
        } finally {
            setLoading(false)
        }
    }

    async function loadStats() {
        try {
            const [
                { count: courseCount },
                { count: studentCount },
                { count: assessCount },
                { count: challengeCount }
            ] = await Promise.all([
                supabase.from('courses').select('*', { count: 'exact', head: true }).eq('organizer_id', profile.id),
                supabase.from('enrollments').select('*', { count: 'exact', head: true }),
                supabase.from('assessments').select('*', { count: 'exact', head: true }),
                supabase.from('coding_challenges').select('*', { count: 'exact', head: true })
            ])
            setStats({
                courses: courseCount || 0,
                students: studentCount || 0,
                assessments: assessCount || 0,
                challenges: challengeCount || 0
            })
        } catch (err) {
            console.error('Error loading stats:', err)
        }
    }

    async function handleSave() {
        try {
            setSaving(true)
            const { error } = await supabase
                .from('users')
                .update({
                    name: formData.name,
                    avatar_url: formData.avatar_url,
                    phone: formData.phone,
                    bio: formData.bio,
                    organization: formData.organization,
                    designation: formData.designation,
                    linkedin_url: formData.linkedin_url,
                    github_url: formData.github_url,
                    website_url: formData.website_url
                })
                .eq('id', profile.id)

            if (error) throw error
            
             // 2. Sync with Auth Metadata (Source of truth for Supabase)
             await supabase.auth.updateUser({
                data: { name: formData.name }
            })

            await refreshProfileStatus()
            setToast({ type: 'success', message: 'Profile updated successfully!' })
        } catch (err) {
            console.error('Error saving:', err)
            setToast({ type: 'error', message: err.message || 'Failed to save profile' })
        } finally {
            setSaving(false)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleAvatarUpload = async (e) => {
        const file = e.target.files[0]
        if (!file) return
        try {
            const fileExt = file.name.split('.').pop()
            const filePath = `${profile.id}/avatar_${Date.now()}.${fileExt}`
            const { error: uploadErr } = await supabase.storage
                .from('profiles')
                .upload(filePath, file, { upsert: true })
            if (uploadErr) throw uploadErr

            const { data: { publicUrl } } = supabase.storage
                .from('profiles')
                .getPublicUrl(filePath)

            setFormData(prev => ({ ...prev, avatar_url: publicUrl }))
            setToast({ type: 'success', message: 'Avatar uploaded!' })
        } catch (err) {
            setToast({ type: 'error', message: 'Upload failed: ' + err.message })
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <Loader2 className="animate-spin" size={32} color="#6366f1" />
            </div>
        )
    }

    const statCards = [
        { label: 'Courses', value: stats.courses, icon: BookOpen, color: '#6366f1' },
        { label: 'Students', value: stats.students, icon: Users, color: '#10b981' },
        { label: 'Assessments', value: stats.assessments, icon: ClipboardList, color: '#f59e0b' },
        { label: 'Challenges', value: stats.challenges, icon: Code, color: '#ec4899' },
    ]

    return (
        <div className="animate-fade-in" style={{ maxWidth: 900, margin: '0 auto', paddingBottom: '4rem' }}>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: '2rem', right: '2rem', zIndex: 2000,
                    padding: '1rem 1.5rem', borderRadius: 12,
                    background: toast.type === 'success' ? '#10b981' : '#ef4444',
                    color: 'white', display: 'flex', alignItems: 'center', gap: '0.75rem',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)', animation: 'slideIn 0.3s ease-out'
                }}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{toast.message}</span>
                    <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><X size={16} /></button>
                    <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
                </div>
            )}

            {/* Profile Header Card */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
                {/* Banner */}
                <div style={{ height: 140, background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)', position: 'relative' }}>
                    <div style={{ position: 'absolute', bottom: -50, left: '2rem', display: 'flex', alignItems: 'flex-end', gap: '1.5rem' }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{
                                width: 100, height: 100, borderRadius: '50%', border: '4px solid white',
                                background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                            }}>
                                {formData.avatar_url ? (
                                    <img src={formData.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <User size={40} color="#94a3b8" />
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current.click()}
                                style={{
                                    position: 'absolute', bottom: 0, right: 0,
                                    width: 32, height: 32, borderRadius: '50%',
                                    background: '#6366f1', border: '3px solid white', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                                }}
                            >
                                <Camera size={14} />
                            </button>
                            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
                        </div>
                    </div>
                    <div style={{ position: 'absolute', top: '1rem', right: '1.5rem' }}>
                        <span style={{ padding: '0.3rem 0.75rem', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Shield size={12} /> {profile?.role?.replace('_', ' ').toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Name + Actions */}
                <div style={{ padding: '3.5rem 2rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{formData.name || 'Organizer'}</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Mail size={14} /> {formData.email}
                        </p>
                        {formData.organization && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Briefcase size={14} /> {formData.designation ? `${formData.designation} at ` : ''}{formData.organization}
                            </p>
                        )}
                    </div>
                    <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ gap: '0.5rem', padding: '0.6rem 1.5rem' }}>
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {statCards.map(s => (
                    <div key={s.label} className="glass-card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                            <s.icon size={20} color={s.color} />
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Form Sections */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                {/* Personal Info */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User size={18} color="#6366f1" /> Personal Information
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label className="form-label">Full Name</label>
                            <input name="name" value={formData.name} onChange={handleChange} className="form-input" placeholder="Your full name" />
                        </div>
                        <div>
                            <label className="form-label">Email</label>
                            <input value={formData.email} disabled className="form-input" style={{ background: '#f8fafc', color: '#64748b' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#10b981', fontSize: '0.75rem', marginTop: '0.4rem', fontWeight: 600 }}>
                                <CheckCircle2 size={12} /> Verified
                            </div>
                        </div>
                        <div>
                            <label className="form-label">Phone Number</label>
                            <input name="phone" value={formData.phone} onChange={handleChange} className="form-input" placeholder="+91 XXXXX XXXXX" />
                        </div>
                        <div>
                            <label className="form-label">Bio / About</label>
                            <textarea name="bio" value={formData.bio} onChange={handleChange} className="form-input" rows={3} placeholder="A short description about yourself..." style={{ resize: 'none' }} />
                        </div>
                    </div>
                </div>

                {/* Professional Info */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Briefcase size={18} color="#f59e0b" /> Professional Details
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label className="form-label">Organization / Institute</label>
                            <input name="organization" value={formData.organization} onChange={handleChange} className="form-input" placeholder="e.g. XYZ University" />
                        </div>
                        <div>
                            <label className="form-label">Designation / Role</label>
                            <input name="designation" value={formData.designation} onChange={handleChange} className="form-input" placeholder="e.g. Professor, HOD, Trainer" />
                        </div>

                        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '1.25rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Globe size={16} /> Social Links
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ position: 'relative' }}>
                                    <Linkedin size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#0077b5' }} />
                                    <input name="linkedin_url" value={formData.linkedin_url} onChange={handleChange} className="form-input" placeholder="LinkedIn profile URL" style={{ paddingLeft: '2.5rem' }} />
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <Github size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#333' }} />
                                    <input name="github_url" value={formData.github_url} onChange={handleChange} className="form-input" placeholder="GitHub profile URL" style={{ paddingLeft: '2.5rem' }} />
                                </div>
                                <div style={{ position: 'relative' }}>
                                    <Globe size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6366f1' }} />
                                    <input name="website_url" value={formData.website_url} onChange={handleChange} className="form-input" placeholder="Personal website URL" style={{ paddingLeft: '2.5rem' }} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Save Bar */}
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button onClick={() => navigate('/organizer')} className="btn-secondary" style={{ padding: '0.7rem 1.5rem' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ padding: '0.7rem 2rem', gap: '0.5rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    )
}
