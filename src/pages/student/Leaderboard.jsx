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

        // Subscribe to real-time updates for submissions
        const codingChannel = supabase
            .channel('lb-coding-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'coding_submissions' }, () => fetchLeaderboard())
            .subscribe()

        const assessChannel = supabase
            .channel('lb-assess-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'assessment_submissions' }, () => fetchLeaderboard())
            .subscribe()

        return () => {
            supabase.removeChannel(codingChannel)
            supabase.removeChannel(assessChannel)
        }
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
            rankName: `${currentTier.name} ${romanLevels[Math.max(0, levelNum - 1)]}`, 
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
            })).sort((a, b) => (b.xp - a.xp) || (a.name || '').localeCompare(b.name || ''))

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
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1.25rem', background: 'rgba(99,102,241,0.1)', borderRadius: '100px', color: 'var(--accent)', marginBottom: '1rem', border: '1px solid rgba(99,102,241,0.2)', position: 'relative' }}>
                    <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', position: 'relative' }}>
                        <div className="pulse-dot" style={{ position: 'absolute', inset: 0, background: '#10b981', borderRadius: '50%', opacity: 0.6 }}></div>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em' }}>LIVE RANKINGS</span>
                </div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>League of <span className="gradient-text">Champions</span></h1>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>Watch the board update in real-time as champions rise. Every point counts!</p>
                <style>{`
                    @keyframes pulse {
                        0% { transform: scale(1); opacity: 0.6; }
                        100% { transform: scale(3); opacity: 0; }
                    }
                    .pulse-dot { animation: pulse 2s infinite; }
                `}</style>
            </div>

            {profile?.role === 'student' && !loading && (
                <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '3rem', borderLeft: '4px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Trophy size={24} color="var(--accent)" />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Your Current Standing</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                Rank #{leaderboard.findIndex(s => s.id === profile.id) + 1} <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>Global</span>
                            </div>
                        </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Experience</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }}>{(leaderboard.find(s => s.id === profile.id)?.xp || 0).toLocaleString()} XP</div>
                    </div>
                </div>
            )}

            {loading ? (
                <div style={{ padding: '4rem', textAlign: 'center' }}><div className="spinner"></div></div>
            ) : (
                <>
                    {/* Podium */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '2rem', marginBottom: '4rem', marginTop: '2rem', padding: '1rem', background: 'radial-gradient(circle at center, rgba(99,102,241,0.05) 0%, transparent 70%)' }}>
                        {/* 2nd Place */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.3s ease' }} className="podium-hover">
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <div style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid #94a3b8', padding: 2, boxShadow: '0 0 20px rgba(148,163,184,0.3)' }}>
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9' }}>
                                        {topThree[1]?.avatar_url ? <img src={topThree[1].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={45} style={{ margin: '15px auto', color: '#94a3b8' }} />}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', background: '#94a3b8', color: 'white', padding: '2px 12px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 900, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>#2</div>
                                <Medal size={24} color="#94a3b8" style={{ position: 'absolute', top: -15, right: -10 }} />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{topThree[1]?.name || '---'}</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' }}>{topThree[1]?.xp || 0} XP</div>
                            </div>
                        </div>

                        {/* 1st Place */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'scale(1.2) translateY(-20px)', zIndex: 5, transition: 'transform 0.3s ease' }} className="podium-hover">
                            <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
                                <Trophy size={36} color="#f59e0b" style={{ position: 'absolute', top: -45, left: '50%', transform: 'translateX(-50%)', filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.5))' }} />
                                <div style={{ width: 100, height: 100, borderRadius: '50%', border: '5px solid #f59e0b', padding: 3, boxShadow: '0 0 30px rgba(245,158,11,0.4)', background: 'white' }}>
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fffbeb' }}>
                                        {topThree[0]?.avatar_url ? <img src={topThree[0].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={55} style={{ margin: '20px auto', color: '#f59e0b' }} />}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)', background: '#f59e0b', color: 'white', padding: '4px 16px', borderRadius: 12, fontSize: '0.9rem', fontWeight: 900, boxShadow: '0 4px 15px rgba(245,158,11,0.3)' }}>#1</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{topThree[0]?.name || '---'}</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f59e0b' }}>{topThree[0]?.xp || 0} XP</div>
                            </div>
                        </div>

                        {/* 3rd Place */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'transform 0.3s ease' }} className="podium-hover">
                            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                                <div style={{ width: 80, height: 80, borderRadius: '50%', border: '4px solid #b45309', padding: 2, boxShadow: '0 0 20px rgba(180,83,9,0.2)' }}>
                                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: '#fff7ed' }}>
                                        {topThree[2]?.avatar_url ? <img src={topThree[2].avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={45} style={{ margin: '15px auto', color: '#b45309' }} />}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', background: '#b45309', color: 'white', padding: '2px 12px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 900, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>#3</div>
                                <Award size={24} color="#b45309" style={{ position: 'absolute', top: -15, left: -10 }} />
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{topThree[2]?.name || '---'}</div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#b45309' }}>{topThree[2]?.xp || 0} XP</div>
                            </div>
                        </div>
                    </div>

                    <style>{`
                        .podium-hover:hover { transform: translateY(-5px) !important; }
                    `}</style>

                    {/* Search & List */}
                    <div className="glass-card" style={{ padding: '0', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative', flex: 1, maxWidth: '400px' }}>
                                <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem' }} />
                                <input 
                                    type="text"
                                    placeholder="Search for a champion..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: 12, border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.9rem', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 700 }}>
                                <TrendingUp size={16} color="var(--accent)" />
                                LIVE ACTIVITY
                            </div>
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', background: '#f8fafc' }}>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rank</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Champion</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>League Tier</th>
                                        <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Total XP</th>
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
                                                        {s.rankName}
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
