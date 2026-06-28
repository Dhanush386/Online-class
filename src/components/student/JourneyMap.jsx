// ============================================================
// JourneyMap — Visual learning roadmap (signature Learnova UI)
//
// Renders a horizontal node chain per week:
//   Mon ── Tue ── Wed ── Thu ── Fri ── Sat ── Sun
//
// Features:
// • Nodes colored by status (green/amber/gray/purple)
// • Current day pulses with glow animation
// • Week header shows grade badge
// • Locked weeks show padlock
// • Clicking a node fires onDaySelect callback
// ============================================================

import { useState } from 'react'
import PropTypes from 'prop-types'
import { Lock, ChevronDown, ChevronRight, Trophy, BookOpen } from 'lucide-react'
import { getDayShort } from '../../constants/xpRewards'

const STATUS_COLORS = {
  completed: { bg: '#10b981', border: '#059669', text: '#fff', glow: '0 0 12px rgba(16,185,129,0.4)' },
  inProgress: { bg: '#f59e0b', border: '#d97706', text: '#fff', glow: '0 0 12px rgba(245,158,11,0.4)' },
  locked: { bg: '#e2e8f0', border: '#cbd5e1', text: '#94a3b8', glow: 'none' },
  revision: { bg: '#8b5cf6', border: '#7c3aed', text: '#fff', glow: '0 0 12px rgba(139,92,246,0.4)' },
  current: { bg: '#3b82f6', border: '#2563eb', text: '#fff', glow: '0 0 16px rgba(59,130,246,0.5)' },
  empty: { bg: '#f8fafc', border: '#e2e8f0', text: '#94a3b8', glow: 'none' },
}

const GRADE_COLORS = {
  'A+': '#10b981', 'A': '#10b981', 'B': '#3b82f6', 'C': '#f59e0b', 'D': '#f97316', 'F': '#ef4444',
}

function getDayStatus(day, weekLocked, isCurrentDay) {
  if (weekLocked) return 'locked'
  if (day.dayOfWeek === 7) return 'revision'
  if (isCurrentDay) return 'current'
  if (!day.modules || day.modules.length === 0) return 'empty'

  const total = day.modules.filter(m => m.is_required !== false).length
  const completed = day.modules.filter(m => m._completed).length

  if (total === 0) return 'empty'
  if (completed >= total) return 'completed'
  if (completed > 0) return 'inProgress'
  return 'locked'
}

function DayNodeIcon({ weekLocked, status, colors, totalModules, completedModules }) {
  if (weekLocked) {
    return <Lock size={16} color={colors.text} />
  }
  if (status === 'completed') {
    return <span style={{ fontSize: '1rem' }}>✓</span>
  }
  if (status === 'revision') {
    return <BookOpen size={16} color={colors.text} />
  }
  if (status === 'inProgress') {
    return <span style={{ fontSize: '0.7rem', fontWeight: 800, color: colors.text }}>{completedModules}/{totalModules}</span>
  }
  if (totalModules > 0) {
    return <span style={{ fontSize: '0.7rem', fontWeight: 800, color: colors.text }}>{totalModules}</span>
  }
  return <span style={{ fontSize: '0.85rem', color: colors.text }}>–</span>
}

function getBoxShadow(status, isSelected, glow) {
  if (status === 'current') return `${glow}, 0 4px 12px rgba(0,0,0,0.1)`
  if (isSelected) return '0 4px 16px rgba(99,102,241,0.3)'
  return '0 2px 6px rgba(0,0,0,0.08)'
}

function DayNode({ day, status, isSelected, onClick, weekLocked, dateStr }) {
  const colors = STATUS_COLORS[status]
  const dayShort = getDayShort(day.dayOfWeek)
  const totalModules = day.modules?.filter(m => m.is_required !== false).length || 0
  const completedModules = day.modules?.filter(m => m._completed).length || 0

  const boxShadow = getBoxShadow(status, isSelected, colors.glow)
  const labelColor = isSelected ? '#6366f1' : status === 'current' ? '#3b82f6' : 'var(--text-muted)'

  return (
    <button
      onClick={() => !weekLocked && onClick?.(day)}
      disabled={weekLocked}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.35rem',
        background: 'none',
        border: 'none',
        cursor: weekLocked ? 'not-allowed' : 'pointer',
        padding: 0,
        opacity: weekLocked ? 0.5 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Node circle */}
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: isSelected ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : colors.bg,
          border: `3px solid ${isSelected ? '#4f46e5' : colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow,
          animation: status === 'current' ? 'journeyPulse 2s ease-in-out infinite' : 'none',
          transition: 'all 0.25s ease',
          transform: isSelected ? 'scale(1.15)' : 'scale(1)',
        }}
      >
        <DayNodeIcon 
          weekLocked={weekLocked} 
          status={status} 
          colors={colors} 
          totalModules={totalModules} 
          completedModules={completedModules} 
        />
      </div>

      {/* Day label */}
      <span style={{
        fontSize: '0.85rem',
        fontWeight: 700,
        color: labelColor,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {dayShort}
      </span>

      {/* Date label */}
      {dateStr && (
        <span style={{
          fontSize: '0.55rem',
          color: 'var(--text-muted)',
          fontWeight: 500,
        }}>
          {dateStr}
        </span>
      )}
    </button>
  )
}

function ConnectorLine({ fromStatus, toStatus }) {
  const isActive = fromStatus === 'completed'
  return (
    <div style={{
      flex: 1,
      height: 3,
      marginTop: -20,
      background: isActive
        ? 'linear-gradient(90deg, #10b981, #10b981)'
        : 'linear-gradient(90deg, #e2e8f0, #e2e8f0)',
      borderRadius: 4,
      minWidth: 16,
      maxWidth: 50,
      transition: 'background 0.3s ease',
    }} />
  )
}

function JourneyWeekCard({
  week,
  locked,
  expanded,
  progress,
  grade,
  isCurrentWeek,
  toggleWeek,
  todayDow,
  selectedDay,
  getScheduleDate,
  onDaySelect,
}) {
  const weekNum = week.weekNum
  const pct = progress?.completion_percentage || 0

  return (
    <div
      className="glass-card"
      style={{
        overflow: 'hidden',
        border: isCurrentWeek ? '2px solid rgba(59,130,246,0.3)' : '1px solid var(--card-border)',
        background: locked ? 'rgba(0,0,0,0.02)' : 'var(--card-bg)',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Week Header */}
      <button
        onClick={() => toggleWeek(weekNum)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          padding: '1rem 1.25rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Expand icon */}
        <div style={{ color: 'var(--text-muted)', transition: 'transform 0.2s' }}>
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>

        {/* Week number badge */}
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: locked
            ? '#e2e8f0'
            : isCurrentWeek
              ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
              : pct >= 100
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {locked ? (
            <Lock size={14} color="#94a3b8" />
          ) : pct >= 100 ? (
            <Trophy size={14} color="#fff" />
          ) : (
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 800,
              color: isCurrentWeek ? '#fff' : '#64748b',
            }}>
              {weekNum}
            </span>
          )}
        </div>

        {/* Week info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: locked ? 'var(--text-muted)' : 'var(--text-primary)',
            }}>
              Week {weekNum}
            </span>
            {isCurrentWeek && (
              <span style={{
                fontSize: '0.6rem',
                fontWeight: 700,
                color: '#3b82f6',
                background: 'rgba(59,130,246,0.1)',
                padding: '0.15rem 0.5rem',
                borderRadius: 20,
                textTransform: 'uppercase',
              }}>
                Current
              </span>
            )}
            {grade && grade !== 'F' && (
              <span style={{
                fontSize: '0.85rem',
                fontWeight: 800,
                color: GRADE_COLORS[grade] || '#64748b',
                background: `${GRADE_COLORS[grade] || '#64748b'}15`,
                padding: '0.15rem 0.5rem',
                borderRadius: 20,
              }}>
                {grade}
              </span>
            )}
          </div>
          {locked && (
            <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600 }}>
              Complete Week {weekNum - 1} (≥70%) to unlock
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!locked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <div style={{
              width: 80,
              height: 6,
              background: '#e2e8f0',
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`,
                height: '100%',
                background: pct >= 100
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                borderRadius: 10,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: pct >= 100 ? '#10b981' : 'var(--text-muted)',
              minWidth: 32,
              textAlign: 'right',
            }}>
              {pct}%
            </span>
          </div>
        )}
      </button>

      {/* Day nodes (expanded) */}
      {expanded && (
        <div style={{
          padding: '0.5rem 1.25rem 1.25rem',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: '0.25rem',
          overflowX: 'auto',
        }}>
          {week.days.map((day, idx) => {
            const isCurrentDay = isCurrentWeek && day.dayOfWeek === todayDow
            const status = getDayStatus(day, locked, isCurrentDay)
            const isSelected = selectedDay?.weekNum === weekNum && selectedDay?.dayOfWeek === day.dayOfWeek

            // Format date if available
            let dateStr = null
            if (day.scheduleDate) {
              const d = new Date(day.scheduleDate)
              dateStr = `${d.getDate()}/${d.getMonth() + 1}`
            } else if (getScheduleDate) {
              const d = getScheduleDate(weekNum, day.dayOfWeek)
              if (d) dateStr = `${d.getDate()}/${d.getMonth() + 1}`
            }

            return (
              <div key={day.dayOfWeek} style={{ display: 'flex', alignItems: 'center' }}>
                <DayNode
                  day={day}
                  status={status}
                  isSelected={isSelected}
                  onClick={() => onDaySelect?.({ weekNum, dayOfWeek: day.dayOfWeek, day })}
                  weekLocked={locked}
                  dateStr={dateStr}
                />
                {idx < week.days.length - 1 && (
                  <ConnectorLine fromStatus={status} toStatus={getDayStatus(week.days[idx + 1], locked, false)} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function JourneyMap({
  weeks = [],
  weekProgress = {},
  isWeekLocked,
  getWeekGrade,
  getScheduleDate,
  currentWeek = 1,
  selectedDay = null,
  onDaySelect,
  onWeekToggle,
}) {
  const [expandedWeeks, setExpandedWeeks] = useState(() => {
    // Default: expand current week
    const set = new Set()
    set.add(currentWeek)
    return set
  })

  const toggleWeek = (weekNum) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      if (next.has(weekNum)) next.delete(weekNum)
      else next.add(weekNum)
      return next
    })
    onWeekToggle?.(weekNum)
  }

  // Determine today's day of week (1=Mon..7=Sun)
  const todayDow = (() => {
    const d = new Date().getDay()
    return d === 0 ? 7 : d // Convert JS Sunday=0 to our Sunday=7
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Pulse animation */}
      <style>{`
        @keyframes journeyPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(59,130,246,0.3), 0 4px 12px rgba(0,0,0,0.1); }
          50% { box-shadow: 0 0 20px rgba(59,130,246,0.5), 0 4px 16px rgba(0,0,0,0.15); }
        }
      `}</style>

      {weeks.map(week => {
        const weekNum = week.weekNum
        const locked = isWeekLocked?.(weekNum)
        const expanded = expandedWeeks.has(weekNum)
        const progress = weekProgress[weekNum]
        const grade = getWeekGrade?.(weekNum)
        const isCurrentWeek = weekNum === currentWeek

        return (
          <JourneyWeekCard
            key={weekNum}
            week={week}
            locked={locked}
            expanded={expanded}
            progress={progress}
            grade={grade}
            isCurrentWeek={isCurrentWeek}
            toggleWeek={toggleWeek}
            todayDow={todayDow}
            selectedDay={selectedDay}
            getScheduleDate={getScheduleDate}
            onDaySelect={onDaySelect}
          />
        )
      })}
    </div>
  )
}
DayNodeIcon.propTypes = {
  weekLocked: PropTypes.bool,
  status: PropTypes.string,
  colors: PropTypes.object,
  totalModules: PropTypes.number,
  completedModules: PropTypes.number
}

DayNode.propTypes = {
  day: PropTypes.object,
  status: PropTypes.string,
  isSelected: PropTypes.bool,
  onClick: PropTypes.func,
  weekLocked: PropTypes.bool,
  dateStr: PropTypes.string
}

JourneyWeekCard.propTypes = {
  week: PropTypes.object,
  locked: PropTypes.bool,
  expanded: PropTypes.bool,
  progress: PropTypes.number,
  grade: PropTypes.string,
  isCurrentWeek: PropTypes.bool,
  toggleWeek: PropTypes.func,
  todayDow: PropTypes.number,
  selectedDay: PropTypes.object,
  getScheduleDate: PropTypes.func,
  onDaySelect: PropTypes.func
}

JourneyMap.propTypes = {
  weeks: PropTypes.array,
  weekProgress: PropTypes.object,
  isWeekLocked: PropTypes.func,
  getWeekGrade: PropTypes.func,
  getScheduleDate: PropTypes.func,
  currentWeek: PropTypes.number,
  selectedDay: PropTypes.object,
  onDaySelect: PropTypes.func,
  onWeekToggle: PropTypes.func
}
