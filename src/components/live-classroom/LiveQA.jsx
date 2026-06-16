import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { MessageSquare, ArrowUp, CheckCircle2, BookmarkPlus } from 'lucide-react';

export default function LiveQA({ videoId, isOrganizer, channel }) {
    const { profile } = useAuth();
    const toast = useToast();
    
    // Ephemeral state for active session questions
    const [questions, setQuestions] = useState([]);
    const [newQuestion, setNewQuestion] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    
    // We use a ref to always have latest state for sync responding
    const questionsRef = useRef([]);
    useEffect(() => { questionsRef.current = questions; }, [questions]);

    useEffect(() => {
        if (!channel) return;

        const sub1 = channel.on('broadcast', { event: 'qa_new' }, (payload) => {
            setQuestions(prev => [payload.payload, ...prev]);
        });

        const sub2 = channel.on('broadcast', { event: 'qa_upvote' }, (payload) => {
            const { qId } = payload.payload;
            setQuestions(prev => prev.map(q => q.id === qId ? { ...q, upvotes: q.upvotes + 1 } : q).sort((a,b) => b.upvotes - a.upvotes));
        });

        const sub3 = channel.on('broadcast', { event: 'qa_answered' }, (payload) => {
            const { qId, answerText } = payload.payload;
            setQuestions(prev => prev.map(q => q.id === qId ? { ...q, answered: true, answer: answerText } : q));
        });

        const sub4 = channel.on('broadcast', { event: 'qa_sync_request' }, () => {
            if (isOrganizer) {
                // Organizer is source of truth, send current state to late joiners
                channel.send({ type: 'broadcast', event: 'qa_sync_response', payload: questionsRef.current });
            }
        });

        const sub5 = channel.on('broadcast', { event: 'qa_sync_response' }, (payload) => {
            if (!isOrganizer) {
                setQuestions(payload.payload);
            }
        });

        // If student, request sync on mount
        if (!isOrganizer) {
            setTimeout(() => {
                channel.send({ type: 'broadcast', event: 'qa_sync_request', payload: {} });
            }, 1000); // slight delay to ensure subscription is active
        }

        return () => {};
    }, [channel, isOrganizer]);

    const handleAskQuestion = () => {
        if (!newQuestion.trim()) return;
        
        const qObj = {
            id: Date.now().toString(),
            text: newQuestion,
            author_name: isAnonymous ? 'Anonymous Student' : profile.name,
            author_id: profile.id,
            upvotes: 0,
            answered: false,
            answer: '',
            isAnonymous
        };

        setQuestions(prev => [qObj, ...prev]);
        channel.send({ type: 'broadcast', event: 'qa_new', payload: qObj });
        setNewQuestion('');
    };

    const handleUpvote = (qId) => {
        // Optimistic upvote (simplistic, doesn't prevent double votes but fine for ephemeral live session)
        setQuestions(prev => prev.map(q => q.id === qId ? { ...q, upvotes: q.upvotes + 1 } : q).sort((a,b) => b.upvotes - a.upvotes));
        channel.send({ type: 'broadcast', event: 'qa_upvote', payload: { qId } });
    };

    const handleMarkAnswered = (qId) => {
        setQuestions(prev => prev.map(q => q.id === qId ? { ...q, answered: true } : q));
        channel.send({ type: 'broadcast', event: 'qa_answered', payload: { qId, answerText: 'Answered Live' } });
    };

    const handleSaveFAQ = async (q) => {
        const { error } = await supabase.from('class_faqs').insert({
            video_id: videoId,
            question: q.text,
            answer: q.answer || 'Answered Live',
            saved_by: profile.id
        });
        
        if (!error) {
            toast.success("Saved to Course FAQs!");
        } else {
            toast.error("Failed to save FAQ");
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', overflowY: 'auto' }}>
            <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MessageSquare size={18} /> Live Q&A
            </h3>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                <textarea 
                    placeholder="Ask a question..." 
                    value={newQuestion} 
                    onChange={e => setNewQuestion(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: 'white', borderRadius: '4px', outline: 'none', resize: 'none', height: '60px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={isAnonymous} onChange={e => setIsAnonymous(e.target.checked)} />
                        Ask anonymously
                    </label>
                    <button onClick={handleAskQuestion} style={{ background: '#6366f1', color: 'white', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>Ask</button>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {questions.map(q => (
                    <div key={q.id} style={{ background: q.answered ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.03)', border: `1px solid ${q.answered ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: '8px', padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{q.author_name}</span>
                            {q.answered && <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><CheckCircle2 size={12} /> Answered</span>}
                        </div>
                        <p style={{ margin: 0, color: 'white', fontSize: '0.95rem', lineHeight: '1.4' }}>{q.text}</p>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                            <button onClick={() => handleUpvote(q.id)} style={{ background: 'transparent', color: '#818cf8', border: '1px solid rgba(129, 140, 248, 0.3)', padding: '0.2rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <ArrowUp size={12} /> {q.upvotes}
                            </button>
                            
                            {isOrganizer && (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {!q.answered && (
                                        <button onClick={() => handleMarkAnswered(q.id)} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                            Mark Answered
                                        </button>
                                    )}
                                    <button onClick={() => handleSaveFAQ(q)} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <BookmarkPlus size={14} /> Save FAQ
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {questions.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2rem' }}>
                        No questions yet.
                    </div>
                )}
            </div>
        </div>
    );
}
