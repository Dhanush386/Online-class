import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { 
    Bell, Send, Trash2, Info, AlertTriangle, CheckCircle, 
    History, Plus, Clock, X, Globe
} from 'lucide-react'
import { subscribeToPush, checkPushSubscription } from '../../utils/pushService'

export default function Notifications() {
    const { profile } = useAuth()
    const [notifications, setNotifications] = useState([])
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isCheckingSub, setIsCheckingSub] = useState(true)
    
    // Form state
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'info',
        target: 'all'
    })

    useEffect(() => {
        fetchNotifications()
        checkSubscription()
    }, [])

    async function checkSubscription() {
        try {
            const sub = await checkPushSubscription()
            setIsSubscribed(sub)
        } catch (err) {
            console.error('Error checking subscription:', err)
        } finally {
            setIsCheckingSub(false)
        }
    }

    async function handleEnableNotifications() {
        try {
            const sub = await subscribeToPush(profile.id)
            if (sub) {
                setIsSubscribed(true)
                alert('Notifications enabled successfully! You will now receive alerts even when the app is closed.')
            }
        } catch (err) {
            console.error('Error enabling notifications:', err)
            alert('Failed to enable notifications. Please ensure you allow permissions in your browser.')
        }
    }

    async function fetchNotifications() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (error) throw error
            setNotifications(data || [])
        } catch (err) {
            console.error('Error fetching notifications:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.title || !formData.message) return

        try {
            setSending(true)
            const { error } = await supabase
                .from('notifications')
                .insert([{
                    ...formData,
                    sender_id: profile.id
                }])
            
            if (error) throw error
            
            setShowCreateModal(false)
            setFormData({ title: '', message: '', type: 'info', target: 'all' })
            fetchNotifications()
        } catch (err) {
            console.error('Error sending notification:', err)
            alert('Failed to send notification')
        } finally {
            setSending(false)
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this notification history?')) return
        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', id)
            
            if (error) throw error
            fetchNotifications()
        } catch (err) {
            console.error('Error deleting notification:', err)
        }
    }

    const getTypeIcon = (type) => {
        switch (type) {
            case 'warning': return <AlertTriangle size={18} color="#f59e0b" />
            case 'success': return <CheckCircle size={18} color="#10b981" />
            default: return <Info size={18} color="#3b82f6" />
        }
    }

    const getTargetLabel = (target) => {
        switch (target) {
            case 'students': return { label: 'Students Only', color: '#10b981', bg: 'rgba(16,185,129,0.1)' }
            case 'organizers': return { label: 'Organizers Only', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' }
            default: return { label: 'Everyone', color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.1)' }
        }
    }

    const renderNotificationsHistory = () => {
        if (loading) {
            return (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <div className="spinner"></div>
                </div>
            );
        }
        if (notifications.length === 0) {
            return (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Bell size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <p>No notifications sent yet.</p>
                </div>
            );
        }
        return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notifications.map(n => {
                    const target = getTargetLabel(n.target)
                    return (
                        <div key={n.id} style={{ borderBottom: '1px solid var(--sidebar-border)', padding: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: '1 1 min-content' }}>
                                <div style={{ marginTop: '0.2rem', flexShrink: 0 }}>{getTypeIcon(n.type)}</div>
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem', fontSize: '0.95rem' }}>{n.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: '1.4', wordBreak: 'break-word' }}>{n.message}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                        <span style={{ 
                                            fontSize: '0.75rem', 
                                            fontWeight: 700, 
                                            padding: '0.2rem 0.6rem', 
                                            borderRadius: 20, 
                                            background: target.bg, 
                                            color: target.color,
                                            textTransform: 'uppercase'
                                        }}>
                                            {target.label}
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            <Clock size={14} />
                                            {new Date(n.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ flexShrink: 0, paddingLeft: '0.5rem' }}>
                                <button 
                                    onClick={() => handleDelete(n.id)}
                                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    className="nav-item-hover"
                                    title="Delete History"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        );
    };

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="stack-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Global Notifications</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Broadcast announcements and alerts to all platform users.</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                    {!isCheckingSub && !isSubscribed && (
                        <button 
                            onClick={handleEnableNotifications}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '0.6rem', 
                                padding: '0.5rem 1rem', borderRadius: 10, background: '#f0fdf4', 
                                border: '1px solid #10b981', color: '#166534', fontSize: '0.85rem', 
                                fontWeight: 600, cursor: 'pointer' 
                            }}
                            className="nav-item-hover"
                        >
                            <Globe size={16} />
                            Enable App Notifications
                        </button>
                    )}
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="btn-primary"
                    >
                        <Plus size={20} />
                        New Broadcast
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                    <div className="glass-card" style={{ padding: 0, borderRadius: 16, border: '1px solid var(--sidebar-border)', overflow: 'hidden' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                            <History size={20} color="var(--text-secondary)" />
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Broadcasting History</h2>
                        </div>
                        
                        {renderNotificationsHistory()}
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            {showCreateModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
                    <div className="animate-scale-in" style={{ background: 'var(--bg-base)', border: '1px solid var(--sidebar-border)', borderRadius: 20, width: '100%', maxWidth: '500px', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
                        <div style={{ padding: '1.5rem', background: 'var(--accent)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                <Send size={24} />
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Send New Broadcast</h2>
                            </div>
                            <button 
                                onClick={() => setShowCreateModal(false)}
                                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', display: 'flex' }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Broadcast Title{/* */}
                                        <input 
                                            type="text"
                                            required
                                            placeholder="e.g. Schedule Update for Tomorrow"
                                            value={formData.title}
                                            onChange={e => setFormData({...formData, title: e.target.value})}
                                            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid var(--sidebar-border)', outline: 'none', fontSize: '0.95rem', background: 'var(--bg-elevated)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                        />
                                    </label>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Message Content{/* */}
                                        <textarea 
                                            required
                                            rows={4}
                                            placeholder="Write your announcement here..."
                                            value={formData.message}
                                            onChange={e => setFormData({...formData, message: e.target.value})}
                                            style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem 1rem', borderRadius: 10, border: '1px solid var(--sidebar-border)', outline: 'none', fontSize: '0.95rem', resize: 'vertical', background: 'var(--bg-elevated)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                        />
                                    </label>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            Type{/* */}
                                            <select 
                                                value={formData.type}
                                                onChange={e => setFormData({...formData, type: e.target.value})}
                                                style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem', borderRadius: 10, border: '1px solid var(--sidebar-border)', outline: 'none', fontSize: '0.95rem', background: 'var(--bg-elevated)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                            >
                                                <option value="info">Information</option>
                                                <option value="warning">Important Alert</option>
                                                <option value="success">Success / Celebration</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                            Target Audience{/* */}
                                            <select 
                                                value={formData.target}
                                                onChange={e => setFormData({...formData, target: e.target.value})}
                                                style={{ display: 'block', width: '100%', marginTop: '0.5rem', padding: '0.8rem', borderRadius: 10, border: '1px solid var(--sidebar-border)', outline: 'none', fontSize: '0.95rem', background: 'var(--bg-elevated)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                                            >
                                                <option value="all">Everyone</option>
                                                <option value="students">Students Only</option>
                                                <option value="organizers">Organizers Only</option>
                                            </select>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button 
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    style={{ flex: 1, padding: '0.8rem', border: '1px solid var(--sidebar-border)', borderRadius: 12, background: 'none', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={sending}
                                    className="btn-primary"
                                    style={{ flex: 2, justifyContent: 'center' }}
                                >
                                    {sending ? <div className="spinner-white"></div> : <><Send size={18} /> Send Broadcast</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
