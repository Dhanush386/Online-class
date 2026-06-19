import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Clock, BookOpen, Trophy, Award, Code as CodeIcon, ChevronRight,
  Flame, Star, ArrowRight, Zap, CheckCircle, Calendar,
  TrendingUp, Sparkles, ShieldCheck, Play, RefreshCw
} from 'lucide-react'
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend, RadialBarChart, RadialBar 
} from 'recharts'
import { GlassCard, Avatar } from '../../design-system'
import { getLevelProgress } from '../../constants/ranks'

export default function StudentDashboard() {
  const { profile, stats } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  
  // Dashboard states
  const [kpis, setKpis] = useState({
    streak: 0,
    xp: 0,
    rank: 'Iron I',
    completedCourses: 0,
    rankColor: 'var(--text-muted)'
  })
  
  const [weeklyActivity, setWeeklyActivity] = useState([])
  const [attendanceRate, setAttendanceRate] = useState(94) // Default/calculated attendance
  const [assessmentScores, setAssessmentScores] = useState([])
  const [schedule, setSchedule] = useState([])
  const [nextMilestone, setNextMilestone] = useState({
    currentLevel: 1,
    nextLevel: 2,
    currentXp: 0,
    neededXp: 1000,
    progressPct: 0,
    nextBadge: 'Attendance Champion',
    badgeProgress: '2 classes remaining'
  })

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (profile?.id) {
      loadDashboardAnalytics()
    }
  }, [profile, stats])

  const loadDashboardAnalytics = async () => {
    setLoading(true)
    try {
      // 1. Fetch Student stats (streak, XP, etc.)
      const studentXp = stats?.xp || 0
      const studentStreak = stats?.streak || 0
      
      // Calculate level metrics dynamically
      const currentLevel = Math.max(1, Math.floor(studentXp / 1000) + 1)
      const nextLevel = currentLevel + 1
      const currentXpInLevel = studentXp % 1000
      const neededXpInLevel = 1000
      const levelProgressPct = Math.round((currentXpInLevel / neededXpInLevel) * 100)

      // Get rank name based on XP
      const rank_name = stats?.rankName || 'Iron I'
      const rank_color = stats?.rankColor || '#94a3b8'

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const sevenDaysAgoStr = sevenDaysAgo.toISOString()

      // Define all parallel queries
      const enrollmentsPromise = supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', profile.id)

      const progressPromise = supabase
        .from('progress')
        .select('completion_percentage')
        .eq('student_id', profile.id)

      const submissionsPromise = supabase
        .from('assessment_submissions')
        .select(`
          score,
          total_questions,
          created_at,
          assessments(title)
        `)
        .eq('student_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(5)

      const upcomingVideosPromise = supabase
        .from('videos')
        .select('id, title, scheduled_time, duration_minutes, courses(title)')
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(2)

      const pastVideosPromise = supabase
        .from('videos')
        .select('id')
        .lte('scheduled_time', new Date().toISOString())

      const attendedCountPromise = supabase
        .from('live_attendance')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', profile.id)
        .eq('attendance_status', 'present')

      const codingSubsPromise = supabase
        .from('coding_submissions')
        .select('score, created_at, status')
        .eq('student_id', profile.id)
        .gte('created_at', sevenDaysAgoStr)

      const liveAttPromise = supabase
        .from('live_attendance')
        .select('joined_at')
        .eq('student_id', profile.id)
        .eq('attendance_status', 'present')
        .gte('joined_at', sevenDaysAgoStr)

      // Execute all queries concurrently!
      const [
        enrollmentsRes,
        progressRes,
        submissionsRes,
        upcomingVideosRes,
        pastVideosRes,
        attendedCountRes,
        codingSubsRes,
        liveAttRes
      ] = await Promise.all([
        enrollmentsPromise,
        progressPromise,
        submissionsPromise,
        upcomingVideosPromise,
        pastVideosPromise,
        attendedCountPromise,
        codingSubsPromise,
        liveAttPromise
      ])

      if (enrollmentsRes.error) throw enrollmentsRes.error
      if (progressRes.error) throw progressRes.error
      if (submissionsRes.error) throw submissionsRes.error
      
      const enrollments = enrollmentsRes.data
      const progress = progressRes.data
      const subs = submissionsRes.data
      const scheduleData = upcomingVideosRes.data
      const pastClasses = pastVideosRes.data
      const attendedCount = attendedCountRes.count
      const codingSubs = codingSubsRes.data
      const liveAtt = liveAttRes.data

      const completedCount = (progress || []).filter(p => p.completion_percentage === 100).length

      const formattedScores = (subs || []).map(s => ({
        name: s.assessments?.title?.substring(0, 10) || 'Quiz',
        Score: s.total_questions > 0 ? Math.round((s.score / s.total_questions) * 100) : 0
      }))

      setAssessmentScores(formattedScores)
      setSchedule(scheduleData || [])

      const totalClassesCount = pastClasses?.length || 0
      const realAttendance = totalClassesCount > 0 
        ? Math.min(100, Math.round((attendedCount / totalClassesCount) * 100))
        : 100

      setAttendanceRate(realAttendance)

      // Set state values
      setKpis({
        streak: studentStreak,
        xp: studentXp,
        rank: rank_name,
        completedCourses: completedCount,
        rankColor: rank_color
      })

      // Calculate dynamic next milestone badge
      let nextBadgeName = 'XP Explorer'
      let badgeProgressText = ''

      if (studentXp < 100) {
        nextBadgeName = 'XP Beginner'
        badgeProgressText = `${100 - studentXp} XP remaining`
      } else if (studentXp < 500) {
        nextBadgeName = 'XP Explorer'
        badgeProgressText = `${500 - studentXp} XP remaining`
      } else if (studentXp < 1000) {
        nextBadgeName = 'XP Challenger'
        badgeProgressText = `${1000 - studentXp} XP remaining`
      } else {
        nextBadgeName = 'XP Master'
        badgeProgressText = `${5000 - studentXp} XP remaining`
      }

      setNextMilestone({
        currentLevel,
        nextLevel,
        currentXp: currentXpInLevel,
        neededXp: neededXpInLevel,
        progressPct: levelProgressPct,
        nextBadge: nextBadgeName,
        badgeProgress: badgeProgressText
      })

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const activityMap = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dayLabel = days[d.getDay()]
        activityMap[dayLabel] = 0
      }

      if (codingSubs) {
        codingSubs.forEach(sub => {
          if (sub.status === 'accepted') {
            const date = new Date(sub.created_at)
            const dayLabel = days[date.getDay()]
            if (activityMap[dayLabel] !== undefined) {
              activityMap[dayLabel] += sub.score || 0
            }
          }
        })
      }

      if (liveAtt) {
        liveAtt.forEach(att => {
          const date = new Date(att.joined_at)
          const dayLabel = days[date.getDay()]
          if (activityMap[dayLabel] !== undefined) {
            activityMap[dayLabel] += 20
          }
        })
      }

      const weeklyActivityData = Object.entries(activityMap).map(([day, xp]) => ({
        day,
        XP: xp
      }))
      
      setWeeklyActivity(weeklyActivityData)

    } catch (err) {
      console.error('Failed to load student dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  const getRankInfo = (xp) => {
    const tiers = [
      { name: 'Iron', color: '#94a3b8', base: 0, step: 200 },
      { name: 'Bronze', color: '#b45309', base: 1000, step: 200 },
      { name: 'Silver', color: '#cbd5e1', base: 2000, step: 300 },
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
  const getUnlockedBadges = () => {
    const list = []
    const studentXp = stats?.xp || 0
    const studentStreak = stats?.streak || 0
    const solvedCount = stats?.solved || 0

    // Streak
    if (studentStreak >= 3) list.push({ icon: '🔥', name: 'Momentum' })
    if (studentStreak >= 7) list.push({ icon: '⚔️', name: 'Weekly Warrior' })
    if (studentStreak >= 30) list.push({ icon: '🌟', name: 'Monthly Master' })

    // XP
    if (studentXp >= 100) list.push({ icon: '⭐', name: 'XP Beginner' })
    if (studentXp >= 500) list.push({ icon: '🧭', name: 'XP Explorer' })
    if (studentXp >= 1000) list.push({ icon: '🏆', name: 'XP Challenger' })
    if (studentXp >= 5000) list.push({ icon: '⚡', name: 'XP Master' })

    // Coding
    if (solvedCount >= 5) list.push({ icon: '💻', name: 'Code Starter' })
    if (solvedCount >= 20) list.push({ icon: '🚀', name: 'Code Climber' })
    if (solvedCount >= 50) list.push({ icon: '🛡️', name: 'Code Challenger' })

    const result = [...list]
    const defaultLocked = [
      { icon: '⭐', name: 'XP Beginner', locked: true },
      { icon: '🔥', name: 'Momentum', locked: true },
      { icon: '💻', name: 'Code Starter', locked: true }
    ]

    while (result.length < 3) {
      const nextDefault = defaultLocked.find(d => !result.some(r => r.name === d.name))
      if (nextDefault) {
        result.push(nextDefault)
      } else {
        result.push({ icon: '🔒', name: 'Locked', locked: true })
      }
    }

    return result.slice(0, 3)
  }

  const attendanceChartData = [
    { name: 'Attendance', value: attendanceRate, fill: '#06b6d4' },
    { name: 'Unattended', value: 100 - attendanceRate, fill: 'rgba(255,255,255,0.05)' }
  ]

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--text-secondary)' }}>
        <RefreshCw className="animate-spin text-indigo-600" size={32} />
        <div>Loading your learning dashboard...</div>
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" style={{ padding: '1rem 0', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Welcome banner */}
      <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
        <GlassCard
          tilt3d={true}
          padding="1.75rem 2rem"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.08))',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.5rem'
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              Welcome back, <span className="gradient-text">{profile?.name?.split(' ')[0] || 'Learner'}</span>!
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Your streak is hot. Let's make today count towards your learning goals!
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🔥 {kpis.streak}d Streak
            </span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ⭐ {kpis.xp.toLocaleString()} XP
            </span>
          </div>
        </GlassCard>
      </motion.div>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2.5fr 1fr', gap: '1.5rem' }}>
        
        {/* Left Column (Main Charts & KPIs) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* KPI Analytics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <KPIStudentCard icon="🔥" title="Streak" value={`${kpis.streak} Days`} subtitle="Keep the flame going" />
            <KPIStudentCard icon="⭐" title="XP" value={kpis.xp.toLocaleString()} subtitle="Total XP accumulated" />
            <KPIStudentCard icon="🏆" title="Rank" value={kpis.rank} subtitle="Rank standing tier" color={kpis.rankColor} />
            <KPIStudentCard icon="📚" title="Completed Courses" value={kpis.completedCourses} subtitle="Modules finished 100%" />
          </div>

          {/* Weekly Learning Activity Area Chart */}
          <GlassCard tilt3d={true}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', marginBottom: '1.5rem' }}>
              📈 Weekly Learning Activity (XP)
            </h3>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={weeklyActivity}>
                  <defs>
                    <linearGradient id="xpGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white' }}
                  />
                  <Area type="monotone" dataKey="XP" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#xpGlow)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

          {/* Row 3: Charts (Attendance % Pie/Radial + Assessment Scores Bar) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.5fr', gap: '1.5rem' }}>
            
            {/* Attendance Radial/Gauge Chart */}
            <GlassCard tilt3d={true} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', width: '100%', textAlign: 'left', marginBottom: '1rem' }}>
                📶 Class Attendance
              </h3>
              <div style={{ width: '100%', height: 120, display: 'flex', justifyItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={attendanceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      paddingAngle={0}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {attendanceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip enabled={false} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignSelf: 'center', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 850, color: 'white' }}>{attendanceRate}%</span>
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 600 }}>Rate</span>
                </div>
              </div>
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0, textAlign: 'center', marginTop: '0.5rem' }}>
                Enrolled class presence history grade
              </p>
            </GlassCard>

            {/* Assessment Performance Bar Chart */}
            <GlassCard tilt3d={true}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>
                📚 Assessment Performance (%)
              </h3>
              {assessmentScores.length === 0 ? (
                <div style={{ height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center', gap: '8px' }}>
                  <span>No assessments completed yet.</span>
                  <Link to="/student/assessments" style={{ color: '#8b5cf6', fontWeight: 700, textDecoration: 'none' }}>
                    Take Quiz →
                  </Link>
                </div>
              ) : (
                <div style={{ width: '100%', height: 140 }}>
                  <ResponsiveContainer>
                    <BarChart data={assessmentScores} barSize={24} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white' }}
                      />
                      <Bar dataKey="Score" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Quick Actions grid */}
          <GlassCard tilt3d={true} padding="1.25rem">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              {[
                { icon: BookOpen,  label: 'My Courses',    path: '/student/courses',     color: '#6366f1' },
                { icon: CodeIcon,  label: 'Coding Practice',path: '/student/coding',      color: '#8b5cf6' },
                { icon: CheckCircle, label: 'Assessments', path: '/student/assessments',  color: '#10b981' },
                { icon: Clock,     label: 'Live Meeting',    path: '/student/courses',   color: '#3b82f6' }
              ].map(({ icon: Icon, label, path, color }) => (
                <Link key={label} to={path} style={{ textDecoration: 'none' }}>
                  <motion.div
                    whileHover={{ y: -2, scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                      padding: '0.75rem', borderRadius: 12,
                      background: `${color}0d`, border: `1px solid ${color}22`,
                      cursor: 'pointer', transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={16} color={color} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textAlign: 'center' }}>{label}</span>
                  </motion.div>
                </Link>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Right Column (Milestones, Badges, Schedule) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Next Milestone box */}
          <GlassCard tilt3d={true}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🏆 Next Milestone
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8' }}>
                <span>Level {nextMilestone.currentLevel}</span>
                <span>Level {nextMilestone.nextLevel}</span>
              </div>
              <div style={{ height: 8, width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${nextMilestone.progressPct}%`, height: '100%', background: '#8b5cf6' }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                <span>XP {nextMilestone.currentXp} / {nextMilestone.neededXp}</span>
                <span style={{ color: '#8b5cf6', fontWeight: 700 }}>{nextMilestone.progressPct}%</span>
              </div>

              <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.15)', borderRadius: 8 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase' }}>Next Badge:</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 850, color: 'white', marginTop: '2px' }}>
                  🏅 {nextMilestone.nextBadge}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  Progress: {nextMilestone.badgeProgress}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Career Badges (Achievements) */}
          <GlassCard tilt3d={true}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white' }}>
                🏅 Unlocked Badges
              </h3>
              <Link to="/student/achievements" style={{ fontSize: '0.75rem', color: '#8b5cf6', textDecoration: 'none', fontWeight: 600 }}>
                View All
              </Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', justifyItems: 'center' }}>
              {getUnlockedBadges().map(badge => (
                <BadgeBox key={badge.name} icon={badge.icon} name={badge.name} active={!badge.locked} />
              ))}
            </div>
          </GlassCard>

          {/* Upcoming schedule */}
          <GlassCard tilt3d={true}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'white', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📅 Upcoming Live Sessions
            </h3>
            {schedule.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.75rem', padding: '1rem 0', textAlign: 'center' }}>
                No classes scheduled. Check back later.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {schedule.map(s => (
                  <div key={s.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 6, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Calendar size={14} color="#6366f1" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'white' }}>{s.title}</div>
                      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>
                        {new Date(s.scheduled_time).toLocaleDateString()} • {new Date(s.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
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
        gap: '0.75rem',
      }}
    >
      <div style={{ fontSize: '1.75rem' }}>{icon}</div>
      <div>
        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{title}</div>
        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: color || 'white', marginTop: '2px' }}>{value}</div>
        <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: '2px' }}>{subtitle}</div>
      </div>
    </GlassCard>
  )
}

function BadgeBox({ icon, name, active }) {
  return (
    <div style={{ textAlign: 'center', opacity: active ? 1 : 0.25 }}>
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
      <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, marginTop: '4px', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </div>
    </div>
  )
}
