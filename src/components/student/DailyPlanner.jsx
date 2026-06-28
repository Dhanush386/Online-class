// ============================================================
// DailyPlanner — Today's schedule with real times
// Uses weekly_schedule.start_time + learning_path_modules
// ============================================================

import { Clock, Video, Radio, Code, ClipboardList, FileText, BookOpen, ChevronRight, CheckCircle2, Target } from 'lucide-react'
import { getDayName } from '../../constants/xpRewards'

const MODULE_ICONS = {
  video: { icon: Video, color: '#3b82f6', label: 'Recorded Video' },
  live_class: { icon: Radio, color: '#ef4444', label: 'Live Class' },
  assessment: { icon: ClipboardList, color: '#10b981', label: 'Quiz' },
  coding: { icon: Code, color: '#f59e0b', label: 'Coding' },
  resource: { icon: FileText, color: '#8b5cf6', label: 'Material' },
  assignment: { icon: FileText, color: '#f97316', label: 'Assignment' },
  notes: { icon: BookOpen, color: '#06b6d4', label: 'Notes' },
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  return `${displayHour}:${m} ${ampm}`
}

export default function DailyPlanner({
  dayModules = [],
  scheduleDate = null,
  startTime = null,
  dayOfWeek = null,
  dailyGoal = null,
  onModuleClick,
}) {
  const today = new Date()
  const dateStr = scheduleDate
    ? new Date(scheduleDate).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
    : today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })

  const completedCount = dayModules.filter(m => m._completed).length
  const totalCount = dayModules.filter(m => m.is_required !== false).length

  return (
    <div className="glass-card" style={{
      padding: '1.25rem',
      background: 'var(--card-bg)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={16} color="#3b82f6" />
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Today's Plan</h4>
        </div>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>{dateStr}</span>
      </div>

      {/* Daily Goal Progress */}
      {dailyGoal && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          padding: '0.6rem 0.75rem',
          borderRadius: 10,
          background: dailyGoal.is_completed
            ? 'rgba(16,185,129,0.06)'
            : 'rgba(59,130,246,0.04)',
          border: `1px solid ${dailyGoal.is_completed ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.1)'}`,
          marginBottom: '0.75rem',
        }}>
          <Target size={14} color={dailyGoal.is_completed ? '#10b981' : '#3b82f6'} />
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: dailyGoal.is_completed ? '#10b981' : 'var(--text-secondary)',
            flex: 1,
          }}>
            {dailyGoal.is_completed
              ? '🎯 Daily Goal Complete!'
              : `Daily Goal: ${dailyGoal.completed_activities}/${dailyGoal.target_activities} activities`
            }
          </span>
          {!dailyGoal.is_completed && (
            <span style={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: 700 }}>+20 XP</span>
          )}
        </div>
      )}

      {/* Module timeline */}
      {dayModules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-muted)' }}>
          <Clock size={28} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.8rem', fontWeight: 500 }}>No activities scheduled for today</p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Vertical timeline line */}
          <div style={{
            position: 'absolute',
            left: 15,
            top: 8,
            bottom: 8,
            width: 2,
            background: 'linear-gradient(180deg, var(--card-border), transparent)',
            borderRadius: 2,
          }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {dayModules.map((module, idx) => {
              const config = MODULE_ICONS[module.module_type] || MODULE_ICONS.resource
              const Icon = config.icon
              const content = module._content || {}
              const isCompleted = module._completed || false

              // Estimate time slot based on position
              const baseHour = startTime ? parseInt(startTime.split(':')[0]) : 9
              const slotHour = baseHour + idx
              const timeLabel = `${slotHour > 12 ? slotHour - 12 : slotHour}:00 ${slotHour >= 12 ? 'PM' : 'AM'}`

              return (
                <div
                  key={module.id || idx}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onModuleClick?.(module)
                    }
                  }}
                  onClick={() => onModuleClick?.(module)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.65rem',
                    paddingLeft: '2rem',
                    padding: '0.5rem 0.65rem 0.5rem 2.25rem',
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(59,130,246,0.04)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                  onFocus={e => {
                    e.currentTarget.style.background = 'rgba(59,130,246,0.04)'
                  }}
                  onBlur={e => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: 10,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: isCompleted ? '#10b981' : config.color + '30',
                    border: `2px solid ${isCompleted ? '#10b981' : config.color}`,
                    zIndex: 1,
                  }}>
                    {isCompleted && (
                      <CheckCircle2 size={8} color="#fff" style={{ position: 'absolute', top: 0, left: 0 }} />
                    )}
                  </div>

                  {/* Time */}
                  <span style={{
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    minWidth: 48,
                    flexShrink: 0,
                  }}>
                    {timeLabel}
                  </span>

                  {/* Icon */}
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: isCompleted ? 'rgba(16,185,129,0.1)' : `${config.color}12`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isCompleted ? (
                      <CheckCircle2 size={14} color="#10b981" />
                    ) : (
                      <Icon size={14} color={config.color} />
                    )}
                  </div>

                  {/* Title */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: isCompleted ? 'var(--text-muted)' : 'var(--text-primary)',
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {content.title || config.label}
                    </div>
                  </div>

                  {/* Action */}
                  {!isCompleted && (
                    <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer summary */}
      {totalCount > 0 && (
        <div style={{
          marginTop: '0.75rem',
          paddingTop: '0.6rem',
          borderTop: '1px solid var(--card-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {completedCount}/{totalCount} completed
          </span>
          <div style={{
            width: 60,
            height: 4,
            background: '#e2e8f0',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%`,
              height: '100%',
              background: completedCount >= totalCount ? '#10b981' : '#3b82f6',
              borderRadius: 10,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}
