/**
 * Badge — Status badge with dot variant.
 */
export default function Badge({ variant = 'neutral', dot = false, children, style = {} }) {
  return (
    <span className={`badge badge-${variant}`} style={style}>
      {dot && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: 'currentColor', display: 'inline-block',
        }} />
      )}
      {children}
    </span>
  )
}
