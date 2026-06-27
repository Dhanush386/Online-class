// ============================================================
// SundayRevision — Smart revision day view
//
// Features:
// • Smart revision queue (sorted by mastery — lowest first)
// • ★ ratings based on mastery level
// • Health score display with breakdown
// • Pending items from the week
// • AI Coach link
// • Weekly report summary
// ============================================================

import { useState, useEffect } from 'react'
import { BookOpen, Star, Brain, Target, ChevronRight, AlertTriangle, TrendingUp, Award, Sparkles, Clock, Video, Code, ClipboardList } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useLearningHealth from '../../hooks/useLearningHealth'

const MASTERY_CONFIG = {
  beginner: { stars: 1, color: '#ef4444', label: 'Needs Practice' },
  learning: { stars: 2, color: '#f59e0b', label: 'Learning' },
  proficient: { stars: 3, color: '#3b82f6', label: 'Proficient' },
  mastered: { stars: 4, color: '#10b981', label: 'Mastered' },
}

function MasteryStars({ level, effectiveScore }) {
  const config = MASTERY_CONFIG[level] || MASTERY_CONFIG.beginner
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={12}
          color={i < config.stars ? config.color : '#e2e8f0'}
          fill={i < config.stars ? config.color : 'none'}
        />
      ))}
      <span style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        color: config.color,
        marginLeft: '0.3rem',
      }}>
        {effectiveScore}%
      </span>
    </div>
  )
}

function HealthGauge({ score, breakdown }) {
  const getColor = (s) => {
    if (s >= 80) return '#10b981'
    if (s >= 60) return '#f59e0b'
    if (s >= 40) return '#f97316'
    return '#ef4444'
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem',
    }}>
      {/* Score circle */}
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        background: `conic-gradient(${getColor(score)} ${score * 3.6}deg, #e2e8f0 0deg)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 4px 16px ${getColor(score)}25`,
      }}>
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'var(--card-bg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1.25rem', fontWeight: 900, color: getColor(score) }}>{score}</span>
          <span style={{ fontSize: '0.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>HEALTH</span>
        </div>
      </div>

      {/* Breakdown bars */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {[
          { label: 'Attendance', value: breakdown.attendance, weight: '25%' },
          { label: 'Quizzes', value: breakdown.quiz, weight: '30%' },
          { label: 'Coding', value: breakdown.coding, weight: '25%' },
          { label: 'Progress', value: breakdown.progress, weight: '20%' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.55rem', fontWeight: 600, color: 'var(--text-muted)', minWidth: 55, textAlign: 'right' }}>
              {item.label}
            </span>
            <div style={{ flex: 1, height: 4, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${item.value}%`,
                height: '100%',
                background: getColor(item.value),
                borderRadius: 4,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: '0.55rem', fontWeight: 700, color: getColor(item.value), minWidth: 25 }}>
              {item.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SundayRevision({
  courseId,
  weekNumber,
  pendingItems = [],
  weekProgress = null,
}) {
  const navigate = useNavigate()
  const { healthScore, breakdown, weakTopics, mastery, loading } = useLearningHealth(courseId)

  const pct = weekProgress?.completion_percentage || 0
  const xpEarned = weekProgress?.xp_earned || 0

  // Sort pending items by mastery (weakest first)
  const sortedPending = [...pendingItems].sort((a, b) => {
    const aContent = a._content || {}
    const bContent = b._content || {}
    const aTopic = aContent.topic || ''
    const bTopic = bContent.topic || ''
    const aMastery = mastery.find(m => m.topic === aTopic)
    const bMastery = mastery.find(m => m.topic === bTopic)
    return (aMastery?.effective_score || 100) - (bMastery?.effective_score || 100)
  })

  const MODULE_ICONS = {
    video: Video,
    live_class: Video,
    assessment: ClipboardList,
    coding: Code,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Revision Header */}
      <div className="glass-card" style={{
        padding: '1.5rem',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.03))',
        border: '1px solid rgba(139,92,246,0.15)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
          Revision Day — Week {weekNumber}
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          This week: {pct}% complete • {xpEarned} XP earned
        </p>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
        {/* Left: Pending Items (Smart Queue) */}
        <div className="glass-card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <AlertTriangle size={16} color="#f59e0b" />
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Pending Items ({sortedPending.length})
            </h4>
          </div>

          {sortedPending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem' }}>
              <Award size={32} color="#10b981" style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#10b981' }}>All caught up! 🎉</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {sortedPending.map((item, idx) => {
                const content = item._content || {}
                const topic = content.topic
                const topicMastery = mastery.find(m => m.topic === topic)
                const Icon = MODULE_ICONS[item.module_type] || BookOpen

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      if (item.module_type === 'coding' && content.id) navigate(`/student/coding/${content.id}`)
                      else if (item.module_type === 'assessment' && content.id) navigate(`/student/assessments/${content.id}/take`)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 10,
                      border: '1px solid var(--card-border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <Icon size={16} color="#8b5cf6" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {content.title || item.module_type}
                      </div>
                      {topicMastery && (
                        <MasteryStars
                          level={topicMastery.mastery_level}
                          effectiveScore={topicMastery.effective_score}
                        />
                      )}
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Health Score + Weak Topics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Health Score */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <TrendingUp size={16} color="#10b981" />
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Learning Health</h4>
            </div>
            {loading ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Calculating...</p>
            ) : (
              <HealthGauge score={healthScore} breakdown={breakdown} />
            )}
          </div>

          {/* Weak Topics */}
          {weakTopics.length > 0 && (
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Brain size={16} color="#ef4444" />
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Weakest Topics</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {weakTopics.map((topic, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.6rem',
                    borderRadius: 8,
                    background: 'rgba(239,68,68,0.04)',
                  }}>
                    <MasteryStars level={topic.mastery_level} effectiveScore={topic.effective_score} />
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      flex: 1,
                    }}>
                      {topic.topic}
                    </span>
                    {topic.days_since_practiced > 7 && (
                      <span style={{ fontSize: '0.55rem', color: '#ef4444', fontWeight: 600 }}>
                        <Clock size={10} /> {topic.days_since_practiced}d ago
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Coach CTA */}
          <button
            onClick={() => navigate('/student/ai-assistant')}
            className="glass-card"
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.05))',
              border: '1px dashed rgba(139,92,246,0.3)',
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <Sparkles size={20} color="#8b5cf6" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#8b5cf6' }}>AI Study Coach</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Get personalized recommendations based on your health score
              </div>
            </div>
            <ChevronRight size={16} color="#8b5cf6" />
          </button>
        </div>
      </div>
    </div>
  )
}
