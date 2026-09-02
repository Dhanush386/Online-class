import { useState, useEffect } from 'react'
import { 
  Bot, Search, Filter, Award, CheckCircle2, 
  Clock, Sparkles, User, ChevronRight, X, 
  BarChart2, BookOpen, AlertTriangle, Lightbulb, 
  ShieldCheck, RefreshCw, Eye, Download 
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { ProgressRing } from '../../design-system'

export default function OrganizerMockInterviews() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [trackFilter, setTrackFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Selected session for verification modal
  const [selectedSession, setSelectedSession] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)
  const [modalTurns, setModalTurns] = useState([])
  const [modalReport, setModalReport] = useState(null)
  const [modalTab, setModalTab] = useState('report') // 'report' | 'transcript'

  useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
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

  const uniqueTracks = Array.from(new Set(sessions.map(s => s.track).filter(Boolean)))

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

          {/* Track Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-muted)" />
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
              {uniqueTracks.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
            background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column',
            overflow: 'hidden', padding: 0
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
                        Student Webcam Recording
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                        Recorded during the mock interview session for verification and assessment audit.
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
