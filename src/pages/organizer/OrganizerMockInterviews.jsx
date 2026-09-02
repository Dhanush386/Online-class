import { useState, useEffect } from 'react'
import { 
  Bot, Search, Filter, Award, CheckCircle2, 
  Clock, Sparkles, User, ChevronRight, X, 
  BarChart2, BookOpen, AlertTriangle, Lightbulb, 
  ShieldCheck, RefreshCw, Eye, Download, Plus,
  Edit2, Trash2, Check, Lock, Layers, Code, Database, Cpu, HelpCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ProgressRing } from '../../design-system'
import { useAuth } from '../../contexts/AuthContext'
import {
  getOrganizerQuestions,
  createOrganizerQuestion,
  updateOrganizerQuestion,
  deleteOrganizerQuestion,
  seedDefaultOrganizerQuestions
} from '../../services/mockInterviewService'

export default function OrganizerMockInterviews() {
  const { profile } = useAuth()
  const [activeMainTab, setActiveMainTab] = useState('submissions') // 'submissions' | 'questions'

  // Sessions state
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [trackFilter, setTrackFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Question Bank state
  const [questions, setQuestions] = useState([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [qSearchQuery, setQSearchQuery] = useState('')
  const [qTrackFilter, setQTrackFilter] = useState('all')
  const [qDifficultyFilter, setQDifficultyFilter] = useState('all')
  const [expandedAnswerId, setExpandedAnswerId] = useState(null)

  // Question Modal state
  const [showQuestionModal, setShowQuestionModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [formTrack, setFormTrack] = useState('Frontend Development')
  const [formCategory, setFormCategory] = useState('')
  const [formDifficulty, setFormDifficulty] = useState('intermediate')
  const [formQuestion, setFormQuestion] = useState('')
  const [formSampleAnswer, setFormSampleAnswer] = useState('')
  const [formOrderIndex, setFormOrderIndex] = useState(1)
  const [formIsActive, setFormIsActive] = useState(true)
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  // Selected session for verification modal
  const [selectedSession, setSelectedSession] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalTurns, setModalTurns] = useState([])
  const [modalReport, setModalReport] = useState(null)
  const [modalTab, setModalTab] = useState('report') // 'report' | 'transcript'

  useEffect(() => {
    fetchSessions()
    fetchQuestions()
  }, [])

  const fetchQuestions = async () => {
    setQuestionsLoading(true)
    try {
      const data = await getOrganizerQuestions('all')
      setQuestions(data || [])
    } catch (err) {
      console.error('Failed to load questions:', err)
    } finally {
      setQuestionsLoading(false)
    }
  }

  const fetchSessions = async () => {
    setLoading(true)
    try {
      // First attempt querying with recording metadata
      let { data, error } = await supabase
        .from('mock_interview_sessions')
        .select(`
          id,
          student_id,
          track,
          question_count,
          status,
          started_at,
          completed_at,
          overall_score,
          recording_url,
          recording_expires_at,
          created_at,
          users:student_id (
            id,
            name,
            email,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })

      // Resilient fallback if recording_url column has not been added via SQL migration yet
      if (error && (error.code === '42703' || error.message?.includes('recording_url'))) {
        const fallback = await supabase
          .from('mock_interview_sessions')
          .select(`
            id,
            student_id,
            track,
            question_count,
            status,
            started_at,
            completed_at,
            overall_score,
            created_at,
            users:student_id (
              id,
              name,
              email,
              avatar_url
            )
          `)
          .order('created_at', { ascending: false })
        data = fallback.data
        error = fallback.error
      }

      if (error) throw error
      setSessions(data || [])
    } catch (err) {
      console.error('Failed to fetch mock interview sessions:', err)
    } finally {
      setLoading(false)
    }
  }

  // Open verification modal
  const handleOpenVerification = async (session) => {
    setSelectedSession(session)
    setModalLoading(true)
    setModalTab('report')
    try {
      // 1. Fetch turns
      const { data: turnsData } = await supabase
        .from('mock_interview_turns')
        .select('*')
        .eq('session_id', session.id)
        .order('turn_number', { ascending: true })

      setModalTurns(turnsData || [])

      // 2. Fetch report if completed
      if (session.status === 'completed') {
        const { data: reportData } = await supabase
          .from('mock_interview_reports')
          .select('*')
          .eq('session_id', session.id)
          .maybeSingle()

        setModalReport(reportData)
      } else {
        setModalReport(null)
      }
    } catch (err) {
      console.error('Failed to load session details for verification:', err)
    } finally {
      setModalLoading(false)
    }
  }

  // Filtered sessions
  const filteredSessions = sessions.filter(s => {
    const studentName = s.users?.name?.toLowerCase() || ''
    const studentEmail = s.users?.email?.toLowerCase() || ''
    const track = s.track?.toLowerCase() || ''
    const q = searchQuery.toLowerCase()

    const matchesSearch = !q || studentName.includes(q) || studentEmail.includes(q) || track.includes(q)
    const matchesTrack = trackFilter === 'all' || s.track === trackFilter
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter

    return matchesSearch && matchesTrack && matchesStatus
  })

  // Aggregate Stats
  const totalSessions = sessions.length
  const completedSessions = sessions.filter(s => s.status === 'completed')
  const avgScore = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((acc, s) => acc + (s.overall_score || 0), 0) / completedSessions.length)
    : 0

  const getScoreColor = (score) => {
    if (score >= 85) return '#10b981'
    if (score >= 70) return '#6366f1'
    if (score >= 55) return '#f59e0b'
    return '#ef4444'
  }

  const formatCategoryName = (key) => {
    return key
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  // Question Handlers
  const handleOpenAddQuestion = () => {
    setEditingQuestion(null)
    setFormTrack(qTrackFilter !== 'all' ? qTrackFilter : 'Frontend Development')
    setFormCategory('')
    setFormDifficulty('intermediate')
    setFormQuestion('')
    setFormSampleAnswer('')
    setFormOrderIndex((questions.length || 0) + 1)
    setFormIsActive(true)
    setFormError(null)
    setShowQuestionModal(true)
  }

  const handleOpenEditQuestion = (q) => {
    setEditingQuestion(q)
    setFormTrack(q.track)
    setFormCategory(q.category || '')
    setFormDifficulty(q.difficulty || 'intermediate')
    setFormQuestion(q.question)
    setFormSampleAnswer(q.sample_answer || '')
    setFormOrderIndex(q.order_index || 1)
    setFormIsActive(q.is_active !== false)
    setFormError(null)
    setShowQuestionModal(true)
  }

  const handleSaveQuestion = async (e) => {
    e.preventDefault()
    if (!formQuestion.trim()) {
      setFormError('Question text is required.')
      return
    }

    setFormSaving(true)
    setFormError(null)

    try {
      const payload = {
        track: formTrack,
        category: formCategory.trim() || 'General',
        difficulty: formDifficulty,
        question: formQuestion.trim(),
        sample_answer: formSampleAnswer.trim(),
        order_index: Number(formOrderIndex) || 1,
        is_active: formIsActive,
        created_by: profile?.id
      }

      if (editingQuestion) {
        await updateOrganizerQuestion(editingQuestion.id, payload)
      } else {
        await createOrganizerQuestion(payload)
      }

      setShowQuestionModal(false)
      await fetchQuestions()
    } catch (err) {
      setFormError(err.message || 'Failed to save question.')
    } finally {
      setFormSaving(false)
    }
  }

  const handleToggleActive = async (q) => {
    try {
      await updateOrganizerQuestion(q.id, { is_active: !q.is_active })
      await fetchQuestions()
    } catch (err) {
      console.error('Failed to toggle question status:', err)
    }
  }

  const handleDeleteQuestion = async (id) => {
    if (!window.confirm('Are you sure you want to delete this interview question?')) return
    try {
      await deleteOrganizerQuestion(id)
      await fetchQuestions()
    } catch (err) {
      console.error('Failed to delete question:', err)
    }
  }

  const handleSeedDefaults = async () => {
    if (!window.confirm('Populate the question bank with industry-standard starter questions for all tracks?')) return
    setQuestionsLoading(true)
    try {
      await seedDefaultOrganizerQuestions(profile?.id)
      await fetchQuestions()
    } catch (err) {
      console.error('Failed to seed questions:', err)
    } finally {
      setQuestionsLoading(false)
    }
  }

  // Filtered Questions
  const filteredQuestions = questions.filter(q => {
    const text = (q.question || '').toLowerCase()
    const cat = (q.category || '').toLowerCase()
    const query = qSearchQuery.toLowerCase()

    const matchesSearch = !query || text.includes(query) || cat.includes(query)
    const matchesTrack = qTrackFilter === 'all' || q.track === qTrackFilter
    const matchesDiff = qDifficultyFilter === 'all' || q.difficulty === qDifficultyFilter

    return matchesSearch && matchesTrack && matchesDiff
  })

  const activeQuestionsCount = questions.filter(q => q.is_active).length
  const uniqueTracks = Array.from(new Set(sessions.map(s => s.track).filter(Boolean)))
  const uniqueQuestionTracks = Array.from(new Set(questions.map(q => q.track).filter(Boolean)))

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Bot size={28} color="var(--primary-600)" /> Mock Interview Oversight
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Verify student interview readiness, review AI evaluations, and inspect detailed answer transcripts.
          </p>
        </div>

        <button 
          onClick={fetchSessions}
          disabled={loading}
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-primary)' }}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Data
        </button>
      </div>

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--sidebar-border)', paddingBottom: '0.25rem' }}>
        <button
          onClick={() => setActiveMainTab('submissions')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            cursor: 'pointer',
            background: activeMainTab === 'submissions' ? 'var(--card-bg)' : 'transparent',
            color: activeMainTab === 'submissions' ? 'var(--primary-600)' : 'var(--text-muted)',
            borderBottom: activeMainTab === 'submissions' ? '2px solid var(--primary-600)' : '2px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <Bot size={18} /> Student Submissions ({sessions.length})
        </button>

        <button
          onClick={() => setActiveMainTab('questions')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: '8px 8px 0 0',
            fontWeight: 700,
            fontSize: '0.95rem',
            border: 'none',
            cursor: 'pointer',
            background: activeMainTab === 'questions' ? 'var(--card-bg)' : 'transparent',
            color: activeMainTab === 'questions' ? 'var(--primary-600)' : 'var(--text-muted)',
            borderBottom: activeMainTab === 'questions' ? '2px solid var(--primary-600)' : '2px solid transparent',
            transition: 'all 0.2s ease'
          }}
        >
          <BookOpen size={18} /> Question Bank ({questions.length})
        </button>
      </div>

      {/* ─── TAB 1: STUDENT SUBMISSIONS ─── */}
      {activeMainTab === 'submissions' && (
        <>
          {/* Metrics Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={26} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Interviews</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{totalSessions}</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={26} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{completedSessions.length}</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={26} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Average Score</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: getScoreColor(avgScore) }}>
                  {avgScore}%
                </div>
              </div>
            </div>
          </div>

          {/* Search & Filters Card */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Search Box */}
              <div style={{ position: 'relative', flex: '1 1 300px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search student name, email, or track..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 1rem 0.6rem 2.4rem',
                    borderRadius: '8px',
                    border: '1px solid var(--sidebar-border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <Filter size={16} /> Filters:
                </div>

                <select
                  value={trackFilter}
                  onChange={(e) => setTrackFilter(e.target.value)}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--sidebar-border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="all">All Tracks</option>
                  <option value="Frontend Development">Frontend Development</option>
                  <option value="Backend Engineering">Backend Engineering</option>
                  <option value="DSA & Algorithms">DSA & Algorithms</option>
                  <option value="Fullstack Development">Fullstack Development</option>
                  {uniqueTracks.filter(t => !['Frontend Development', 'Backend Engineering', 'DSA & Algorithms', 'Fullstack Development'].includes(t)).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--sidebar-border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>
            </div>
          </div>

          {/* Sessions Table */}
          <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--sidebar-border)' }}>
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Student</th>
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Track</th>
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Length</th>
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Score</th>
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Status</th>
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Date</th>
                    <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        Loading student interview records...
                      </td>
                    </tr>
                  ) : filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No mock interview records match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map(session => {
                      const isCompleted = session.status === 'completed'
                      const studentName = session.users?.name || 'Unknown Student'
                      const studentEmail = session.users?.email || 'N/A'
                      const dateStr = new Date(session.created_at).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })

                      return (
                        <tr 
                          key={session.id} 
                          style={{ borderBottom: '1px solid var(--sidebar-border)', transition: 'background 0.15s' }}
                        >
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ 
                                width: 36, height: 36, 
                                borderRadius: '50%', 
                                background: 'var(--primary-100)', 
                                color: 'var(--primary-700)', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 700, fontSize: '0.85rem'
                              }}>
                                {studentName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{studentName}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{studentEmail}</div>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {session.track}
                          </td>

                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)' }}>
                            {session.question_count} Qs
                          </td>

                          <td style={{ padding: '1rem 1.25rem' }}>
                            {isCompleted && session.overall_score !== null ? (
                              <span style={{ 
                                fontWeight: 800, 
                                color: getScoreColor(session.overall_score),
                                background: `${getScoreColor(session.overall_score)}14`,
                                padding: '3px 9px',
                                borderRadius: '999px',
                                fontSize: '0.85rem'
                              }}>
                                {session.overall_score}%
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                            )}
                          </td>

                          <td style={{ padding: '1rem 1.25rem' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                              color: isCompleted ? '#10b981' : '#d97706'
                            }}>
                              {isCompleted ? 'Completed' : 'In Progress'}
                            </span>
                          </td>

                          <td style={{ padding: '1rem 1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {dateStr}
                          </td>

                          <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                            <button
                              onClick={() => handleOpenVerification(session)}
                              className="btn-secondary"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.4rem 0.85rem',
                                fontSize: '0.8rem'
                              }}
                            >
                              <Eye size={14} /> Verify & Review
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── TAB 2: QUESTION BANK & CONFIGURATION ─── */}
      {activeMainTab === 'questions' && (
        <>
          {/* Question Bank Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={26} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Questions</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{questions.length}</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={26} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active in Interviews</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{activeQuestionsCount}</div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '12px', background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={26} />
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tracks Covered</span>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{uniqueQuestionTracks.length}</div>
              </div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="glass-card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Search Box */}
              <div style={{ position: 'relative', flex: '1 1 260px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search questions by text or category..."
                  value={qSearchQuery}
                  onChange={(e) => setQSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 1rem 0.6rem 2.4rem',
                    borderRadius: '8px',
                    border: '1px solid var(--sidebar-border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Filters & Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <select
                  value={qTrackFilter}
                  onChange={(e) => setQTrackFilter(e.target.value)}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--sidebar-border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="all">All Tracks</option>
                  <option value="Frontend Development">Frontend Development</option>
                  <option value="Backend Engineering">Backend Engineering</option>
                  <option value="DSA & Algorithms">DSA & Algorithms</option>
                  <option value="Fullstack Development">Fullstack Development</option>
                </select>

                <select
                  value={qDifficultyFilter}
                  onChange={(e) => setQDifficultyFilter(e.target.value)}
                  style={{
                    padding: '0.55rem 0.85rem',
                    borderRadius: '8px',
                    border: '1px solid var(--sidebar-border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                >
                  <option value="all">All Difficulties</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>

                {questions.length === 0 && (
                  <button
                    onClick={handleSeedDefaults}
                    disabled={questionsLoading}
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                  >
                    <Sparkles size={16} color="#f59e0b" /> Seed Starter Questions
                  </button>
                )}

                <button
                  onClick={handleOpenAddQuestion}
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                >
                  <Plus size={16} /> Add Question
                </button>
              </div>
            </div>
          </div>

          {/* Question List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {questionsLoading ? (
              <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading question bank...
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="glass-card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <HelpCircle size={28} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  No Interview Questions Found
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 450, margin: '0 auto 1.5rem' }}>
                  You haven't set any custom interview questions for this track yet, or your search filter didn't return any matches.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button onClick={handleSeedDefaults} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={16} color="#f59e0b" /> Seed Standard Industry Questions
                  </button>
                  <button onClick={handleOpenAddQuestion} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={16} /> Create Custom Question
                  </button>
                </div>
              </div>
            ) : (
              filteredQuestions.map((q, idx) => {
                const isExpanded = expandedAnswerId === q.id
                const diffColor = q.difficulty === 'beginner' ? '#10b981' : q.difficulty === 'advanced' ? '#ec4899' : '#f59e0b'
                const trackIcon = q.track.includes('Frontend') ? Code : q.track.includes('Backend') ? Database : q.track.includes('DSA') ? Cpu : Layers

                return (
                  <div 
                    key={q.id || idx} 
                    className="glass-card" 
                    style={{ 
                      padding: '1.25rem 1.5rem', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '0.85rem',
                      opacity: q.is_active ? 1 : 0.65,
                      borderLeft: q.is_active ? '4px solid var(--primary-600)' : '4px solid var(--sidebar-border)'
                    }}
                  >
                    {/* Top Row: Track, Category, Difficulty, Order */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          color: 'var(--primary-600)', 
                          background: 'rgba(99, 102, 241, 0.1)',
                          padding: '3px 8px', 
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {q.track}
                        </span>

                        {q.category && (
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: 600, 
                            color: 'var(--text-muted)', 
                            background: 'var(--bg-elevated)', 
                            padding: '3px 8px', 
                            borderRadius: '6px' 
                          }}>
                            {q.category}
                          </span>
                        )}

                        <span style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 700, 
                          color: diffColor, 
                          background: `${diffColor}18`, 
                          padding: '3px 8px', 
                          borderRadius: '6px',
                          textTransform: 'capitalize'
                        }}>
                          {q.difficulty}
                        </span>

                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          Order #{q.order_index || idx + 1}
                        </span>
                      </div>

                      {/* Right Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {/* Active Toggle */}
                        <button
                          onClick={() => handleToggleActive(q)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            border: '1px solid var(--sidebar-border)',
                            background: q.is_active ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-elevated)',
                            color: q.is_active ? '#10b981' : 'var(--text-muted)'
                          }}
                          title="Toggle whether this question appears in student interviews"
                        >
                          <Check size={13} style={{ opacity: q.is_active ? 1 : 0.3 }} />
                          {q.is_active ? 'Active' : 'Disabled'}
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditQuestion(q)}
                          className="btn-secondary"
                          style={{ padding: '5px 8px', fontSize: '0.75rem' }}
                          title="Edit Question"
                        >
                          <Edit2 size={14} />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          style={{ 
                            padding: '5px 8px', 
                            fontSize: '0.75rem',
                            borderRadius: '6px',
                            border: '1px solid rgba(239,68,68,0.2)',
                            background: 'rgba(239,68,68,0.08)',
                            color: '#ef4444',
                            cursor: 'pointer'
                          }}
                          title="Delete Question"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.45 }}>
                      {q.question}
                    </div>

                    {/* Sample Answer / Grading Rubric Accordion (Instructor Only) */}
                    {q.sample_answer && (
                      <div style={{ marginTop: '0.25rem' }}>
                        <button
                          onClick={() => setExpandedAnswerId(isExpanded ? null : q.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: 'var(--primary-600)',
                            padding: 0
                          }}
                        >
                          <Lock size={13} /> {isExpanded ? 'Hide Grading Rubric & Ideal Answer' : 'View Confidential Grading Rubric & Ideal Answer'}
                        </button>

                        {isExpanded && (
                          <div style={{ 
                            marginTop: '0.6rem', 
                            padding: '0.85rem 1rem', 
                            borderRadius: '8px', 
                            background: 'var(--bg-elevated)', 
                            border: '1px solid var(--sidebar-border)',
                            fontSize: '0.85rem',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.5
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700 }}>
                              <ShieldCheck size={14} color="#10b981" /> CONFIDENTIAL EVALUATION RUBRIC (STRIPPED FROM STUDENTS)
                            </div>
                            {q.sample_answer}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* ─── ADD / EDIT QUESTION MODAL ─── */}
      {showQuestionModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="glass-card" style={{
            width: '100%', maxWidth: 650, maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            background: 'var(--card-bg)', border: '1px solid var(--sidebar-border)',
            borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BookOpen size={20} color="var(--primary-600)" />
                {editingQuestion ? 'Edit Interview Question' : 'Add Custom Interview Question'}
              </h3>
              <button 
                onClick={() => setShowQuestionModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveQuestion} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', padding: '1.5rem', gap: '1.2rem' }}>
              {formError && (
                <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '0.85rem' }}>
                  {formError}
                </div>
              )}

              {/* Track & Difficulty Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Track / Specialization *
                  </label>
                  <select
                    value={formTrack}
                    onChange={(e) => setFormTrack(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px',
                      border: '1px solid var(--sidebar-border)', background: 'var(--bg-primary)',
                      color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
                    }}
                  >
                    <option value="Frontend Development">Frontend Development</option>
                    <option value="Backend Engineering">Backend Engineering</option>
                    <option value="DSA & Algorithms">DSA & Algorithms</option>
                    <option value="Fullstack Development">Fullstack Development</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Difficulty Level *
                  </label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px',
                      border: '1px solid var(--sidebar-border)', background: 'var(--bg-primary)',
                      color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
                    }}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Category & Order Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Category / Topic (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. React & State, Database Indexing"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px',
                      border: '1px solid var(--sidebar-border)', background: 'var(--bg-primary)',
                      color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                    Sequence Order Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formOrderIndex}
                    onChange={(e) => setFormOrderIndex(e.target.value)}
                    style={{
                      width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px',
                      border: '1px solid var(--sidebar-border)', background: 'var(--bg-primary)',
                      color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Question Text *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter the technical question to be asked by the AI interviewer..."
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '8px',
                    border: '1px solid var(--sidebar-border)', background: 'var(--bg-primary)',
                    color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', resize: 'vertical'
                  }}
                />
              </div>

              {/* Confidential Sample Answer / Rubric */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Confidential Model Answer & Rubric (Optional)
                  </label>
                  <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Lock size={12} /> Hidden from students
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Key concepts, architectural trade-offs, and points the student should cover for a high score..."
                  value={formSampleAnswer}
                  onChange={(e) => setFormSampleAnswer(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem', borderRadius: '8px',
                    border: '1px solid var(--sidebar-border)', background: 'var(--bg-primary)',
                    color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none', resize: 'vertical'
                  }}
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                  This rubric is passed directly to the Gemini AI evaluator to grade answers accurately, and is excluded from student database access via RLS.
                </small>
              </div>

              {/* Active Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="formIsActive" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Active (Include this question in student mock interviews)
                </label>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="btn-secondary"
                  disabled={formSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={formSaving}
                >
                  {formSaving ? 'Saving...' : editingQuestion ? 'Update Question' : 'Add Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification & Review Modal */}
      {selectedSession && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem'
        }}>
          <div className="glass-card" style={{ 
            maxWidth: 900, width: '100%', maxHeight: '90vh', 
            background: 'var(--card-bg)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', padding: 0,
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)'
          }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--sidebar-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Interview Verification: {selectedSession.users?.name || 'Student'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', background: 'var(--primary-100)', color: 'var(--primary-700)' }}>
                    {selectedSession.track}
                  </span>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedSession.users?.email} • {selectedSession.question_count} Questions
                </span>
              </div>

              <button 
                onClick={() => setSelectedSession(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--sidebar-border)', padding: '0 1.5rem', background: 'var(--bg-elevated)' }}>
              <button
                onClick={() => setModalTab('report')}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'report' ? '2px solid var(--primary-600)' : '2px solid transparent',
                  color: modalTab === 'report' ? 'var(--primary-600)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                AI Scorecard & Analysis
              </button>

              <button
                onClick={() => setModalTab('transcript')}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'transcript' ? '2px solid var(--primary-600)' : '2px solid transparent',
                  color: modalTab === 'transcript' ? 'var(--primary-600)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                Full Q&A Transcript ({modalTurns.length} Turns)
              </button>

              <button
                onClick={() => setModalTab('recording')}
                style={{
                  padding: '0.75rem 1.25rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'recording' ? '2px solid var(--primary-600)' : '2px solid transparent',
                  color: modalTab === 'recording' ? 'var(--primary-600)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                🎥 Video Recording
                {selectedSession.recording_url && (
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
                )}
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {modalLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading session data...
                </div>
              ) : modalTab === 'report' ? (
                modalReport ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Score & Competencies */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                      <div style={{ padding: '1.5rem', background: 'var(--bg-elevated)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <ProgressRing value={selectedSession.overall_score || 0} size={100} stroke={8} color={getScoreColor(selectedSession.overall_score || 0)} />
                        <div>
                          <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)' }}>{selectedSession.overall_score}%</div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Overall Assessment Score</span>
                        </div>
                      </div>

                      <div style={{ padding: '1.25rem', background: 'var(--bg-elevated)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {Object.entries(modalReport.category_scores || {}).map(([cat, score]) => (
                          <div key={cat}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{formatCategoryName(cat)}</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{score}%</span>
                            </div>
                            <div style={{ height: 6, background: 'var(--bg-primary)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${score}%`, background: getScoreColor(score), borderRadius: 3 }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Strengths & Gaps */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
                      <div style={{ padding: '1.25rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <CheckCircle2 size={16} /> Key Strengths
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                          {(modalReport.strengths || []).map((s, idx) => (
                            <li key={idx} style={{ marginBottom: '0.35rem' }}>{s}</li>
                          ))}
                        </ul>
                      </div>

                      <div style={{ padding: '1.25rem', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <AlertTriangle size={16} /> Knowledge Gaps & Areas for Improvement
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-primary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                          {(modalReport.gaps || []).map((g, idx) => (
                            <li key={idx} style={{ marginBottom: '0.35rem' }}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    This interview is currently in progress. Final evaluation scorecard has not yet been generated.
                  </div>
                )
              ) : (
                /* Full Transcript Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {modalTurns.map((turn) => (
                    <div 
                      key={turn.turn_number}
                      style={{ 
                        padding: '1.25rem', 
                        borderRadius: '12px', 
                        border: '1px solid var(--sidebar-border)', 
                        background: 'var(--bg-elevated)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-600)', textTransform: 'uppercase' }}>
                          Turn {turn.turn_number} of {selectedSession.question_count}
                        </span>
                      </div>

                      <div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>AI Question:</span>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {turn.question}
                        </p>
                      </div>

                      <div style={{ padding: '0.75rem', background: 'var(--bg-primary)', borderRadius: '8px', borderLeft: '3px solid var(--primary-500)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Student's Answer:</span>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                          {turn.student_answer || '(No answer provided)'}
                        </p>
                      </div>

                      {turn.ai_feedback && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          AI Feedback: {turn.ai_feedback}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tab 3: Video Recording */}
              {!modalLoading && modalTab === 'recording' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Student Screen & Webcam Recording
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                        Combined screen capture & webcam picture-in-picture recorded during the mock interview for verification.
                      </p>
                    </div>

                    {selectedSession.recording_expires_at && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        background: new Date(selectedSession.recording_expires_at) < new Date() ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: new Date(selectedSession.recording_expires_at) < new Date() ? '#ef4444' : '#d97706',
                        border: `1px solid ${new Date(selectedSession.recording_expires_at) < new Date() ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                      }}>
                        {new Date(selectedSession.recording_expires_at) < new Date() 
                          ? '⚠️ Recording Expired (Auto-purged after 24h)' 
                          : `⏳ Auto-purges on: ${new Date(selectedSession.recording_expires_at).toLocaleDateString()} ${new Date(selectedSession.recording_expires_at).toLocaleTimeString()}`
                        }
                      </span>
                    )}
                  </div>

                  {selectedSession.recording_url && new Date(selectedSession.recording_expires_at || 0) >= new Date() ? (
                    <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', boxShadow: 'var(--shadow-lg)' }}>
                      <video
                        src={selectedSession.recording_url}
                        controls
                        playsInline
                        style={{ width: '100%', maxHeight: '480px', display: 'block' }}
                      />
                    </div>
                  ) : (
                    <div style={{ padding: '3.5rem 2rem', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px dashed var(--sidebar-border)' }}>
                      <AlertTriangle size={36} color="#d97706" style={{ margin: '0 auto 0.75rem' }} />
                      <h5 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        Video Recording Unavailable
                      </h5>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, maxWidth: 450, marginInline: 'auto' }}>
                        {selectedSession.recording_expires_at && new Date(selectedSession.recording_expires_at) < new Date()
                          ? 'This video recording has exceeded the 24-hour retention window and was automatically purged to protect student privacy.'
                          : 'No video was recorded for this session (camera permission was not granted by the student).'
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--sidebar-border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-elevated)' }}>
              <button 
                className="btn-secondary" 
                onClick={() => setSelectedSession(null)}
              >
                Close Verification
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
