import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { Hand, Check, X } from 'lucide-react';

export default function LiveHandRaise({ isOrganizer, channel }) {
    const { profile } = useAuth();
    const toast = useToast();
    
    // For organizers: list of raised hands
    // For students: boolean indicating if their hand is currently raised
    const [raisedHands, setRaisedHands] = useState([]);
    const [myHandRaised, setMyHandRaised] = useState(false);
    
    const handsRef = useRef([]);
    useEffect(() => { handsRef.current = raisedHands; }, [raisedHands]);

    useEffect(() => {
        if (!channel) return;

        const sub1 = channel.on('broadcast', { event: 'hand_raise' }, (payload) => {
            const { student_id, student_name, raised_at } = payload.payload;
            if (isOrganizer) {
                setRaisedHands(prev => {
                    if (prev.find(h => h.student_id === student_id)) return prev;
                    return [...prev, { student_id, student_name, raised_at }];
                });
            }
        });

        const sub2 = channel.on('broadcast', { event: 'hand_handled' }, (payload) => {
            const { student_id, action } = payload.payload;
            if (isOrganizer) {
                setRaisedHands(prev => prev.filter(h => h.student_id !== student_id));
            } else if (profile.id === student_id) {
                setMyHandRaised(false);
                if (action === 'accept') {
                    toast.success("The instructor accepted your hand raise. You can speak now.");
                } else {
                    toast.info("The instructor dismissed your hand raise.");
                }
            }
        });

        const sub3 = channel.on('broadcast', { event: 'hand_sync_request' }, () => {
            if (isOrganizer) {
                channel.send({ type: 'broadcast', event: 'hand_sync_response', payload: handsRef.current });
            }
        });

        const sub4 = channel.on('broadcast', { event: 'hand_sync_response' }, (payload) => {
            if (!isOrganizer) {
                const myHand = payload.payload.find(h => h.student_id === profile.id);
                setMyHandRaised(!!myHand);
            }
        });

        if (!isOrganizer) {
            setTimeout(() => {
                channel.send({ type: 'broadcast', event: 'hand_sync_request', payload: {} });
            }, 1000);
        }

        return () => {};
    }, [channel, isOrganizer, profile]);

    const handleRaiseHand = () => {
        setMyHandRaised(true);
        channel.send({ type: 'broadcast', event: 'hand_raise', payload: {
            student_id: profile.id,
            student_name: profile.name,
            raised_at: new Date().toISOString()
        }});
        toast.success("Hand raised!");
    };

    const handleLowerHand = () => {
        setMyHandRaised(false);
        channel.send({ type: 'broadcast', event: 'hand_handled', payload: { student_id: profile.id, action: 'lower' } });
    };

    const handleAction = (student_id, action) => {
        setRaisedHands(prev => prev.filter(h => h.student_id !== student_id));
        channel.send({ type: 'broadcast', event: 'hand_handled', payload: { student_id, action } });
    };

    if (!isOrganizer) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', maxWidth: '250px' }}>
                    <div style={{ 
                        width: '80px', height: '80px', borderRadius: '50%', 
                        background: myHandRaised ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        margin: '0 auto 1.5rem',
                        border: `2px solid ${myHandRaised ? '#6366f1' : 'transparent'}`,
                        transition: 'all 0.3s'
                    }}>
                        <Hand size={40} color={myHandRaised ? '#818cf8' : '#94a3b8'} />
                    </div>
                    <h3 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.2rem' }}>
                        {myHandRaised ? 'Hand Raised' : 'Have a Question?'}
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                        {myHandRaised ? 'Wait for the instructor to call on you.' : 'Click below to notify the instructor that you want to speak.'}
                    </p>
                    
                    {!myHandRaised ? (
                        <button onClick={handleRaiseHand} style={{ width: '100%', background: '#6366f1', color: 'white', border: 'none', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                            Raise Hand
                        </button>
                    ) : (
                        <button onClick={handleLowerHand} style={{ width: '100%', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                            Lower Hand
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Hand size={18} /> Raised Hands
                </h3>
                <span style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600 }}>
                    {raisedHands.length}
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {raisedHands.map(hand => (
                    <div key={hand.student_id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <p style={{ margin: 0, color: 'white', fontSize: '0.95rem', fontWeight: 500 }}>{hand.student_name}</p>
                            <p style={{ margin: 0, color: '#64748b', fontSize: '0.75rem' }}>
                                Raised {new Date(hand.raised_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button onClick={() => handleAction(hand.student_id, 'accept')} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }} title="Accept & Allow to Speak">
                                <Check size={16} />
                            </button>
                            <button onClick={() => handleAction(hand.student_id, 'dismiss')} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.4rem', borderRadius: '6px', cursor: 'pointer' }} title="Dismiss">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ))}
                
                {raisedHands.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.9rem', marginTop: '3rem' }}>
                        No hands raised right now.
                    </div>
                )}
            </div>
        </div>
    );
}
