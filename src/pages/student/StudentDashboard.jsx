import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Clock, BookOpen, Trophy, Award, Code as CodeIcon, ChevronRight,
  Flame, Star, Bell, Globe, ArrowRight, Zap, CheckCircle, Calendar,
  TrendingUp, Target, Sparkles
} from 'lucide-react'
import { subscribeToPush, checkPushSubscription } from '../../utils/pushService'
import { useToast } from '../../components/Toast'
import { getLevelProgress, getTierForXP } from '../../constants/ranks'
import { StatCard, GlassCard, ProgressRing, Avatar } from '../../design-system'

// Greeting based on time of day
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

// Motivational messages
const MOTIVATIONS = [
  "Every expert was once a beginner. Keep going! 🚀",
  "Consistency beats talent. Show up every day. 🔥",
  "You're building a skill set that will last a lifetime. 💡",
  "Small progress every day adds up to big results. ⭐",
  "Learning is the only thing that compounds. 📈",
]

export default function StudentDashboard() {
  const { profile, stats } = useAuth()
  const toast    = useToast()
  const navigate = useNavigate()

  const [data,         setData]         = useState({ courses: 0, completion: 0, timeSpent: 0, topics: 0 })
  const [loading,      setLoading]      = useState(true)
  const [isSubscribed, setIsSubscribed] = useState(true)
  const [schedule,     setSchedule]     = useState([])
  const [topStudents,  setTopStudents]  = useState([])
  const [motivation]   = useState(MOTIVATIONS[Math.floor(Math.random() * MOTIVATIONS.length)])

  const xp       = stats?.xp       || 0
  const streak   = stats?.streak   || 0
  const rankName = stats?.rankName || 'Iron I'
  const rankColor= stats?.rankColor || 'var(--text-muted)'
  const levelProgress = getLevelProgress(xp)

  useEffect(() => {
    fetchDashboardData()
    checkSubscription()
    fetchSchedule()
    fetchTopStudents()
  }, [profile?.id])

  async function checkSubscription() {
    try { setIsSubscribed(await checkPushSubscription()) } catch {}
  }

  async function handleEnableNotifications() {
    try {
      const sub = await subscribeToPush(profile.id)
      if (sub) { setIsSubscribed(true); toast.success('Notifications enabled!') }
    } catch { toast.error('Could not enable notifications.') }
  }

  async function fetchDashboardData() {
    if (!profile?.id) return
    try {
      const { data: rawEnrollments } = await supabase
        .from('enrollments').select('course_id, courses(start_date)').eq('student_id', profile.id)

      const seen = new Set()
      const enrollments = (rawEnrollments || []).filter(e => {
        if (!e.courses || seen.has(e.course_id)) return false
        const started = !e.courses.start_date || new Date(e.courses.start_date) <= new Date()
        if (started) { seen.add(e.course_id); return true }
        return false
      })

      const { data: progress } = await supabase.from('progress').select('completion_percentage, time_spent_minutes').eq('student_id', profile.id)
      const avgComp  = progress?.length ? Math.round(progress.reduce((s, p) => s + (p.completion_percentage || 0), 0) / progress.length) : 0
      const totalTime = progress?.reduce((s, p) => s + (p.time_spent_minutes || 0), 0) || 0
      setData({ courses: enrollments.length, completion: avgComp, timeSpent: totalTime, topics: enrollments.length * 5 })
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  async function fetchSchedule() {
    if (!profile?.id) return
    try {
      // Use videos table (which exists) for upcoming scheduled classes
      const { data, error } = await supabase
        .from('videos')
        .select('id, title, scheduled_time, duration_minutes, courses(title)')
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(3)
      if (!error) setSchedule(data || [])
    } catch {}
  }

  const getRankInfo = (xp) => {
    const tiers = [
      { name: 'Iron', color: 'var(--text-muted)', base: 0, step: 200 },
      { name: 'Bronze', color: '#b45309', base: 1000, step: 200 },
      { name: 'Silver', color: 'var(--text-muted)', base: 2000, step: 300 },
      { name: 'Gold', color: '#f59e0b', base: 3500, step: 800 },
      { name: 'Diamond', color: '#a855f7', base: 7500, step: 1000 }
    ]
    let currentTier = tiers[0]
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (xp >= tiers[i].base) { currentTier = tiers[i]; break }
    }
    const xpInTier = xp - currentTier.base
    const levelNum = Math.min(5, Math.floor(xpInTier / currentTier.step) + 1)
    const romanLevels = ['I', 'II', 'III', 'IV', 'V']
    return { 
      rank_name: `${currentTier.name} ${romanLevels[Math.max(0, levelNum - 1)]}`, 
      rank_color: currentTier.color
    }
  }

  async function fetchTopStudents() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, xp, avatar_url')
        .eq('role', 'student')
        .order('xp', { ascending: false })
        .order('name', { ascending: true })
        .limit(3)
      
      if (!error && data) {
        setTopStudents(data.map(s => ({
          ...s,
          xp: s.xp || 0,
          ...getRankInfo(s.xp || 0)
        })))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const timeHrs = Math.floor((data.timeSpent || 0) / 60)

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.07 } },
  }
  const itemVariants = {
    hidden:  { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ maxWidth: 1280 }}>

      {/* ══════════════ HERO WELCOME ══════════════ */}
      <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
        <GlassCard
          tilt3d
          padding="1.75rem 2rem"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(139,92,246,0.05) 50%, rgba(16,185,129,0.04) 100%)',
            border: '1px solid rgba(99,102,241,0.15)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background decoration */}
          <div aria-hidden style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12), transparent 70%)', pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'absolute', bottom: -20, left: '40%', width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.08), transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{getGreeting()} 👋</div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
                Welcome back,{' '}
                <span className="gradient-text">{profile?.name?.split(' ')[0] || 'Learner'}</span>!
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                {motivation}
              </p>

              {/* Gamification chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span className="xp-chip xp-chip-streak">
                  <Flame size={14} fill={streak > 0 ? 'currentColor' : 'none'} />
                  {streak > 0 ? `${streak} Day Streak 🔥` : 'Start your streak!'}
                </span>
                <span className="xp-chip xp-chip-xp">
                  <Star size={14} fill="currentColor" /> {xp.toLocaleString()} XP
                </span>
                <span className="xp-chip xp-chip-rank" style={{ color: rankColor, background: `${rankColor}18`, borderColor: `${rankColor}30` }}>
                  <Trophy size={14} /> {rankName}
                </span>
              </div>
            </div>

            {/* XP Progress Ring */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
              <ProgressRing value={levelProgress} size={100} stroke={6} color={rankColor} label="Level" />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {levelProgress < 100
                    ? `${100 - levelProgress}% to next rank`
                    : 'Rank maxed! 🎉'}
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Push notification banner */}
      {!isSubscribed && (
        <motion.div variants={itemVariants} style={{ marginBottom: '1.5rem' }}>
          <GlassCard padding="1rem 1.25rem" style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Bell size={18} color="#6366f1" />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>Enable Push Notifications</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Get real-time alerts for live classes and announcements.</div>
              </div>
            </div>
            <button onClick={handleEnableNotifications} className="btn-primary" style={{ fontSize: '0.82rem', padding: '0.55rem 1.1rem', flexShrink: 0 }}>
              Enable <ArrowRight size={14} />
            </button>
          </GlassCard>
        </motion.div>
      )}

      {/* ══════════════ STATS ROW ══════════════ */}
      <motion.div variants={itemVariants} className="stat-grid" style={{ marginBottom: '1.75rem' }}>
        <StatCard icon={BookOpen}   label="Courses Enrolled" value={data.courses}    color="primary" suffix="" isLoading={loading} />
        <StatCard icon={TrendingUp} label="Avg Completion"   value={data.completion} color="success" suffix="%" isLoading={loading} />
        <StatCard icon={Clock}      label="Hours Learned"    value={timeHrs}         color="violet"  suffix="h" isLoading={loading} />
        <StatCard icon={Flame}      label="Day Streak"        value={streak}          color="warning" isLoading={loading} />
      </motion.div>

      {/* ══════════════ MAIN GRID ══════════════ */}
      <div className="dashboard-grid">
        {/* ── Left Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <GlassCard padding="1.25rem">
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem', letterSpacing: '-0.01em' }}>
                Quick Actions
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                {[
                  { icon: BookOpen,  label: 'My Courses',    path: '/student/courses',     color: '#6366f1' },
                  { icon: CodeIcon,  label: 'Coding',        path: '/student/coding',       color: '#8b5cf6' },
                  { icon: CheckCircle, label: 'Assessments', path: '/student/assessments',  color: '#10b981' },
                  { icon: Globe,     label: 'Playground',    path: '/student/playground',   color: '#3b82f6' },
                ].map(({ icon: Icon, label, path, color }) => (
                  <Link key={path} to={path} style={{ textDecoration: 'none' }}>
                    <motion.div
                      whileHover={{ y: -2, scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                        padding: '1rem 0.75rem', borderRadius: 14,
                        background: `${color}0d`, border: `1px solid ${color}22`,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={18} color={color} />
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center' }}>{label}</span>
                    </motion.div>
                  </Link>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* Rank & Progress */}
          <motion.div variants={itemVariants}>
            <GlassCard tilt3d padding="1.5rem">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Trophy size={16} color={rankColor} /> Your Rank</span>
                </h3>
                <Link to="/student/leaderboard" style={{ fontSize: '0.78rem', color: 'var(--primary-500)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                  Leaderboard <ChevronRight size={13} />
                </Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
                  background: `${rankColor}18`, border: `2px solid ${rankColor}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 0 20px ${rankColor}25`,
                }}>
                  <Trophy size={32} color={rankColor} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 900, color: rankColor, lineHeight: 1, marginBottom: '0.3rem' }}>{rankName}</div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{xp.toLocaleString()} XP total</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div className="progress-bar-track" style={{ flex: 1 }}>
                      <div className="progress-bar-fill" style={{ width: `${levelProgress}%`, background: rankColor }} />
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{levelProgress}%</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Achievement badges */}
          <motion.div variants={itemVariants}>
            <GlassCard padding="1.5rem">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={16} color="#f59e0b" /> Career Badges
                </h3>
                <Link to="/student/achievements" style={{ fontSize: '0.78rem', color: 'var(--primary-500)', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-around' }}>
                {[
                  { icon: Trophy,    label: rankName.split(' ')[0], color: rankColor,  active: true },
                  { icon: CodeIcon,  label: `${stats?.problemsSolved || 0} Solved`, color: '#6366f1', active: (stats?.problemsSolved || 0) > 0 },
                  { icon: Flame,     label: `${streak}d Streak`, color: '#f97316', active: streak >= 3 },
                ].map(({ icon: Icon, label, color, active }) => (
                  <div key={label} style={{ textAlign: 'center', opacity: active ? 1 : 0.35 }}>
                    <div className="hexagon-container-mini" style={{ color, margin: '0 auto' }}>
                      <div className="hexagon-mini"><div className="hexagon-inner-mini"><Icon size={16} /></div></div>
                    </div>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, marginTop: 4, color: 'var(--text-secondary)' }}>{label}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* ── Right Column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Upcoming schedule */}
          <motion.div variants={itemVariants}>
            <GlassCard padding="1.25rem">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={15} color="var(--primary-500)" /> Upcoming
                </h3>
                <Link to="/student/courses" style={{ fontSize: '0.75rem', color: 'var(--primary-500)', textDecoration: 'none', fontWeight: 600 }}>View all</Link>
              </div>
              {schedule.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  <Calendar size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <div>No upcoming sessions</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {schedule.map(s => (
                    <div key={s.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', borderRadius: 10, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Calendar size={16} color="#6366f1" />
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{s.title || 'Live Session'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {new Date(s.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </motion.div>

          {/* Top students mini-leaderboard */}
          <motion.div variants={itemVariants}>
            <GlassCard padding="1.25rem">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Trophy size={15} color="#f59e0b" /> Top Learners
                </h3>
                <Link to="/student/leaderboard" style={{ fontSize: '0.75rem', color: 'var(--primary-500)', textDecoration: 'none', fontWeight: 600 }}>Full board</Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {topStudents.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem', borderRadius: 10, background: s.id === profile?.id ? 'rgba(99,102,241,0.06)' : 'transparent', border: s.id === profile?.id ? '1px solid rgba(99,102,241,0.15)' : '1px solid transparent' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#f59e0b' : i === 1 ? 'var(--text-muted)' : '#cd7c2f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <Avatar name={s.name} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{(s.xp || 0).toLocaleString()} XP</div>
                    </div>
                    <span className="xp-chip xp-chip-rank" style={{ fontSize: '0.62rem', color: s.rank_color || 'var(--text-muted)', background: `${s.rank_color || 'var(--text-muted)'}15`, borderColor: `${s.rank_color || 'var(--text-muted)'}25`, padding: '0.15rem 0.4rem' }}>
                      {(s.rank_name || 'Iron').split(' ')[0]}
                    </span>
                  </div>
                ))}
                {topStudents.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading rankings...</div>
                )}
              </div>
            </GlassCard>
          </motion.div>

          {/* AI insight card */}
          <motion.div variants={itemVariants}>
            <GlassCard padding="1.25rem" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))', border: '1px solid rgba(99,102,241,0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Sparkles size={16} color="#8b5cf6" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b5cf6' }}>AI Insight</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '0.875rem' }}>
                {streak >= 7
                  ? `🔥 Impressive! You've maintained a ${streak}-day streak. You're in the top 10% of learners. Keep it going!`
                  : xp > 500
                  ? `You've earned ${xp} XP so far. Complete an assessment today to boost your rank to ${rankName.replace('I', 'II')}.`
                  : `Start with completing a course module today. Even 15 minutes of daily learning leads to mastery. 💡`}
              </p>
              <Link to="/student/courses" style={{ textDecoration: 'none' }}>
                <button className="btn-primary" style={{ fontSize: '0.78rem', padding: '0.5rem 1rem' }}>
                  Continue Learning <ArrowRight size={13} />
                </button>
              </Link>
            </GlassCard>
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
