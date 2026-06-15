/**
 * AnimatedBackground — vivid layered mesh gradient + floating orbs
 * variant: 'auth' | 'dashboard' | 'minimal'
 * GPU-composited using transform + opacity only.
 * Respects prefers-reduced-motion.
 */
export default function AnimatedBackground({ variant = 'minimal' }) {
  const prefersReduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  const configs = {
    auth: {
      orb1: { size: 450, top: '-8%',   left: '-6%',  color: 'rgba(99,102,241,0.35)',   dur: '16s' },
      orb2: { size: 380, top: '50%',   left: '55%',  color: 'rgba(139,92,246,0.30)',   dur: '20s', reverse: true },
      orb3: { size: 320, top: '15%',   left: '65%',  color: 'rgba(236,72,153,0.22)',   dur: '24s' },
      orb4: { size: 280, top: '65%',   left: '-3%',  color: 'rgba(59,130,246,0.25)',   dur: '18s', reverse: true },
      orb5: { size: 200, top: '35%',   left: '30%',  color: 'rgba(16,185,129,0.18)',   dur: '22s' },
    },
    dashboard: {
      orb1: { size: 500, top: '-12%', left: '-8%', color: 'rgba(99,102,241,0.18)',  dur: '22s' },
      orb2: { size: 380, top: '55%',  left: '60%', color: 'rgba(139,92,246,0.14)', dur: '28s', reverse: true },
      orb3: { size: 280, top: '25%',  left: '70%', color: 'rgba(16,185,129,0.12)', dur: '18s' },
    },
    minimal: {
      orb1: { size: 400, top: '-8%',  left: '-5%', color: 'rgba(99,102,241,0.10)', dur: '28s' },
      orb2: { size: 300, top: '60%',  left: '70%', color: 'rgba(139,92,246,0.08)', dur: '34s', reverse: true },
    },
  }

  const cfg = configs[variant] || configs.minimal

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Vivid base mesh gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: variant === 'auth'
          ? `
            radial-gradient(ellipse 80% 50% at 15% 5%, rgba(99,102,241,0.15) 0%, transparent 55%),
            radial-gradient(ellipse 60% 70% at 85% 85%, rgba(139,92,246,0.12) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 50% 50%, rgba(236,72,153,0.08) 0%, transparent 60%),
            radial-gradient(ellipse 50% 40% at 70% 20%, rgba(59,130,246,0.10) 0%, transparent 50%)
          `
          : `
            radial-gradient(ellipse 80% 60% at 20% 10%, rgba(99,102,241,0.09) 0%, transparent 60%),
            radial-gradient(ellipse 60% 80% at 80% 90%, rgba(139,92,246,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at 50% 50%, rgba(236,72,153,0.04) 0%, transparent 70%)
          `,
      }} />

      {/* Floating orbs */}
      {Object.values(cfg).map((orb, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: orb.top,
            left: orb.left,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 40% 40%, ${orb.color}, ${orb.color.replace(/[\d.]+\)$/, '0)')})`,
            filter: `blur(${Math.round(orb.size * 0.12)}px)`,
            animation: prefersReduced
              ? 'none'
              : `${orb.reverse ? 'orbitReverse' : 'orbit'} ${orb.dur} ease-in-out infinite`,
            animationDelay: `${i * -3}s`,
            willChange: 'transform',
          }}
        />
      ))}

      {/* Subtle noise overlay for texture/depth */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E")`,
        opacity: 0.5,
      }} />
    </div>
  )
}
