/**
 * ProgressRing — SVG circular progress with gradient stroke.
 * Animates on mount.
 */
export default function ProgressRing({
  value = 0,       // 0–100
  size = 64,
  stroke = 5,
  color = '#6366f1',
  trackColor = 'rgba(226,232,240,0.6)',
  children,
  label,
}) {
  const r       = (size - stroke) / 2
  const circ    = 2 * Math.PI * r
  const offset  = circ - (value / 100) * circ

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`ring-grad-${color.replace('#','')}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor={color} stopOpacity="1" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={trackColor} strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#ring-grad-${color.replace('#','')})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: '0.1rem',
      }}>
        {children || (
          <>
            <span style={{ fontSize: size > 60 ? '0.95rem' : '0.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1 }}>{Math.round(value)}%</span>
            {label && <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>}
          </>
        )}
      </div>
    </div>
  )
}
