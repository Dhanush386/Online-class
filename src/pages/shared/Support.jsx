import { useState, useEffect, useRef } from 'react'
import { Send, User as UserIcon, Clock, CheckCheck, MessageSquare, Search } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Support() {
    const { profile } = useAuth()
    const isOrganizer = profile?.role === 'organizer'
    
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    
    // Organizer-only state
    const [conversations, setConversations] = useState([])
    const [selectedStudent, setSelectedStudent] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    
    const scrollRef = useRef(null)

    useEffect(() => {
        if (isOrganizer) {
            fetchConversations()
        } else {
            fetchMessages(profile?.id)
        }

        // Subscribe to new messages
        const subscription = supabase
            .channel('support_messages')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'support_messages' 
            }, (payload) => {
                if (isOrganizer) {
                    // Update conversation list OR current messages
                    fetchConversations()
                    if (selectedStudent?.id === payload.new.student_id) {
                        setMessages(prev => [...prev, payload.new])
                    }
                } else if (payload.new.student_id === profile?.id) {
                    setMessages(prev => [...prev, payload.new])
                }
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [profile, isOrganizer, selectedStudent])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const fetchConversations = async () => {
        const { data, error } = await supabase
            .from('support_messages')
            .select(`
                student_id,
                message,
                created_at,
                is_read,
                is_from_student,
                student:users!student_id(name, email, avatar_url)
            `)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching conversations:', error)
            return
        }

        // Group by student_id to get latest message per student
        const latest = []
        const seen = new Set()
        data.forEach(msg => {
            if (!seen.has(msg.student_id)) {
                latest.push({
                    id: msg.student_id,
                    name: msg.student?.name || 'Unknown Student',
                    email: msg.student?.email || '',
                    avatar_url: msg.student?.avatar_url,
                    lastMessage: msg.message,
                    lastDate: msg.created_at,
                    unread: !msg.is_read && msg.is_from_student
                })
                seen.add(msg.student_id)
            }
        })
        setConversations(latest)
        setLoading(false)
    }

    const fetchMessages = async (studentId) => {
        if (!studentId) return
        setLoading(true)
        const { data, error } = await supabase
            .from('support_messages')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching messages:', error)
        } else {
            setMessages(data)
            
            // Mark as read if organizer is viewing
            if (isOrganizer) {
                await supabase
                    .from('support_messages')
                    .update({ is_read: true })
                    .eq('student_id', studentId)
                    .eq('is_from_student', true)
            }
        }
        setLoading(false)
    }

    const handleSendMessage = async (e) => {
        e.preventDefault()
        if (!newMessage.trim() || sending) return
        
        const studentId = isOrganizer ? selectedStudent?.id : profile?.id
        if (!studentId) return

        setSending(true)
        try {
            const { data, error } = await supabase
                .from('support_messages')
                .insert({
                    student_id: studentId,
                    organizer_id: isOrganizer ? profile.id : null,
                    message: newMessage.trim(),
                    is_from_student: !isOrganizer
                })

            if (error) throw error
            setNewMessage('')
        } catch (err) {
            alert('Failed to send message: ' + err.message)
        } finally {
            setSending(false)
        }
    }

    const filteredConversations = conversations.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.email.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading && !messages.length && !conversations.length) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div className="animate-spin" style={{ width: 40, height: 40, border: '4px solid #f3f3f3', borderTop: '4px solid var(--accent)', borderRadius: '50%' }}></div>
            </div>
        )
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.5rem' }}>
            <div>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Support & Queries</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                    {isOrganizer ? 'Manage and respond to student questions' : 'Contact our support team for any queries'}
                </p>
            </div>

            <div className="glass-card" style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 0 }}>
                {isOrganizer && (
                    <div style={{ width: '320px', borderRight: '1px solid var(--sidebar-border)', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                        <div style={{ padding: '1.25rem' }}>
                            <div style={{ position: 'relative' }}>
                                <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Search students..." 
                                    className="form-input"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{ paddingLeft: '2.5rem', background: 'white' }}
                                />
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {filteredConversations.map(conv => (
                                <button 
                                    key={conv.id} 
                                    onClick={() => {
                                        setSelectedStudent(conv)
                                        fetchMessages(conv.id)
                                    }}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        gap: '0.75rem',
                                        padding: '1rem 1.25rem',
                                        border: 'none',
                                        borderBottom: '1px solid var(--sidebar-border)',
                                        background: selectedStudent?.id === conv.id ? '#eff6ff' : 'transparent',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ 
                                        width: 40, height: 40, borderRadius: '50%', 
                                        background: 'var(--accent)', color: 'white', 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        {conv.avatar_url ? <img src={conv.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : <UserIcon size={20} />}
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{conv.name}</span>
                                            {conv.unread && <div style={{ width: 8, height: 8, background: 'var(--accent)', borderRadius: '50%' }}></div>}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {conv.lastMessage}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
                    {isOrganizer && !selectedStudent ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '1rem' }}>
                            <MessageSquare size={48} style={{ opacity: 0.3 }} />
                            <p>Select a student to start messaging</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <UserIcon size={16} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{isOrganizer ? selectedStudent?.name : 'Support Team'}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>{isOrganizer ? selectedStudent?.email : 'Online'}</div>
                                </div>
                            </div>

                            <div 
                                ref={scrollRef}
                                style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f1f5f940' }}
                            >
                                {messages.map((msg, i) => {
                                    const fromMe = isOrganizer ? !msg.is_from_student : msg.is_from_student
                                    return (
                                        <div key={msg.id} style={{ alignSelf: fromMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                                            <div style={{ 
                                                padding: '0.75rem 1rem', 
                                                borderRadius: fromMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                                background: fromMe ? 'var(--accent)' : 'white',
                                                color: fromMe ? 'white' : 'var(--text-primary)',
                                                fontSize: '0.875rem',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                                marginBottom: '0.25rem'
                                            }}>
                                                {msg.message}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: fromMe ? 'flex-end' : 'flex-start', gap: '0.4rem', fontSize: '0.6rem', color: 'var(--text-secondary)' }}>
                                                <Clock size={10} />
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {fromMe && msg.is_read && <CheckCheck size={12} color="#10b981" />}
                                            </div>
                                        </div>
                                    )
                                })}
                                {messages.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                                        No messages yet. Start the conversation!
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleSendMessage} style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--sidebar-border)', background: 'white' }}>
                                <div style={{ display: 'flex', gap: '0.75rem', position: 'relative' }}>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="Type your message here..." 
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        style={{ background: '#f8fafc' }}
                                    />
                                    <button 
                                        type="submit" 
                                        disabled={!newMessage.trim() || sending}
                                        className="btn-primary" 
                                        style={{ width: 'auto', padding: '0 1.25rem' }}
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
