import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Award, Trophy, Star, Target, Zap, Shield, Rocket, Heart, Flame, Code, BookOpen, Database, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

const CATEGORIES = [
    {
        id: 'leaderboard',
        name: 'Leaderboard',
        badges: [
            { id: 'iron_1', title: 'Iron Champion', subtitle: 'Rank - 1', color: '#64748b' },
            { id: 'iron_2', title: 'Iron Master', subtitle: 'Rank - 2', color: '#64748b' },
            { id: 'iron_3', title: 'Iron Prodigy', subtitle: 'Rank - 3', color: '#64748b' },
            { id: 'iron_4', title: 'Iron Achiever', subtitle: 'Rank - 4', color: '#64748b' },
            { id: 'iron_5', title: 'Iron Challenger', subtitle: 'Rank - 5', color: '#64748b' },
        ]
    },
    {
        id: 'problems',
        name: 'Problem Solved',
        badges: [
            { id: 'probs_10', title: 'Problem Solver', subtitle: '10 problems solved', threshold: 10, color: '#6366f1' },
            { id: 'probs_30', title: 'Logic Builder', subtitle: '30 problems solved', threshold: 30, color: '#6366f1' },
            { id: 'probs_50', title: 'Code Challenger', subtitle: '50 problems solved', threshold: 50, color: '#6366f1' },
            { id: 'probs_100', title: 'Algorithm Enthusiast', subtitle: '100 problems solved', threshold: 100, color: '#6b7280' },
            { id: 'probs_150', title: 'Bug Buster', subtitle: '150 problems solved', threshold: 150, color: '#6b7280' },
            { id: 'probs_200', title: 'Coding Prodigy', subtitle: '200 problems solved', threshold: 200, color: '#6b7280' },
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
            { id: 'xp_500', title: 'XP Explorer', subtitle: 'Earn 500 XP points', threshold: 500, color: '#f59e0b' },
            { id: 'xp_1000', title: 'XP Challenger', subtitle: 'Earn 1000 XP points', threshold: 1000, color: '#f59e0b' },
            { id: 'xp_2500', title: 'XP Achiever', subtitle: 'Earn 2500 XP points', threshold: 2500, color: '#f59e0b' },
            { id: 'xp_5000', title: 'XP Master', subtitle: 'Earn 5000 XP points', threshold: 5000, color: '#f59e0b' },
            { id: 'xp_8000', title: 'XP Prodigy', subtitle: 'Earn 8000 XP points', threshold: 8000, color: '#f59e0b' },
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
        if (categoryId === 'leaderboard') return stats.rank <= parseInt(badge.id.split('_')[1])
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
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>{cat.name}</h2>
                    <div className="badge-grid">
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
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 800 }}>#{badge.id.split('_')[1]}</div>
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
