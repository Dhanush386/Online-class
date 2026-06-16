import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Award, Trophy, Star, Target, Zap, Shield, Rocket, Heart, Flame, Code, BookOpen, Database, Lock, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const generateRankBadges = () => {
    const tiers = [
        { name: 'Iron', color1: '#cbd5e1', color2: 'var(--text-muted)', base: 0, step: 200 },
        { name: 'Bronze', color1: '#fcd34d', color2: '#b45309', base: 1000, step: 200 },
        { name: 'Silver', color1: '#e2e8f0', color2: 'var(--text-secondary)', base: 2000, step: 300 },
        { name: 'Gold', color1: '#fde047', color2: '#ca8a04', base: 3500, step: 800 },
        { name: 'Diamond', color1: '#e879f9', color2: '#7e22ce', base: 7500, step: 1000 }
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
                color1: tier.color1,
                color2: tier.color2,
                tierName: tier.name,
                levelRoman: roman[i],
                shape: 'shield'
            })
        }
    })
    return badges
}

const CATEGORIES = [
    {
        id: 'leaderboard',
        name: 'Ranks & Tiers',
        description: 'Climb the leaderboard by earning XP',
        badges: generateRankBadges()
    },
    {
        id: 'problems',
        name: 'Problem Solver',
        description: 'Complete coding challenges to unlock',
        badges: [
            { id: 'probs_5', title: 'Code Starter', subtitle: '5 problems', threshold: 5, color1: '#818cf8', color2: '#4338ca', shape: 'hexagon', icon: <Code size={24} /> },
            { id: 'probs_20', title: 'Code Climber', subtitle: '20 problems', threshold: 20, color1: '#60a5fa', color2: '#1d4ed8', shape: 'hexagon', icon: <Code size={24} /> },
            { id: 'probs_50', title: 'Code Challenger', subtitle: '50 problems', threshold: 50, color1: '#34d399', color2: '#047857', shape: 'hexagon', icon: <Code size={24} /> },
            { id: 'probs_100', title: 'Algorithm Enthusiast', subtitle: '100 problems', threshold: 100, color1: '#f87171', color2: '#b91c1c', shape: 'hexagon', icon: <Target size={24} /> },
            { id: 'probs_200', title: 'Logic Legend', subtitle: '200 problems', threshold: 200, color1: '#fbbf24', color2: '#b45309', shape: 'hexagon', icon: <Award size={24} /> },
        ]
    },
    {
        id: 'xp',
        name: 'Experience Points',
        description: 'Accumulate total XP across the platform',
        badges: [
            { id: 'xp_100', title: 'XP Beginner', subtitle: '100 XP', threshold: 100, color1: '#fbcfe8', color2: '#db2777', shape: 'circle', icon: <Star size={24} /> },
            { id: 'xp_500', title: 'XP Explorer', subtitle: '500 XP', threshold: 500, color1: '#fca5a5', color2: '#dc2626', shape: 'circle', icon: <Star size={24} /> },
            { id: 'xp_1000', title: 'XP Challenger', subtitle: '1K XP', threshold: 1000, color1: '#fde047', color2: '#ca8a04', shape: 'circle', icon: <Star size={24} /> },
            { id: 'xp_5000', title: 'XP Master', subtitle: '5K XP', threshold: 5000, color1: '#a7f3d0', color2: '#059669', shape: 'circle', icon: <Trophy size={24} /> },
            { id: 'xp_10000', title: 'XP Legend', subtitle: '10K XP', threshold: 10000, color1: '#c4b5fd', color2: '#6d28d9', shape: 'circle', icon: <Zap size={24} /> },
        ]
    },
    {
        id: 'streak',
        name: 'Learning Streaks',
        description: 'Log in and learn consecutively',
        badges: [
            { id: 'streak_3', title: 'Momentum', subtitle: '3 Days', threshold: 3, color1: '#fed7aa', color2: '#ea580c', shape: 'diamond', icon: <Flame size={24} /> },
            { id: 'streak_7', title: 'Weekly Warrior', subtitle: '7 Days', threshold: 7, color1: '#fdba74', color2: '#c2410c', shape: 'diamond', icon: <Flame size={24} /> },
            { id: 'streak_30', title: 'Monthly Master', subtitle: '30 Days', threshold: 30, color1: '#fb923c', color2: '#9a3412', shape: 'diamond', icon: <Flame size={24} /> },
            { id: 'streak_100', title: 'Century Streaker', subtitle: '100 Days', threshold: 100, color1: '#f97316', color2: '#7c2d12', shape: 'diamond', icon: <Flame size={24} /> },
            { id: 'streak_365', title: 'Year of Code', subtitle: '365 Days', threshold: 365, color1: '#ffedd5', color2: '#ff5500', shape: 'diamond', icon: <Heart size={24} /> },
        ]
    }
]

export default function Achievements() {
    const { stats, loading: authLoading } = useAuth()
    const [filter, setFilter] = useState('all')

    const isUnlocked = (badge, categoryId) => {
        if (categoryId === 'xp') return stats.xp >= (badge.threshold || 0)
        if (categoryId === 'problems') return stats.solved >= (badge.threshold || 0)
        if (categoryId === 'streak') return stats.streak >= (badge.threshold || 0)
        if (categoryId === 'leaderboard') return stats.xp >= (badge.threshold || 0)
        if (categoryId === 'skills') {
            const keyword = badge.id.split('_')[1]
            return stats.completedCourses?.some(title => title.includes(keyword))
        }
        return false
    }

    if (authLoading) return <div style={{ padding: '4rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }}></div></div>

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
            <style>{`
                /* 3D Badge Base */
                .badge-3d-wrapper {
                    position: relative;
                    width: 100px;
                    height: 100px;
                    margin: 0 auto 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    perspective: 1000px;
                }
                
                .badge-3d-base {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 
                        inset 0px 4px 12px rgba(255,255,255,0.6),
                        inset 0px -6px 12px rgba(0,0,0,0.3),
                        0px 10px 20px -5px rgba(0,0,0,0.3);
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .badge-3d-base::before {
                    content: '';
                    position: absolute;
                    inset: 4px;
                    border: 2px solid rgba(255,255,255,0.3);
                    background: linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 100%);
                    z-index: 2;
                }

                /* Shapes */
                .shape-circle {
                    border-radius: 50%;
                }
                .shape-circle::before {
                    border-radius: 50%;
                }

                .shape-shield {
                    clip-path: polygon(50% 0%, 100% 15%, 100% 70%, 50% 100%, 0% 70%, 0% 15%);
                }
                .shape-shield::before {
                    clip-path: polygon(50% 0%, 100% 15%, 100% 70%, 50% 100%, 0% 70%, 0% 15%);
                }

                .shape-hexagon {
                    clip-path: polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%);
                }
                .shape-hexagon::before {
                    clip-path: polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%);
                }

                .shape-diamond {
                    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
                }
                .shape-diamond::before {
                    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
                }

                /* States */
                .badge-locked .badge-3d-base {
                    filter: grayscale(1) brightness(0.7);
                    box-shadow: inset 0px 4px 12px rgba(255,255,255,0.2), inset 0px -6px 12px rgba(0,0,0,0.4);
                }

                /* Glassmorphic Lock */
                .badge-lock-overlay {
                    position: absolute;
                    inset: -10px;
                    background: rgba(255,255,255,0.1);
                    backdrop-filter: blur(4px);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10;
                    color: var(--text-secondary);
                    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.2);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .badge-locked .badge-lock-overlay {
                    opacity: 1;
                }

                .badge-card-container {
                    background: rgba(255,255,255,0.6);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.8);
                    border-radius: 20px;
                    padding: 2rem 1.5rem;
                    text-align: center;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.03);
                    transition: all 0.3s ease;
                    position: relative;
                    overflow: hidden;
                }

                .badge-card-container:hover .badge-3d-base {
                    transform: scale(1.1) rotateY(10deg) rotateX(10deg);
                }

                .badge-card-container:hover {
                    background: white;
                    box-shadow: 0 10px 30px rgba(99,102,241,0.1);
                    transform: translateY(-5px);
                }

                /* Category Header */
                .category-header {
                    background: linear-gradient(90deg, rgba(99,102,241,0.1) 0%, transparent 100%);
                    padding: 1rem 1.5rem;
                    border-radius: 16px;
                    margin-bottom: 2rem;
                    border-left: 4px solid var(--accent);
                }
            `}</style>

            {/* Header Area */}
            <div style={{ marginBottom: '3rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -50, right: 0, width: 300, height: 300, background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', zIndex: -1 }}></div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
                    Hall of <span className="gradient-text">Achievements</span>
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px' }}>
                    Unlock exclusive 3D badges by completing courses, solving challenges, and climbing the leaderboard.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem' }}>
                    <button 
                        onClick={() => setFilter('all')}
                        style={{ padding: '0.75rem 1.5rem', borderRadius: 100, fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s', border: '1px solid',
                            background: filter === 'all' ? 'var(--accent)' : 'transparent',
                            color: filter === 'all' ? 'white' : 'var(--text-secondary)',
                            borderColor: filter === 'all' ? 'var(--accent)' : '#e2e8f0'
                        }}
                    >
                        All Badges
                    </button>
                    <button 
                        onClick={() => setFilter('unlocked')}
                        style={{ padding: '0.75rem 1.5rem', borderRadius: 100, fontWeight: 700, fontSize: '0.9rem', transition: 'all 0.2s', border: '1px solid',
                            background: filter === 'unlocked' ? 'var(--accent)' : 'transparent',
                            color: filter === 'unlocked' ? 'white' : 'var(--text-secondary)',
                            borderColor: filter === 'unlocked' ? 'var(--accent)' : '#e2e8f0'
                        }}
                    >
                        Unlocked Only
                    </button>
                </div>
            </div>

            <AnimatePresence>
                {CATEGORIES.map((cat, catIdx) => {
                    const visibleBadges = cat.badges.filter(b => filter === 'all' || isUnlocked(b, cat.id))
                    
                    if (visibleBadges.length === 0) return null

                    return (
                        <motion.div 
                            key={cat.id} 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: catIdx * 0.1 }}
                            style={{ marginBottom: '4rem' }}
                        >
                            <div className="category-header">
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                    {cat.name}
                                </h2>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>{cat.description}</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '2rem' }}>
                                {visibleBadges.map((badge, idx) => {
                                    const unlocked = isUnlocked(badge, cat.id)
                                    
                                    return (
                                        <motion.div 
                                            key={badge.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className={`badge-card-container ${unlocked ? 'badge-unlocked' : 'badge-locked'}`}
                                        >
                                            <div className="badge-3d-wrapper">
                                                <div 
                                                    className={`badge-3d-base shape-${badge.shape}`}
                                                    style={{ background: `linear-gradient(135deg, ${badge.color1} 0%, ${badge.color2} 100%)` }}
                                                >
                                                    <div style={{ position: 'relative', zIndex: 5, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                                                        {cat.id === 'leaderboard' ? (
                                                            <div style={{ textAlign: 'center' }}>
                                                                <Trophy size={28} style={{ margin: '0 auto 4px' }} />
                                                                <div style={{ fontSize: '0.8rem', fontWeight: 900 }}>{badge.levelRoman}</div>
                                                            </div>
                                                        ) : (
                                                            badge.icon
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Lock Overlay */}
                                                {!unlocked && (
                                                    <div className="badge-lock-overlay">
                                                        <div style={{ width: 40, height: 40, background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                                            <Lock size={18} />
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Unlocked Sparkle */}
                                                {unlocked && (
                                                    <div style={{ position: 'absolute', top: -5, right: -5, background: '#10b981', color: 'white', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)', zIndex: 10 }}>
                                                        <Check size={14} strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>

                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                                {badge.title}
                                            </h3>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {badge.subtitle}
                                            </p>
                                            
                                            {/* Progress bar placeholder for locked items */}
                                            {!unlocked && (
                                                <div style={{ marginTop: '1rem', background: '#f1f5f9', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ width: '15%', background: '#cbd5e1', height: '100%' }}></div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )
                                })}
                            </div>
                        </motion.div>
                    )
                })}
            </AnimatePresence>
        </div>
    )
}
