import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Trophy, Medal, Award, Star, Zap, ChevronRight, User, Search, TrendingUp } from 'lucide-react'

export default function Leaderboard() {
    const { profile } = useAuth()
    const [leaderboard, setLeaderboard] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => {
        fetchLeaderboard()
    }, [])

    const getRankInfo = (xp) => {
        const tiers = [
            { name: 'Iron', color: '#94a3b8', base: 0, step: 200, bg: 'rgba(148,163,184,0.1)' },
            { name: 'Bronze', color: '#b45309', base: 1000, step: 200, bg: 'rgba(180,83,9,0.1)' },
            { name: 'Silver', color: '#64748b', base: 2000, step: 300, bg: 'rgba(100,116,139,0.1)' },
            { name: 'Gold', color: '#f59e0b', base: 3500, step: 800, bg: 'rgba(245,158,11,0.1)' },
            { name: 'Diamond', color: '#a855f7', base: 7500, step: 1000, bg: 'rgba(168,85,247,0.1)' }
        ]

        let currentTier = tiers[0]
        for (let i = tiers.length - 1; i >= 0; i--) {
            if (xp >= tiers[i].base) {
                currentTier = tiers[i]
                break
            }
        }

        const xpInTier = xp - currentTier.base
        const levelNum = Math.min(5, Math.floor(xpInTier / currentTier.step) + 1)
        const romanLevels = ['I', 'II', 'III', 'IV', 'V']
        
        return { 
            name: `${currentTier.name} ${romanLevels[Math.max(0, levelNum - 1)]}`, 
            color: currentTier.color, 
            bg: currentTier.bg 
        }
    }

    async function fetchLeaderboard() {
        try {
            setLoading(true)
            // 1. Fetch all students
            const { data: students } = await supabase
                .from('users')
                .select('id, name, avatar_url')
                .eq('role', 'student')
            
            // 2. Fetch all coding submissions
            const { data: codingSubs } = await supabase
                .from('coding_submissions')
                .select('student_id, score')
                .eq('status', 'accepted')
            
            // 3. Fetch all assessment submissions
            const { data: assessSubs } = await supabase
                .from('assessment_submissions')
                .select('student_id, score')

            // Aggregate XP
            const xpMap = {}
            codingSubs?.forEach(s => {
                xpMap[s.student_id] = (xpMap[s.student_id] || 0) + (s.score || 0)
            })
            assessSubs?.forEach(s => {
                xpMap[s.student_id] = (xpMap[s.student_id] || 0) + (s.score || 0)
            })

            const leaderboardData = (students || []).map(s => ({
                ...s,
                xp: xpMap[s.id] || 0,
                ...getRankInfo(xpMap[s.id] || 0)
            })).sort((a, b) => b.xp - a.xp)

            setLeaderboard(leaderboardData)
        } catch (err) {
            console.error('Error fetching leaderboard:', err)
        } finally {
            setLoading(false)
        }
    }

    const filteredLeaderboard = leaderboard.filter(s => 
        s.name?.toLowerCase().includes(search.toLowerCase())
    )

    const topThree = leaderboard.slice(0, 3)
    const others = filteredLeaderboard.slice(0, 50) // Show top 50 in the list

    return (
        <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1.25rem', background: 'rgba(99,102,241,0.1)', borderRadius: '100px', color: 'var(--accent)', marginBottom: '1rem', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <Trophy size={18} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>GLOBAL RANKINGS</span>
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>League of <span className="gradient-text">Champions</span></h1>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>Climb the ranks by solving challenges and acing assessments. Every point counts!</p>
            </div>

            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}><div className="spinner"></div></div>
            ) : (
                <>
                    {/* Podium */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '1rem', marginBottom: '4rem', marginTop: '1rem' }}>
                        {/* 2nd Place */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <div style={{ width: 70, height: 70, borderRadius: '50%', border: '4px solid #94a3b8', padding: 2 }}>
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9' }}>
                                        {topThree[1]?.avatar_url ? <img src={topThree[1].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={40} style={{ margin: '15px auto', color: '#94a3b8' }} />}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', background: '#94a3b8', color: 'white', padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800 }}>#2</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{topThree[1]?.name?.split(' ')[0]}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8' }}>{topThree[1]?.xp || 0} XP</div>
                            </div>
                        </div>

                        {/* 1st Place */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'scale(1.15)', zIndex: 5 }}>
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <Trophy size={28} color="#f59e0b" style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)' }} />
                                <div style={{ width: 90, height: 90, borderRadius: '50%', border: '4px solid #f59e0b', padding: 2 }}>
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fffbeb' }}>
                                        {topThree[0]?.avatar_url ? <img src={topThree[0].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={50} style={{ margin: '20px auto', color: '#f59e0b' }} />}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: 'white', padding: '4px 12px', borderRadius: 10, fontSize: '0.8rem', fontWeight: 800 }}>#1</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{topThree[0]?.name?.split(' ')[0]}</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>{topThree[0]?.xp || 0} XP</div>
                            </div>
                        </div>

                        {/* 3rd Place */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <div style={{ width: 70, height: 70, borderRadius: '50%', border: '4px solid #b45309', padding: 2 }}>
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fff7ed' }}>
                                        {topThree[2]?.avatar_url ? <img src={topThree[2].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={40} style={{ margin: '15px auto', color: '#b45309' }} />}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', background: '#b45309', color: 'white', padding: '2px 8px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 800 }}>#3</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{topThree[2]?.name?.split(' ')[0]}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b45309' }}>{topThree[2]?.xp || 0} XP</div>
                            </div>
                        </div>
                    </div>

                    {/* Search & List */}
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', flex: 1, maxWidth: '400px' }}>
                                <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem' }} />
                                <input 
                                    type="text"
                                    placeholder="Find a champion..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.75rem', borderRadius: 12, border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
                                <TrendingUp size={16} />
                                Active Players
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Rank</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Student</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tier</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Total XP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {others.map((s, i) => {
                                        const rank = leaderboard.findIndex(item => item.id === s.id) + 1
                                        const isCurrentUser = s.id === profile.id
                                        return (
                                            <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: isCurrentUser ? 'rgba(99,102,241,0.05)' : 'white' }}>
                                                <td style={{ padding: '1rem 1.5rem' }}>
                                                    <div style={{ 
                                                        width: 28, 
                                                        height: 28, 
                                                        borderRadius: '50%', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 800,
                                                        background: rank <= 3 ? (rank === 1 ? '#fff7e6' : rank === 2 ? '#f1f5f9' : '#fff7ed') : 'transparent',
                                                        color: rank === 1 ? '#f59e0b' : rank === 2 ? '#64748b' : rank === 3 ? '#b45309' : 'var(--text-muted)'
                                                    }}>
                                                        {rank}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9' }}>
                                                            {s.avatar_url ? <img src={s.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} style={{ margin: '8px auto', color: 'var(--text-muted)' }} />}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                                {s.name} {isCurrentUser && <span style={{ fontSize: '0.7rem', color: 'var(--accent)', marginLeft: '0.5rem', fontWeight: 800, textTransform: 'uppercase' }}>(You)</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem' }}>
                                                    <div style={{ 
                                                        display: 'inline-flex', 
                                                        alignItems: 'center', 
                                                        gap: '0.4rem', 
                                                        padding: '0.25rem 0.75rem', 
                                                        borderRadius: 100, 
                                                        background: s.bg, 
                                                        color: s.color,
                                                        fontSize: '0.75rem',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
                                                        {s.name}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                                    {s.xp.toLocaleString()}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
