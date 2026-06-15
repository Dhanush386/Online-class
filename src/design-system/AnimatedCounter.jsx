import { useEffect, useRef, useState } from 'react'

/**
 * AnimatedCounter — Counts up from 0 to target value on mount.
 * Uses requestAnimationFrame for smooth 60fps animation.
 */
export default function AnimatedCounter({ value = 0, duration = 1200, decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  const frameRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    if (typeof value !== 'number' || isNaN(value)) return
    const start = 0
    const end   = value

    const animate = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp
      const elapsed  = timestamp - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease out expo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplay(parseFloat((start + (end - start) * eased).toFixed(decimals)))
      if (progress < 1) frameRef.current = requestAnimationFrame(animate)
    }

    startRef.current = null
    frameRef.current = requestAnimationFrame(animate)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [value, duration, decimals])

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</>
}
