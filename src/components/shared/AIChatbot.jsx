import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function AIChatbot() {
    const { profile } = useAuth()
    const location = useLocation()
    const [isOpen, setIsOpen] = useState(false)
    const [messages, setMessages] = useState([
        { role: 'assistant', content: `Hello ${profile?.name || 'there'}! I'm your EduStream AI assistant. How can I help you today?` }
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const scrollRef = useRef(null)

    // Visibility Logic: Hide on assessments and coding practice
    const isHidden = location.pathname.includes('/take') || location.pathname.includes('/student/coding/')
    
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages, isOpen])

    if (isHidden) return null

    const handleSend = async (e) => {
        e.preventDefault()
        if (!input.trim() || isLoading) return

        const userMessage = { role: 'user', content: input.trim() }
        setMessages(prev => [...prev, userMessage])
        setInput('')
        setIsLoading(true)

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY

        try {
            if (apiKey) {
                // Real Gemini AI Integration
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: `You are EduStream Assistant. Help the user with: ${input.trim()}. Platform Info: EduStream is an e-learning platform with courses, assessments, and coding practice. Be concise and friendly.` }]
                        }]
                    })
                })
                const data = await response.json()
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm sorry, I couldn't process that. Please try again."
                setMessages(prev => [...prev, { role: 'assistant', content: aiText }])
            } else {
                // Mock AI Response fallback
                setTimeout(() => {
                    const aiResponse = { 
                        role: 'assistant', 
                        content: getMockResponse(input.trim().toLowerCase()) 
                    }
                    setMessages(prev => [...prev, aiResponse])
                }, 1000)
            }
        } catch (error) {
            console.error('Chatbot Error:', error)
            setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I'm having trouble connecting right now. Make sure your API key is valid." }])
        } finally {
            setIsLoading(false)
        }
    }

    const getMockResponse = (query) => {
        if (query.includes('assessment')) return "Assessments are timed tests. Make sure you're in a quiet place and have a stable internet connection. You can find your pending assessments in the 'Assessments' tab."
        if (query.includes('coding') || query.includes('practice')) return "The Coding Practice section allows you to solve real-world problems. You can use any of the supported languages in our integrated workspace."
        if (query.includes('course')) return "You can view your enrolled courses in 'My Courses'. To explore new topics, check out the Course Management section."
        if (query.includes('support')) return "If you have a technical issue, you can reach out to our team via the Support page in the sidebar."
        return `I'm here to help with questions about ${query}. For platform-specific issues, you can also check the Support section!`
    }

    return (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000 }}>
            {/* Floating Action Button */}
            {!isOpen && (
                <button 
                    onClick={() => setIsOpen(true)}
                    className="animate-bounce"
                    style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                        border: 'none',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 10px 25px rgba(139, 92, 246, 0.4)',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <MessageSquare size={32} />
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div 
                    className="glass-card animate-scale-in"
                    style={{
                        width: '400px',
                        height: '600px',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
                        borderRadius: '24px'
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '1.5rem',
                        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Sparkles size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>EduStream AI</h3>
                                <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>Online & Ready to Help</span>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.5rem' }}
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div 
                        ref={scrollRef}
                        style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                            background: '#f8fafc'
                        }}
                    >
                        {messages.map((msg, i) => (
                            <div 
                                key={i}
                                style={{
                                    display: 'flex',
                                    gap: '0.75rem',
                                    alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%'
                                }}
                            >
                                {msg.role === 'assistant' && (
                                    <div style={{ width: 32, height: 32, background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <Bot size={18} />
                                    </div>
                                )}
                                <div style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: msg.role === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                                    background: msg.role === 'user' ? '#8b5cf6' : 'white',
                                    color: msg.role === 'user' ? 'white' : '#1e293b',
                                    fontSize: '0.9rem',
                                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                                    lineHeight: 1.5
                                }}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
                                <div style={{ width: 32, height: 32, background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Bot size={18} />
                                </div>
                                <div style={{ padding: '1rem', background: 'white', borderRadius: '16px 16px 16px 2px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                                    <Loader2 className="animate-spin" size={18} color="#8b5cf6" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <form 
                        onSubmit={handleSend}
                        style={{
                            padding: '1.25rem',
                            borderTop: '1px solid #e2e8f0',
                            display: 'flex',
                            gap: '0.75rem',
                            background: 'white'
                        }}
                    >
                        <input 
                            type="text"
                            placeholder="Ask me anything..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '0.75rem 1rem',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                fontSize: '0.9rem',
                                outline: 'none'
                            }}
                        />
                        <button 
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '10px',
                                background: input.trim() ? '#8b5cf6' : '#e2e8f0',
                                color: 'white',
                                border: 'none',
                                cursor: input.trim() ? 'pointer' : 'default',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Send size={20} />
                        </button>
                    </form>
                </div>
            )}

            <style>{`
                @keyframes scaleIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-scale-in {
                    animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
            `}</style>
        </div>
    )
}
