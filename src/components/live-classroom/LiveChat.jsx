import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { Send, Pin, ShieldAlert, Loader2, Info, Smile } from 'lucide-react';

const appendMessageToList = (messages, newMsg) => [...messages, newMsg];
const updateMessageInList = (messages, updatedMsg) => messages.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m);
const removeMessageFromList = (messages, oldId) => messages.filter(m => m.id !== oldId);

const addReactionToMessage = (messages, newReaction) => messages.map(m => {
    if (m.id === newReaction.message_id) {
        return { ...m, reactions: [...(m.reactions || []), newReaction] };
    }
    return m;
});

const removeReactionFromMessage = (messages, oldReaction) => messages.map(m => {
    return { ...m, reactions: (m.reactions || []).filter(r => r.id !== oldReaction.id) };
});

const getMessageBackground = (isMine, isInstructor) => {
    if (isMine) return '#6366f1';
    if (isInstructor) return 'rgba(99,102,241,0.15)';
    return 'rgba(255,255,255,0.08)';
};

const getMessageBorder = (isMine, isInstructor) => {
    if (isMine) return 'none';
    if (isInstructor) return '1px solid rgba(99,102,241,0.3)';
    return 'none';
};

function MessageItem({ msg, profile, isOrganizer, reactionPickerMsgId, setReactionPickerMsgId, togglePin, toggleReaction }) {
    const isMine = msg.user_id === profile?.id;
    const isSystem = msg.message_type === 'system';
    const isAnnouncement = msg.message_type === 'announcement';
    const isInstructor = msg.message_type === 'instructor';
    
    if (isSystem || isAnnouncement) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0' }}>
                <div style={{ background: isAnnouncement ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: 16, fontSize: '0.75rem', color: isAnnouncement ? '#f59e0b' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: isAnnouncement ? 600 : 400 }}>
                    <Info size={12} /> {msg.message}
                </div>
            </div>
        );
    }

    // Group reactions by emoji
    const reactionCounts = (msg.reactions || []).reduce((acc, curr) => {
        acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
        return acc;
    }, {});

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: isMine ? 'flex-end' : 'flex-start',
            opacity: msg.is_deleted ? 0.5 : 1,
            position: 'relative'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                {!isMine && (
                    <span style={{ fontSize: '0.7rem', color: isInstructor ? '#818cf8' : 'var(--text-muted)', fontWeight: isInstructor ? 600 : 400 }}>
                        {msg.users?.name || 'Unknown'} {isInstructor && '(Instructor)'}
                    </span>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isOrganizer && !isMine && (
                    <button onClick={() => togglePin(msg.id, false)} title="Pin Message" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                        <Pin size={12} />
                    </button>
                )}
                <div 
                    style={{ 
                        background: getMessageBackground(isMine, isInstructor),
                        color: 'white',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 12,
                        borderTopRightRadius: isMine ? 2 : 12,
                        borderTopLeftRadius: isMine ? 12 : 2,
                        border: getMessageBorder(isMine, isInstructor),
                        fontSize: '0.9rem',
                        maxWidth: '220px',
                        wordBreak: 'break-word',
                        position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                        const btn = e.currentTarget.querySelector('.react-btn');
                        if (btn) btn.style.opacity = 1;
                    }}
                    onMouseLeave={(e) => {
                        const btn = e.currentTarget.querySelector('.react-btn');
                        if (btn && reactionPickerMsgId !== msg.id) btn.style.opacity = 0;
                    }}
                >
                    {msg.message}
                    
                    {/* Reaction Hover Button */}
                    <button 
                        className="react-btn"
                        onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                        style={{ 
                            position: 'absolute', 
                            [isMine ? 'left' : 'right']: -30, 
                            top: '50%', 
                            transform: 'translateY(-50%)',
                            background: 'rgba(15,23,42,0.8)', 
                            border: '1px solid rgba(255,255,255,0.1)', 
                            borderRadius: '50%', 
                            width: 24, height: 24, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            cursor: 'pointer',
                            opacity: reactionPickerMsgId === msg.id ? 1 : 0,
                            transition: 'opacity 0.2s',
                            color: 'var(--text-muted)'
                        }}>
                        <Smile size={12} />
                    </button>

                    {/* Reaction Picker Popup */}
                    {reactionPickerMsgId === msg.id && (
                        <div style={{
                            position: 'absolute',
                            [isMine ? 'right' : 'left']: 0,
                            bottom: '100%',
                            marginBottom: 4,
                            background: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12,
                            padding: '4px 8px',
                            display: 'flex',
                            gap: 4,
                            zIndex: 10,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}>
                            {['👍', '❤️', '😂', '👏', '🎉'].map(emoji => (
                                <button 
                                    key={emoji}
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 4, transition: 'transform 0.1s' }}
                                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Active Reactions Row */}
            {Object.keys(reactionCounts).length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, paddingLeft: isMine ? 0 : 8, paddingRight: isMine ? 8 : 0 }}>
                    {Object.entries(reactionCounts).map(([emoji, count]) => {
                        const iReacted = (msg.reactions || []).some(r => r.emoji === emoji && r.user_id === profile?.id);
                        return (
                            <button 
                                key={emoji}
                                onClick={() => toggleReaction(msg.id, emoji)}
                                style={{ 
                                    background: iReacted ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', 
                                    border: iReacted ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.1)', 
                                    borderRadius: 10, 
                                    padding: '2px 6px', 
                                    fontSize: '0.7rem', 
                                    color: iReacted ? '#818cf8' : 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    cursor: 'pointer'
                                }}>
                                <span>{emoji}</span> {count}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

MessageItem.propTypes = {
    msg: PropTypes.object.isRequired,
    profile: PropTypes.object,
    isOrganizer: PropTypes.bool.isRequired,
    reactionPickerMsgId: PropTypes.any,
    setReactionPickerMsgId: PropTypes.func.isRequired,
    togglePin: PropTypes.func.isRequired,
    toggleReaction: PropTypes.func.isRequired,
};

export default function LiveChat({ videoId, isOrganizer, chatLocked, channel, onNewMessage }) {
    const { profile } = useAuth();
    const toast = useToast();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
    const messagesEndRef = useRef(null);

    const pinnedMessages = messages.filter(m => m.is_pinned);
    const regularMessages = messages.filter(m => !m.is_pinned);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, []);

    const handleMessageChange = useCallback(async (payload) => {
        if (payload.eventType === 'INSERT') {
            // Fetch user details for the new message
            const { data: userData } = await supabase
                .from('users')
                .select('name, role, avatar_url')
                .eq('id', payload.new.user_id)
                .single();
                
            const newMsg = { ...payload.new, users: userData, reactions: [] };
            setMessages(prev => appendMessageToList(prev, newMsg));
            scrollToBottom();
            if (onNewMessage && payload.new.user_id !== profile?.id) {
                onNewMessage();
            }
        } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => updateMessageInList(prev, payload.new));
        } else if (payload.eventType === 'DELETE') {
            setMessages(prev => removeMessageFromList(prev, payload.old.id));
        }
    }, [onNewMessage, profile?.id, scrollToBottom]);

    const handleReactionChange = useCallback((payload) => {
        if (payload.eventType === 'INSERT') {
            setMessages(prev => addReactionToMessage(prev, payload.new));
        } else if (payload.eventType === 'DELETE') {
            setMessages(prev => removeReactionFromMessage(prev, payload.old));
        }
    }, []);

    useEffect(() => {
        // Fetch existing messages and their reactions
        async function fetchMessages() {
            const { data, error } = await supabase
                .from('live_chat_messages')
                .select('*, users:user_id(name, role, avatar_url), reactions:live_chat_reactions(id, emoji, user_id)')
                .eq('video_id', videoId)
                .order('created_at', { ascending: true });

            if (!error && data) {
                setMessages(data);
            }
            setLoading(false);
            scrollToBottom();
        }
        fetchMessages();

        // Subscribe to new messages
        const subscription = supabase
            .channel(`live_chat_${videoId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'live_chat_messages',
                filter: `video_id=eq.${videoId}`
            }, handleMessageChange)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'live_chat_reactions'
            }, handleReactionChange)
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [videoId, handleMessageChange, handleReactionChange, scrollToBottom]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;
        if (chatLocked && !isOrganizer) return;

        setSending(true);
        const type = isOrganizer ? 'instructor' : 'normal';
        
        const { error } = await supabase
            .from('live_chat_messages')
            .insert({
                video_id: videoId,
                user_id: profile.id,
                message: newMessage.trim(),
                message_type: type,
            });

        if (error) {
            console.error("Failed to send message:", error);
            toast.error("Failed to send message");
        } else {
            setNewMessage('');
        }
        setSending(false);
    };

    const togglePin = async (messageId, currentPinnedStatus) => {
        if (!isOrganizer) return;
        const { error } = await supabase
            .from('live_chat_messages')
            .update({ is_pinned: !currentPinnedStatus })
            .eq('id', messageId);
            
        if (error) {
            toast.error("Failed to pin message");
        }
    };

    const toggleReaction = async (messageId, emoji) => {
        setReactionPickerMsgId(null);
        // Check if user already reacted with this emoji
        const msg = messages.find(m => m.id === messageId);
        const existingReaction = msg?.reactions?.find(r => r.emoji === emoji && r.user_id === profile.id);
        
        if (existingReaction) {
            await supabase.from('live_chat_reactions').delete().eq('id', existingReaction.id);
        } else {
            await supabase.from('live_chat_reactions').insert({
                message_id: messageId,
                user_id: profile.id,
                emoji: emoji
            });
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Loader2 className="animate-spin text-slate-500" /></div>;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(15,23,42,0.5)' }}>
            {/* Pinned Messages Area */}
            {pinnedMessages.length > 0 && (
                <div style={{ 
                    padding: '0.75rem', 
                    background: 'rgba(99, 102, 241, 0.1)', 
                    borderBottom: '1px solid rgba(99, 102, 241, 0.2)' 
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#818cf8', fontSize: '0.75rem', fontWeight: 600 }}>
                        <Pin size={12} /> Pinned
                    </div>
                    {pinnedMessages.map(msg => (
                        <div key={msg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                            <p style={{ margin: 0, color: 'white', fontSize: '0.85rem' }}>{msg.message}</p>
                            {isOrganizer && (
                                <button onClick={() => togglePin(msg.id, true)} style={{ background: 'transparent', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 4 }}>
                                    <Pin size={12} fill="#818cf8" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Messages List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {regularMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
                        No messages yet. Say hello!
                    </div>
                ) : (
                    regularMessages.map((msg) => (
                        <MessageItem
                            key={msg.id}
                            msg={msg}
                            profile={profile}
                            isOrganizer={isOrganizer}
                            reactionPickerMsgId={reactionPickerMsgId}
                            setReactionPickerMsgId={setReactionPickerMsgId}
                            togglePin={togglePin}
                            toggleReaction={toggleReaction}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.95)' }}>
                {chatLocked && !isOrganizer ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#ef4444', fontSize: '0.8rem', padding: '0.5rem', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
                        <ShieldAlert size={14} /> Chat is locked by instructor
                    </div>
                ) : (
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            disabled={sending}
                            style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                padding: '0.5rem 0.75rem',
                                borderRadius: 8,
                                outline: 'none',
                                fontSize: '0.9rem'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || sending}
                            style={{
                                background: (!newMessage.trim() || sending) ? 'rgba(99,102,241,0.5)' : '#6366f1',
                                color: 'white',
                                border: 'none',
                                width: 36,
                                height: 36,
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: (!newMessage.trim() || sending) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

LiveChat.propTypes = {
    videoId: PropTypes.string.isRequired,
    isOrganizer: PropTypes.bool.isRequired,
    chatLocked: PropTypes.bool.isRequired,
    channel: PropTypes.any,
    onNewMessage: PropTypes.func
};
