import { useState, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import {
  Play, RotateCcw, Copy, Check, Code2, Sparkles,
  Lightbulb, CheckCircle2, Maximize2, Minimize2,
  Trash2, ChevronDown, BookOpen, AlertCircle, Plus
} from 'lucide-react'

export const PRACTICE_TEMPLATES = [
  {
    id: 'typography',
    name: 'Typography & Google Fonts',
    category: 'CSS Styling',
    description: 'Challenge students to import Google Fonts, style headings, font-size, line-height, and font-style.',
    data: {
      title: 'Practice Challenge: Typography & Google Fonts',
      difficulty: 'Beginner',
      instructions: '1. Import Google Fonts "Caveat" and "Roboto" in CSS\n2. Apply font-family: "Caveat", cursive to .main-heading\n3. Set font-size: 18px and color: #334155 on .paragraph\n4. Style the button with font-weight: 600 and rounded corners',
      hints: 'Use @import url("https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Roboto:wght@400;700&display=swap"); at the very top of your CSS.',
      starterHtml: `<div class="card">
  <h1 class="main-heading">Explore Wanderlust</h1>
  <p class="paragraph">Discover breathtaking destinations across the globe and curate unforgettable journeys.</p>
  <button class="cta-btn">Book Your Escape</button>
</div>`,
      starterCss: `@import url("https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Roboto:wght@400;700&display=swap");

.card {
  background: #ffffff;
  padding: 2.25rem;
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08);
  max-width: 420px;
  margin: 1.5rem auto;
  text-align: center;
}

.main-heading {
  font-family: "Caveat", cursive;
  font-size: 38px;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
}

.paragraph {
  font-family: "Roboto", sans-serif;
  font-size: 16px;
  color: #475569;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.cta-btn {
  background: #6366f1;
  color: #ffffff;
  border: none;
  padding: 0.75rem 1.6rem;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.cta-btn:hover {
  background: #4f46e5;
}`,
      starterJs: `console.log("Typography practice challenge loaded!");`
    }
  },
  {
    id: 'flexbox',
    name: 'Flexbox Layout & Centering',
    category: 'Layout',
    description: 'Challenge students to build a centered 3-card feature showcase using display: flex and gap.',
    data: {
      title: 'Practice Challenge: Flexbox Navigation & Cards',
      difficulty: 'Intermediate',
      instructions: '1. Set .features-container to display: flex with gap: 16px\n2. Center elements with justify-content: center and flex-wrap: wrap\n3. Add a hover transform: translateY(-4px) on .feature-card',
      hints: 'Flex containers distribute children along the main axis. Use justify-content: center to keep cards centered.',
      starterHtml: `<div class="container">
  <div class="header">
    <h2>Platform Capabilities</h2>
    <p>Everything you need to master modern engineering.</p>
  </div>
  <div class="features-container">
    <div class="feature-card">
      <div class="icon">🚀</div>
      <h3>Fast Builds</h3>
      <p>Vite-powered HMR.</p>
    </div>
    <div class="feature-card">
      <div class="icon">🛡️</div>
      <h3>Sandboxed</h3>
      <p>Secure iframe execution.</p>
    </div>
    <div class="feature-card">
      <div class="icon">⚡</div>
      <h3>Live Runner</h3>
      <p>Instant visual feedback.</p>
    </div>
  </div>
</div>`,
      starterCss: `.container {
  padding: 2rem;
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 620px;
  margin: 0 auto;
  text-align: center;
}

.header h2 {
  color: #0f172a;
  margin: 0 0 0.25rem 0;
}

.header p {
  color: #64748b;
  margin: 0 0 1.5rem 0;
}

.features-container {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.feature-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem;
  flex: 1;
  min-width: 140px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}

.icon {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}`,
      starterJs: `console.log("Flexbox practice challenge ready!");`
    }
  },
  {
    id: 'interactive_dom',
    name: 'Interactive JS Counter & DOM',
    category: 'JavaScript DOM',
    description: 'Challenge students to bind click events, manipulate state, and update DOM numbers interactively.',
    data: {
      title: 'Practice Challenge: Interactive DOM Counter',
      difficulty: 'Beginner',
      instructions: '1. Select elements using document.getElementById()\n2. Add click event listeners to increment, decrement, and reset\n3. Update the textContent of #count on every user click',
      hints: 'Remember to use addEventListener("click", () => { ... }) on each button.',
      starterHtml: `<div class="counter-box">
  <h3>Interactive Counter</h3>
  <div id="count" class="counter-display">0</div>
  <div class="btn-group">
    <button id="btn-decrement">- Decrease</button>
    <button id="btn-reset">Reset</button>
    <button id="btn-increment">+ Increase</button>
  </div>
</div>`,
      starterCss: `.counter-box {
  background: #ffffff;
  border-radius: 16px;
  padding: 2rem;
  max-width: 320px;
  margin: 1.5rem auto;
  text-align: center;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
  font-family: system-ui, -apple-system, sans-serif;
}

.counter-display {
  font-size: 3.5rem;
  font-weight: 800;
  color: #6366f1;
  margin: 1rem 0;
}

.btn-group {
  display: flex;
  gap: 8px;
  justify-content: center;
}

button {
  padding: 0.55rem 0.9rem;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

button:hover {
  background: #6366f1;
  color: white;
  border-color: #6366f1;
}`,
      starterJs: `let count = 0;
const display = document.getElementById('count');

document.getElementById('btn-increment').addEventListener('click', () => {
  count++;
  display.textContent = count;
});

document.getElementById('btn-decrement').addEventListener('click', () => {
  count--;
  display.textContent = count;
});

document.getElementById('btn-reset').addEventListener('click', () => {
  count = 0;
  display.textContent = count;
});`
    }
  },
  {
    id: 'grid',
    name: 'CSS Grid Responsive Gallery',
    category: 'Layout',
    description: 'Challenge students to create a responsive auto-fit grid gallery with minmax.',
    data: {
      title: 'Practice Challenge: CSS Grid Gallery',
      difficulty: 'Intermediate',
      instructions: '1. Set .grid-gallery to display: grid\n2. Use grid-template-columns: repeat(auto-fit, minmax(130px, 1fr))\n3. Add a gap: 12px between gallery cards',
      hints: 'repeat(auto-fit, minmax(...)) dynamically calculates how many columns can fit the screen.',
      starterHtml: `<div class="gallery-wrapper">
  <h2>Design Inspirations</h2>
  <div class="grid-gallery">
    <div class="item grad-1">Minimalism</div>
    <div class="item grad-2">Glassmorphism</div>
    <div class="item grad-3">Brutalism</div>
    <div class="item grad-4">Neumorphism</div>
  </div>
</div>`,
      starterCss: `.gallery-wrapper {
  padding: 1.5rem;
  font-family: system-ui, sans-serif;
  max-width: 580px;
  margin: 0 auto;
}

.gallery-wrapper h2 {
  text-align: center;
  color: #0f172a;
}

.grid-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-top: 1rem;
}

.item {
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.08);
}

.grad-1 { background: linear-gradient(135deg, #6366f1, #a855f7); }
.grad-2 { background: linear-gradient(135deg, #3b82f6, #06b6d4); }
.grad-3 { background: linear-gradient(135deg, #f59e0b, #ef4444); }
.grad-4 { background: linear-gradient(135deg, #10b981, #059669); }`,
      starterJs: `console.log("Grid gallery ready!");`
    }
  },
  {
    id: 'blank',
    name: 'Blank Canvas (Clean Slate)',
    category: 'Custom',
    description: 'Clean skeleton to craft your own custom hands-on coding practice from scratch.',
    data: {
      title: 'Practice Challenge: Custom Exercise',
      difficulty: 'Beginner',
      instructions: '1. Describe the practice objectives for your students here\n2. Provide starter HTML markup\n3. Provide starter CSS styles\n4. Add optional JavaScript for interaction',
      hints: 'Add a helpful hint here to guide students who get stuck.',
      starterHtml: `<div class="practice-box">\n  <h1>Practice Challenge</h1>\n  <p>Edit this code to complete the challenge!</p>\n</div>`,
      starterCss: `.practice-box {\n  padding: 24px;\n  background: #ffffff;\n  border-radius: 12px;\n  font-family: system-ui, sans-serif;\n  color: #1e293b;\n}`,
      starterJs: `console.log("Ready to practice!");`
    }
  }
]

export default function OrganizerPlaygroundEditor({
  playgroundData,
  onChange,
  onRemove
}) {
  const [activeCodeTab, setActiveCodeTab] = useState('html') // 'html' | 'css' | 'js'
  const [viewMode, setViewMode] = useState('split') // 'split' | 'editor' | 'preview'
  const [showTemplatesMenu, setShowTemplatesMenu] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [runTimestamp, setRunTimestamp] = useState(Date.now())
  const templateMenuRef = useRef(null)

  const data = playgroundData || {}
  const html = typeof data.starterHtml === 'string' ? data.starterHtml : ''
  const css = typeof data.starterCss === 'string' ? data.starterCss : ''
  const js = typeof data.starterJs === 'string' ? data.starterJs : ''
  const title = typeof data.title === 'string' ? data.title : ''
  const difficulty = data.difficulty || 'Beginner'
  const instructions = typeof data.instructions === 'string' ? data.instructions : ''
  const hints = typeof data.hints === 'string' ? data.hints : ''

  const taskList = useMemo(() => {
    if (!instructions) return []
    return instructions.split('\n').map(t => t.trim()).filter(Boolean)
  }, [instructions])

  const handleAddTask = () => {
    const nextNum = taskList.length + 1
    const newTasks = [...taskList, `${nextNum}. New practice requirement`]
    onChange({ ...data, instructions: newTasks.join('\n') })
  }

  const handleUpdateTask = (idx, text) => {
    const updated = [...taskList]
    updated[idx] = text
    onChange({ ...data, instructions: updated.join('\n') })
  }

  const handleDeleteTask = (idx) => {
    const updated = taskList.filter((_, i) => i !== idx)
    // Renumber remaining tasks
    const renumbered = updated.map((task, i) => `${i + 1}. ${task.replace(/^\d+[\.\)]\s*/, '')}`)
    onChange({ ...data, instructions: renumbered.join('\n') })
  }

  const handleClearAllTasks = () => {
    onChange({ ...data, instructions: '' })
  }

  // Build sandboxed HTML document for live preview runner
  const sandboxedDoc = useMemo(() => {
    let finalHtml = html || ''
    const cssInject = `<style>\n${css || ''}\n</style>`
    const jsInject = `<script>\n${js || ''}\n</script>`

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
  }, [html, css, js, runTimestamp])

  const handleApplyTemplate = (template) => {
    onChange({
      ...data,
      title: template.data.title,
      difficulty: template.data.difficulty,
      instructions: template.data.instructions,
      hints: template.data.hints,
      starterHtml: template.data.starterHtml,
      starterCss: template.data.starterCss,
      starterJs: template.data.starterJs
    })
    setShowTemplatesMenu(false)
    setRunTimestamp(Date.now())
  }

  const handleCopyCurrentCode = () => {
    const codeToCopy = activeCodeTab === 'html' ? html : activeCodeTab === 'css' ? css : js
    navigator.clipboard.writeText(codeToCopy).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleRun = () => {
    setRunTimestamp(Date.now())
  }

  const currentCode = activeCodeTab === 'html' ? html : activeCodeTab === 'css' ? css : js
  const lineCount = (currentCode.match(/\n/g) || []).length + 1

  return (
    <div
      style={{
        background: 'var(--bg-elevated, #161b28)',
        border: '1.5px solid rgba(236, 72, 153, 0.35)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.25rem',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? '10px' : 'auto',
        left: isFullscreen ? '10px' : 'auto',
        right: isFullscreen ? '10px' : 'auto',
        bottom: isFullscreen ? '10px' : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        overflow: isFullscreen ? 'auto' : 'visible'
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Code2 size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#f8fafc' }}>
                Live Coding Practice Suite
              </h5>
              <span style={{
                background: 'rgba(236, 72, 153, 0.15)',
                color: '#f472b6',
                border: '1px solid rgba(236, 72, 153, 0.3)',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: '999px'
              }}>
                Sandboxed Practice
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted, #8e9bb0)' }}>
              Configure task instructions, multi-language starter code, and test execution live
            </span>
          </div>
        </div>

        {/* Top Control Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Preset Templates Dropdown */}
          <div style={{ position: 'relative' }} ref={templateMenuRef}>
            <button
              type="button"
              onClick={() => setShowTemplatesMenu(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                padding: '0.4rem 0.75rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Sparkles size={13} />
              <span>Challenge Presets</span>
              <ChevronDown size={13} />
            </button>

            {showTemplatesMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: '280px',
                  background: '#0f172a',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5)',
                  padding: '6px',
                  zIndex: 100
                }}
              >
                <div style={{ padding: '6px 8px', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select Practice Template
                </div>
                {PRACTICE_TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                        {tmpl.name}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: '#818cf8', fontWeight: 600 }}>
                        {tmpl.category}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.3 }}>
                      {tmpl.description}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(prev => !prev)}
            style={{
              background: 'transparent',
              border: '1px solid var(--card-border, rgba(255,255,255,0.1))',
              color: 'var(--text-secondary, #cbd5e1)',
              padding: '0.4rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {/* Remove Subblock */}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#ef4444',
                padding: '0.4rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Remove Live Playground"
            >
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
      </div>

      {/* Challenge Metadata Form */}
      <div style={{
        background: 'var(--bg-surface, #111522)',
        border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
        borderRadius: '8px',
        padding: '0.85rem',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', display: 'block', marginBottom: '4px' }}>
              Practice Challenge Title
            </label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => onChange({ ...data, title: e.target.value })}
              placeholder="e.g. Practice Challenge: Style a Modern Hero Card"
              style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', display: 'block', marginBottom: '4px' }}>
              Difficulty Level
            </label>
            <select
              className="form-input"
              value={difficulty}
              onChange={(e) => onChange({ ...data, difficulty: e.target.value })}
              style={{ width: '100%', fontSize: '0.85rem', padding: '0.45rem 0.65rem' }}
            >
              <option value="Beginner">🟢 Beginner (Basic properties & elements)</option>
              <option value="Intermediate">🔵 Intermediate (Flexbox, Grid, Responsive)</option>
              <option value="Advanced">🟣 Advanced (Keyframes, Animations, Complex JS)</option>
            </select>
          </div>
        </div>

        {/* Task Instructions */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CheckCircle2 size={13} style={{ color: '#10b981' }} />
              <span>Practice Objectives / Task Requirements</span>
              <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                {taskList.length} {taskList.length === 1 ? 'task' : 'tasks'}
              </span>
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handleAddTask}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10b981',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Plus size={12} /> Add Task
              </button>

              {taskList.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllTasks}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#ef4444',
                    padding: '2px 8px',
                    borderRadius: '5px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Clear all tasks"
                >
                  <Trash2 size={11} /> Clear All
                </button>
              )}
            </div>
          </div>

          {/* Structured Task List with Individual Delete Buttons */}
          {taskList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '6px' }}>
              {taskList.map((task, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#818cf8',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    value={task.replace(/^\d+[\.\)]\s*/, '')}
                    onChange={(e) => handleUpdateTask(i, `${i + 1}. ${e.target.value}`)}
                    placeholder="Describe requirement for students..."
                    style={{ flex: 1, fontSize: '0.82rem', padding: '0.35rem 0.55rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(i)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#ef4444',
                      padding: '4px 6px',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                    title={`Delete task ${i + 1}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '0.65rem 0.85rem',
              borderRadius: '6px',
              border: '1px dashed var(--card-border, rgba(255, 255, 255, 0.15))',
              background: 'rgba(255, 255, 255, 0.02)',
              fontSize: '0.78rem',
              color: 'var(--text-muted, #8e9bb0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <span>No task requirements added. Students will see an open sandbox.</span>
              <button
                type="button"
                onClick={handleAddTask}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#6366f1',
                  fontWeight: 700,
                  fontSize: '0.76rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  padding: 0
                }}
              >
                <Plus size={12} /> Add First Task
              </button>
            </div>
          )}
        </div>

        {/* Optional Hint */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Lightbulb size={13} style={{ color: '#f59e0b' }} />
              <span>Helpful Hint (Revealed when student clicks &quot;Need a Hint?&quot;)</span>
            </label>
            {hints && (
              <button
                type="button"
                onClick={() => onChange({ ...data, hints: '' })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0
                }}
                title="Remove hint"
              >
                Clear Hint
              </button>
            )}
          </div>
          <input
            type="text"
            className="form-input"
            value={hints}
            onChange={(e) => onChange({ ...data, hints: e.target.value })}
            placeholder="Optional: Enter a hint to help students (or leave empty)"
            style={{ width: '100%', fontSize: '0.82rem', padding: '0.45rem 0.65rem' }}
          />
        </div>
      </div>

      {/* View Mode & Code Controls Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '0.65rem'
      }}>
        {/* Language Tabs */}
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-surface, #111522)', padding: '3px', borderRadius: '8px', border: '1px solid var(--card-border, rgba(255,255,255,0.08))' }}>
          <button
            type="button"
            onClick={() => setActiveCodeTab('html')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              background: activeCodeTab === 'html' ? '#e34c26' : 'transparent',
              color: activeCodeTab === 'html' ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '0.68rem', fontWeight: 900 }}>5</span>
            <span>HTML</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCodeTab('css')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              background: activeCodeTab === 'css' ? '#264de4' : 'transparent',
              color: activeCodeTab === 'css' ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '0.68rem', fontWeight: 900 }}>3</span>
            <span>CSS</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCodeTab('js')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              background: activeCodeTab === 'js' ? '#f7df1e' : 'transparent',
              color: activeCodeTab === 'js' ? '#000000' : 'var(--text-secondary, #cbd5e1)',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '0.68rem', fontWeight: 900 }}>JS</span>
            <span>JAVASCRIPT</span>
          </button>
        </div>

        {/* View Mode & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-surface, #111522)', padding: '2px', borderRadius: '6px', border: '1px solid var(--card-border, rgba(255,255,255,0.08))' }}>
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                background: viewMode === 'editor' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: viewMode === 'editor' ? '#ffffff' : '#94a3b8',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Editor Only
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                background: viewMode === 'split' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: viewMode === 'split' ? '#ffffff' : '#94a3b8',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Split View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                border: 'none',
                background: viewMode === 'preview' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: viewMode === 'preview' ? '#ffffff' : '#94a3b8',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Live Preview
            </button>
          </div>

          {/* Copy Current Tab Code */}
          <button
            type="button"
            onClick={handleCopyCurrentCode}
            style={{
              background: 'transparent',
              border: '1px solid var(--card-border, rgba(255,255,255,0.1))',
              color: 'var(--text-secondary, #cbd5e1)',
              padding: '0.35rem 0.6rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Copy current tab code"
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Run Code Button */}
          <button
            type="button"
            onClick={handleRun}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#10b981',
              color: '#ffffff',
              border: 'none',
              padding: '0.4rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Play size={13} fill="#ffffff" />
            <span>Run Code</span>
          </button>
        </div>
      </div>

      {/* Editor & Runner Split Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: viewMode === 'split' ? '1fr 1fr' : '1fr',
          gap: '12px',
          minHeight: isFullscreen ? 'calc(100vh - 280px)' : '320px'
        }}
      >
        {/* Code Editor Pane */}
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#080e1e',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              overflow: 'hidden'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: '#050914',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.72rem',
              color: '#94a3b8'
            }}>
              <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {activeCodeTab === 'html' ? 'Starter HTML Markup' : activeCodeTab === 'css' ? 'Starter CSS Stylesheet' : 'Starter JavaScript Logic'}
              </span>
              <span>{lineCount} lines</span>
            </div>

            <textarea
              className="code-editor-textarea"
              value={activeCodeTab === 'html' ? html : activeCodeTab === 'css' ? css : js}
              onChange={(e) => {
                const val = e.target.value
                if (activeCodeTab === 'html') onChange({ ...data, starterHtml: val })
                else if (activeCodeTab === 'css') onChange({ ...data, starterCss: val })
                else onChange({ ...data, starterJs: val })
              }}
              placeholder={`Write your starter ${activeCodeTab.toUpperCase()} code here...`}
              spellCheck={false}
              style={{
                flex: 1,
                width: '100%',
                minHeight: '260px',
                padding: '12px',
                background: '#080e1e',
                color: '#f8fafc',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: '0.84rem',
                lineHeight: 1.5,
                border: 'none',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        )}

        {/* Live Preview Sandbox Pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              overflow: 'hidden'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              background: '#0f172a',
              borderBottom: '1px solid #1e293b',
              fontSize: '0.72rem',
              color: '#94a3b8'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontWeight: 700, color: '#f8fafc' }}>Live Sandboxed Execution</span>
              </div>
              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                Rendered with sandbox=&quot;allow-scripts&quot;
              </span>
            </div>

            <iframe
              title="Organizer Code Playground Live Preview"
              srcDoc={sandboxedDoc}
              sandbox="allow-scripts"
              style={{
                flex: 1,
                width: '100%',
                minHeight: '260px',
                border: 'none',
                background: '#f8fafc',
                display: 'block'
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}

OrganizerPlaygroundEditor.propTypes = {
  playgroundData: PropTypes.shape({
    title: PropTypes.string,
    difficulty: PropTypes.string,
    instructions: PropTypes.string,
    hints: PropTypes.string,
    starterHtml: PropTypes.string,
    starterCss: PropTypes.string,
    starterJs: PropTypes.string
  }),
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func
}
