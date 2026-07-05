import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { 
    CheckCircle2, XCircle, Clock, Search, 
    RefreshCw, User, CreditCard, 
    Loader2
} from 'lucide-react'

function getStatusBadgeClass(status) {
    if (status === 'pending') return 'warning'
    if (status === 'approved') return 'success'
    return 'danger'
}

export default function RenewalManagement() {
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [actioningId, setActioningId] = useState(null)
    const [filter, setFilter] = useState('pending')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        fetchRequests()
    }, [filter])

    async function fetchRequests() {
        try {
            setLoading(true)
            let query = supabase
                .from('payments')
                .select('*, users!inner(name, email)')
                .order('created_at', { ascending: false })

            if (filter !== 'all') {
                query = query.eq('status', filter)
            }

            const { data, error } = await query

            if (error) throw error
            setRequests(data || [])
        } catch (err) {
            console.error('Error fetching renewals:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleAction(id, newStatus) {
        try {
            setActioningId(id)
            const { error } = await supabase
                .from('payments')
                .update({ status: newStatus })
                .eq('id', id)

            if (error) throw error
            
            // Optimistic update
            setRequests(requests.map(req => 
                req.id === id ? { ...req, status: newStatus } : req
            ))

            if (newStatus === 'approved') {
                alert('Renewal approved! Student access has been extended.')
            }
        } catch (err) {
            console.error('Action failed:', err)
            alert('Failed to update status: ' + err.message)
        } finally {
            setActioningId(null)
            if (filter !== 'all') fetchRequests()
        }
    }

    const filteredRequests = requests.filter(req => 
        req.users.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.users.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.transaction_id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', overflowX: 'hidden' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Renewal Management</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Verify and approve student access renewal requests</p>
                </div>
                <button 
                    onClick={fetchRequests} 
                    className="btn-secondary"
                    style={{ padding: '0.5rem', borderRadius: '8px' }}
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Controls */}
            <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                        type="text" 
                        placeholder="Search name, email or transaction ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="form-input"
                        style={{ paddingLeft: '2.5rem' }}
                    />
                </div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '10px' }}>
                    {['pending', 'approved', 'rejected', 'all'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                border: 'none',
                                background: filter === f ? 'white' : 'transparent',
                                color: filter === f ? 'var(--accent)' : 'var(--text-secondary)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: filter === f ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                                textTransform: 'capitalize'
                            }}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            <div className="glass-card" style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '700px' }}>
                    <thead>
                        <tr>
                            <th>Student</th>
                            <th>Transaction Details</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                                    <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent)', margin: '0 auto' }} />
                                    <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading requests...</p>
                                </td>
                            </tr>
                        )}
                        {!loading && filteredRequests.length === 0 && (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '4rem' }}>
                                    <Clock size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                                    <p style={{ color: 'var(--text-secondary)' }}>No {filter === 'all' ? '' : filter} requests found.</p>
                                </td>
                            </tr>
                        )}
                        {!loading && filteredRequests.length > 0 && (
                            filteredRequests.map((req) => (
                                <tr key={req.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                            <div style={{ width: 36, height: 36, background: 'var(--accent-glow)', color: 'var(--accent)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{req.users.name}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{req.users.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                                            <CreditCard size={14} />
                                            {req.transaction_id}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>₹{req.amount} via {req.payment_method}</div>
                                    </td>
                                    <td style={{ fontSize: '0.8rem' }}>
                                        {new Date(req.created_at).toLocaleDateString()}
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${getStatusBadgeClass(req.status)}`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td>
                                        {req.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button 
                                                    onClick={() => handleAction(req.id, 'approved')}
                                                    disabled={actioningId === req.id}
                                                    style={{ 
                                                        background: '#d1fae5', 
                                                        color: '#065f46', 
                                                        border: 'none', 
                                                        padding: '6px', 
                                                        borderRadius: '6px', 
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Approve"
                                                >
                                                    {actioningId === req.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                </button>
                                                <button 
                                                    onClick={() => handleAction(req.id, 'rejected')}
                                                    disabled={actioningId === req.id}
                                                    style={{ 
                                                        background: '#fee2e2', 
                                                        color: '#991b1b', 
                                                        border: 'none', 
                                                        padding: '6px', 
                                                        borderRadius: '6px', 
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                    title="Reject"
                                                >
                                                    {actioningId === req.id ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                                </button>
                                            </div>
                                        )}
                                        {req.status !== 'pending' && (
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Processed</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
