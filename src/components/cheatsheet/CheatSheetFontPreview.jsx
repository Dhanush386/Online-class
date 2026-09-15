import PropTypes from 'prop-types'
import useGoogleFonts from '../../hooks/useGoogleFonts'
import { formatInlineText } from '../../utils/sanitizeRichText'

export default function CheatSheetFontPreview({ data }) {
  if (!data || !data.fonts || data.fonts.length === 0) return null

  // Ensure all font families are dynamically loaded with proper lifecycle
  useGoogleFonts(data.fonts)

  return (
    <div style={{ margin: '1.75rem 0' }}>
      {data.text && (
        <p
          style={{
            fontSize: '0.98rem',
            color: 'var(--text-secondary, #cbd5e1)',
            marginBottom: '1.25rem',
            lineHeight: 1.6
          }}
          dangerouslySetInnerHTML={{ __html: formatInlineText(data.text) }}
        />
      )}

      <div style={{
        background: 'var(--bg-elevated, #161b28)',
        border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          padding: '0.75rem 1.25rem',
          background: 'rgba(99, 102, 241, 0.08)',
          borderBottom: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#818cf8' }}>
            Supported Google Font Families
          </span>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #8e9bb0)' }}>
            Live Google Fonts Rendering
          </span>
        </div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {data.fonts.map((f, idx) => {
            const rawFamily = (f.family || '').replace(/["']/g, '')
            const fontStyleString = `"${rawFamily}", sans-serif`
            const sampleText = f.uppercase ? (data.sampleWord || 'Tourism').toUpperCase() : (data.sampleWord || 'Tourism')

            return (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(160px, 220px) 1fr',
                  alignItems: 'center',
                  gap: '1.5rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '8px',
                  background: idx % 2 === 0 ? 'var(--bg-surface, #111522)' : 'transparent',
                  border: '1px solid var(--card-border, rgba(255,255,255,0.04))'
                }}
              >
                {/* Left font name value as copyable code badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <code
                    className="cs-code-allowed"
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: '#818cf8',
                      background: 'rgba(99, 102, 241, 0.12)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(99, 102, 241, 0.25)',
                      fontFamily: 'var(--font-mono, monospace)',
                      userSelect: 'text'
                    }}
                  >
                    {f.name || `"${rawFamily}"`}
                  </code>
                </div>

                {/* Right rendered sample preview in that exact font */}
                <span
                  style={{
                    fontFamily: fontStyleString,
                    fontSize: rawFamily === 'Monoton' ? '1.5rem' : '1.75rem',
                    fontWeight: f.weight || '700',
                    fontStyle: f.style || 'normal',
                    color: 'var(--text-primary, #f8fafc)',
                    letterSpacing: rawFamily === 'Monoton' ? '1px' : 'normal',
                    lineHeight: 1.2
                  }}
                >
                  {sampleText}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

CheatSheetFontPreview.propTypes = {
  data: PropTypes.shape({
    text: PropTypes.string,
    sampleWord: PropTypes.string,
    fonts: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        family: PropTypes.string.isRequired,
        style: PropTypes.string,
        weight: PropTypes.string,
        uppercase: PropTypes.bool
      })
    ).isRequired
  }).isRequired
}
