import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Award, Trophy, Star, Target, Zap, Shield, Rocket, Heart, Flame } from 'lucide-react'
import { Link } from 'react-router-dom'

const ALL_BADGES = [
    { id: 'early_bird', title: 'Early Bird', description: 'Joined the platform in its early days.', icon: <Rocket size={24} />, color: '#6366f1', xp: 50 },
    { id: 'fast_learner', title: 'Fast Learner', description: 'Completed first course within a week.', icon: <Flame size={24} />, color: '#ef4444', xp: 100 },
    { id: 'quiz_master', title: 'Quiz Master', description: 'Scored 100% in any assessment.', icon: <Trophy size={24} />, color: '#f59e0b', xp: 150 },
    { id: 'code_warrior', title: 'Code Warrior', description: 'Solved 5 coding challenges.', icon: <Target size={24} />, color: '#10b981', xp: 200 },
    { id: 'bug_hunter', title: 'Bug Hunter', description: 'Found and reported a significant bug.', icon: <Shield size={24} />, color: '#64748b', xp: 300 },
    { id: 'helpful_peer', title: 'Helpful Peer', description: 'Helped others in the discussion forum.', icon: <Heart size={24} />, color: '#ec4899', xp: 100 },
]

export default function Achievements() {
    const { profile } = useAuth()
    const [earnedBadges, setEarnedBadges] = useState(['early_bird', 'fast_learner', 'quiz_master']) // Mocking for now
    const [totalXp, setTotalXp] = useState(0)

    useEffect(() => {
        // In a real app, fetch from a user_badges table
        // For now, calculating XP based on mock earned badges
        const xp = ALL_BADGES.filter(b => earnedBadges.includes(b.id)).reduce((sum, b) => sum + b.xp, 0)
        setTotalXp(xp)
    }, [earnedBadges])

    return (
        <div className="animate-fade-in">
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>My Achievements</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Track your badges, rank, and total XP earned.</p>
                </div>
                <div style={{ padding: '0.75rem 1.25rem', background: 'linear-gradient(135deg, #6366f1, #a855f7)', borderRadius: 12, color: 'white', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }}>Total XP</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{totalXp}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {ALL_BADGES.map(badge => {
                    const isEarned = earnedBadges.includes(badge.id)
                    return (
                        <div key={badge.id} className="glass-card" style={{
                            padding: '1.5rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            opacity: isEarned ? 1 : 0.5,
                            filter: isEarned ? 'none' : 'grayscale(1)',
                            position: 'relative',
                            transition: 'all 0.3s ease',
                            border: isEarned ? `1px solid ${badge.color}40` : '1px solid var(--sidebar-border)'
                        }}>
                            <div style={{
                                width: 64, height: 64,
                                background: isEarned ? `${badge.color}15` : '#f1f5f9',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isEarned ? badge.color : '#94a3b8',
                                marginBottom: '1rem',
                                boxShadow: isEarned ? `0 10px 20px -5px ${badge.color}30` : 'none'
                            }}>
                                {badge.icon}
                            </div>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{badge.title}</h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1 }}>{badge.description}</p>
                            <div style={{ marginTop: '1.25rem', fontSize: '0.75rem', fontWeight: 700, color: badge.color, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Star size={12} /> {badge.xp} XP
                            </div>

                            {!isEarned && (
                                <div style={{ position: 'absolute', inset: 0, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(1px)' }}>
                                    <span style={{ padding: '0.35rem 0.75rem', background: '#94a3b8', color: 'white', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 }}>LOCKED</span>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            <div className="glass-card" style={{ marginTop: '2.5rem', padding: '2rem', textAlign: 'center' }}>
                <Trophy size={48} color="#f59e0b" style={{ margin: '0 auto 1.5rem' }} />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Global Leaderboard</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: 500, margin: '0 auto 1.5rem' }}>See where you stand among thousands of other learners and climb to the top.</p>
                <div style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Leaderboard feature is coming soon! Keep earning XP to secure your spot.
                </div>
            </div>
        </div>
    )
}
