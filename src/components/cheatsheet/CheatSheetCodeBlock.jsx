import PropTypes from 'prop-types'

/**
 * Enhanced syntax highlighter for CSS & HTML snippets
 * Uses single-pass token matching to prevent nested tag replacement collisions
 */
function highlightCode(rawCode, language) {
  if (!rawCode) return []

  const lines = rawCode.split('\n')
  return lines.map((line, idx) => {
    if (language.toUpperCase() === 'CSS') {
      const tokenRegex = /(@[a-zA-Z-]+)|url\(([^)]*)\)|(\.[a-zA-Z0-9_-]+)|([a-z-]+)(?=\s*:)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b\d+(?:px|em|rem|%)?\b)|(\b(?:normal|italic|oblique|bold|bolder|lighter|sans-serif|serif|cursive|monospace)\b)|([{}();])/g

      const formatted = line.replace(tokenRegex, (match, atRule, urlArg, cls, prop, str, num, kw, punct) => {
        if (atRule) return `<span style="color:#ec4899;font-weight:600;">${atRule}</span>`
        if (urlArg !== undefined) return `<span style="color:#38bdf8;">url</span>(<span style="color:#fde047;">${urlArg}</span>)`
        if (cls) return `<span style="color:#4ade80;font-weight:600;">${cls}</span>`
        if (prop) return `<span style="color:#38bdf8;font-style:italic;">${prop}</span>`
        if (str) return `<span style="color:#fde047;">${str}</span>`
        if (num) return `<span style="color:#c084fc;font-weight:600;">${num}</span>`
        if (kw) return `<span style="color:#67e8f9;">${kw}</span>`
        if (punct) return `<span style="color:#facc15;">${punct}</span>`
        return match
      })

      return { lineNumber: idx + 1, html: formatted }
    }

    return { lineNumber: idx + 1, html: line }
  })
}

export default function CheatSheetCodeBlock({ code, language = 'CSS' }) {
  const lines = highlightCode(code, language)

  return (
    <div
      style={{
        position: 'relative',
        background: '#070b16',
        borderRadius: '14px',
        margin: '1.25rem 0',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
      onCopy={(e) => e.preventDefault()}
    >
      {/* Terminal Window Chrome Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 1rem',
          background: '#0a1020',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        }}
      >
        {/* Left: macOS dots & filename */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
          </div>
          <span style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'var(--font-mono, monospace)', marginLeft: '6px', fontWeight: 600 }}>
            {language.toLowerCase() === 'css' ? 'stylesheet.css' : language.toLowerCase() === 'html' ? 'index.html' : 'snippet.js'}
          </span>
        </div>

        {/* Right: Language Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: language.toUpperCase() === 'CSS' ? 'rgba(38, 77, 228, 0.2)' : 'rgba(99, 102, 241, 0.2)',
              color: language.toUpperCase() === 'CSS' ? '#60a5fa' : '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.5px'
            }}
          >
            {language.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Code view with line numbers - strictly protected against copying */}
      <pre
        style={{
          margin: 0,
          padding: '1.25rem 1rem 1.25rem 0.25rem',
          fontFamily: 'var(--font-mono, "JetBrains Mono", Consolas, monospace)',
          fontSize: '0.88rem',
          lineHeight: '1.7',
          color: '#f1f5f9',
          overflowX: 'auto',
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: 'default'
        }}
      >
        <code style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
          {lines.map((item) => (
            <div
              key={item.lineNumber}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                minHeight: '1.7em',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              }}
            >
              <span
                style={{
                  width: '40px',
                  textAlign: 'right',
                  paddingRight: '14px',
                  color: '#475569',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  marginRight: '12px'
                }}
              >
                {item.lineNumber}
              </span>
              <span
                style={{
                  flex: 1,
                  whiteSpace: 'pre',
                  userSelect: 'none',
                  WebkitUserSelect: 'none'
                }}
                dangerouslySetInnerHTML={{ __html: item.html }}
              />
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}

CheatSheetCodeBlock.propTypes = {
  code: PropTypes.string.isRequired,
  language: PropTypes.string
}
