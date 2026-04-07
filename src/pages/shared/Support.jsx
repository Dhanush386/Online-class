import { useState, useEffect, useRef } from 'react'
import { Send, User as UserIcon, Clock, CheckCheck, MessageSquare, Search, Paperclip, File, X, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Support() {
    const { profile } = useAuth()
    const isOrganizer = profile?.role === 'organizer'
    
    const [messages, setMessages] = useState([])
    const [newMessage, setNewMessage] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [attachment, setAttachment] = useState(null)
    const [uploading, setUploading] = useState(false)
    
    const fileInputRef = useRef(null)
    
    // Organizer/Shared state
    const [tickets, setTickets] = useState([])
    const [selectedTicket, setSelectedTicket] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    
    const scrollRef = useRef(null)

    useEffect(() => {
        fetchTickets()

        // Subscribe to new messages & ticket updates
        const msgSub = supabase
            .channel('support_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => {
                if (selectedTicket) fetchMessages(selectedTicket.id)
                fetchTickets()
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets' }, () => {
                fetchTickets()
            })
            .subscribe()

        return () => {
            msgSub.unsubscribe()
        }
    }, [profile, selectedTicket])

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const fetchTickets = async () => {
        if (!profile?.id) return
        
        let query = supabase
            .from('support_tickets')
            .select(`
                *,
                student:users!student_id(name, email, avatar_url)
            `)
            .order('created_at', { ascending: false })

        if (!isOrganizer) {
            query = query.eq('student_id', profile.id)
        }

        const { data, error } = await query

        if (error) {
            console.error('Error fetching tickets:', error)
            return
        }

        setTickets(data || [])
        setLoading(false)
    }

    const fetchMessages = async (ticketId) => {
        if (!ticketId) return
        setLoading(true)
        const { data, error } = await supabase
            .from('support_messages')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true })

        if (error) {
            console.error('Error fetching messages:', error)
        } else {
            setMessages(data)
            
            // Mark as read if organizer is viewing student messages
            if (isOrganizer) {
                await supabase
                    .from('support_messages')
                    .update({ is_read: true })
                    .eq('ticket_id', ticketId)
                    .eq('is_from_student', true)
            }
        }
        setLoading(false)
    }

    const handleCloseTicket = async () => {
        if (!selectedTicket || !isOrganizer) return
        
        try {
            const { error } = await supabase
                .from('support_tickets')
                .update({ status: 'closed' })
                .eq('id', selectedTicket.id)

            if (error) throw error
            
            setSelectedTicket(prev => ({ ...prev, status: 'closed' }))
            fetchTickets()
            alert('Ticket closed successfully')
        } catch (err) {
            alert('Failed to close ticket: ' + err.message)
        }
    }

    const handleSendMessage = async (e) => {
        e.preventDefault()
        if ((!newMessage.trim() && !attachment) || sending || uploading) return
        
        const ticketId = selectedTicket?.id
        if (!ticketId) return

        setSending(true)
        try {
            let attachmentUrl = null
            let attachmentName = null

            if (attachment) {
                setUploading(true)
                const fileExt = attachment.name.split('.').pop()
                const fileName = `${Math.random()}.${fileExt}`
                const filePath = `${profile.id}/${fileName}`

                const { error: uploadError } = await supabase.storage
                    .from('support-attachments')
                    .upload(filePath, attachment)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('support-attachments')
                    .getPublicUrl(filePath)
                
                attachmentUrl = publicUrl
                attachmentName = attachment.name
            }

            const { error } = await supabase
                .from('support_messages')
                .insert({
                    ticket_id: ticketId,
                    student_id: isOrganizer ? selectedTicket.student_id : profile.id,
                    organizer_id: isOrganizer ? profile.id : null,
                    message: newMessage.trim(),
                    is_from_student: !isOrganizer,
                    attachment_url: attachmentUrl,
                    attachment_name: attachmentName
                })

            if (error) throw error
            setNewMessage('')
            setAttachment(null)
        } catch (err) {
            alert('Failed to send message: ' + err.message)
        } finally {
            setSending(false)
            setUploading(false)
        }
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('File size too large (max 5MB)')
                return
            }
            setAttachment(file)
        }
    }

    const filteredTickets = tickets.filter(t => 
        t.subject.toLowerCase().includes(searchTerm.toLowerCase()) || 
        t.student?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (loading && !messages.length && !tickets.length) {
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
                <div style={{ width: '320px', borderRight: '1px solid var(--sidebar-border)', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                    <div style={{ padding: '1.25rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={16} />
                            <input 
                                type="text" 
                                placeholder="Search tickets..." 
                                className="form-input"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ paddingLeft: '2.5rem', background: 'white' }}
                            />
                        </div>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredTickets.map(t => (
                            <button 
                                key={t.id} 
                                onClick={() => {
                                    setSelectedTicket(t)
                                    fetchMessages(t.id)
                                }}
                                style={{
                                    width: '100%',
                                    display: 'flex',
                                    gap: '0.75rem',
                                    padding: '1rem 1.25rem',
                                    border: 'none',
                                    borderBottom: '1px solid var(--sidebar-border)',
                                    background: selectedTicket?.id === t.id ? '#eff6ff' : 'transparent',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    alignItems: 'center',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{ 
                                    width: 40, height: 40, borderRadius: '50%', 
                                    background: t.status === 'closed' ? '#ef4444' : 'var(--accent)', color: 'white', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {t.student?.avatar_url ? <img src={t.student?.avatar_url} style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : <UserIcon size={20} />}
                                </div>
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: t.status === 'closed' ? '#94a3b8' : 'var(--text-primary)' }}>{t.subject}</span>
                                        <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: t.status === 'closed' ? '#fee2e2' : '#ecfdf5', color: t.status === 'closed' ? '#ef4444' : '#10b981', fontWeight: 600 }}>{t.status}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {t.student?.name}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white' }}>
                    {!selectedTicket ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '1rem' }}>
                            <MessageSquare size={48} style={{ opacity: 0.3 }} />
                            <p>{isOrganizer ? 'Select a ticket to respond' : 'Select a ticket to view conversation'}</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: selectedTicket.status === 'closed' ? '#94a3b8' : 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <UserIcon size={16} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{selectedTicket.subject}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Ticket #{selectedTicket.id.slice(0, 8)} • {selectedTicket.student?.name}</div>
                                    </div>
                                </div>
                                {isOrganizer && selectedTicket.status === 'open' && (
                                    <button 
                                        onClick={handleCloseTicket}
                                        style={{ color: '#ef4444', border: '1px solid #fee2e2', background: '#fef2f2', padding: '0.4rem 0.8rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Close Ticket
                                    </button>
                                )}
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
                                                {msg.attachment_url && (
                                                    <div style={{ marginBottom: msg.message ? '0.5rem' : 0 }}>
                                                        {msg.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                                            <a href={msg.attachment_url} target="_blank" rel="noreferrer">
                                                                <img 
                                                                    src={msg.attachment_url} 
                                                                    alt="attachment" 
                                                                    style={{ maxWidth: '100%', borderRadius: 8, maxHeight: 200, display: 'block' }} 
                                                                />
                                                            </a>
                                                        ) : (
                                                            <a 
                                                                href={msg.attachment_url} 
                                                                target="_blank" 
                                                                rel="noreferrer"
                                                                style={{ 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    gap: '0.5rem', 
                                                                    padding: '0.5rem', 
                                                                    background: fromMe ? 'rgba(255,255,255,0.1)' : '#f8fafc',
                                                                    borderRadius: 6,
                                                                    color: 'inherit',
                                                                    textDecoration: 'none',
                                                                    fontSize: '0.75rem'
                                                                }}
                                                            >
                                                                <File size={16} />
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                                                                    {msg.attachment_name || 'View Attachment'}
                                                                </span>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
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
                                {selectedTicket.status === 'closed' ? (
                                    <div style={{ textAlign: 'center', padding: '0.5rem', color: '#ef4444', background: '#fef2f2', borderRadius: 8, fontSize: '0.85rem', fontWeight: 500 }}>
                                        This ticket is closed. Please open a new ticket if you need further help.
                                    </div>
                                ) : (
                                    <>
                                        {attachment && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: '0.75rem' }}>
                                                <div style={{ background: 'var(--accent)', color: 'white', padding: '4px', borderRadius: 4 }}>
                                                    {attachment.type.startsWith('image/') ? <ImageIcon size={14} /> : <File size={14} />}
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: '#64748b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {attachment.name}
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => setAttachment(null)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                            <input 
                                                type="file" 
                                                ref={fileInputRef}
                                                style={{ display: 'none' }}
                                                onChange={handleFileChange}
                                                accept="image/*,application/pdf,.doc,.docx"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => fileInputRef.current.click()}
                                                style={{ background: '#f1f5f9', border: 'none', color: '#64748b', padding: '0.6rem', borderRadius: 8, cursor: 'pointer' }}
                                                title="Attach file"
                                            >
                                                <Paperclip size={20} />
                                            </button>
                                            <input 
                                                type="text" 
                                                className="form-input" 
                                                placeholder="Type your message here..." 
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                style={{ background: '#f8fafc', flex: 1 }}
                                            />
                                            <button 
                                                type="submit" 
                                                disabled={(!newMessage.trim() && !attachment) || sending || uploading}
                                                className="btn-primary" 
                                                style={{ 
                                                    width: 'auto', 
                                                    padding: '0.6rem 1.25rem', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center',
                                                    minWidth: 50,
                                                    background: (newMessage.trim() || attachment) ? 'var(--accent)' : '#e2e8f0',
                                                    cursor: (newMessage.trim() || attachment) ? 'pointer' : 'default',
                                                    border: 'none',
                                                    borderRadius: 8,
                                                    color: 'white',
                                                    opacity: 1,
                                                    visibility: 'visible'
                                                }}
                                            >
                                                {sending || uploading ? (
                                                    <div className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%' }}></div>
                                                ) : (
                                                    <Send size={18} />
                                                )}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
