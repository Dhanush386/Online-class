import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Sparkles, Bot, Code, Database, Cpu, 
  Layers, BookOpen, Clock, Award, Play, 
  RotateCcw, ChevronRight, AlertCircle, Loader2,
  CheckCircle2, ArrowRight
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { startInterviewSession } from '../../services/mockInterviewService'

const STANDARD_TRACKS = [
  {
    id: 'Frontend Development',
    title: 'Frontend Development',
    icon: Code,
    color: '#6366f1',
    description: 'React, TypeScript/JS, Browser APIs, CSS layout, Web Performance, and State Management.',
    sampleTopics: ['Virtual DOM', 'State Management', 'Web Vitals', 'CSS Grid/Flex', 'Accessibility']
  },
  {
    id: 'Backend Engineering',
    title: 'Backend Engineering',
    icon: Database,
    color: '#10b981',
    description: 'REST/GraphQL APIs, SQL & NoSQL, Caching, DB Transactions, and Distributed Systems.',
    sampleTopics: ['REST Design', 'DB Indexing', 'Concurrency', 'Auth & JWT', 'Microservices']
  },
  {
    id: 'DSA & Algorithms',
    title: 'DSA & Algorithms',
    icon: Cpu,
    color: '#f59e0b',
    description: 'Data structures, algorithmic paradigms, Big-O complexity, and technical problem solving.',
    sampleTopics: ['Trees & Graphs', 'Dynamic Programming', 'BFS/DFS', 'Sorting & Search', 'Arrays & Maps']
  },
  {
    id: 'Fullstack Development',
    title: 'Fullstack Development',
    icon: Layers,
    color: '#ec4899',
    description: 'End-to-end web architecture, fullstack data flow, security, and cloud integrations.',
    sampleTopics: ['Client-Server Lifecycle', 'API Security', 'SSR/SSG', 'ORM & Schema', 'CI/CD']
  },
]

export default function MockInterviewHub() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  // Setup state
  const [selectedTrack, setSelectedTrack] = useState('Frontend Development')
  const [questionCount, setQuestionCount] = useState(5)
  const [enrolledCourse, setEnrolledCourse] = useState(null)
  const [courseTopics, setCourseTopics] = useState([])
  const [starting, setStarting] = useState(false)
  const [setupError, setSetupError] = useState(null)

  // History state
  const [sessions, setSessions] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [filterTab, setFilterTab] = useState('all')

  // Fetch student's enrolled course + syllabus & history
  useEffect(() => {
    if (!profile?.id) return

    async function loadData() {
      setLoadingHistory(true)
      try {
        // 1. Fetch Enrolled Course
        const { data: enrollData } = await supabase
          .from('enrollments')
          .select('course_id, courses(id, title, description)')
          .eq('student_id', profile.id)
          .limit(1)
          .maybeSingle()

        if (enrollData?.courses) {
          setEnrolledCourse(enrollData.courses)

          // Fetch course syllabus topics
          const { data: scheduleData } = await supabase
            .from('weekly_schedule')
            .select('topic')
            .eq('course_id', enrollData.courses.id)
            .limit(10)

          const topics = Array.from(new Set((scheduleData || []).map(s => s.topic).filter(Boolean)))
          setCourseTopics(topics)
        }

        // 2. Fetch Sessions History
        const { data: sessData, error: sessErr } = await supabase
          .from('mock_interview_sessions')
          .select('*')
          .eq('student_id', profile.id)
          .order('created_at', { ascending: false })

        if (sessErr) throw sessErr
        setSessions(sessData || [])
      } catch (err) {
        console.error('Error loading interview hub data:', err)
      } finally {
        setLoadingHistory(false)
      }
    }

    loadData()
  }, [profile?.id])

  // Start New Interview
  const handleStartInterview = async () => {
    if (starting || !profile?.id) return
    setStarting(true)
    setSetupError(null)

    try {
      let isCourseTrack = selectedTrack === 'Enrolled Course'
      let trackName = isCourseTrack ? `Course: ${enrolledCourse?.title || 'Enrolled Course'}` : selectedTrack

      const courseContext = isCourseTrack && enrolledCourse ? {
        title: enrolledCourse.title,
        description: enrolledCourse.description,
        topics: courseTopics
      } : undefined

      const newSession = await startInterviewSession({
        userId: profile.id,
        track: trackName,
        questionCount,
        courseContext
      })

      navigate(`/student/mock-interview/${newSession.id}`)
    } catch (err) {
      console.error('Failed to start interview:', err)
      setSetupError(err.message || 'Failed to start interview session. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  // Filter history
  const filteredSessions = sessions.filter(s => {
    if (filterTab === 'completed') return s.status === 'completed'
    if (filterTab === 'in_progress') return s.status === 'in_progress'
    return true
  })

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      
      {/* Header Banner */}
      <div className="glass-card" style={{ 
        padding: '2.5rem', 
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)', 
        border: '1px solid rgba(99, 102, 241, 0.2)',
        borderRadius: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem'
      }}>
        <div style={{ maxWidth: 620 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '4px 12px', background: 'var(--primary-100)', borderRadius: '999px', color: 'var(--primary-700)', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            <Sparkles size={14} /> AI Interview Coach
          </div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
            Master Technical Interviews with Real-Time AI
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.75rem', lineHeight: 1.5 }}>
            Practice conversational technical interviews tailored to industry tracks or your enrolled course curriculum. Get structured scorecards, competency breakdowns, and model answers.
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '1.25rem 2rem', 
          background: 'var(--bg-primary)', 
          borderRadius: '16px', 
          border: '1px solid var(--sidebar-border)',
          minWidth: 160,
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)'
        }}>
          <span style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--primary-600)', lineHeight: 1 }}>
            {sessions.filter(s => s.status === 'completed').length}
          </span>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>
            Interviews Completed
          </span>
        </div>
      </div>

      {/* Section 1: Configure & Start Interview */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Bot size={22} color="var(--primary-600)" /> 1. Select Interview Track
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Choose a specialized domain track or align questions directly with your current course curriculum.
        </p>

        {/* Track Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          
          {/* Enrolled Course Track */}
          {enrolledCourse && (
            <div
              onClick={() => setSelectedTrack('Enrolled Course')}
              style={{
                padding: '1.25rem',
                borderRadius: '14px',
                border: selectedTrack === 'Enrolled Course' ? '2px solid #7c3aed' : '1px solid var(--sidebar-border)',
                background: selectedTrack === 'Enrolled Course' ? 'rgba(124, 58, 237, 0.06)' : 'var(--bg-primary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={20} />
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#7c3aed', letterSpacing: 0.5 }}>Enrolled Course</span>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {enrolledCourse.title}
                  </h3>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0.5rem 0' }}>
                Questions derived strictly from your course syllabus, weekly modules, and lecture topics.
              </p>
              {courseTopics.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                  {courseTopics.slice(0, 3).map((topic, i) => (
                    <span key={i} style={{ fontSize: '0.72rem', background: 'var(--bg-elevated)', padding: '2px 7px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                      {topic}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Standard Tracks */}
          {STANDARD_TRACKS.map((t) => {
            const Icon = t.icon
            const isSelected = selectedTrack === t.id
            return (
              <div
                key={t.id}
                onClick={() => setSelectedTrack(t.id)}
                style={{
                  padding: '1.25rem',
                  borderRadius: '14px',
                  border: isSelected ? `2px solid ${t.color}` : '1px solid var(--sidebar-border)',
                  background: isSelected ? `${t.color}0d` : 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: `${t.color}18`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} />
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {t.title}
                  </h3>
                </div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0.5rem 0' }}>
                  {t.description}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                  {t.sampleTopics.slice(0, 3).map((topic, i) => (
                    <span key={i} style={{ fontSize: '0.72rem', background: 'var(--bg-elevated)', padding: '2px 7px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Question Count & Start CTA */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          flexWrap: 'wrap', 
          gap: '1.5rem', 
          paddingTop: '1.5rem', 
          borderTop: '1px solid var(--sidebar-border)' 
        }}>
          
          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
              Interview Length
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { count: 5, label: '5 Questions', duration: '~10 mins' },
                { count: 10, label: '10 Questions', duration: '~20 mins' }
              ].map(opt => (
                <button
                  key={opt.count}
                  type="button"
                  onClick={() => setQuestionCount(opt.count)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: questionCount === opt.count ? '1.5px solid var(--primary-600)' : '1px solid var(--sidebar-border)',
                    background: questionCount === opt.count ? 'var(--primary-100)' : 'var(--bg-primary)',
                    color: questionCount === opt.count ? 'var(--primary-700)' : 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({opt.duration})</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            {setupError && (
              <span style={{ fontSize: '0.85rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <AlertCircle size={14} /> {setupError}
              </span>
            )}
            <button
              onClick={handleStartInterview}
              disabled={starting}
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                padding: '0.75rem 1.75rem',
                fontSize: '1rem',
                fontWeight: 700,
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)'
              }}
            >
              {starting ? (
                <>
                  <Loader2 className="animate-spin" size={18} /> Preparing Interview...
                </>
              ) : (
                <>
                  <Play size={18} /> Start Mock Interview <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Section 2: Previous Interviews History */}
      <div className="glass-card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Interview History & Reports
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              Review past scorecard evaluations, identified gaps, and model answers.
            </p>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-elevated)', padding: '3px', borderRadius: '8px' }}>
            {[
              { id: 'all', label: 'All' },
              { id: 'completed', label: 'Completed' },
              { id: 'in_progress', label: 'In Progress' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: filterTab === tab.id ? 'var(--bg-primary)' : 'transparent',
                  color: filterTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: filterTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loadingHistory ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 0.5rem' }} />
            <span>Loading interview records...</span>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', background: 'var(--bg-primary)', borderRadius: '12px', border: '1px dashed var(--sidebar-border)' }}>
            <Award size={36} color="var(--text-muted)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              No Interview Sessions Found
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Select a track above and start your first AI mock interview to build your readiness.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {filteredSessions.map((s) => {
              const isCompleted = s.status === 'completed'
              const dateStr = new Date(s.started_at || s.created_at).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric'
              })

              return (
                <div
                  key={s.id}
                  style={{
                    padding: '1.1rem 1.25rem',
                    borderRadius: '12px',
                    border: '1px solid var(--sidebar-border)',
                    background: 'var(--bg-primary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: 42, height: 42, 
                      borderRadius: '10px', 
                      background: isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                      color: isCompleted ? '#10b981' : '#6366f1',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' 
                    }}>
                      {isCompleted ? <CheckCircle2 size={22} /> : <Clock size={22} />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                          {s.track}
                        </h4>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 700, 
                          padding: '2px 7px', 
                          borderRadius: '4px',
                          background: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                          color: isCompleted ? '#10b981' : '#d97706'
                        }}>
                          {isCompleted ? 'Completed' : 'In Progress'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {dateStr} • {s.question_count} Questions
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    {isCompleted && s.overall_score !== null && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: s.overall_score >= 70 ? '#10b981' : '#6366f1' }}>
                          {s.overall_score}%
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Score</span>
                      </div>
                    )}

                    <button
                      onClick={() => navigate(`/student/mock-interview/${s.id}`)}
                      className={isCompleted ? "btn-secondary" : "btn-primary"}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem'
                      }}
                    >
                      {isCompleted ? (
                        <>
                          View Report <ChevronRight size={14} />
                        </>
                      ) : (
                        <>
                          Resume <Play size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
