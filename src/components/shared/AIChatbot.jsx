import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
    MessageSquare, X, Send, Bot, User, Loader2, Sparkles, 
    PlusCircle, History, Ticket, Home, ExternalLink, ChevronRight,
    MessageCircle, Trash2, Clock
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function AIChatbot() {
    const { profile } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState('home') 
    const [isChatting, setIsChatting] = useState(false)
    const [sessions, setSessions] = useState([])
    const [activeSessionId, setActiveSessionId] = useState(null)
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [tickets, setTickets] = useState([])
    const [isCreatingTicket, setIsCreatingTicket] = useState(false)
    const [newTicketSubject, setNewTicketSubject] = useState('')
    const [newTicketMessage, setNewTicketMessage] = useState('')
    const [isTicketLoading, setIsTicketLoading] = useState(false)
    const scrollRef = useRef(null)

    // Storage Key
    const storageKey = profile?.id ? `edustream_sessions_${profile.id}` : 'edustream_sessions_guest'

    // Load ALL sessions on mount
    useEffect(() => {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                setSessions(Array.isArray(parsed) ? parsed : [])
            } catch (e) {
                console.error('Error loading sessions:', e)
                setSessions([])
            }
        }
    }, [profile?.id, storageKey])

    // Save ALL sessions whenever any session changes
    useEffect(() => {
        if (sessions.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(sessions))
        }
    }, [sessions, storageKey])

    // Load Tickets when tab changes
    useEffect(() => {
        if (activeTab === 'tickets' && profile?.id) {
            fetchTickets()
        }
    }, [activeTab, profile?.id])

    const fetchTickets = async () => {
        setIsTicketLoading(true)
        try {
            const { data, error } = await supabase
                .from('support_tickets')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (error) throw error
            setTickets(data || [])
        } catch (err) {
            console.error('Error fetching tickets:', err)
        } finally {
            setIsTicketLoading(false)
        }
    }

    const handleCreateTicket = async (e) => {
        e.preventDefault()
        if (!newTicketSubject.trim() || !newTicketMessage.trim() || isTicketLoading) return

        setIsTicketLoading(true)
        try {
            // 1. Create Ticket
            const { data: ticket, error: ticketError } = await supabase
                .from('support_tickets')
                .insert({
                    student_id: profile.id,
                    subject: newTicketSubject.trim(),
                    status: 'open'
                })
                .select()
                .single()

            if (ticketError) throw ticketError

            // 2. Create Initial Message
            const { error: msgError } = await supabase
                .from('support_messages')
                .insert({
                    ticket_id: ticket.id,
                    student_id: profile.id,
                    message: newTicketMessage.trim(),
                    is_from_student: true
                })

            if (msgError) throw msgError

            setNewTicketSubject('')
            setNewTicketMessage('')
            setIsCreatingTicket(false)
            fetchTickets()
            alert('Ticket created successfully!')
        } catch (err) {
            alert('Failed to create ticket: ' + err.message)
        } finally {
            setIsTicketLoading(false)
        }
    }

    const getActiveMessages = () => {
        const session = sessions.find(s => s.id === activeSessionId)
        return session?.messages || []
    }

    const setMessages = (updateFn) => {
        setSessions(prev => prev.map(s => {
            if (s.id === activeSessionId) {
                const currentMsgs = s.messages || []
                const newMsgs = typeof updateFn === 'function' ? updateFn(currentMsgs) : updateFn
                return { ...s, messages: newMsgs, timestamp: Date.now() }
            }
            return s
        }))
    }

    const handleStartNewChat = () => {
        const newId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`
        const initialMsg = profile?.name 
            ? { role: 'assistant', content: `Hello ${profile.name}! I'm your EduStream AI assistant. How can I help you today?` }
            : { role: 'assistant', content: `Hello! I'm your EduStream AI assistant. How can I help you today?` }
        
        const newSession = {
            id: newId,
            timestamp: Date.now(),
            messages: [initialMsg]
        }
        
        setSessions(prev => [newSession, ...prev])
        setActiveSessionId(newId)
        setIsChatting(true)
    }

    const handleResumeChat = (sessionId) => {
        setActiveSessionId(sessionId)
        setIsChatting(true)
    }

    const handleDeleteSession = (e, sessionId) => {
        e.stopPropagation()
        if (window.confirm('Delete this chat history?')) {
            const updatedSessions = sessions.filter(s => s.id !== sessionId)
            setSessions(updatedSessions)
            if (activeSessionId === sessionId) {
                setIsChatting(false)
                setActiveSessionId(null)
            }
            localStorage.setItem(storageKey, JSON.stringify(updatedSessions))
        }
    }

    const handleClearChat = () => {
        if (window.confirm('Clear all messages in this session?')) {
            setMessages([])
        }
    }

    // Visibility Logic
    const isHidden = location.pathname.includes('/take') || location.pathname.includes('/student/coding/')
    
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [sessions, isOpen, isChatting])

    if (isHidden) return null

    const handleSend = async (e) => {
        e.preventDefault()
        if (!input.trim() || isLoading || !activeSessionId) return

        const userMessage = { role: 'user', content: input.trim() }
        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY
        const modelsToTry = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemma-3-27b-it']

        try {
            if (apiKey) {
                let lastError = null
                let success = false

                for (const model of modelsToTry) {
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 15000) 

                    try {
                        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: controller.signal,
                            body: JSON.stringify({
                                contents: [{
                                    parts: [{ text: `You are EduStream Assistant. Help the user with: ${input.trim()}. Platform Info: EduStream is an e-learning platform. Be concise and friendly.` }]
                                }]
                            })
                        })

                        clearTimeout(timeoutId)

                        if (response.ok) {
                            const data = await response.json()
                            const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that response."
                            setMessages(prev => [...prev, { role: 'assistant', content: aiText }])
                            success = true
                            break 
                        } else {
                            const errorData = await response.json()
                            lastError = errorData.error?.message || `Error ${response.status}`
                        }
                    } catch (err) {
                        clearTimeout(timeoutId)
                        lastError = err.message
                    }
                }
                if (!success) throw new Error(lastError || "All models busy.")
            } else {
                setTimeout(() => {
                    setMessages(prev => [...prev, { role: 'assistant', content: getMockResponse(input.trim().toLowerCase()) }])
                }, 1000)
            }
        } catch (error) {
            setTimeout(() => {
                setMessages(prev => [...prev, { role: 'assistant', content: getMockResponse(input.trim().toLowerCase()) }])
            }, 500)
        } finally {
            setIsLoading(false)
        }
    }

    const getMockResponse = (query) => {
        if (query.includes('assessment')) return "Assessments are timed tests. Find them in the 'Assessments' tab."
        if (query.includes('coding')) return "The Coding Practice section has real-world tests."
        if (query.includes('course')) return "View enrolled courses in 'My Courses'."
        return "I'm here to help with your EduStream platform questions! How else can I assist you?"
    }

    const renderHeader = () => (
        <div style={{ padding: '1rem 1.25rem', background: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '6px', background: '#eff6ff', borderRadius: '8px', color: '#6366f1' }}>
                    <MessageCircle size={20} />
                </div>
                <h3 style={{ fontWeight: 600, fontSize: '0.95rem', color: '#1e293b', margin: 0 }}>Virtual Assistant</h3>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
        </div>
    )

    const renderTabs = () => (
        <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #f1f5f9', padding: '0 0.5rem' }}>
            {['home', 'past', 'tickets'].map((tab) => (
                <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setIsChatting(false); }}
                    style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', fontSize: '0.85rem', fontWeight: activeTab === tab ? 600 : 500, color: activeTab === tab ? '#6366f1' : '#64748b', position: 'relative', cursor: 'pointer', flex: 1, textTransform: 'capitalize' }}
                >
                    {tab === 'home' ? 'Home' : tab === 'past' ? 'Past chats' : 'Ticket history'}
                    {activeTab === tab && <div style={{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: '3px', background: '#1e293b', borderRadius: '3px 3px 0 0' }} />}
                </button>
            ))}
        </div>
    )

    const renderHome = () => (
        <div style={{ padding: '2rem 1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '1rem', color: '#64748b', marginBottom: '0.25rem' }}>Welcome</span>
            <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {profile?.name || 'Guest'} <span style={{ fontSize: '1.75rem' }}>👋</span>
            </h2>
            <p style={{ color: '#475569', fontSize: '1rem', lineHeight: 1.5, margin: '0 0 1.5rem 0' }}>How can I help you?<br />Browse our Help Center or start a chat.</p>
            <button 
                onClick={() => {
                    setIsOpen(false)
                    const supportPath = profile?.role === 'organizer' ? '/organizer/support' : '/student/support'
                    navigate(supportPath)
                }}
                style={{
                    width: '100%',
                    padding: '1rem',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: '#6366f1',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: 'auto'
                }}
            >
                Help Center <ExternalLink size={18} />
            </button>
            <button 
                onClick={handleStartNewChat}
                style={{ width: '100%', padding: '1rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 10px 20px rgba(124, 58, 237, 0.2)', cursor: 'pointer', transition: 'transform 0.2s', marginTop: '2rem' }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
                <PlusCircle size={20} fill="white" color="#7c3aed" /> Start New Chat
            </button>
        </div>
    )

    const renderChatArea = () => (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: 1, overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 1rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                    onClick={() => { setIsChatting(false); setActiveSessionId(null); }}
                    style={{ background: 'none', border: 'none', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                >
                    <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Home
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={handleClearChat} style={{ color: '#64748b', background: 'none', border: 'none', fontSize: '0.75rem', cursor: 'pointer' }}>Reset</button>
                </div>
            </div>

            <div 
                ref={scrollRef}
                style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'white' }}
            >
                {getActiveMessages().map((msg, i) => (
                    <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        <div style={{ padding: '0.75rem 1rem', borderRadius: '16px', background: msg.role === 'user' ? '#7c3aed' : '#f1f5f9', color: msg.role === 'user' ? 'white' : '#1e293b', fontSize: '0.9rem', lineHeight: 1.5 }}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div style={{ alignSelf: 'flex-start', padding: '1rem', background: '#f1f5f9', borderRadius: '16px' }}>
                        <Loader2 className="animate-spin" size={18} color="#6366f1" />
                    </div>
                )}
            </div>

            <form onSubmit={handleSend} style={{ padding: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.5rem', background: 'white' }}>
                <input 
                    className="chat-input-new"
                    type="text" 
                    placeholder="Type your message..." 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', background: '#f8fafc' }}
                />
                <button type="submit" disabled={!input.trim() || isLoading} style={{ width: 44, height: 44, borderRadius: '10px', background: '#7c3aed', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Send size={20} />
                </button>
            </form>
        </div>
    )

    const renderPastChats = () => (
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
            {sessions.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    <History size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p style={{ margin: 0 }}>No past conversations yet.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {sessions.map(s => {
                        const lastMsg = s.messages[s.messages.length - 1]?.content || 'Empty Chat'
                        const date = new Date(s.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
                        return (
                            <div 
                                key={s.id}
                                onClick={() => handleResumeChat(s.id)}
                                style={{ padding: '1rem', borderRadius: '16px', background: 'white', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.transform = 'translateY(0)' }}
                            >
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', overflow: 'hidden', flex: 1 }}>
                                    <div style={{ padding: '8px', background: '#f8fafc', borderRadius: '10px', color: '#6366f1' }}><MessageSquare size={18} /></div>
                                    <div style={{ overflow: 'hidden', flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastMsg}</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}><Clock size={12} /> {date}</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => handleDeleteSession(e, s.id)}
                                    style={{ padding: '8px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                                    onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                                    onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )

    const renderTicketHistory = () => {
        if (isCreatingTicket) {
            return (
                <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>New Support Ticket</h4>
                        <button 
                            onClick={() => setIsCreatingTicket(false)}
                            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    </div>
                    <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem' }}>Subject</label>
                            <input 
                                type="text"
                                placeholder="What's the issue about?"
                                value={newTicketSubject}
                                onChange={(e) => setNewTicketSubject(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none' }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem' }}>Description</label>
                            <textarea 
                                placeholder="Provide more details..."
                                value={newTicketMessage}
                                onChange={(e) => setNewTicketMessage(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', minHeight: '120px', resize: 'none' }}
                                required
                            />
                        </div>
                        <button 
                            type="submit"
                            disabled={isTicketLoading}
                            style={{ width: '100%', padding: '0.85rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 600, marginTop: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                        >
                            {isTicketLoading ? <Loader2 className="animate-spin" size={18} /> : <>Submit Ticket <Send size={16} /></>}
                        </button>
                    </form>
                </div>
            )
        }

        return (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>Support Tickets</h4>
                    <button 
                        onClick={() => setIsCreatingTicket(true)}
                        style={{ padding: '0.5rem 0.8rem', background: '#eff6ff', color: '#6366f1', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                        <PlusCircle size={14} /> New Ticket
                    </button>
                </div>

                {isTicketLoading && tickets.length === 0 ? (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Loader2 className="animate-spin" size={24} color="#6366f1" />
                    </div>
                ) : tickets.length === 0 ? (
                    <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <Ticket size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>No tickets found yet.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {tickets.map(t => (
                            <div 
                                key={t.id}
                                onClick={() => {
                                    setIsOpen(false)
                                    const supportPath = profile?.role === 'organizer' ? '/organizer/support' : '/student/support'
                                    navigate(supportPath)
                                }}
                                style={{ padding: '1rem', borderRadius: '14px', background: 'white', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = '#f1f5f9'}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', flex: 1, marginRight: '0.5rem' }}>{t.subject}</span>
                                    <span style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: '6px', 
                                        fontSize: '0.6rem', 
                                        fontWeight: 700, 
                                        textTransform: 'uppercase',
                                        background: t.status === 'open' ? '#ecfdf5' : '#fef2f2',
                                        color: t.status === 'open' ? '#10b981' : '#ef4444'
                                    }}>
                                        {t.status}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: '#94a3b8' }}>
                                    <Clock size={12} /> {new Date(t.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="fab-shadow animate-bounce"
                    style={{ width: '64px', height: '64px', borderRadius: '20px', background: '#7c3aed', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.3s' }}
                >
                    <MessageSquare size={30} />
                </button>
            )}

            {isOpen && (
                <div className="animate-scale-in" style={{ width: '400px', height: '660px', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'white', borderRadius: '28px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #f1f5f9' }}>
                    {renderHeader()}
                    {!isChatting && renderTabs()}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                        {isChatting ? renderChatArea() : (
                            <>
                                {activeTab === 'home' && renderHome()}
                                {activeTab === 'past' && renderPastChats()}
                                {activeTab === 'tickets' && renderTicketHistory()}
                            </>
                        )}
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '200px', background: 'radial-gradient(circle at 100% 100%, rgba(124,58,237,0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: -1 }} />
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '200px', background: 'radial-gradient(circle at 0% 0%, rgba(99,102,241,0.03) 0%, transparent 70%)', pointerEvents: 'none', zIndex: -1 }} />
                    </div>
                </div>
            )}

            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.95) translateY(10px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
                .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
                .fab-shadow { box-shadow: 0 10px 30px rgba(124, 58, 237, 0.4); }
                .chat-input-new:focus { border-color: #7c3aed !important; box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.1); }
            `}</style>
        </div>
    )
}
