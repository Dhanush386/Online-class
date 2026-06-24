import { useEffect, useRef } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'

/**
 * CustomCursor — Decorative trailing orb + ring that follows the mouse.
 * The normal system cursor stays fully visible at all times.
 * This is purely cosmetic — a soft glowing trail behind the real cursor.
 *
 * Accessibility:
 *  - Auto-disabled on touch devices (pointer: coarse)
 *  - Respects prefers-reduced-motion
 */
export default function CustomCursor() {
  const orbRef  = useRef(null)
  const ringRef = useRef(null)

  const mx = useMotionValue(-100)
  const my = useMotionValue(-100)

  // Spring configs: orb = fast, ring = lagged for trailing effect
  const orbX  = useSpring(mx, { stiffness: 800, damping: 50, mass: 0.4 })
  const orbY  = useSpring(my, { stiffness: 800, damping: 50, mass: 0.4 })
  const ringX = useSpring(mx, { stiffness: 200, damping: 30, mass: 0.8 })
  const ringY = useSpring(my, { stiffness: 200, damping: 30, mass: 0.8 })

  useEffect(() => {
    // Disable on touch devices
    if (globalThis.matchMedia('(pointer: coarse)').matches) return
    // Disable on reduced motion
    if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const hideCursor = () => {
      if (orbRef.current)  orbRef.current.style.opacity  = '0'
      if (ringRef.current) ringRef.current.style.opacity = '0'
    }

    const showCursor = () => {
      if (orbRef.current)  orbRef.current.style.opacity  = '0.6'
      if (ringRef.current) ringRef.current.style.opacity = '0.35'
    }

    const handleMove = (e) => {
      mx.set(e.clientX)
      my.set(e.clientY)

      // Show the trail if not yet visible
      if (orbRef.current?.style.opacity === '0') {
        showCursor()
      }
    }

    document.addEventListener('mousemove', handleMove, { passive: true })
    document.addEventListener('mouseleave', hideCursor)
    document.addEventListener('mouseenter', showCursor)

    return () => {
      document.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseleave', hideCursor)
      document.removeEventListener('mouseenter', showCursor)
    }
  }, [mx, my])

  // Don't render on touch devices at all
  if (typeof globalThis !== 'undefined' && globalThis.matchMedia('(pointer: coarse)').matches) return null
  if (typeof globalThis !== 'undefined' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return null

  return (
    <>
      {/* Trailing ring — lagged */}
      <motion.div
        ref={ringRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          x: ringX,
          y: ringY,
          width: 36,
          height: 36,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          border: '1.5px solid rgba(99, 102, 241, 0.5)',
          pointerEvents: 'none',
          zIndex: 99998,
          opacity: 0,
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
          willChange: 'transform, opacity',
          boxShadow: '0 0 12px rgba(99,102,241,0.15)',
        }}
      />

      {/* Primary orb */}
      <motion.div
        ref={orbRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          x: orbX,
          y: orbY,
          width: 12,
          height: 12,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, rgba(139,92,246,0.95), rgba(99,102,241,0.9))',
          boxShadow: '0 0 12px rgba(99,102,241,0.6), 0 0 24px rgba(99,102,241,0.3)',
          pointerEvents: 'none',
          zIndex: 99999,
          opacity: 0,
          transition: 'transform 0.2s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
          willChange: 'transform, opacity',
        }}
      />
    </>
  )
}
