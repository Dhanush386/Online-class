import { useState, useMemo } from 'react'
import PropTypes from 'prop-types'
import {
  Play, RotateCcw, Copy, Check, MessageSquare,
  Sparkles, Lightbulb, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react'

// Language Badges
function HtmlBadge() {
  return (
    <span style={{
      background: '#e34c26',
      color: 'white',
      fontWeight: 900,
      fontSize: '0.65rem',
      padding: '1px 5px',
      borderRadius: '3px',
      lineHeight: 1
    }}>
      5
    </span>
  )
}

function CssBadge() {
  return (
    <span style={{
      background: '#264de4',
      color: 'white',
      fontWeight: 900,
      fontSize: '0.65rem',
      padding: '1px 5px',
      borderRadius: '3px',
      lineHeight: 1
    }}>
      3
    </span>
  )
}

function JsBadge() {
  return (
    <span style={{
      background: '#f7df1e',
      color: '#000000',
      fontWeight: 900,
      fontSize: '0.65rem',
      padding: '1px 4px',
      borderRadius: '3px',
      lineHeight: 1
    }}>
      JS
    </span>
  )
}

export default function CheatSheetPlayground({ starterData }) {
  const [activeTab, setActiveTab] = useState('html') // 'html' | 'css' | 'js'
  const [htmlCode, setHtmlCode] = useState(starterData?.starterHtml || '<!DOCTYPE html>\n<html>\n  <body>\n    <h1 class="main-heading">Tourism</h1>\n    <hr />\n    <p class="paragraph">Plan your trip wherever you want to go</p>\n  </body>\n</html>')
  const [cssCode, setCssCode] = useState(starterData?.starterCss || '@import url("https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Roboto:wght@400;700&display=swap");\n\n.main-heading {\n  font-family: "Caveat", cursive;\n  font-size: 36px;\n  font-style: italic;\n  color: #1e293b;\n  margin-bottom: 0.25rem;\n}\n\n.paragraph {\n  font-family: "Roboto", sans-serif;\n  font-size: 18px;\n  color: #334155;\n}')
  const [jsCode, setJsCode] = useState(starterData?.starterJs || '// JavaScript ready')
  const [runTimestamp, setRunTimestamp] = useState(Date.now())
  const [copied, setCopied] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackSent, setFeedbackSent] = useState(false)

  // Construct securely bundled HTML document for srcDoc
  const sandboxedDoc = useMemo(() => {
    let finalHtml = htmlCode || ''
    const cssInject = `<style>\n${cssCode || ''}\n</style>`
    const jsInject = `<script>\n${jsCode || ''}\n</script>`

    if (finalHtml.includes('</head>')) {
      finalHtml = finalHtml.replace('</head>', `${cssInject}</head>`)
    } else if (finalHtml.includes('<body>')) {
      finalHtml = finalHtml.replace('<body>', `<body>${cssInject}`)
    } else {
      finalHtml = cssInject + finalHtml
    }

    if (finalHtml.includes('</body>')) {
      finalHtml = finalHtml.replace('</body>', `${jsInject}</body>`)
    } else {
      finalHtml = finalHtml + jsInject
    }

    return finalHtml
  }, [htmlCode, cssCode, jsCode, runTimestamp])

  const handleReset = () => {
    setHtmlCode(starterData?.starterHtml || '')
    setCssCode(starterData?.starterCss || '')
    setJsCode(starterData?.starterJs || '')
    setRunTimestamp(Date.now())
  }

  const handleCopyActiveCode = () => {
    const currentCode = activeTab === 'html' ? htmlCode : activeTab === 'css' ? cssCode : jsCode
    navigator.clipboard.writeText(currentCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const currentCode = activeTab === 'html' ? htmlCode : activeTab === 'css' ? cssCode : jsCode
  const setCurrentCode = (val) => {
    if (activeTab === 'html') setHtmlCode(val)
    else if (activeTab === 'css') setCssCode(val)
    else setJsCode(val)
  }

  const lineNumbers = currentCode.split('\n').map((_, i) => i + 1)
  const [showHint, setShowHint] = useState(false)

  const practiceTitle = starterData?.title || 'Practice Challenge: Interactive Playground'
  const practiceDifficulty = starterData?.difficulty || 'Beginner'
  const practiceInstructions = starterData?.instructions || '1. Inspect the starter HTML structure\n2. Modify styles and properties in the CSS tab\n3. Click "Run Code" to preview the live rendering in the sandbox'
  const practiceHints = starterData?.hints || 'Tweak the values in the CSS tab and click "Run Code" to observe the immediate effect on the rendered layout.'
  const hasPracticeChallenge = true

  const taskList = useMemo(() => {
    if (!practiceInstructions) return []
    return practiceInstructions
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.replace(/^\d+[\.\)]\s*/, ''))
  }, [practiceInstructions])

  return (
    <div style={{ margin: '2rem 0' }}>
      {/* Coding Practice Challenge Briefing */}
      {hasPracticeChallenge && (
        <div
          style={{
            background: 'var(--bg-elevated, #161b28)',
            border: '1.5px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '16px',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.25rem',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff'
                }}
              >
                <Sparkles size={16} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#818cf8' }}>
                Coding Practice Challenge
              </span>
            </div>

            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '999px',
                background:
                  practiceDifficulty === 'Advanced'
                    ? 'rgba(168, 85, 247, 0.15)'
                    : practiceDifficulty === 'Intermediate'
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(16, 185, 129, 0.15)',
                color:
                  practiceDifficulty === 'Advanced'
                    ? '#c084fc'
                    : practiceDifficulty === 'Intermediate'
                    ? '#60a5fa'
                    : '#34d399',
                border: `1px solid ${
                  practiceDifficulty === 'Advanced'
                    ? 'rgba(168, 85, 247, 0.3)'
                    : practiceDifficulty === 'Intermediate'
                    ? 'rgba(59, 130, 246, 0.3)'
                    : 'rgba(16, 185, 129, 0.3)'
                }`
              }}
            >
              {practiceDifficulty}
            </span>
          </div>

          {practiceTitle && (
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
              {practiceTitle}
            </h3>
          )}

          {/* Objectives List */}
          {taskList.length > 0 && (
            <div style={{ marginBottom: '0.85rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted, #8e9bb0)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Your Tasks:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {taskList.map((task, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.88rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                    <CheckCircle2 size={16} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                    <span style={{ lineHeight: 1.4 }}>{task}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expandable Hint */}
          {practiceHints && (
            <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--card-border, rgba(255,255,255,0.08))', paddingTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setShowHint(prev => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#f59e0b',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Lightbulb size={14} />
                <span>{showHint ? 'Hide Hint' : 'Need a hint?'}</span>
                {showHint ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showHint && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    color: '#fef3c7',
                    fontSize: '0.84rem',
                    lineHeight: 1.5
                  }}
                >
                  {practiceHints}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Outer Playground Split Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          minHeight: '380px',
          background: '#0b1329'
        }}
      >
        {/* Left: Code Editor */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#0b1329',
            borderRight: '1px solid #1e293b'
          }}
        >
          {/* Header Tab Bar */}
          <div
            role="tablist"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#080e1e',
              borderBottom: '1px solid #1e293b',
              padding: '0 0.5rem'
            }}
          >
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '2px' }}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'html'}
                onClick={() => setActiveTab('html')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.65rem 1rem',
                  background: activeTab === 'html' ? '#0b1329' : 'transparent',
                  color: activeTab === 'html' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderBottom: activeTab === 'html' ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                <HtmlBadge />
                <span>HTML</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'css'}
                onClick={() => setActiveTab('css')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.65rem 1rem',
                  background: activeTab === 'css' ? '#0b1329' : 'transparent',
                  color: activeTab === 'css' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderBottom: activeTab === 'css' ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                <CssBadge />
                <span>CSS</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'js'}
                onClick={() => setActiveTab('js')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.65rem 1rem',
                  background: activeTab === 'js' ? '#0b1329' : 'transparent',
                  color: activeTab === 'js' ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderBottom: activeTab === 'js' ? '2px solid #3b82f6' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                <JsBadge />
                <span>JAVASCRIPT</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={handleCopyActiveCode}
                title="Copy Active Code"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '4px'
                }}
              >
                {copied ? <Check size={14} color="#4ade80" /> : <Copy size={14} />}
              </button>
              <button
                type="button"
                onClick={handleReset}
                title="Reset Code"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '5px',
                  borderRadius: '4px'
                }}
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>

          {/* Editor Body */}
          <div
            role="tabpanel"
            style={{
              position: 'relative',
              flex: 1,
              display: 'flex',
              padding: '0.75rem 0.5rem',
              overflow: 'hidden'
            }}
          >
            {/* Line Numbers */}
            <div
              style={{
                width: '32px',
                textAlign: 'right',
                paddingRight: '12px',
                color: '#475569',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                lineHeight: '1.6',
                userSelect: 'none',
                overflowY: 'hidden'
              }}
            >
              {lineNumbers.map(n => (
                <div key={n}>{n}</div>
              ))}
            </div>

            {/* Editable Text Area */}
            <textarea
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value)}
              spellCheck="false"
              aria-label={`${activeTab.toUpperCase()} Code Editor`}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
                fontSize: '0.88rem',
                lineHeight: '1.6',
                resize: 'none',
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                overflowX: 'auto',
                minHeight: '260px'
              }}
            />
          </div>

          {/* Bottom Bar with "Run Code" */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '0.65rem 1rem',
              borderTop: '1px solid #1e293b',
              background: '#080e1e'
            }}
          >
            <button
              type="button"
              onClick={() => setRunTimestamp(Date.now())}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.45rem 1.1rem',
                borderRadius: '20px',
                border: 'none',
                background: '#0052cc',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,82,204,0.4)',
                transition: 'transform 0.1s ease'
              }}
            >
              <Play size={13} fill="#ffffff" />
              <span>Run Code</span>
            </button>
          </div>
        </div>

        {/* Right: Secure Sandboxed Output Preview Pane */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: '#ffffff',
            position: 'relative'
          }}
        >
          <iframe
            key={runTimestamp}
            sandbox="allow-scripts"
            srcDoc={sandboxedDoc}
            title="Interactive Code Preview"
            style={{
              width: '100%',
              height: '100%',
              minHeight: '340px',
              border: 'none',
              background: '#ffffff'
            }}
          />
        </div>
      </div>

      {/* Bottom Submit Feedback button */}
      <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          type="button"
          onClick={() => setShowFeedbackModal(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.5rem 1.25rem',
            borderRadius: '8px',
            border: '1.5px solid #2563eb',
            background: 'transparent',
            color: '#2563eb',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <MessageSquare size={14} />
          <span>Submit Feedback</span>
        </button>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '1.75rem',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a', fontSize: '1.15rem', fontWeight: 800 }}>
              Lesson Feedback
            </h4>
            <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.88rem' }}>
              How was your experience with this cheat sheet and code playground?
            </p>

            {feedbackSent ? (
              <div style={{ padding: '1rem', background: '#ecfdf5', color: '#065f46', borderRadius: '8px', textAlign: 'center', fontWeight: 600 }}>
                Thank you! Your feedback has been submitted.
              </div>
            ) : (
              <>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Share what you liked or any doubts you had..."
                  style={{
                    width: '100%',
                    height: '100px',
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    marginBottom: '1rem',
                    boxSizing: 'border-box'
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowFeedbackModal(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#f1f5f9',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#475569',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackSent(true)
                      setTimeout(() => {
                        setShowFeedbackModal(false)
                        setFeedbackSent(false)
                        setFeedbackText('')
                      }, 1500)
                    }}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: '#0052cc',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontWeight: 700
                    }}
                  >
                    Submit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

CheatSheetPlayground.propTypes = {
  starterData: PropTypes.shape({
    title: PropTypes.string,
    difficulty: PropTypes.string,
    instructions: PropTypes.string,
    hints: PropTypes.string,
    starterHtml: PropTypes.string,
    starterCss: PropTypes.string,
    starterJs: PropTypes.string
  })
}
