import PropTypes from 'prop-types'

/**
 * Avatar — User avatar with initials fallback, gradient bg, and online indicator.
 */
const GRADIENT_PALETTES = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #10b981, #3b82f6)',
  'linear-gradient(135deg, #f59e0b, #ef4444)',
  'linear-gradient(135deg, #ec4899, #8b5cf6)',
  'linear-gradient(135deg, #14b8a6, #6366f1)',
]

function getGradient(name = '') {
  const code = name.codePointAt(0) || 0
  return GRADIENT_PALETTES[code % GRADIENT_PALETTES.length]
}

export default function Avatar({
  name = '',
  src,
  size = 'md',
  online,
  style = {},
  className = '',
}) {
  const sizeMap = { sm: 28, md: 36, lg: 48, xl: 64, '2xl': 80 }
  const fontMap = { sm: '0.65rem', md: '0.8rem', lg: '1rem', xl: '1.25rem', '2xl': '1.5rem' }
  const px      = sizeMap[size] || 36

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        className={`avatar avatar-${size} ${className}`}
        style={{
          width: px, height: px,
          background: src ? 'transparent' : getGradient(name),
          fontSize: fontMap[size],
          color: '#fff',
          ...style,
        }}
      >
        {src
          ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (name?.[0] || '?').toUpperCase()
        }
      </div>
      {online !== undefined && (
        <span style={{
          position: 'absolute',
          bottom: 0, right: 0,
          width: Math.max(8, px * 0.22),
          height: Math.max(8, px * 0.22),
          borderRadius: '50%',
          background: online ? 'var(--success)' : 'var(--text-muted)',
          border: '1.5px solid var(--bg-elevated)',
        }} />
      )}
    </div>
  )
}

Avatar.propTypes = {
  name: PropTypes.string,
  src: PropTypes.string,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl', '2xl']),
  online: PropTypes.bool,
  style: PropTypes.object,
  className: PropTypes.string,
}
