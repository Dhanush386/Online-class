import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
    CreditCard, CheckCircle2, AlertCircle, Loader2, 
    ArrowRight, ShieldCheck, Zap, Copy, ExternalLink,
    Smartphone, Download
} from 'lucide-react'

export default function RenewAccess() {
    const { user, profile, refreshProfileStatus, isExpired, signOut } = useAuth()
    const navigate = useNavigate()
    const [saving, setSaving] = useState(false)
    const [transactionId, setTransactionId] = useState('')
    const [error, setError] = useState(null)
    const [copied, setCopied] = useState(false)

    const UPI_ID = "dhanush74244@okhdfcbank"
    const AMOUNT = "100"

    // Construct UPI Deep Link for mobile
    const upiLink = `upi://pay?pa=${UPI_ID}&pn=Dhanush&am=${AMOUNT}&cu=INR&tn=CourseRenewal`

    const handleCopyUpi = () => {
        navigator.clipboard.writeText(UPI_ID)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!transactionId || transactionId.length < 10) {
            setError("Please enter a valid 12-digit Transaction ID (UTR)")
            return
        }

        try {
            setSaving(true)
            setError(null)

            // 1. Record the payment
            const { error: payError } = await supabase
                .from('payments')
                .insert({
                    student_id: user.id,
                    amount: 100,
                    transaction_id: transactionId,
                    status: 'approved' // Automatically approved as per user request
                })

            if (payError) throw payError

            // 2. Extend the access via RPC
            const { error: rpcError } = await supabase
                .rpc('extend_student_access', { p_student_id: user.id })

            if (rpcError) throw rpcError

            // 3. Refresh profile to clear the isExpired status
            await refreshProfileStatus()
            
            // 4. Success! Redirect to student dashboard
            navigate('/student', { replace: true })
            
        } catch (err) {
            console.error('Renewal failed:', err)
            setError(err.message || "Something went wrong. Please try again or contact support.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{ 
            minHeight: '100vh', 
            background: '#0a0d1a', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '2rem',
            color: 'white'
        }}>
            <div className="glass-card" style={{ 
                maxWidth: 500, 
                width: '100%', 
                padding: '2.5rem',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Decorative background element */}
                <div style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: 150,
                    height: 150,
                    background: 'rgba(99,102,241,0.1)',
                    borderRadius: '50%',
                    filter: 'blur(40px)'
                }} />

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ 
                        width: 64, 
                        height: 64, 
                        background: 'rgba(239,68,68,0.1)', 
                        color: '#ef4444', 
                        borderRadius: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        margin: '0 auto 1.5rem',
                        border: '1px solid rgba(239,68,68,0.2)'
                    }}>
                        <AlertCircle size={32} />
                    </div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>Access Expired</h1>
                    <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Your current subscription phase has ended. Renew now to continue your learning journey.</p>
                </div>

                <div style={{ 
                    background: 'rgba(255,255,255,0.03)', 
                    borderRadius: '16px', 
                    padding: '1.5rem',
                    marginBottom: '2rem',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Renewal Plan</span>
                        <span style={{ fontWeight: 700, color: '#6366f1' }}>1 Month Access</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Amount Payable</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>₹100</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>Step 1: Pay via UPI</label>
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem', 
                            background: 'rgba(255,255,255,0.05)', 
                            padding: '0.75rem 1rem', 
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <Smartphone size={20} color="#6366f1" />
                            <span style={{ flex: 1, fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600 }}>{UPI_ID}</span>
                            <button 
                                type="button" 
                                onClick={handleCopyUpi} 
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: copied ? '#10b981' : '#6366f1', 
                                    cursor: 'pointer',
                                    padding: '4px'
                                }}
                            >
                                {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                            </button>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>Scan QR or pay to the above UPI ID using GPay, PhonePe, or Paytm.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>Step 2: Enter Transaction ID (UTR)</label>
                        <input 
                            value={transactionId}
                            onChange={(e) => setTransactionId(e.target.value)}
                            placeholder="Enter 12-digit UTR/Ref number"
                            style={{ 
                                width: '100%', 
                                padding: '1rem', 
                                background: 'rgba(255,255,255,0.05)', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                borderRadius: '12px',
                                color: 'white',
                                outline: 'none'
                            }}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            color: '#ef4444', 
                            fontSize: '0.85rem',
                            background: 'rgba(239,68,68,0.1)',
                            padding: '0.75rem',
                            borderRadius: '8px'
                        }}>
                            <AlertCircle size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={saving || !transactionId} 
                        className="btn-primary" 
                        style={{ 
                            width: '100%', 
                            padding: '1rem', 
                            fontSize: '1rem', 
                            gap: '0.75rem',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            boxShadow: '0 10px 20px rgba(99,102,241,0.2)'
                        }}
                    >
                        {saving ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Processing Renewal...
                            </>
                        ) : (
                            <>
                                <ShieldCheck size={20} />
                                Verify & Extend Access
                            </>
                        )}
                    </button>

                    <div style={{ textAlign: 'center' }}>
                        <button 
                            type="button"
                            onClick={() => signOut()}
                            style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: '#64748b', 
                                fontSize: '0.875rem', 
                                cursor: 'pointer',
                                textDecoration: 'underline'
                            }}
                        >
                            Log Out from Account
                        </button>
                    </div>
                </form>

                <div style={{ 
                    marginTop: '2rem', 
                    paddingTop: '1.5rem', 
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <Zap size={16} color="#f59e0b" style={{ marginTop: 2, flexShrink: 0 }} />
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                            <strong>Instant Access:</strong> Your account will be activated immediately after you submit the transaction ID.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <ShieldCheck size={16} color="#10b981" style={{ marginTop: 2, flexShrink: 0 }} />
                        <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
                            <strong>Secured:</strong> All transactions are audited. Incorrect transaction IDs may lead to permanent account suspension.
                        </p>
                    </div>
                </div>
            </div>
            
            <style>{`
                .glass-card {
                    background: rgba(15, 20, 35, 0.7);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 24px;
                }
                .btn-primary:active {
                    transform: translateY(1px);
                }
                input::placeholder {
                    color: #475569;
                }
            `}</style>
        </div>
    )
}
