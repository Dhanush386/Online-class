import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import {
  Clock, BookOpen, Trophy, Award, Code as CodeIcon, ChevronRight,
  Flame, Star, ArrowRight, Zap, CheckCircle, Calendar,
  TrendingUp, Sparkles, ShieldCheck, Play, RefreshCw, BarChart2, Coins
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend, RadialBarChart, RadialBar
} from 'recharts'
import { GlassCard, Avatar } from '../../design-system'
import XpTimeline from '../../components/student/XpTimeline'
import DailyPlanner from '../../components/student/DailyPlanner'
import useXpAward from '../../hooks/useXpAward'

export default function StudentDashboard() {
  const { profile, stats } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useXpAward()

  // Dashboard states
  const [kpis, setKpis] = useState({
    level: 1,
    xp: 0,
    leaderboardRank: 0,
    totalStudents: 1,
    streak: 0,
    avgCompletion: 0,
    avgAssessment: 0,
    attendanceRate: 0,
    rankName: 'Iron I',
    rankColor: 'var(--text-muted)'
  })

  const [weeklyActivity, setWeeklyActivity] = useState([])
  const [learningConsistency, setLearningConsistency] = useState([])

  const [topLeaderboard, setTopLeaderboard] = useState([])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (profile?.id) {
      loadDashboardAnalytics()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, stats])

  const loadDashboardAnalytics = async () => {
    setLoading(true)
    try {
      const studentXp = stats?.xp || 0
      const studentStreak = stats?.streak || 0

      const currentLevel = Math.max(1, Math.floor(studentXp / 1000) + 1)
      const rank_name = stats?.rankName || 'Iron I'
      const rank_color = stats?.rankColor || '#94a3b8'

      const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      // Define parallel queries
      const enrollmentsPromise = supabase.from('enrollments').select('course_id').eq('student_id', profile.id)
      const progressPromise = supabase.from('progress').select('completion_percentage').eq('student_id', profile.id)
      const submissionsPromise = supabase.from('assessment_submissions').select('score, total_questions, created_at, assessments(title)').eq('student_id', profile.id).order('created_at', { ascending: true })
      const upcomingVideosPromise = supabase.from('videos').select('id, title, scheduled_time, duration_minutes, courses(title)').gte('scheduled_time', new Date().toISOString()).order('scheduled_time', { ascending: true }).limit(2)
      const pastVideosPromise = supabase.from('videos').select('id').lte('scheduled_time', new Date().toISOString())
      const attendedCountPromise = supabase.from('live_attendance').select('*', { count: 'exact', head: true }).eq('student_id', profile.id).eq('attendance_status', 'present')
      const codingSubsPromise = supabase.from('coding_submissions').select('score, created_at, status').eq('student_id', profile.id).gte('created_at', sevenDaysAgoStr)
      const liveAttPromise = supabase.from('live_attendance').select('joined_at').eq('student_id', profile.id).eq('attendance_status', 'present').gte('joined_at', sevenDaysAgoStr)
      const leaderboardPromise = supabase.from('users').select('id, name, xp').eq('role', 'student').order('xp', { ascending: false })

      // Execute all queries concurrently
      const [
        _enrollmentsRes, progressRes, submissionsRes, upcomingVideosRes, pastVideosRes,
        attendedCountRes, codingSubsRes, liveAttRes, leaderboardRes
      ] = await Promise.all([
        enrollmentsPromise, progressPromise, submissionsPromise, upcomingVideosPromise, pastVideosPromise,
        attendedCountPromise, codingSubsPromise, liveAttPromise, leaderboardPromise
      ])

      const progress = progressRes.data || []
      const subs = submissionsRes.data || []
      const scheduleData = upcomingVideosRes.data || []
      const pastClassesCount = pastVideosRes.data?.length || 0
      const attendedCount = attendedCountRes.count || 0
      const codingSubs = codingSubsRes.data || []
      const liveAtt = liveAttRes.data || []
      const allStudents = (leaderboardRes.data || []).sort((a, b) => {
        const xpA = a.xp || 0;
        const xpB = b.xp || 0;
        if (xpB !== xpA) return xpB - xpA;
        return (a.name || '').localeCompare(b.name || '');
      })

      // --- CALCULATIONS ---

      // Course Completion %
      const avgComp = progress.length > 0
        ? Math.round(progress.reduce((sum, p) => sum + (p.completion_percentage || 0), 0) / progress.length)
        : 0

      // Assessment Average
      let totalAssScore = 0
      let validAss = 0
      const formattedScores = []
      subs.forEach(s => {
        if (s.total_questions > 0) {
          const pct = (s.score / s.total_questions) * 100
          totalAssScore += pct
          validAss++
          formattedScores.push({ name: s.assessments?.title?.substring(0, 10) || 'Quiz', Score: Math.round(pct) })
        }
      })
      const avgAss = validAss > 0 ? Math.round(totalAssScore / validAss) : 0
      setAssessmentScores(formattedScores.slice(-6))

      // Attendance %
      const avgAtt = pastClassesCount > 0 ? Math.round((attendedCount / pastClassesCount) * 100) : 100

      // Leaderboard
      const myRankIndex = allStudents.findIndex(u => u.id === profile.id)
      const myRank = myRankIndex >= 0 ? myRankIndex + 1 : allStudents.length
      setTopLeaderboard(allStudents.slice(0, 5))

      setKpis({
        level: currentLevel,
        xp: studentXp,
        leaderboardRank: myRank,
        totalStudents: allStudents.length || 1,
        streak: studentStreak,
        avgCompletion: avgComp,
        avgAssessment: avgAss,
        attendanceRate: avgAtt,
        rankName: rank_name,
        rankColor: rank_color
      })

      setSchedule(scheduleData)

      // Weekly Activity & Consistency
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const activityMap = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        activityMap[days[d.getDay()]] = 0
      }

      codingSubs.forEach(sub => {
        if (sub.status === 'accepted') {
          const dayLabel = days[new Date(sub.created_at).getDay()]
          if (activityMap[dayLabel] !== undefined) activityMap[dayLabel] += (sub.score || 10)
        }
      })

      liveAtt.forEach(att => {
        const dayLabel = days[new Date(att.joined_at).getDay()]
        if (activityMap[dayLabel] !== undefined) activityMap[dayLabel] += 20
      })

      // We combine assessment xp too if we had it, but this is good enough for overall XP.
      const weeklyActivityData = Object.entries(activityMap).map(([day, xp]) => ({ day, XP: xp }))
      setWeeklyActivity(weeklyActivityData)

      // Learning consistency maps directly to weekly activity but scaled
      const maxXP = Math.max(...weeklyActivityData.map(d => d.XP), 1)
      setLearningConsistency(weeklyActivityData.map(d => ({ day: d.day, intensity: (d.XP / maxXP) * 100 })))

    } catch (err) {
      console.error('Failed to load student dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const getUnlockedBadges = () => {
    if (profile?.role === 'organizer' || profile?.role === 'main_admin') {
      return [
        { icon: '🏆', name: 'Top Achiever', locked: false },
        { icon: '💻', name: 'Coding Master', locked: false },
        { icon: '✨', name: 'Perfect Attendance', locked: false },
        { icon: '🔥', name: '7-Day Streak', locked: false }
      ]
    }
    const list = []
    const studentXp = stats?.xp || 0
    const studentStreak = stats?.streak || 0
    const solvedCount = stats?.solved || 0

    if (studentStreak >= 7) list.push({ icon: '🔥', name: '7-Day Streak' })
    if (studentXp >= 1000) list.push({ icon: '🏆', name: 'Top Achiever' })
    if (kpis.attendanceRate >= 95) list.push({ icon: '✨', name: 'Perfect Attendance' })
    if (solvedCount >= 20) list.push({ icon: '💻', name: 'Coding Master' })

    const result = [...list]
    const defaultLocked = [
      { icon: '⭐', name: 'XP Beginner', locked: true },
      { icon: '🔥', name: 'Momentum', locked: true },
      { icon: '💻', name: 'Code Starter', locked: true }
    ]

    while (result.length < 4) {
      const nextDefault = defaultLocked.find(d => !result.some(r => r.name === d.name))
      if (nextDefault) result.push(nextDefault)
      else result.push({ icon: '🔒', name: 'Locked', locked: true })
    }

    return result.slice(0, 4)
  }

  const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }
  const itemVariants = { hidden: { opacity: 0, y: 15 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } } }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--text-secondary)' }}>
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <div>Loading your learning analytics...</div>
      </div>
    )
  }

  const currentXpInLevel = kpis.xp % 1000
  const levelProgressPct = Math.round((currentXpInLevel / 1000) * 100)

  // Color coding for Course Completion
  const getCompletionColor = (pct) => {
    if (pct < 40) return '#ef4444' // Red
    if (pct < 70) return '#eab308' // Yellow
    return '#22c55e' // Green
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ padding: '1rem 0', maxWidth: 1400, margin: '0 auto' }}>

      {/* Welcome banner */}
      <motion.div variants={itemVariants} style={{ marginBottom: '1.5rem' }}>
        <GlassCard
          tilt3d={true}
          padding="1.75rem 2rem"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08))',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem'
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              Welcome back, <span className="gradient-text">{profile?.name?.split(' ')[0] || 'Learner'}</span>!
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Your learning journey is accelerating. Keep up the great work!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.85rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🔥 {kpis.streak}d Streak
            </span>
          </div>
        </GlassCard>
      </motion.div>

      {/* 2-Column Dashboard Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2.5fr 1fr', gap: '1.5rem' }}>
        
        {/* LEFT COLUMN: Activity & Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Row 3: Main Charts (Activity & Consistency) */}
          <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: '1.5rem' }}>

            {/* Weekly Learning Activity Area Chart */}
            <GlassCard tilt3d={true} style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <TrendingUp size={18} color="#8b5cf6" /> Weekly Learning Activity
              </h3>
              <div style={{ width: '100%', height: 220, flex: 1, minWidth: 0, minHeight: 0 }}>
                <ResponsiveContainer width="99%" height={220}>
                  <AreaChart data={weeklyActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="xpGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white' }} />
                    <Area type="monotone" dataKey="XP" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#xpGlow)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            {/* Learning Consistency Widget */}
            <GlassCard tilt3d={true} style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart2 size={18} color="#06b6d4" /> Learning Consistency
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', flex: 1, justifyContent: 'center' }}>
                {learningConsistency.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 30, fontSize: '0.85rem', color: '#94a3b8', fontWeight: 700 }}>{item.day}</div>
                    <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(2, item.intensity)}%`, height: '100%', background: item.intensity > 0 ? '#06b6d4' : 'transparent', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

          </motion.div>

          {/* Row 4: Achievements & Leaderboard */}
          <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap: '1.5rem' }}>

            {/* Top Achievements Showcase */}
            <GlassCard tilt3d={true}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🏅 Top Achievements
                </h3>
                <Link to="/student/achievements" style={{ fontSize: '0.85rem', color: '#8b5cf6', textDecoration: 'none', fontWeight: 600 }}>
                  View All
                </Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', justifyItems: 'center' }}>
                {getUnlockedBadges().map((badge, i) => (
                  <BadgeBox key={i} icon={badge.icon} name={badge.name} active={!badge.locked} />
                ))}
              </div>
            </GlassCard>

            {/* Mini Leaderboard Widget */}
            <GlassCard tilt3d={true} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🌍 Global Leaderboard
                </h3>
                <Link to="/student/leaderboard" style={{ fontSize: '0.85rem', color: '#8b5cf6', textDecoration: 'none', fontWeight: 600 }}>
                  Full Rank
                </Link>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {topLeaderboard.map((user, i) => (
                  <div key={user.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: user.id === profile.id ? 'rgba(139,92,246,0.1)' : 'transparent', borderRadius: 8, border: user.id === profile.id ? '1px solid rgba(139,92,246,0.2)' : '1px solid transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: i < 3 ? '#f59e0b' : '#94a3b8', width: 20 }}>#{i + 1}</span>
                      <span style={{ fontSize: '0.85rem', color: 'white', fontWeight: user.id === profile.id ? 800 : 500 }}>{user.id === profile.id ? 'You' : user.name.split(' ')[0]}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: '#8b5cf6', fontWeight: 700 }}>{user.xp.toLocaleString()} XP</span>
                  </div>
                ))}
              </div>
            </GlassCard>

          </motion.div>

        </div>

        {/* RIGHT COLUMN: All KPIs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <motion.div variants={itemVariants}>
            <GlassCard tilt3d={true} padding="1.25rem" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>🎮</div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Current Level</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'white' }}>Level {kpis.level}</div>
                  </div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
                  <span>{currentXpInLevel} / 1000 XP</span>
                  <span>{1000 - currentXpInLevel} XP to Lv {kpis.level + 1}</span>
                </div>
                <div style={{ height: 6, width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${levelProgressPct}%`, height: '100%', background: '#8b5cf6' }} />
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div variants={itemVariants}>
            <KPIStudentCard icon="⭐" title="Total XP" value={kpis.xp.toLocaleString()} subtitle={`Standing: ${kpis.rankName}`} color="#f59e0b" />
          </motion.div>

          <motion.div variants={itemVariants}>
            <KPIStudentCard
              icon="👑"
              title="Leaderboard Rank"
              value={`#${kpis.leaderboardRank}`}
              subtitle={`Top ${Math.max(1, Math.round((kpis.leaderboardRank / kpis.totalStudents) * 100))}% of students`}
              color="#a855f7"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <KPIStudentCard
              icon="🔥"
              title="Coding Streak"
              value={`${kpis.streak} Days`}
              subtitle="Keep the flame going"
              color="#ef4444"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <KPIStudentCard
              icon="📶"
              title="Attendance Rate"
              value={`${kpis.attendanceRate}%`}
              subtitle="Live class presence"
              color="#06b6d4"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <KPIStudentCard
              icon="🏆"
              title="Course Completion"
              value={`${kpis.avgCompletion}%`}
              subtitle="Overall progress average"
              color={getCompletionColor(kpis.avgCompletion)}
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <KPIStudentCard
              icon="🎯"
              title="Assessment Avg"
              value={`${kpis.avgAssessment}%`}
              subtitle="Average quiz score"
              color="#10b981"
            />
          </motion.div>
        </div>

      </div>
    </motion.div>
  )
}

function KPIStudentCard({ icon, title, value, subtitle, color }) {
  return (
    <GlassCard
      tilt3d={true}
      padding="1.25rem"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: `rgba(${hexToRgb(color)}, 0.1)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem'
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{title}</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: color || 'white', marginTop: '2px' }}>{value}</div>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>{subtitle}</div>
      </div>
    </GlassCard>
  )
}

function hexToRgb(hex) {
  if (!hex) return '255,255,255';
  let c = hex.substring(1).split('');
  if (c.length === 3) {
    c = [c[0], c[0], c[1], c[1], c[2], c[2]];
  }
  c = '0x' + c.join('');
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255].join(',');
}

function BadgeBox({ icon, name, active }) {
  return (
    <div style={{ textAlign: 'center', opacity: active ? 1 : 0.3 }}>
      <div style={{
        width: 52,
        height: 52,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
        margin: '0 auto'
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '0.85rem', color: active ? 'white' : '#94a3b8', fontWeight: 700, marginTop: '6px', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </div>
    </div>
  )
}
