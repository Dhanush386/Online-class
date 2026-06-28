// ============================================================
// SemesterTimeline — Visual semester progress with week nodes
//
// Displays:
//   Week 1 ✅ ── Week 2 ✅ ── Week 3 ⭐ ── Week 4 🔥 ── Week 5 ⏳ ── Week 6 🔒
// ============================================================

import { Trophy, Lock, Flame, Star, CheckCircle2 } from 'lucide-react'
import PropTypes from 'prop-types'

const GRADE_COLORS = {
  'A+': '#10b981', 'A': '#10b981', 'B': '#3b82f6', 'C': '#f59e0b', 'D': '#f97316', 'F': '#ef4444',
}

function getWeekIcon(status, grade) {
  switch (status) {
    case 'completed': return <CheckCircle2 size={14} color="#fff" />
    case 'current': return <Flame size={14} color="#fff" />
    case 'inProgress': return <Star size={14} color="#fff" />
    case 'locked': return <Lock size={12} color="#94a3b8" />
    default: return null
  }
}

function getWeekStyle(status) {
  switch (status) {
    case 'completed':
      return { bg: 'linear-gradient(135deg, #10b981, #059669)', border: '#059669', shadow: '0 4px 12px rgba(16,185,129,0.25)' }
    case 'current':
      return { bg: 'linear-gradient(135deg, #3b82f6, #6366f1)', border: '#3b82f6', shadow: '0 4px 16px rgba(59,130,246,0.3)' }
    case 'inProgress':
      return { bg: 'linear-gradient(135deg, #f59e0b, #f97316)', border: '#f59e0b', shadow: '0 4px 12px rgba(245,158,11,0.25)' }
    case 'locked':
      return { bg: '#e2e8f0', border: '#cbd5e1', shadow: 'none' }
    default:
      return { bg: '#f8fafc', border: '#e2e8f0', shadow: 'none' }
  }
}

function getWeekTextColor(status, isCurrentWeek) {
  if (status === 'locked') return '#94a3b8'
  if (isCurrentWeek) return '#3b82f6'
  return 'var(--text-muted)'
}

export default function SemesterTimeline({
  weeks = [],
  weekProgress = {},
  currentWeek = 1,
  isWeekLocked,
  getWeekGrade,
}) {
  const totalWeeks = weeks.length
  const completedWeeks = Object.values(weekProgress).filter(p => p.completion_percentage >= 100).length
  const overallPct = totalWeeks > 0 ? Math.round((completedWeeks / totalWeeks) * 100) : 0

  return (
    <div className="glass-card" style={{ padding: '1.25rem', background: 'var(--card-bg)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={16} color="#f59e0b" />
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Semester Progress</h4>
        </div>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: overallPct >= 100 ? '#10b981' : '#6366f1',
        }}>
          {overallPct}%
        </span>
      </div>

      {/* Overall progress bar */}
      <div style={{
        height: 8,
        background: '#e2e8f0',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: '1.25rem',
      }}>
        <div style={{
          width: `${overallPct}%`,
          height: '100%',
          background: overallPct >= 100
            ? 'linear-gradient(90deg, #10b981, #059669)'
            : 'linear-gradient(90deg, #6366f1, #8b5cf6, #3b82f6)',
          backgroundSize: '200% 100%',
          animation: 'shimmerBar 3s ease-in-out infinite',
          borderRadius: 10,
          transition: 'width 0.5s ease',
        }} />
      </div>

      <style>{`
        @keyframes shimmerBar {
          0%, 100% { background-position: 0% 0; }
          50% { background-position: 100% 0; }
        }
      `}</style>

      {/* Week nodes */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.25rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem',
      }}>
        {weeks.map((week, idx) => {
          const weekNum = week.weekNum
          const locked = isWeekLocked?.(weekNum)
          const progress = weekProgress[weekNum]
          const pct = progress?.completion_percentage || 0
          const grade = getWeekGrade?.(weekNum)
          const isCurrentWeek = weekNum === currentWeek

          let status = 'locked'
          if (!locked) {
            if (pct >= 100) status = 'completed'
            else if (isCurrentWeek) status = 'current'
            else if (pct > 0) status = 'inProgress'
          }

          const style = getWeekStyle(status)

          return (
            <div key={weekNum} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Week node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: style.bg,
                  border: `2px solid ${style.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: style.shadow,
                  transition: 'all 0.3s ease',
                  position: 'relative',
                }}>
                  {getWeekIcon(status, grade)}

                  {/* Grade badge */}
                  {grade && status === 'completed' && (
                    <div style={{
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: GRADE_COLORS[grade] || '#6366f1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid white',
                    }}>
                      <span style={{ fontSize: '0.4rem', fontWeight: 900, color: '#fff' }}>{grade}</span>
                    </div>
                  )}
                </div>
                <span style={{
                  fontSize: '0.5rem',
                  fontWeight: 700,
                  color: getWeekTextColor(status, isCurrentWeek),
                  textTransform: 'uppercase',
                }}>
                  W{weekNum}
                </span>
              </div>

              {/* Connector */}
              {idx < weeks.length - 1 && (
                <div style={{
                  width: 12,
                  height: 2,
                  background: status === 'completed' ? '#10b981' : '#e2e8f0',
                  marginTop: -12,
                  transition: 'background 0.3s ease',
                }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer stats */}
      <div style={{
        marginTop: '0.85rem',
        paddingTop: '0.6rem',
        borderTop: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          Week {currentWeek} of {totalWeeks}
        </span>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>
          {completedWeeks} week{completedWeeks === 1 ? '' : 's'} completed
        </span>
      </div>
    </div>
  )
}

SemesterTimeline.propTypes = {
  weeks: PropTypes.arrayOf(PropTypes.any),
  weekProgress: PropTypes.shape({}),
  currentWeek: PropTypes.number,
  isWeekLocked: PropTypes.func,
  getWeekGrade: PropTypes.func
}
