import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Award, Trophy, Star, Target, Zap, Shield, Rocket, Heart, Flame, Code, BookOpen, Database, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

const generateRankBadges = () => {
    const tiers = [
        { name: 'Iron', color: '#94a3b8', base: 0, step: 200 },
        { name: 'Bronze', color: '#b45309', base: 1000, step: 200 },
        { name: 'Silver', color: '#64748b', base: 2000, step: 300 },
        { name: 'Gold', color: '#f59e0b', base: 3500, step: 800 },
        { name: 'Diamond', color: '#a855f7', base: 7500, step: 1000 }
    ]
    const roman = ['I', 'II', 'III', 'IV', 'V']
    const badges = []
    
    tiers.forEach(tier => {
        for (let i = 0; i < 5; i++) {
            const threshold = tier.base + (i * tier.step)
            badges.push({
                id: `rank_${tier.name.toLowerCase()}_${i+1}`,
                title: `${tier.name} ${roman[i]}`,
                subtitle: `${threshold}+ XP`,
                threshold: threshold,
                color: tier.color,
                tierName: tier.name,
                levelRoman: roman[i]
            })
        }
    })
    return badges
}

const CATEGORIES = [
    {
        id: 'leaderboard',
        name: 'Ranks & Tiers',
        badges: generateRankBadges()
    },
    {
        id: 'problems',
        name: 'Problem Solved',
        badges: [
            { id: 'probs_5', title: 'Code Starter', subtitle: '5 problems solved', threshold: 5, color: '#6366f1' },
            { id: 'probs_10', title: 'Problem Solver', subtitle: '10 problems solved', threshold: 10, color: '#6366f1' },
            { id: 'probs_20', title: 'Code Climber', subtitle: '20 problems solved', threshold: 20, color: '#6366f1' },
            { id: 'probs_30', title: 'Logic Builder', subtitle: '30 problems solved', threshold: 30, color: '#6366f1' },
            { id: 'probs_40', title: 'Puzzle Master', subtitle: '40 problems solved', threshold: 40, color: '#6366f1' },
            { id: 'probs_50', title: 'Code Challenger', subtitle: '50 problems solved', threshold: 50, color: '#6366f1' },
            { id: 'probs_75', title: 'Algorithm Ace', subtitle: '75 problems solved', threshold: 75, color: '#6366f1' },
            { id: 'probs_100', title: 'Algorithm Enthusiast', subtitle: '100 problems solved', threshold: 100, color: '#6b7280' },
            { id: 'probs_125', title: 'Code Commander', subtitle: '125 problems solved', threshold: 125, color: '#6b7280' },
            { id: 'probs_150', title: 'Bug Buster', subtitle: '150 problems solved', threshold: 150, color: '#6b7280' },
            { id: 'probs_175', title: 'Script Scientist', subtitle: '175 problems solved', threshold: 175, color: '#6b7280' },
            { id: 'probs_200', title: 'Logic Legend', subtitle: '200 problems solved', threshold: 200, color: '#6b7280' },
        ]
    },
    {
        id: 'skills',
        name: 'Skill Progress',
        badges: [
            { id: 'skill_html', title: 'HTML Master', subtitle: 'Complete HTML Course', color: '#f97316', icon: <Code size={20} /> },
            { id: 'skill_bootstrap', title: 'Bootstrap Pro', subtitle: 'Complete Bootstrap Course', color: '#7c3aed', icon: 'B' },
            { id: 'skill_sql', title: 'SQL Data Explorer', subtitle: 'Complete SQL Course', color: '#3b82f6', icon: <Database size={20} /> },
            { id: 'skill_python', title: 'Python Programmer', subtitle: 'Complete Python Course', color: '#1e293b', icon: '🐍' },
            { id: 'skill_js', title: 'JavaScript Developer', subtitle: 'Complete JS Course', color: '#eab308', icon: 'JS' },
        ]
    },
    {
        id: 'xp',
        name: 'Total XP',
        badges: [
            { id: 'xp_100', title: 'XP Beginner', subtitle: 'Earn 100 XP points', threshold: 100, color: '#f59e0b' },
            { id: 'xp_200', title: 'XP Novice', subtitle: 'Earn 200 XP points', threshold: 200, color: '#f59e0b' },
            { id: 'xp_500', title: 'XP Explorer', subtitle: 'Earn 500 XP points', threshold: 500, color: '#f59e0b' },
            { id: 'xp_700', title: 'XP Scout', subtitle: 'Earn 700 XP points', threshold: 700, color: '#f59e0b' },
            { id: 'xp_800', title: 'XP Voyager', subtitle: 'Earn 800 XP points', threshold: 800, color: '#f59e0b' },
            { id: 'xp_1000', title: 'XP Challenger', subtitle: 'Earn 1000 XP points', threshold: 1000, color: '#f59e0b' },
            { id: 'xp_1200', title: 'XP Warrior', subtitle: 'Earn 1200 XP points', threshold: 1200, color: '#f59e0b' },
            { id: 'xp_1500', title: 'XP Veteran', subtitle: 'Earn 1500 XP points', threshold: 1500, color: '#f59e0b' },
            { id: 'xp_2000', title: 'XP Elite', subtitle: 'Earn 2000 XP points', threshold: 2000, color: '#f59e0b' },
            { id: 'xp_2500', title: 'XP Achiever', subtitle: 'Earn 2500 XP points', threshold: 2500, color: '#f59e0b' },
            { id: 'xp_3000', title: 'XP Master', subtitle: 'Earn 3000 XP points', threshold: 3000, color: '#f59e0b' },
            { id: 'xp_3500', title: 'XP Grandmaster', subtitle: 'Earn 3500 XP points', threshold: 3500, color: '#f59e0b' },
            { id: 'xp_4000', title: 'XP Legend', subtitle: 'Earn 4000 XP points', threshold: 4000, color: '#f59e0b' },
            { id: 'xp_7000', title: 'XP Prodigy', subtitle: 'Earn 7000 XP points', threshold: 7000, color: '#f59e0b' },
        ]
    },
    {
        id: 'streak',
        name: 'Streak',
        badges: [
            { id: 'streak_3', title: 'Streak - 3 Days', subtitle: '3-day learning streak', threshold: 3, color: '#f97316' },
            { id: 'streak_7', title: 'Streaks- 7 Days', subtitle: '7-day learning streak', threshold: 7, color: '#f97316' },
            { id: 'streak_14', title: 'Streak - 14 Days', subtitle: '14-day learning streak', threshold: 14, color: '#f97316' },
            { id: 'streak_30', title: 'Streak - 30 Days', subtitle: '30-day learning streak', threshold: 30, color: '#f97316' },
            { id: 'streak_45', title: 'Streak - 45 Days', subtitle: '45-day learning streak', threshold: 45, color: '#f97316' },
        ]
    }
]

export default function Achievements() {
    const { profile, stats, loading: authLoading } = useAuth()
    const [loading, setLoading] = useState(false)

    // Stats are now loaded globally in AuthContext

    const isUnlocked = (badge, categoryId) => {
        if (categoryId === 'xp') return stats.xp >= (badge.threshold || 0)
        if (categoryId === 'problems') return stats.solved >= (badge.threshold || 0)
        if (categoryId === 'streak') return stats.streak >= (badge.threshold || 0)
        if (categoryId === 'leaderboard') return stats.xp >= (badge.threshold || 0)
        if (categoryId === 'skills') {
            const keyword = badge.id.split('_')[1] // html, js, etc.
            return stats.completedCourses?.some(title => title.includes(keyword))
        }
        return false
    }

    if (authLoading || loading) return <div style={{ padding: '4rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
            <style>{`
                .hexagon-container {
                    width: 70px;
                    height: 80px;
                    position: relative;
                    margin: 0 auto 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }
                .hexagon {
                    width: 100%;
                    height: 100%;
                    background: #f1f5f9;
                    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                    font-weight: 800;
                    font-size: 0.9rem;
                    position: relative;
                }
                .hexagon-inner {
                    width: 88%;
                    height: 88%;
                    background: white;
                    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }
                .badge-unlocked .hexagon {
                    background: currentColor;
                }
                .badge-unlocked .hexagon-inner {
                    background: white;
                }
                .badge-locked {
                    filter: grayscale(1);
                    opacity: 0.6;
                }
                .lock-overlay {
                    position: absolute;
                    bottom: 5px;
                    right: 5px;
                    background: white;
                    border-radius: 50%;
                    padding: 4px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 5;
                    color: #64748b;
                }
                .badge-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 3rem;
                }
                .badge-scroll-container {
                    display: flex;
                    gap: 1.5rem;
                    overflow-x: auto;
                    padding: 1rem 0.5rem 2rem 0.5rem;
                    margin-bottom: 2rem;
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 transparent;
                }
                .badge-scroll-container::-webkit-scrollbar {
                    height: 6px;
                }
                .badge-scroll-container::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 10px;
                }
                .badge-scroll-container .badge-card {
                    min-width: 160px;
                    flex-shrink: 0;
                }
                .badge-card {
                    padding: 1.5rem 1rem;
                    text-align: center;
                    background: white;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    transition: transform 0.2s ease;
                }
                .badge-card:hover {
                    transform: translateY(-4px);
                }
                .badge-title {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 0.25rem;
                    line-height: 1.2;
                }
                .badge-subtitle {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                }
            `}</style>

            <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)' }}>Badges</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Showcase your achievements and progress</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: 20 }}>All</button>
                    <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', borderRadius: 20, background: 'none' }}>Collected</button>
                </div>
            </div>

            {CATEGORIES.map(cat => (
                <div key={cat.id} style={{ marginBottom: '2rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {cat.name}
                        {cat.id === 'leaderboard' && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>Scroll right →</span>}
                    </h2>
                    <div className={cat.id === 'leaderboard' ? 'badge-scroll-container' : 'badge-grid'}>
                        {cat.badges.map(badge => {
                            const unlocked = isUnlocked(badge, cat.id)
                            return (
                                <div key={badge.id} className={`badge-card ${unlocked ? 'badge-unlocked' : 'badge-locked'}`} style={{ color: badge.color }}>
                                    <div className="hexagon-container">
                                        <div className="hexagon">
                                            <div className="hexagon-inner">
                                                {cat.id === 'leaderboard' ? (
                                                    <div style={{ color: badge.color }}>
                                                        <Trophy size={18} style={{ marginBottom: 2 }} />
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>{badge.levelRoman}</div>
                                                    </div>
                                                ) : cat.id === 'problems' ? (
                                                    <div style={{ color: badge.color }}>
                                                        <Code size={18} style={{ marginBottom: 2 }} />
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800 }}>{badge.threshold}</div>
                                                    </div>
                                                ) : cat.id === 'xp' ? (
                                                    <div style={{ color: badge.color }}>
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>XP</div>
                                                        <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>{badge.threshold}</div>
                                                    </div>
                                                ) : cat.id === 'streak' ? (
                                                    <div style={{ color: badge.color }}>
                                                        <Flame size={18} style={{ marginBottom: 2 }} />
                                                        <div style={{ fontSize: '0.75rem', fontWeight: 800 }}>{badge.threshold}</div>
                                                    </div>
                                                ) : (
                                                    <div style={{ color: badge.color, fontSize: '0.9rem', fontWeight: 800 }}>
                                                        {badge.icon}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {!unlocked && (
                                            <div className="lock-overlay">
                                                <Lock size={10} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="badge-title">{badge.title}</div>
                                    <div className="badge-subtitle">{badge.subtitle}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}
