// ============================================================
// XpTimeline — Today's XP breakdown card
//
// Shows each XP event earned today with module type icon,
// reason text, multiplier info, and running total.
// ============================================================

import { Star, Video, Code, ClipboardList, Radio, Flame, Trophy, Target, Award } from 'lucide-react'

const EVENT_ICONS = {
  live_class_full: { icon: Radio, color: '#ef4444', emoji: '📺' },
  live_class_partial: { icon: Radio, color: '#f97316', emoji: '📺' },
  recorded_video: { icon: Video, color: '#3b82f6', emoji: '📹' },
  quiz_high: { icon: ClipboardList, color: '#10b981', emoji: '📝' },
  quiz_mid: { icon: ClipboardList, color: '#f59e0b', emoji: '📝' },
  quiz_low: { icon: ClipboardList, color: '#ef4444', emoji: '📝' },
  coding_solve: { icon: Code, color: '#8b5cf6', emoji: '💻' },
  coding_all_tests: { icon: Code, color: '#10b981', emoji: '💻' },
  coding_first_attempt: { icon: Code, color: '#f59e0b', emoji: '💻' },
  daily_streak: { icon: Flame, color: '#ef4444', emoji: '🔥' },
  weekly_bonus: { icon: Trophy, color: '#f59e0b', emoji: '🏆' },
  daily_goal: { icon: Target, color: '#10b981', emoji: '🎯' },
  attendance_badge: { icon: Award, color: '#3b82f6', emoji: '🏅' },
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${hour}:${m} ${ampm}`
}

export default function XpTimeline({ events = [], totalXp = 0, totalCoins = 0 }) {
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })

  if (events.length === 0) {
    return (
      <div className="glass-card" style={{
        padding: '1.25rem',
        background: 'var(--card-bg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Star size={16} color="#f59e0b" />
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Today's XP</h4>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{dateStr}</span>
        </div>
        <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--text-muted)' }}>
          <Star size={28} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
          <p style={{ fontSize: '0.8rem', fontWeight: 500 }}>No XP earned yet today. Start learning!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card" style={{
      padding: '1.25rem',
      background: 'var(--card-bg)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Star size={16} color="#f59e0b" />
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Today's XP</h4>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>{dateStr}</span>
      </div>

      {/* Event list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {events.map((event, idx) => {
          const config = EVENT_ICONS[event.event_type] || { icon: Star, color: '#6366f1', emoji: '⭐' }
          const multipliers = event.metadata?.multipliers || {}
          const hasMultiplier = Object.keys(multipliers).length > 0

          return (
            <div
              key={event.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.55rem 0.75rem',
                borderRadius: 10,
                background: 'rgba(0,0,0,0.015)',
                border: '1px solid rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Emoji */}
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>{config.emoji}</span>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {event.reason || event.event_type.replace(/_/g, ' ')}
                </div>
                {hasMultiplier && (
                  <div style={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: 600, marginTop: '0.1rem' }}>
                    {multipliers.firstAttempt && `×${multipliers.firstAttempt} First Attempt `}
                    {multipliers.streak && `×${multipliers.streak} Streak `}
                    {multipliers.difficulty && `×${multipliers.difficulty} Difficulty`}
                  </div>
                )}
              </div>

              {/* Time */}
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>
                {formatTime(event.created_at)}
              </span>

              {/* XP amount */}
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 800,
                color: config.color,
                flexShrink: 0,
                minWidth: 50,
                textAlign: 'right',
              }}>
                +{event.xp_amount} XP
              </span>
            </div>
          )
        })}
      </div>

      {/* Total */}
      <div style={{
        marginTop: '0.75rem',
        paddingTop: '0.75rem',
        borderTop: '2px dashed var(--card-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {events.length} activit{events.length !== 1 ? 'ies' : 'y'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#6366f1' }}>
            {totalXp} XP
          </span>
          {totalCoins > 0 && (
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>
              {totalCoins} 🪙
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
