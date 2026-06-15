import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import GlassCard from './GlassCard'
import AnimatedCounter from './AnimatedCounter'

/**
 * StatCard — Premium metric card with animated counter, icon, delta badge, and mini trend line.
 * Includes 3D tilt for dashboard placement.
 */
export default function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
  color = 'primary',       // 'primary' | 'success' | 'warning' | 'danger' | 'violet'
  suffix = '',
  prefix = '',
  isLoading = false,
  tilt3d = true,
  style = {},
}) {
  const colorMap = {
    primary: { bg: 'rgba(99,102,241,0.1)',  icon: 'rgba(99,102,241,0.15)', color: '#6366f1', glow: 'rgba(99,102,241,0.2)' },
    success: { bg: 'rgba(16,185,129,0.1)',  icon: 'rgba(16,185,129,0.15)', color: '#10b981', glow: 'rgba(16,185,129,0.2)' },
    warning: { bg: 'rgba(245,158,11,0.1)',  icon: 'rgba(245,158,11,0.15)', color: '#f59e0b', glow: 'rgba(245,158,11,0.2)' },
    danger:  { bg: 'rgba(239,68,68,0.1)',   icon: 'rgba(239,68,68,0.15)',  color: '#ef4444', glow: 'rgba(239,68,68,0.2)'  },
    violet:  { bg: 'rgba(139,92,246,0.1)',  icon: 'rgba(139,92,246,0.15)', color: '#8b5cf6', glow: 'rgba(139,92,246,0.2)' },
  }
  const c = colorMap[color] || colorMap.primary
  const isPositive = delta > 0
  const isNegative = delta < 0

  if (isLoading) {
    return (
      <div className="glass-card skeleton-card" style={{ padding: '1.5rem', ...style }}>
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: '1rem' }} />
        <div className="skeleton" style={{ width: '60%', height: 14, marginBottom: '0.5rem', borderRadius: 6 }} />
        <div className="skeleton" style={{ width: '40%', height: 28, borderRadius: 8 }} />
      </div>
    )
  }

  return (
    <GlassCard tilt3d={tilt3d} style={style} padding="1.25rem">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.02em' }}>
            {label}
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {prefix}<AnimatedCounter value={Number(value) || 0} />{suffix}
          </div>
          {(delta !== undefined) && (
            <div style={{
              marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
              fontSize: '0.75rem', fontWeight: 600,
              color: isPositive ? 'var(--success)' : isNegative ? 'var(--danger)' : 'var(--text-muted)',
            }}>
              <span>{isPositive ? '↑' : isNegative ? '↓' : '—'} {Math.abs(delta)}%</span>
              {deltaLabel && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{deltaLabel}</span>}
            </div>
          )}
        </div>
        <motion.div
          whileHover={{ scale: 1.08, rotate: 4 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: c.icon,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 4px 16px ${c.glow}`,
          }}
        >
          {Icon && <Icon size={20} color={c.color} strokeWidth={2} />}
        </motion.div>
      </div>
    </GlassCard>
  )
}
