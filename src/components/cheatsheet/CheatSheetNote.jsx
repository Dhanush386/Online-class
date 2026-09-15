import PropTypes from 'prop-types'
import { FileText } from 'lucide-react'
import { formatInlineText } from '../../utils/sanitizeRichText'

export default function CheatSheetNote({ items = [] }) {
  if (!items || items.length === 0) return null

  return (
    <div
      style={{
        position: 'relative',
        background: 'rgba(245, 158, 11, 0.05)',
        borderRadius: '14px',
        padding: '1.75rem 1.5rem 1.25rem 1.5rem',
        margin: '1.75rem 0',
        border: '1.5px solid rgba(245, 158, 11, 0.22)',
        boxShadow: '0 4px 16px rgba(245, 158, 11, 0.04)'
      }}
    >
      {/* Pill Badge at top-left overlapping card */}
      <div
        style={{
          position: 'absolute',
          top: '-13px',
          left: '16px',
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#ffffff',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 12px',
          borderRadius: '20px',
          fontSize: '0.78rem',
          fontWeight: 800,
          boxShadow: '0 2px 10px rgba(245, 158, 11, 0.35)',
          letterSpacing: '0.02em',
          textTransform: 'uppercase'
        }}
      >
        <FileText size={13} />
        <span>Important Rules</span>
      </div>

      {/* Numbered Points with custom badge counters */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginTop: '0.25rem'
        }}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '0.92rem',
              color: 'var(--text-secondary, #cbd5e1)',
              lineHeight: 1.6
            }}
          >
            <span
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '3px'
              }}
            >
              {idx + 1}
            </span>
            <div
              style={{ flex: 1 }}
              dangerouslySetInnerHTML={{ __html: formatInlineText(item) }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

CheatSheetNote.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired
}
