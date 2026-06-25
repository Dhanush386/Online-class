import { useRef } from 'react'
import { motion } from 'framer-motion'
import PropTypes from 'prop-types'

/**
 * GlassCard — Frosted glass card with optional 3D tilt.
 * Use data-cursor="card" on this component to engage custom cursor card state.
 * 
 * Props:
 *  - tilt3d: boolean — enables perspective tilt on mouse move (only for dashboard/course cards)
 *  - className, style, children, onClick, padding
 */
export default function GlassCard({
  children,
  tilt3d = false,
  className = '',
  style = {},
  onClick,
  padding = '1.5rem',
  hover = true,
  ...props
}) {
  const cardRef = useRef(null)

  const handleMouseMove = (e) => {
    if (!tilt3d || !cardRef.current) return
    const rect  = cardRef.current.getBoundingClientRect()
    const cx    = rect.left + rect.width  / 2
    const cy    = rect.top  + rect.height / 2
    const dx    = (e.clientX - cx) / (rect.width  / 2)
    const dy    = (e.clientY - cy) / (rect.height / 2)
    const rotX  = -(dy * 5).toFixed(2)   // max ±5deg
    const rotY  =  (dx * 5).toFixed(2)
    cardRef.current.style.transform =
      `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(4px)`
  }

  const handleMouseLeave = () => {
    if (!tilt3d || !cardRef.current) return
    cardRef.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0px)'
  }

  return (
    <motion.div
      ref={cardRef}
      data-cursor={tilt3d ? 'card' : undefined}
      onClick={onClick}
      onMouseMove={tilt3d ? handleMouseMove : undefined}
      onMouseLeave={tilt3d ? handleMouseLeave : undefined}
      className={`glass-card ${tilt3d ? 'card-3d' : ''} ${className}`}
      style={{
        padding,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s cubic-bezier(0.16,1,0.3,1)',
        ...style,
      }}
      whileHover={hover && !tilt3d ? { y: -2 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  )
}

GlassCard.propTypes = {
  children: PropTypes.node,
  tilt3d: PropTypes.bool,
  className: PropTypes.string,
  style: PropTypes.object,
  onClick: PropTypes.func,
  padding: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  hover: PropTypes.bool,
}
