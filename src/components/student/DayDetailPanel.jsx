// ============================================================
// DayDetailPanel — Slides in when a day node is clicked
//
// Shows:
// • Day name + date + time
// • Ordered list of modules with status/XP
// • Sunday → renders revision view
// ============================================================

import { X, Video, BookOpen, Code, ClipboardList, FileText, Radio, Award, Lock, CheckCircle2, Clock, ChevronRight, Sparkles } from 'lucide-react'
import { getDayName } from '../../constants/xpRewards'
import { useNavigate } from 'react-router-dom'

const MODULE_ICONS = {
  video: { icon: Video, color: '#3b82f6', label: 'Recorded Video' },
  live_class: { icon: Radio, color: '#ef4444', label: 'Live Class' },
  assessment: { icon: ClipboardList, color: '#10b981', label: 'Quiz / Assessment' },
  coding: { icon: Code, color: '#f59e0b', label: 'Coding Practice' },
  resource: { icon: FileText, color: '#8b5cf6', label: 'Study Material' },
  assignment: { icon: FileText, color: '#f97316', label: 'Assignment' },
  notes: { icon: BookOpen, color: '#06b6d4', label: 'Notes' },
}

function ModuleRow({ module, courseId, onAction }) {
  const navigate = useNavigate()
  const config = MODULE_ICONS[module.module_type] || MODULE_ICONS.resource
  const Icon = config.icon
  const content = module._content || {}
  const isCompleted = module._completed || false
  const xpEarned = module._xpEarned || 0

  const handleClick = () => {
    switch (module.module_type) {
      case 'video':
      case 'live_class':
        onAction?.('watch', module)
        break
      case 'coding':
        if (content.id) navigate(`/student/coding/${content.id}`)
        break
      case 'assessment':
        if (content.id) navigate(`/student/assessments/${content.id}/take`)
        break
      case 'resource':
        onAction?.('viewResource', module)
        break
      default:
        onAction?.('view', module)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.85rem 1rem',
        borderRadius: 12,
        background: isCompleted ? 'rgba(16,185,129,0.04)' : 'rgba(0,0,0,0.01)',
        border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.15)' : 'var(--card-border)'}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = isCompleted ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.04)'
        e.currentTarget.style.transform = 'translateX(4px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isCompleted ? 'rgba(16,185,129,0.04)' : 'rgba(0,0,0,0.01)'
        e.currentTarget.style.transform = 'translateX(0)'
      }}
      onFocus={e => {
        e.currentTarget.style.background = isCompleted ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.04)'
        e.currentTarget.style.transform = 'translateX(4px)'
      }}
      onBlur={e => {
        e.currentTarget.style.background = isCompleted ? 'rgba(16,185,129,0.04)' : 'rgba(0,0,0,0.01)'
        e.currentTarget.style.transform = 'translateX(0)'
      }}
    >
      {/* Status icon */}
      <div style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: isCompleted
          ? 'linear-gradient(135deg, #10b981, #059669)'
          : `${config.color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {isCompleted ? (
          <CheckCircle2 size={16} color="#fff" />
        ) : (
          <Icon size={16} color={config.color} />
        )}
      </div>

      {/* Content info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {content.title || config.label}
        </div>
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          marginTop: '0.15rem',
        }}>
          <span style={{ color: config.color, fontWeight: 600 }}>{config.label}</span>
          {content.difficulty && (
            <>
              <span>•</span>
              <span style={{
                textTransform: 'uppercase',
                fontWeight: 700,
                color: content.difficulty === 'hard' ? '#ef4444' : content.difficulty === 'medium' ? '#f59e0b' : '#10b981',
              }}>
                {content.difficulty}
              </span>
            </>
          )}
        </div>
      </div>

      {/* XP earned or potential */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        {isCompleted && xpEarned > 0 && (
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: '#10b981',
            background: 'rgba(16,185,129,0.1)',
            padding: '0.2rem 0.5rem',
            borderRadius: 20,
          }}>
            +{xpEarned} XP
          </span>
        )}
        <ChevronRight size={14} color="var(--text-muted)" />
      </div>
    </div>
  )
}

export default function DayDetailPanel({
  weekNum,
  dayOfWeek,
  day,
  courseId,
  isVisible,
  onClose,
  onModuleAction,
}) {
  const navigate = useNavigate()

  if (!isVisible || !day) return null

  const dayName = getDayName(dayOfWeek)
  const isRevision = day.isRevision || dayOfWeek === 7
  const modules = day.modules || []
  const totalRequired = modules.filter(m => m.is_required !== false).length
  const completed = modules.filter(m => m._completed).length
  const totalXp = modules.reduce((sum, m) => sum + (m._xpEarned || 0), 0)

  // Format schedule date
  let dateStr = ''
  if (day.scheduleDate) {
    const d = new Date(day.scheduleDate)
    dateStr = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  // Format time
  let timeStr = ''
  if (day.startTime) {
    const [h, m] = day.startTime.split(':')
    const hour = parseInt(h)
    timeStr = `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`
    if (day.endTime) {
      const [h2, m2] = day.endTime.split(':')
      const hour2 = parseInt(h2)
      timeStr += ` – ${hour2 > 12 ? hour2 - 12 : hour2}:${m2} ${hour2 >= 12 ? 'PM' : 'AM'}`
    }
  }

  return (
    <div
      className="animate-slide-up"
      style={{
        background: 'var(--card-bg)',
        borderRadius: 20,
        border: '1px solid var(--card-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        marginTop: '1rem',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '1.25rem 1.5rem',
        background: isRevision
          ? 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(139,92,246,0.03))'
          : 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(99,102,241,0.03))',
        borderBottom: '1px solid var(--card-border)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              color: isRevision ? '#8b5cf6' : '#3b82f6',
              background: isRevision ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)',
              padding: '0.15rem 0.5rem',
              borderRadius: 20,
              textTransform: 'uppercase',
            }}>
              Week {weekNum} • {dayName}
            </span>
          </div>
          <h3 style={{
            fontSize: '1.1rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '0.2rem',
          }}>
            {isRevision ? '📚 Revision Day' : (day.title || dayName)}
          </h3>
          {dateStr && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Clock size={12} /> {dateStr} {timeStr && `• ${timeStr}`}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: 4,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Progress summary */}
      {totalRequired > 0 && (
        <div style={{
          padding: '0.75rem 1.5rem',
          borderBottom: '1px solid var(--card-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          background: 'rgba(0,0,0,0.01)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              height: 6,
              background: '#e2e8f0',
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${totalRequired > 0 ? (completed / totalRequired) * 100 : 0}%`,
                height: '100%',
                background: completed >= totalRequired
                  ? 'linear-gradient(90deg, #10b981, #059669)'
                  : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                borderRadius: 10,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {completed}/{totalRequired} done
          </span>
          {totalXp > 0 && (
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#f59e0b',
              background: 'rgba(245,158,11,0.1)',
              padding: '0.2rem 0.5rem',
              borderRadius: 20,
            }}>
              {totalXp} XP
            </span>
          )}
        </div>
      )}

      {/* Module list */}
      <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {modules.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            color: 'var(--text-muted)',
          }}>
            <BookOpen size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>
              {isRevision ? 'No pending items — great job!' : 'No content scheduled for this day yet.'}
            </p>
          </div>
        ) : (
          modules.map(module => (
            <ModuleRow
              key={module.id || module.reference_id}
              module={module}
              courseId={courseId}
              onAction={onModuleAction}
            />
          ))
        )}

        {/* Sunday: AI Coach link */}
        {isRevision && (
          <button
            onClick={() => navigate('/student/ai-assistant')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem',
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.05))',
              border: '1px dashed rgba(139,92,246,0.3)',
              cursor: 'pointer',
              marginTop: '0.5rem',
            }}
          >
            <Sparkles size={18} color="#8b5cf6" />
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#8b5cf6' }}>Ask AI Coach</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Get personalized revision recommendations</div>
            </div>
            <ChevronRight size={14} color="#8b5cf6" />
          </button>
        )}
      </div>
    </div>
  )
}
