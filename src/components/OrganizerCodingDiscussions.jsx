import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MessageSquare, CheckCircle2, Search, Send, Clock, Code as CodeIcon, ChevronLeft } from 'lucide-react'
import { useToast } from './Toast'

export default function OrganizerCodingDiscussions() {
    const { profile } = useAuth()
    const toast = useToast()
    const [discussions, setDiscussions] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [activeThread, setActiveThread] = useState(null)
    const [replies, setReplies] = useState([])
    const [replyContent, setReplyContent] = useState('')

    useEffect(() => {
        if (!activeThread) {
            fetchDiscussions()
        } else {
            fetchReplies(activeThread.id)
        }
    }, [activeThread])

    const fetchDiscussions = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('coding_discussions')
                .select('*, users:student_id(name), coding_challenges:challenge_id(title)')
                .order('created_at', { ascending: false })
            
            if (error) throw error
            setDiscussions(data)
        } catch (err) {
            console.error(err)
            toast.error("Failed to load discussions")
        } finally {
            setLoading(false)
        }
    }

    const fetchReplies = async (discussionId) => {
        try {
            const { data, error } = await supabase
                .from('coding_discussion_replies')
                .select('*, users:user_id(name, role)')
                .eq('discussion_id', discussionId)
                .order('created_at', { ascending: true })
            
            if (error) throw error
            setReplies(data)
        } catch (err) {
            console.error(err)
        }
    }

    const handlePostReply = async (e) => {
        e.preventDefault()
        if (!replyContent.trim()) return
        try {
            const { error } = await supabase.from('coding_discussion_replies').insert({
                discussion_id: activeThread.id,
                user_id: profile.id,
                content: replyContent,
                is_organizer: true
            })
            if (error) throw error
            toast.success("Reply posted")
            setReplyContent('')
            fetchReplies(activeThread.id)
        } catch (err) {
            console.error(err)
            toast.error("Failed to post reply")
        }
    }

    const handleMarkResolved = async (id) => {
        try {
            const { error } = await supabase.from('coding_discussions').update({ status: 'resolved' }).eq('id', id)
            if (error) throw error
            toast.success("Marked as resolved")
            if (activeThread && activeThread.id === id) {
                setActiveThread({ ...activeThread, status: 'resolved' })
            } else {
                fetchDiscussions()
            }
        } catch (err) {
            console.error(err)
            toast.error("Failed to update status")
        }
    }

    if (activeThread) {
        return (
            <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)' }}>
                <button onClick={() => setActiveThread(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.9rem', width: 'fit-content' }}>
                    <ChevronLeft size={16} /> Back to All Discussions
                </button>
                
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingRight: '1rem' }}>
                    {/* Original Post */}
                    <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{activeThread.title}</h2>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>Challenge: <strong style={{ color: 'var(--text-secondary)' }}>{activeThread.coding_challenges?.title}</strong></span>
                                    <span>•</span>
                                    <span>Student: <strong style={{ color: 'var(--text-secondary)' }}>{activeThread.users?.name}</strong></span>
                                    <span>•</span>
                                    <span><Clock size={12} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {new Date(activeThread.created_at).toLocaleString()}</span>
                                </div>
                            </div>
                            {activeThread.status !== 'resolved' && (
                                <button onClick={() => handleMarkResolved(activeThread.id)} className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <CheckCircle2 size={14} /> Mark Resolved
                                </button>
                            )}
                        </div>
                        
                        <p style={{ fontSize: '0.95rem', color: 'var(--card-border)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{activeThread.content}</p>
                        
                        {activeThread.code_snapshot && (
                            <div style={{ marginTop: '1.5rem', borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                                <div style={{ padding: '0.5rem 1rem', background: '#e2e8f0', borderBottom: '1px solid #cbd5e1', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}><CodeIcon size={14} /> Attached Code Snapshot</div>
                                <pre style={{ margin: 0, padding: '1rem', background: '#f1f5f9', color: 'var(--text-primary)', fontSize: '0.85rem', overflowX: 'auto', border: 'none' }}>{activeThread.code_snapshot}</pre>
                            </div>
                        )}
                    </div>

                    {/* Replies */}
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '1rem' }}>Replies</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                        {replies.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>No replies yet.</div>
                        ) : (
                            replies.map(reply => (
                                <div key={reply.id} style={{ padding: '1.25rem', borderRadius: 12, background: reply.is_organizer ? '#eff6ff' : '#fff', border: `1px solid ${reply.is_organizer ? '#bfdbfe' : '#e2e8f0'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: reply.is_organizer ? '#1d4ed8' : 'var(--card-border)' }}>{reply.users?.name || 'User'}</span>
                                        {reply.is_organizer && <span style={{ padding: '2px 8px', background: '#3b82f6', color: '#fff', fontSize: '0.65rem', borderRadius: 6, fontWeight: 800 }}>ORGANIZER</span>}
                                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(reply.created_at).toLocaleString()}</span>
                                    </div>
                                    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{reply.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Reply Form */}
                <form onSubmit={handlePostReply} style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
                    <input value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="Type your authoritative reply..." style={{ flex: 1, padding: '1rem', borderRadius: 10, border: '1px solid #cbd5e1', fontSize: '0.95rem', outline: 'none' }} />
                    <button type="submit" disabled={!replyContent.trim()} className="btn-primary" style={{ padding: '0 1.5rem', opacity: replyContent.trim() ? 1 : 0.5 }}>
                        <Send size={18} /> Reply
                    </button>
                </form>
            </div>
        )
    }

    const filtered = discussions.filter(d => 
        d.title.toLowerCase().includes(search.toLowerCase()) || 
        d.coding_challenges?.title?.toLowerCase().includes(search.toLowerCase()) ||
        d.users?.name?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="glass-card animate-fade-in" style={{ padding: '1.5rem', minHeight: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search discussions by title, challenge, or student..."
                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.8rem', borderRadius: 10, border: '1px solid var(--card-border)', background: 'white', fontSize: '0.9rem' }}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading discussions...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', background: '#f8fafc', borderRadius: 12, border: '1px dashed #cbd5e1' }}>
                    <MessageSquare size={32} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>No discussions found</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Students haven't asked any questions yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {filtered.map(d => (
                        <div key={d.id} onClick={() => setActiveThread(d)} style={{ padding: '1.25rem', borderRadius: 12, background: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.2s', ':hover': { borderColor: 'var(--text-muted)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' } }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{d.title}</h4>
                                {d.status === 'resolved' ? (
                                    <span style={{ padding: '4px 8px', background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: '0.7rem', borderRadius: 6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><CheckCircle2 size={12} /> Resolved</span>
                                ) : (
                                    <span style={{ padding: '4px 8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontSize: '0.7rem', borderRadius: 6, fontWeight: 700, whiteSpace: 'nowrap' }}>Open</span>
                                )}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{d.coding_challenges?.title}</span>
                                <span>•</span>
                                <span>{d.users?.name}</span>
                            </div>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '1rem' }}>{d.content}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <span>{new Date(d.created_at).toLocaleString()}</span>
                                {d.code_snapshot && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CodeIcon size={14} /> Code attached</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
