import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MessageSquare, Plus, ChevronLeft, Send, Code as CodeIcon, Clock, ThumbsUp, CheckCircle2 } from 'lucide-react'
import { useToast } from './Toast'

export default function CodingDiscussions({ challengeId, currentCode }) {
    const { profile } = useAuth()
    const toast = useToast()
    const [discussions, setDiscussions] = useState([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState('list') // 'list', 'create', 'thread'
    const [activeThread, setActiveThread] = useState(null)
    const [replies, setReplies] = useState([])

    // Create form state
    const [newTitle, setNewTitle] = useState('')
    const [newContent, setNewContent] = useState('')
    const [attachCode, setAttachCode] = useState(true)

    // Reply state
    const [replyContent, setReplyContent] = useState('')

    useEffect(() => {
        if (view === 'list') {
            fetchDiscussions()
        } else if (view === 'thread' && activeThread) {
            fetchReplies(activeThread.id)
        }
    }, [view, activeThread, challengeId])

    const fetchDiscussions = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('coding_discussions')
                .select('*, users:student_id(name)')
                .eq('challenge_id', challengeId)
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
                .select('*, users:user_id(name)')
                .eq('discussion_id', discussionId)
                .order('created_at', { ascending: true })
            
            if (error) throw error
            setReplies(data)
        } catch (err) {
            console.error(err)
        }
    }

    const handleCreateThread = async (e) => {
        e.preventDefault()
        if (!newTitle.trim() || !newContent.trim()) return

        try {
            let codeSnapshot = null;
            if (attachCode) {
                codeSnapshot = typeof currentCode === 'string' ? currentCode : JSON.stringify(currentCode);
            }
            const { error } = await supabase.from('coding_discussions').insert({
                challenge_id: challengeId,
                student_id: profile.id,
                title: newTitle,
                content: newContent,
                code_snapshot: codeSnapshot
            })
            if (error) throw error
            toast.success("Thread created successfully!")
            setView('list')
            setNewTitle('')
            setNewContent('')
        } catch (err) {
            console.error(err)
            toast.error("Failed to create thread")
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
                is_organizer: profile.role === 'organizer' || profile.role === 'sub_admin' || profile.role === 'main_admin'
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

    if (loading && view === 'list') {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading discussions...</div>
    }

    if (view === 'create') {
        return (
            <div className="animate-fade-in" style={{ padding: '0.5rem' }}>
                <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                    <ChevronLeft size={16} /> Back to Discussions
                </button>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#fff' }}>Start a New Thread</h3>
                <form onSubmit={handleCreateThread} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label htmlFor="thread-title" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Title</label>
                        <input id="thread-title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="E.g. Getting an EOFError on Test Case 2" required style={{ width: '100%', padding: '0.75rem', borderRadius: 8, background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: '#fff', fontSize: '0.9rem' }} />
                    </div>
                    <div>
                        <label htmlFor="thread-desc" style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Description</label>
                        <textarea id="thread-desc" value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Describe what you need help with..." required rows={5} style={{ width: '100%', padding: '0.75rem', borderRadius: 8, background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: '#fff', fontSize: '0.9rem', resize: 'vertical' }} />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: '#cbd5e1' }}>
                        <input type="checkbox" checked={attachCode} onChange={e => setAttachCode(e.target.checked)} />
                        <span>Attach my current code workspace snapshot</span>
                    </label>
                    <button type="submit" style={{ padding: '0.75rem', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', fontWeight: 700, marginTop: '1rem', cursor: 'pointer' }}>Post Thread</button>
                </form>
            </div>
        )
    }

    if (view === 'thread' && activeThread) {
        return (
            <div className="animate-fade-in" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                    <ChevronLeft size={16} /> Back
                </button>
                
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {/* Original Post */}
                    <div style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>{activeThread.title}</h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                            <span>Posted by {activeThread.users?.name || 'Student'}</span>
                            <span>•</span>
                            <Clock size={12} /> {new Date(activeThread.created_at).toLocaleDateString()}
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--text-primary)', padding: '1rem', borderRadius: 8, border: '1px solid var(--card-border)' }}>{activeThread.content}</p>
                        
                        {activeThread.code_snapshot && (
                            <div style={{ marginTop: '1rem', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                                <div style={{ padding: '0.5rem 1rem', background: 'var(--text-primary)', borderBottom: '1px solid var(--card-border)', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CodeIcon size={14} /> Attached Code Snapshot</div>
                                <pre style={{ margin: 0, padding: '1rem', background: 'var(--text-primary)', color: '#e2e8f0', fontSize: '0.8rem', overflowX: 'auto' }}>{activeThread.code_snapshot}</pre>
                            </div>
                        )}
                    </div>

                    {/* Replies */}
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase' }}>Replies</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                        {replies.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--text-primary)', borderRadius: 8, border: '1px dashed var(--card-border)' }}>No replies yet.</div>
                        ) : (
                            replies.map(reply => (
                                <div key={reply.id} style={{ padding: '1rem', borderRadius: 8, background: reply.is_organizer ? '#1e3a8a20' : 'var(--text-primary)', border: `1px solid ${reply.is_organizer ? '#3b82f650' : 'var(--card-border)'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: reply.is_organizer ? '#60a5fa' : 'var(--text-muted)' }}>{reply.users?.name || 'User'}</span>
                                        {reply.is_organizer && <span style={{ padding: '2px 6px', background: '#3b82f6', color: '#fff', fontSize: '0.6rem', borderRadius: 4, fontWeight: 800 }}>MENTOR</span>}
                                        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(reply.created_at).toLocaleString()}</span>
                                    </div>
                                    <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{reply.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Reply Form */}
                <form onSubmit={handlePostReply} style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--card-border)' }}>
                    <input value={replyContent} onChange={e => setReplyContent(e.target.value)} placeholder="Type your reply..." style={{ flex: 1, padding: '0.75rem', borderRadius: 8, background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: '#fff', fontSize: '0.9rem' }} />
                    <button type="submit" disabled={!replyContent.trim()} style={{ padding: '0 1.25rem', borderRadius: 8, background: '#3b82f6', border: 'none', color: '#fff', cursor: replyContent.trim() ? 'pointer' : 'not-allowed', opacity: replyContent.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Send size={18} />
                    </button>
                </form>
            </div>
        )
    }

    return (
        <div className="animate-fade-in" style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={18} /> Discussions</h3>
                <button onClick={() => setView('create')} style={{ padding: '0.4rem 0.8rem', borderRadius: 6, background: '#3b82f6', border: 'none', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={14} /> New Thread
                </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {discussions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        <MessageSquare size={32} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                        <p style={{ fontSize: '0.9rem' }}>No discussions yet. Be the first to ask a question!</p>
                    </div>
                ) : (
                    discussions.map(d => (
                        <button 
                            key={d.id} 
                            onClick={() => { setActiveThread(d); setView('thread') }} 
                            style={{ display: 'block', width: '100%', textAlign: 'left', fontFamily: 'inherit', color: 'inherit', padding: '1rem', borderRadius: 8, background: 'var(--text-primary)', border: '1px solid var(--card-border)', cursor: 'pointer', transition: 'all 0.2s ease', ':hover': { borderColor: 'var(--text-secondary)' } }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0', margin: 0, lineHeight: 1.4 }}>{d.title}</h4>
                                {d.status === 'resolved' && <span style={{ padding: '2px 6px', background: '#10b98120', color: '#10b981', border: '1px solid #10b98150', fontSize: '0.65rem', borderRadius: 4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}><CheckCircle2 size={10} /> Resolved</span>}
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '1rem' }}>{d.content}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>{d.users?.name || 'Student'}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><ThumbsUp size={12} /> {d.upvotes}</span>
                                {d.code_snapshot && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><CodeIcon size={12} /> Code attached</span>}
                                <span style={{ marginLeft: 'auto' }}>{new Date(d.created_at).toLocaleDateString()}</span>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    )
}

CodingDiscussions.propTypes = {
    challengeId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    currentCode: PropTypes.oneOfType([PropTypes.string, PropTypes.object])
}
