// ============================================================
// DayDetailPanel — Slides in when a day node is clicked
//
// Shows:
// • Day name + date + time
// • Ordered list of modules with status/XP
// • Sunday → renders revision view
// ============================================================

import PropTypes from 'prop-types'
import { Video, BookOpen, Code, ClipboardList, FileText, Radio, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react'
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

function getDifficultyColor(difficulty) {
  if (difficulty === 'hard') return '#ef4444'
  if (difficulty === 'medium') return '#f59e0b'
  return '#10b981'
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
    <button
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        padding: '0.85rem 1rem',
        borderRadius: 12,
        background: isCompleted ? 'rgba(16,185,129,0.04)' : 'rgba(0,0,0,0.01)',
        border: `1px solid ${isCompleted ? 'rgba(16,185,129,0.15)' : 'var(--card-border)'}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        width: '100%',
        textAlign: 'left',
        fontFamily: 'inherit',
        color: 'inherit'
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
                color: getDifficultyColor(content.difficulty),
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
    </button>
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

  const dateStr = formatScheduleDate(day.scheduleDate)
  const timeStr = formatScheduleTime(day.startTime, day.endTime)

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
      <DayDetailHeader
        isRevision={isRevision}
        weekNum={weekNum}
        dayName={dayName}
        dayTitle={day.title}
        dateStr={dateStr}
        timeStr={timeStr}
        onClose={onClose}
      />

      <DayDetailProgress
        totalRequired={totalRequired}
        completed={completed}
        totalXp={totalXp}
      />

      {/* Module list */}
      <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {modules.length === 0 ? (
          <DayDetailEmpty isRevision={isRevision} />
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
              gap: '0.85rem',
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

ModuleRow.propTypes = {
  module: PropTypes.shape({
    module_type: PropTypes.string,
    _content: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      title: PropTypes.string,
      difficulty: PropTypes.string
    }),
    _completed: PropTypes.bool,
    _xpEarned: PropTypes.number,
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    reference_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
  }).isRequired,
  courseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onAction: PropTypes.func
}

DayDetailPanel.propTypes = {
  weekNum: PropTypes.number,
  dayOfWeek: PropTypes.number,
  day: PropTypes.shape({
    isRevision: PropTypes.bool,
    modules: PropTypes.array,
    title: PropTypes.string,
    scheduleDate: PropTypes.string,
    startTime: PropTypes.string,
    endTime: PropTypes.string
  }),
  courseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  isVisible: PropTypes.bool,
  onClose: PropTypes.func,
  onModuleAction: PropTypes.func
}
