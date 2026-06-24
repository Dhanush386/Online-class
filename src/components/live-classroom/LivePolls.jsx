import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Toast';
import { Loader2, Plus, Clock, BarChart2, CheckCircle2 } from 'lucide-react';

export default function LivePolls({ videoId, isOrganizer, channel }) {
    const { profile } = useAuth();
    const toast = useToast();
    const [polls, setPolls] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Create Poll State
    const [isCreating, setIsCreating] = useState(false);
    const [newQuestion, setNewQuestion] = useState('');
    const [newOptions, setNewOptions] = useState([{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }]);
    const [correctOption, setCorrectOption] = useState(null);
    const [timerSeconds, setTimerSeconds] = useState(60);
    const [creating, setCreating] = useState(false);

    // Votes state: poll_id -> { optionText: count }
    const [voteCounts, setVoteCounts] = useState({});
    const [myVotes, setMyVotes] = useState({}); // poll_id -> selected_option

    useEffect(() => {
        fetchPolls();
    }, [videoId]);

    const handlePollNew = useCallback((payload) => {
        setPolls(prev => {
            if (prev.some(p => p.id === payload.payload.id)) return prev;
            return [payload.payload, ...prev];
        });
    }, []);

    const handlePollVote = useCallback((payload) => {
        const { poll_id, selected_option } = payload.payload;
        setVoteCounts(prev => ({
            ...prev,
            [poll_id]: {
                ...prev[poll_id],
                [selected_option]: (prev[poll_id]?.[selected_option] || 0) + 1
            }
        }));
    }, []);

    const handlePollEnd = useCallback((payload) => {
        const { poll_id, ended_at } = payload.payload;
        setPolls(prev => prev.map(p => p.id === poll_id ? { ...p, ended_at } : p));
    }, []);

    const broadcastPollEnd = useCallback((pollId, endedAt) => {
        channel.send({ type: 'broadcast', event: 'poll_end', payload: { poll_id: pollId, ended_at: endedAt } });
        setPolls(prev => prev.map(p => p.id === pollId ? { ...p, ended_at: endedAt } : p));
    }, [channel]);

    useEffect(() => {
        if (!channel) return;

        channel.on('broadcast', { event: 'poll_new' }, handlePollNew);
        channel.on('broadcast', { event: 'poll_vote' }, handlePollVote);
        channel.on('broadcast', { event: 'poll_end' }, handlePollEnd);

        return () => {};
    }, [channel, handlePollNew, handlePollVote, handlePollEnd]);

    async function fetchPolls() {
        // Fetch polls
        const { data: pollsData, error } = await supabase
            .from('live_polls')
            .select('*')
            .eq('video_id', videoId)
            .order('created_at', { ascending: false });

        if (!error && pollsData) {
            setPolls(pollsData);
            
            // Fetch votes to calculate counts
            const pollIds = pollsData.map(p => p.id);
            if (pollIds.length > 0) {
                const { data: votesData } = await supabase
                    .from('live_poll_votes')
                    .select('poll_id, selected_option, student_id')
                    .in('poll_id', pollIds);

                if (votesData) {
                    const counts = {};
                    const myV = {};
                    votesData.forEach(v => {
                        if (!counts[v.poll_id]) counts[v.poll_id] = {};
                        counts[v.poll_id][v.selected_option] = (counts[v.poll_id][v.selected_option] || 0) + 1;
                        if (v.student_id === profile?.id) {
                            myV[v.poll_id] = v.selected_option;
                        }
                    });
                    setVoteCounts(counts);
                    setMyVotes(myV);
                }
            }
        }
        setLoading(false);
    }

    const handleCreatePoll = async () => {
        const optionsList = newOptions.map(o => o.text);
        if (!newQuestion.trim() || optionsList.some(o => !o.trim())) {
            return toast.error("Please fill all fields");
        }
        setCreating(true);

        const endedAt = new Date(Date.now() + timerSeconds * 1000).toISOString();

        const { data, error } = await supabase
            .from('live_polls')
            .insert({
                video_id: videoId,
                question: newQuestion,
                options: optionsList,
                correct_option: correctOption,
                created_by: profile.id,
                ended_at: endedAt
            })
            .select()
            .single();

        if (error) {
            toast.error("Failed to create poll");
        } else {
            toast.success("Poll created!");
            setIsCreating(false);
            setNewQuestion('');
            setNewOptions([{ id: crypto.randomUUID(), text: '' }, { id: crypto.randomUUID(), text: '' }]);
            setCorrectOption(null);
            setPolls([data, ...polls]);
            channel.send({ type: 'broadcast', event: 'poll_new', payload: data });
            
            // Insert system message for the chat
            supabase.from('live_chat_messages').insert({
                video_id: videoId,
                user_id: profile.id,
                message: `📊 Instructor created a poll: ${newQuestion}`,
                message_type: 'system'
            }).then(() => {});

            // Set timeout to broadcast end
            setTimeout(() => {
                broadcastPollEnd(data.id, endedAt);
            }, timerSeconds * 1000);
        }
        setCreating(false);
    };

    const handleVote = async (pollId, option) => {
        if (myVotes[pollId]) return; // already voted

        // Optimistic update
        setMyVotes(prev => ({ ...prev, [pollId]: option }));
        setVoteCounts(prev => ({
            ...prev,
            [pollId]: {
                ...prev[pollId],
                [option]: (prev[pollId]?.[option] || 0) + 1
            }
        }));

        const { error } = await supabase
            .from('live_poll_votes')
            .insert({
                poll_id: pollId,
                student_id: profile.id,
                selected_option: option
            });

        if (error) {
             toast.error("Failed to vote");
        } else {
            channel.send({ type: 'broadcast', event: 'poll_vote', payload: { poll_id: pollId, selected_option: option } });
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Loader2 className="animate-spin text-slate-500" /></div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1rem', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Live Polls</h3>
                {isOrganizer && !isCreating && (
                    <button 
                        onClick={() => setIsCreating(true)}
                        style={{ background: '#6366f1', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                    >
                        <Plus size={14} /> New Poll
                    </button>
                )}
            </div>

            {isCreating && (
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <input 
                        type="text" placeholder="Poll Question" value={newQuestion} onChange={e => setNewQuestion(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: 'white', borderRadius: '4px', outline: 'none' }}
                    />
                    {newOptions.map((optObj, i) => (
                        <div key={optObj.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                            <input 
                                type="radio" 
                                name="correctOption" 
                                checked={correctOption === optObj.text && optObj.text !== ''} 
                                onChange={() => setCorrectOption(optObj.text)} 
                                title="Mark as correct answer"
                                style={{ cursor: 'pointer' }}
                            />
                            <input 
                                type="text" placeholder={`Option ${i+1}`} value={optObj.text} onChange={e => {
                                    const opts = [...newOptions]; 
                                    if (correctOption === opts[i].text) {
                                        setCorrectOption(e.target.value);
                                    }
                                    opts[i] = { ...opts[i], text: e.target.value }; 
                                    setNewOptions(opts);
                                }}
                                style={{ flex: 1, padding: '0.5rem', background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: 'white', borderRadius: '4px', outline: 'none' }}
                            />
                            {i > 1 && (
                                <button onClick={() => setNewOptions(newOptions.filter((_, idx) => idx !== i))} style={{ background: 'transparent', color: '#ef4444', border: 'none', cursor: 'pointer' }}>X</button>
                            )}
                        </div>
                    ))}
                    <button onClick={() => setNewOptions([...newOptions, { id: crypto.randomUUID(), text: '' }])} style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8rem', marginBottom: '1rem' }}>+ Add Option</button>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <Clock size={14} /> Timer:
                        <select value={timerSeconds} onChange={e => setTimerSeconds(Number(e.target.value))} style={{ background: 'var(--text-primary)', color: 'white', border: '1px solid var(--card-border)', padding: '0.2rem', borderRadius: '4px', outline: 'none' }}>
                            <option value={30}>30s</option>
                            <option value={60}>60s</option>
                            <option value={120}>2 mins</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={handleCreatePoll} disabled={creating} style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer' }}>
                            {creating ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Launch Poll'}
                        </button>
                        <button onClick={() => setIsCreating(false)} style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--card-border)', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {polls.map(poll => {
                    const isEnded = new Date(poll.ended_at) <= new Date();
                    const hasVoted = !!myVotes[poll.id];
                    const totalVotes = Object.values(voteCounts[poll.id] || {}).reduce((a, b) => a + b, 0);

                    return (
                        <div key={poll.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <h4 style={{ margin: 0, color: 'white', fontSize: '0.95rem' }}>{poll.question}</h4>
                                <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '12px', background: isEnded ? 'rgba(255,255,255,0.1)' : 'rgba(16, 185, 129, 0.2)', color: isEnded ? 'var(--text-muted)' : '#10b981' }}>
                                    {isEnded ? 'Closed' : 'Active'}
                                </span>
                            </div>
                                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                                {poll.options.map((opt) => {
                                    const votes = voteCounts[poll.id]?.[opt] || 0;
                                    const percentage = totalVotes === 0 ? 0 : Math.round((votes / totalVotes) * 100);
                                    const isMyVote = myVotes[poll.id] === opt;
                                    if (isEnded || hasVoted || isOrganizer) {
                                        // Show Results View
                                        const isCorrectAnswer = poll.correct_option === opt;
                                        const isWrongVote = isMyVote && poll.correct_option && !isCorrectAnswer;
                                        
                                        let barColor = 'rgba(255,255,255,0.1)';
                                        let checkColor = 'var(--text-muted)';
                                        
                                        if (isCorrectAnswer) {
                                            barColor = 'rgba(16, 185, 129, 0.3)';
                                            checkColor = '#10b981';
                                        } else if (isWrongVote) {
                                            barColor = 'rgba(239, 68, 68, 0.3)';
                                            checkColor = '#ef4444';
                                        } else if (isMyVote) {
                                            barColor = 'rgba(99, 102, 241, 0.3)';
                                            checkColor = '#6366f1';
                                        }
                                        return (
                                            <div key={opt} style={{ position: 'relative', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                                                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${percentage}%`, background: barColor, transition: 'width 0.5s' }} />
                                                <div style={{ position: 'relative', padding: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', color: 'white' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {(isMyVote || isCorrectAnswer) && <CheckCircle2 size={14} color={checkColor} />}
                                                        {opt}
                                                    </span>
                                                    <span style={{ color: 'var(--text-muted)' }}>{percentage}% ({votes})</span>
                                                </div>
                                            </div>
                                        )
                                    }

                                    // Show Voting View
                                    return (
                                        <button 
                                            key={opt} 
                                            onClick={() => handleVote(poll.id, opt)}
                                            style={{ padding: '0.6rem', background: 'var(--text-primary)', border: '1px solid var(--card-border)', color: 'white', borderRadius: '4px', cursor: 'pointer', textAlign: 'left', fontSize: '0.85rem', transition: 'background 0.2s' }}
                                            onMouseOver={(e) => e.target.style.background = 'var(--card-border)'}
                                            onFocus={(e) => e.target.style.background = 'var(--card-border)'}
                                            onMouseOut={(e) => e.target.style.background = 'var(--text-primary)'}
                                            onBlur={(e) => e.target.style.background = 'var(--text-primary)'}
                                        >
                                            {opt}
                                        </button>
                                    )
                                })}
                            </div>
                            
                            <div style={{ marginTop: '0.8rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <BarChart2 size={12} /> {totalVotes} total votes
                            </div>
                        </div>
                    )
                })}
                {polls.length === 0 && !isCreating && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '2rem' }}>
                        No polls yet.
                    </div>
                )}
            </div>
        </div>
    );
}

LivePolls.propTypes = {
    videoId: PropTypes.string.isRequired,
    isOrganizer: PropTypes.bool.isRequired,
    channel: PropTypes.shape({
        on: PropTypes.func,
        send: PropTypes.func
    })
};
