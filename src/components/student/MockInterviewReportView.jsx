import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { 
  Award, CheckCircle2, AlertTriangle, Lightbulb, 
  ChevronDown, ChevronUp, RotateCcw, ArrowLeft, 
  Sparkles, Target, BarChart2, BookOpen, ShieldCheck 
} from 'lucide-react'
import { ProgressRing } from '../../design-system'

export default function MockInterviewReportView({ 
  session, 
  report, 
  onBackToHub, 
  onStartNew 
}) {
  const [expandedModelAnswer, setExpandedModelAnswer] = useState(0)

  if (!report) {
    return (
      <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Report data is unavailable.</p>
        <button className="btn-primary" onClick={onBackToHub} style={{ marginTop: '1rem' }}>
          Return to Hub
        </button>
      </div>
    )
  }

  const overallScore = session?.overall_score || report.overall_score || 0
  const categoryScores = report.category_scores || {}
  const strengths = report.strengths || []
  const gaps = report.gaps || []
  const modelAnswers = report.model_answers || []

  const getScoreColor = (score) => {
    if (score >= 85) return '#10b981'
    if (score >= 70) return '#6366f1'
    if (score >= 55) return '#f59e0b'
    return '#ef4444'
  }

  const getScoreLabel = (score) => {
    if (score >= 85) return 'Advanced / Strong Hire'
    if (score >= 70) return 'Proficient / Hire'
    if (score >= 55) return 'Developing / Lean Hire'
    return 'Needs Practice'
  }

  const formatCategoryName = (key) => {
    return key
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem', paddingBottom: '3rem' }}>
      
      {/* Top Header & Nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button 
            onClick={onBackToHub}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.4rem 0.85rem' }}
          >
            <ArrowLeft size={16} /> Back to Interview Hub
          </button>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Sparkles size={28} color="#7c3aed" /> Interview Performance Report
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Track: <strong style={{ color: 'var(--text-primary)' }}>{session?.track}</strong> • {session?.question_count} Questions
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={onStartNew}
            className="btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem' }}
          >
            <RotateCcw size={16} /> Start Another Interview
          </button>
        </div>
      </div>

      {/* Video Recording Player (24h Retention) */}
      {session?.recording_url && (
        <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              🎥 Interview Video Recording
            </h3>
            
            {session.recording_expires_at && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                background: new Date(session.recording_expires_at) < new Date() ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.12)',
                color: new Date(session.recording_expires_at) < new Date() ? '#ef4444' : '#d97706',
                border: `1px solid ${new Date(session.recording_expires_at) < new Date() ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
              }}>
                {new Date(session.recording_expires_at) < new Date() 
                  ? '⚠️ Expired & Deleted (24h Retention)'
                  : '⏳ Available for 24 hours (Auto-deletes afterwards)'
                }
              </span>
            )}
          </div>

          {new Date(session.recording_expires_at || 0) < new Date() ? (
            <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px dashed var(--sidebar-border)' }}>
              <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
                This recording has reached its 24-hour retention limit and has been automatically removed.
              </p>
            </div>
          ) : (
            <div style={{ borderRadius: '12px', overflow: 'hidden', background: '#000', boxShadow: 'var(--shadow-md)' }}>
              <video
                src={session.recording_url}
                controls
                playsInline
                style={{ width: '100%', maxHeight: '420px', display: 'block' }}
              />
            </div>
          )}
        </div>
      )}

      {/* Row 1: Overall Score & Category Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Overall Score Card */}
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '1rem' }}>
          <div style={{ position: 'relative', width: 140, height: 140 }}>
            <ProgressRing value={overallScore} size={140} stroke={10} color={getScoreColor(overallScore)} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>{overallScore}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Out of 100</span>
            </div>
          </div>
          
          <div>
            <span style={{ 
              display: 'inline-block',
              padding: '0.35rem 0.9rem', 
              borderRadius: '999px', 
              fontSize: '0.85rem', 
              fontWeight: 700, 
              background: `${getScoreColor(overallScore)}18`,
              color: getScoreColor(overallScore),
              border: `1px solid ${getScoreColor(overallScore)}40`
            }}>
              {getScoreLabel(overallScore)}
            </span>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.75rem', maxWidth: 280 }}>
              Evaluated across technical correctness, explanation clarity, depth, and structured problem solving.
            </p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)' }}>
            <BarChart2 size={20} color="var(--primary-600)" /> Competency Breakdown
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {Object.entries(categoryScores).map(([category, score]) => (
              <div key={category}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{formatCategoryName(category)}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{score}%</span>
                </div>
                <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      height: '100%', 
                      width: `${score}%`, 
                      background: getScoreColor(score), 
                      borderRadius: 4,
                      transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' 
                    }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Row 2: Strengths & Growth Areas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Strengths */}
        <div className="glass-card" style={{ padding: '1.75rem', borderLeft: '4px solid #10b981' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
            <CheckCircle2 size={20} /> Key Strengths
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {strengths.length > 0 ? strengths.map((item, idx) => (
              <div key={idx} style={{ padding: '0.85rem 1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                <span style={{ color: '#10b981', fontWeight: 700, marginTop: '1px' }}>•</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>{item}</span>
              </div>
            )) : <p style={{ color: 'var(--text-muted)' }}>Keep practicing to uncover and showcase your key strengths.</p>}
          </div>
        </div>

        {/* Growth Areas (Gaps) */}
        <div className="glass-card" style={{ padding: '1.75rem', borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
            <AlertTriangle size={20} /> Focus & Improvement Areas
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {gaps.length > 0 ? gaps.map((item, idx) => (
              <div key={idx} style={{ padding: '0.85rem 1rem', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '10px', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                <span style={{ color: '#f59e0b', fontWeight: 700, marginTop: '1px' }}>•</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>{item}</span>
              </div>
            )) : <p style={{ color: 'var(--text-muted)' }}>No critical knowledge gaps detected!</p>}
          </div>
        </div>

      </div>

      {/* Row 3: Model Answers & Coaching Insights */}
      {modelAnswers.length > 0 && (
        <div className="glass-card" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-primary)' }}>
              <BookOpen size={22} color="var(--primary-600)" /> Exemplary Model Answers & Takeaways
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Detailed breakdown of recommended answer structures for targeted interview questions.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {modelAnswers.map((item, idx) => {
              const isExpanded = expandedModelAnswer === idx
              return (
                <div 
                  key={idx} 
                  style={{ 
                    borderRadius: '12px', 
                    border: '1px solid var(--sidebar-border)', 
                    background: 'var(--bg-primary)',
                    overflow: 'hidden' 
                  }}
                >
                  <button
                    onClick={() => setExpandedModelAnswer(isExpanded ? -1 : idx)}
                    style={{
                      width: '100%',
                      padding: '1.1rem 1.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: isExpanded ? 'var(--bg-elevated)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ 
                        background: 'var(--primary-100)', 
                        color: 'var(--primary-700)', 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        padding: '3px 8px', 
                        borderRadius: '6px' 
                      }}>
                        Q{idx + 1}
                      </span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.question}
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>

                  {isExpanded && (
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', borderTop: '1px solid var(--sidebar-border)' }}>
                      
                      {/* Candidate summary */}
                      {item.student_summary && (
                        <div style={{ padding: '0.85rem', background: 'var(--bg-elevated)', borderRadius: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                            Your Answer Summary
                          </span>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                            {item.student_summary}
                          </p>
                        </div>
                      )}

                      {/* Ideal answer */}
                      <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                          <ShieldCheck size={14} /> Recommended Model Answer
                        </span>
                        <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {item.ideal_answer}
                        </p>
                      </div>

                      {/* Key takeaway */}
                      {item.key_takeaway && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.85rem', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          <Lightbulb size={18} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
                          <div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', display: 'block', marginBottom: '0.15rem' }}>
                              Interview Principle
                            </span>
                            <span style={{ fontSize: '0.9rem', color: '#92400e', fontWeight: 500, lineHeight: 1.4 }}>
                              {item.key_takeaway}
                            </span>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}

MockInterviewReportView.propTypes = {
  session: PropTypes.object,
  report: PropTypes.object,
  onBackToHub: PropTypes.func.isRequired,
  onStartNew: PropTypes.func.isRequired,
}
