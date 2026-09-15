import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, CheckCircle2, Award, Clock, Sparkles,
  AlertCircle, RefreshCw, Calendar, Lock, BookOpen,
  ChevronRight, Check
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { cheatSheetService, formatDayName } from '../../services/cheatSheetService'
import CheatSheetCodeBlock from '../../components/cheatsheet/CheatSheetCodeBlock'
import CheatSheetNote from '../../components/cheatsheet/CheatSheetNote'
import CheatSheetFontPreview from '../../components/cheatsheet/CheatSheetFontPreview'
import CheatSheetQuiz from '../../components/cheatsheet/CheatSheetQuiz'
import CheatSheetPlayground from '../../components/cheatsheet/CheatSheetPlayground'
import { formatInlineText } from '../../utils/sanitizeRichText'

export default function CheatSheetViewer() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, refreshStats } = useAuth()

  const [sheet, setSheet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isCached, setIsCached] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [xpAwarded, setXpAwarded] = useState(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [viewMode, setViewMode] = useState('step') // 'step' | 'all'
  const [attendedQuizzes, setAttendedQuizzes] = useState(() => {
    try {
      const saved = localStorage.getItem(`learnova_attended_quizzes_${id || 'css-part-3'}`)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [toast, setToast] = useState({ visible: false, message: '' })
  const toastTimeoutRef = useRef(null)

  const sections = sheet?.sections || []

  const isSectionLocked = (targetIdx) => {
    for (let i = 0; i < targetIdx; i++) {
      const sec = sections[i]
      if (sec?.quiz && !attendedQuizzes[sec.id || i]) {
        return { locked: true, blockingIndex: i, blockingTitle: sec.title || `Section ${i + 1}` }
      }
    }
    return { locked: false }
  }

  const handleAttendQuiz = (sectionKey) => {
    setAttendedQuizzes(prev => {
      const updated = { ...prev, [sectionKey]: true }
      try {
        localStorage.setItem(`learnova_attended_quizzes_${id || 'css-part-3'}`, JSON.stringify(updated))
      } catch {}
      return updated
    })
    triggerToast('🎉 Practice question answered! Next section is unlocked.')
  }

  useEffect(() => {
    loadCheatSheet()
  }, [id, user?.id])

  // Track reading scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      if (totalHeight > 0) {
        const current = (window.scrollY / totalHeight) * 100
        setScrollProgress(Math.min(100, Math.max(0, current)))
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const loadCheatSheet = async () => {
    setLoading(true)
    setError(null)

    const result = await cheatSheetService.getCheatSheet(id || 'css-part-3', user?.id)

    if (result.error && !result.data) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSheet(result.data)
    setIsCached(Boolean(result.isCached))

    // Check completion status
    if (result.data?.id && user?.id) {
      const isDone = await cheatSheetService.checkCompletion(user.id, result.data.id)
      setCompleted(isDone)
    }

    setLoading(false)
  }

  const handleComplete = async () => {
    if (!sheet?.id || completed || completing) return
    setCompleting(true)

    const res = await cheatSheetService.completeCheatSheet(sheet.id)
    if (res.success) {
      setCompleted(true)
      setXpAwarded(res.xp_awarded)
      if (refreshStats) refreshStats()
    }
    setCompleting(false)
  }

  const triggerToast = (msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToast({ visible: true, message: msg })
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ visible: false, message: '' })
    }, 3500)
  }

  // Strict Copy & Content Theft Protection:
  // Disables right-click, Ctrl+C, Cmd+C, Ctrl+A, and text dragging across ALL instructional materials and code blocks,
  // encouraging students to type out the code manually to build muscle memory. Only active student playground input fields allow typing.
  useEffect(() => {
    const isEditableInput = (node) => {
      if (!node) return false
      const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
      return Boolean(
        el?.closest('textarea') ||
        el?.closest('input') ||
        el?.closest('.code-editor-textarea')
      )
    }

    const handleGlobalKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey
      if (!isCtrlOrCmd) return

      const key = e.key.toLowerCase()

      // Block Ctrl+C / Cmd+C on all content and code
      if (key === 'c') {
        const selection = window.getSelection()
        const activeEl = document.activeElement

        const isInputActive = activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')
        const selectionInInput = selection && !selection.isCollapsed &&
          isEditableInput(selection.anchorNode) &&
          isEditableInput(selection.focusNode)

        if (!isInputActive && !selectionInInput) {
          e.preventDefault()
          e.stopPropagation()
          if (selection) selection.removeAllRanges()
          triggerToast('🔒 Copying code and study content is disabled. Type out the code in the playground to practice!')
        }
      }

      // Block Ctrl+A / Cmd+A across the full reading document
      if (key === 'a') {
        const activeEl = document.activeElement
        const isInputActive = activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')
        if (!isInputActive) {
          e.preventDefault()
          e.stopPropagation()
        }
      }

      // Block Ctrl+S / Cmd+S save page attempt
      if (key === 's') {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const handleGlobalContextMenu = (e) => {
      const isInput = isEditableInput(e.target)
      if (!isInput) {
        e.preventDefault()
        e.stopPropagation()
        triggerToast('🔒 Right-click is disabled on study content and code. Practice by typing the code directly!')
      }
    }

    const handleGlobalDragStart = (e) => {
      const isInput = isEditableInput(e.target)
      if (!isInput) {
        e.preventDefault()
      }
    }

    const handleGlobalCopy = (e) => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return

      const anchorInInput = isEditableInput(selection.anchorNode)
      const focusInInput = isEditableInput(selection.focusNode)

      if (!anchorInInput || !focusInInput) {
        e.preventDefault()
        e.stopPropagation()
        selection.removeAllRanges()
        triggerToast('🔒 Copying code and study content is disabled. Practice by typing the code in the playground!')
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown, true)
    window.addEventListener('contextmenu', handleGlobalContextMenu, true)
    window.addEventListener('dragstart', handleGlobalDragStart, true)
    document.addEventListener('copy', handleGlobalCopy, true)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true)
      window.removeEventListener('contextmenu', handleGlobalContextMenu, true)
      window.removeEventListener('dragstart', handleGlobalDragStart, true)
      document.removeEventListener('copy', handleGlobalCopy, true)
    }
  }, [])

  // Component-level fallback copy handler
  const handleContentCopy = (e) => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const isEditableInput = (node) => {
      if (!node) return false
      const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement
      return Boolean(el?.closest('textarea') || el?.closest('input') || el?.closest('.code-editor-textarea'))
    }

    const anchorInInput = isEditableInput(selection.anchorNode)
    const focusInInput = isEditableInput(selection.focusNode)

    if (!anchorInInput || !focusInInput) {
      e.preventDefault()
      triggerToast('🔒 Copying code and study content is disabled. Practice by typing the code in the playground!')
    }
  }

  const handleContextMenu = (e) => {
    const isInput = Boolean(e.target?.closest('textarea, input, .code-editor-textarea'))
    if (!isInput) {
      e.preventDefault()
      triggerToast('🔒 Right-click is disabled on study content and code. Practice by typing the code directly!')
    }
  }

  const handleNavigateSection = (secIndex) => {
    if (secIndex < 0 || secIndex >= sections.length) return
    if (secIndex > activeSectionIndex) {
      const lockCheck = isSectionLocked(secIndex)
      if (lockCheck.locked) {
        triggerToast(`🔒 Please attempt the practice quiz in "${lockCheck.blockingTitle}" to unlock this section.`)
        return
      }
    }
    setActiveSectionIndex(secIndex)
    if (viewMode === 'all') {
      const el = document.getElementById(`cs-section-${secIndex}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    } else {
      const el = document.getElementById('cs-content-heading')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 220, behavior: 'smooth' })
      }
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base, #0a0d14)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>
          <div style={{ height: '36px', width: '320px', background: 'var(--bg-elevated, #161b28)', borderRadius: '8px', marginBottom: '1.5rem', animation: 'pulse 1.5s infinite' }} />
          <div style={{ background: 'var(--bg-surface, #111522)', borderRadius: '16px', padding: '2.5rem', minHeight: '450px', border: '1px solid var(--card-border, rgba(255,255,255,0.08))' }}>
            <div style={{ height: '40px', width: '280px', background: 'var(--bg-elevated, #161b28)', borderRadius: '8px', marginBottom: '1.5rem' }} />
            <div style={{ height: '20px', width: '480px', background: 'var(--bg-elevated, #161b28)', borderRadius: '6px', marginBottom: '2rem' }} />
            <div style={{ height: '160px', width: '100%', background: '#070b16', borderRadius: '12px' }} />
          </div>
        </div>
      </div>
    )
  }

  if (error && !sheet) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base, #0a0d14)', padding: '4rem 1.5rem' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ background: 'var(--bg-surface, #111522)', borderRadius: '20px', padding: '3rem 2rem', border: '1px solid rgba(239, 68, 68, 0.25)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1.25rem auto' }} />
            <h2 style={{ fontSize: '1.5rem', color: '#f8fafc', marginBottom: '0.75rem', fontWeight: 800 }}>Access Restricted</h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '2rem' }}>{error}</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/student/courses')}
                style={{ padding: '0.65rem 1.5rem', background: '#6366f1', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}
              >
                Browse Enrolled Courses
              </button>
              <button
                onClick={loadCheatSheet}
                style={{ padding: '0.65rem 1.5rem', background: 'var(--bg-elevated, #161b28)', color: '#cbd5e1', border: '1px solid var(--card-border, rgba(255,255,255,0.1))', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="cs-protected-reading"
      onCopy={handleContentCopy}
      onContextMenu={handleContextMenu}
      onDragStart={(e) => {
        if (!e.target?.closest('pre, code, .cs-code-allowed, textarea, input')) {
          e.preventDefault()
        }
      }}
      style={{
        minHeight: '100vh',
        background: 'var(--bg-base, #0a0d14)',
        paddingBottom: '5rem',
        position: 'relative'
      }}
    >
      {/* Top Reading Progress Bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '3.5px',
          background: 'rgba(255, 255, 255, 0.05)',
          zIndex: 1000
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${viewMode === 'step' ? Math.round(((activeSectionIndex + 1) / (sections.length || 1)) * 100) : scrollProgress}%`,
            background: 'linear-gradient(90deg, #6366f1, #ec4899)',
            transition: 'width 0.25s ease-out'
          }}
        />
      </div>

      {/* Sticky Top Navigation Bar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          background: 'rgba(10, 13, 20, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
          zIndex: 50,
          padding: '0.75rem 1.5rem'
        }}
      >
        <div
          style={{
            maxWidth: '1080px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          {/* Left: Back button & Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'var(--bg-elevated, #161b28)',
                border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #cbd5e1)',
                transition: 'all 0.15s ease'
              }}
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft size={16} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem' }}>
              <span style={{ color: '#818cf8', fontWeight: 600 }}>{sheet?.topic_badge || 'Introduction to HTML & CSS'}</span>
              <ChevronRight size={13} color="#64748b" />
              <span style={{ color: 'var(--text-primary, #f8fafc)', fontWeight: 700 }}>
                {sheet?.breadcrumb_title || sheet?.title}
              </span>
            </div>
          </div>

          {/* Right: Security Pill & Metadata */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Copy-protection status badge */}
            <div
              title="Study material and code are protected against copying. Practice by typing the code directly into the editor!"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '20px',
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                color: '#818cf8',
                fontSize: '0.72rem',
                fontWeight: 700
              }}
            >
              <Lock size={12} />
              <span>Copy Protected (Type to Practice)</span>
            </div>

            {/* Schedule Week & Day */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '20px',
                background: 'var(--bg-elevated, #161b28)',
                color: 'var(--text-secondary, #cbd5e1)',
                border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              <Calendar size={13} style={{ color: '#6366f1' }} />
              <span>Week {sheet?.week_number || 1} • {formatDayName(sheet?.day_of_week || sheet?.day_number || 1)}</span>
            </span>

            {isCached && (
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.25)', fontWeight: 600 }}>
                Offline Cache
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '1.5rem 1.25rem 0 1.25rem' }}>
        {/* Document Hero Banner */}
        <div
          style={{
            background: 'linear-gradient(180deg, var(--bg-surface, #111522) 0%, var(--bg-elevated, #161b28) 100%)',
            borderRadius: '20px',
            border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
            padding: '2rem 2.25rem',
            marginBottom: '2rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Subtle glowing orb background */}
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              right: '-40px',
              width: '180px',
              height: '180px',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
              pointerEvents: 'none'
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                borderRadius: '6px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}
            >
              <BookOpen size={12} />
              <span>Interactive Cheat Sheet</span>
            </span>
          </div>

          <h1
            style={{
              margin: '0 0 1rem 0',
              fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
              fontWeight: 900,
              color: 'var(--text-primary, #f8fafc)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}
          >
            {sheet?.title || 'Interactive Cheat Sheet'}
          </h1>

          {sheet?.description && (
            <p style={{ fontSize: '1.02rem', color: 'var(--text-secondary, #cbd5e1)', margin: '0 0 1.25rem 0', lineHeight: 1.6, maxWidth: '800px' }}>
              {sheet.description}
            </p>
          )}

          {/* Quick Metrics Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              paddingTop: '1rem',
              borderTop: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary, #cbd5e1)' }}>
              <Clock size={15} style={{ color: '#818cf8' }} />
              <span>{sheet?.estimated_minutes || 10} Mins Read</span>
            </div>

            <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary, #cbd5e1)' }}>
              <Award size={15} style={{ color: '#eab308' }} />
              <span>+{sheet?.xp_reward || 10} XP on Completion</span>
            </div>

            <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary, #cbd5e1)' }}>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>{sections.length}</span>
              <span>Total Learning Sections</span>
            </div>

            {completed && (
              <>
                <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.82rem', fontWeight: 700 }}>
                  <CheckCircle2 size={15} /> Completed
                </span>
              </>
            )}
          </div>
        </div>

        {/* Interactive Table of Contents (Section Jumper & Stepper) */}
        {sections.length > 1 && (
          <div
            id="cs-content-heading"
            style={{
              background: 'var(--bg-surface, #111522)',
              border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
              borderRadius: '16px',
              padding: '1rem 1.25rem',
              marginBottom: '2rem'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '0.85rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={16} color="#818cf8" />
                <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary, #f8fafc)' }}>
                  Lesson Sections:
                </span>
                <span style={{ fontSize: '0.78rem', color: '#818cf8', fontWeight: 700 }}>
                  ({viewMode === 'step' ? `Section ${activeSectionIndex + 1} of ${sections.length}` : `${sections.length} Topics`})
                </span>
              </div>

              {/* View Mode Toggle: Step-by-Step vs View All */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: 'var(--bg-elevated, #161b28)',
                  borderRadius: '8px',
                  padding: '3px',
                  border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))'
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('step')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: viewMode === 'step' ? '#6366f1' : 'transparent',
                    color: viewMode === 'step' ? '#ffffff' : 'var(--text-muted, #8e9bb0)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Step by Step
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('all')}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: viewMode === 'all' ? '#6366f1' : 'transparent',
                    color: viewMode === 'all' ? '#ffffff' : 'var(--text-muted, #8e9bb0)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  View All
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {sections.map((sec, idx) => {
                const isActive = viewMode === 'step' && activeSectionIndex === idx
                const lockCheck = isSectionLocked(idx)
                const isLocked = lockCheck.locked

                return (
                  <button
                    key={sec.id || idx}
                    type="button"
                    onClick={() => {
                      if (isLocked) {
                        triggerToast(`🔒 Please attempt the practice quiz in "${lockCheck.blockingTitle}" to unlock this section.`)
                        return
                      }
                      handleNavigateSection(idx)
                    }}
                    title={isLocked ? `Locked: Complete quiz in ${lockCheck.blockingTitle}` : sec.title}
                    style={{
                      background: isActive
                        ? '#6366f1'
                        : isLocked
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'var(--bg-elevated, #161b28)',
                      border: `1px solid ${
                        isActive
                          ? '#818cf8'
                          : isLocked
                          ? 'rgba(255, 255, 255, 0.06)'
                          : 'var(--card-border, rgba(255, 255, 255, 0.08))'
                      }`,
                      borderRadius: '20px',
                      padding: '4px 14px',
                      fontSize: '0.78rem',
                      fontWeight: isActive ? 800 : 600,
                      color: isActive
                        ? '#ffffff'
                        : isLocked
                        ? 'var(--text-muted, #64748b)'
                        : 'var(--text-secondary, #cbd5e1)',
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                      boxShadow: isActive ? '0 2px 10px rgba(99, 102, 241, 0.35)' : 'none',
                      opacity: isLocked ? 0.6 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive && !isLocked) {
                        e.currentTarget.style.borderColor = '#6366f1'
                        e.currentTarget.style.color = '#ffffff'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive && !isLocked) {
                        e.currentTarget.style.borderColor = 'var(--card-border, rgba(255, 255, 255, 0.08))'
                        e.currentTarget.style.color = 'var(--text-secondary, #cbd5e1)'
                      }
                    }}
                  >
                    <span>{sec.title}</span>
                    {isLocked && <Lock size={11} style={{ opacity: 0.7 }} />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Section Cards List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {(viewMode === 'step'
            ? (sections[activeSectionIndex] ? [{ ...sections[activeSectionIndex], originalIndex: activeSectionIndex }] : [])
            : sections.map((sec, idx) => ({ ...sec, originalIndex: idx }))
          ).map((section) => {
            const idx = section.originalIndex
            return (
              <article
                key={section.id || idx}
                id={`cs-section-${idx}`}
                className="cs-section-card"
              >
                {/* Section Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.85rem' }}>
                  <span
                    style={{
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: '#818cf8',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase'
                    }}
                  >
                    Section 0{idx + 1}
                  </span>
                </div>

                <h2
                  style={{
                    fontSize: 'clamp(1.35rem, 3vw, 1.85rem)',
                    fontWeight: 800,
                    color: 'var(--text-primary, #f8fafc)',
                    margin: '0 0 1rem 0',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {section.title}
                </h2>

                {/* Section Description with inline code badge formatting */}
                {section.description && (
                  <div
                    style={{
                      fontSize: '1.02rem',
                      color: 'var(--text-secondary, #cbd5e1)',
                      lineHeight: 1.65,
                      marginBottom: '1.5rem'
                    }}
                    dangerouslySetInnerHTML={{ __html: formatInlineText(section.description) }}
                  />
                )}

                {/* Values Table Subblock */}
                {section.valueTable && (
                  <div style={{ margin: '1.5rem 0' }}>
                    {section.valueTable.title && (
                      <div
                        style={{ fontSize: '0.96rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '0.85rem' }}
                        dangerouslySetInnerHTML={{ __html: formatInlineText(section.valueTable.title) }}
                      />
                    )}
                    <div
                      style={{
                        maxWidth: '220px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
                        background: 'var(--bg-elevated, #161b28)',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)'
                      }}
                    >
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#ffffff',
                          padding: '8px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          textAlign: 'center',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}
                      >
                        {section.valueTable.header || 'Value'}
                      </div>
                      {(section.valueTable.values || []).map((val, vIdx) => (
                        <div
                          key={vIdx}
                          style={{
                            padding: '8px 14px',
                            background: vIdx % 2 === 0 ? 'var(--bg-surface, #111522)' : 'var(--bg-elevated, #161b28)',
                            color: '#38bdf8',
                            fontSize: '0.88rem',
                            fontFamily: 'var(--font-mono, monospace)',
                            fontWeight: 600,
                            textAlign: 'center',
                            borderTop: '1px solid var(--card-border, rgba(255, 255, 255, 0.05))',
                            userSelect: 'none'
                          }}
                        >
                          {val}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Code Block Snippet with Terminal Chrome Bar */}
                {section.codeBlock && (
                  <CheatSheetCodeBlock
                    code={section.codeBlock.code}
                    language={section.codeBlock.language || 'CSS'}
                  />
                )}

                {/* Font Family Live Google Fonts Preview */}
                {section.fontPreview && (
                  <CheatSheetFontPreview data={section.fontPreview} />
                )}

                {/* Callout Note Banner */}
                {section.note && (
                  <CheatSheetNote items={section.note.items || []} />
                )}

                {/* Interactive Practice Quiz */}
                {section.quiz && (
                  <CheatSheetQuiz
                    quiz={section.quiz}
                    initialAttended={Boolean(attendedQuizzes[section.id || idx])}
                    onAttend={() => handleAttendQuiz(section.id || idx)}
                  />
                )}

                {/* Live Embedded Coding Practice Playground */}
                {section.playground && (
                  <CheatSheetPlayground starterData={section.playground} />
                )}

                {/* Section Step Navigation Footer Bar */}
                {(() => {
                  const hasQuiz = Boolean(section.quiz)
                  const isQuizAttended = Boolean(attendedQuizzes[section.id || idx])
                  const canProceed = !hasQuiz || isQuizAttended

                  return (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '1.75rem',
                        marginTop: '2.5rem',
                        borderTop: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      {/* Previous Section Button */}
                      {idx > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleNavigateSection(idx - 1)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '10px',
                            background: 'var(--bg-elevated, #161b28)',
                            border: '1px solid var(--card-border, rgba(255, 255, 255, 0.12))',
                            color: 'var(--text-secondary, #cbd5e1)',
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#6366f1'
                            e.currentTarget.style.color = '#ffffff'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--card-border, rgba(255, 255, 255, 0.12))'
                            e.currentTarget.style.color = 'var(--text-secondary, #cbd5e1)'
                          }}
                        >
                          <ArrowLeft size={16} />
                          <span>Previous: {sections[idx - 1]?.title}</span>
                        </button>
                      ) : (
                        <div />
                      )}

                      {/* Next Section Button or Completion Prompt */}
                      {idx < sections.length - 1 ? (
                        canProceed ? (
                          <button
                            type="button"
                            onClick={() => handleNavigateSection(idx + 1)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '0.75rem 1.6rem',
                              borderRadius: '12px',
                              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                              color: '#ffffff',
                              border: 'none',
                              fontWeight: 800,
                              fontSize: '0.92rem',
                              cursor: 'pointer',
                              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'translateY(-1px)'
                              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.5)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'none'
                              e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.35)'
                            }}
                          >
                            <span>Next: {sections[idx + 1]?.title}</span>
                            <ArrowRight size={18} />
                          </button>
                        ) : (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '0.72rem 1.4rem',
                              borderRadius: '12px',
                              background: 'rgba(234, 179, 8, 0.08)',
                              border: '1px solid rgba(234, 179, 8, 0.28)',
                              color: '#fbbf24',
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
                            }}
                          >
                            <Lock size={16} />
                            <span>Attempt Practice Quiz above to unlock Next Section</span>
                          </div>
                        )
                      ) : (
                        canProceed ? (
                          <button
                            type="button"
                            onClick={handleComplete}
                            disabled={completed || completing}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '0.75rem 1.6rem',
                              borderRadius: '12px',
                              background: completed
                                ? 'rgba(16, 185, 129, 0.2)'
                                : 'linear-gradient(135deg, #10b981, #059669)',
                              color: completed ? '#34d399' : '#ffffff',
                              border: completed ? '1px solid #10b981' : 'none',
                              fontWeight: 800,
                              fontSize: '0.92rem',
                              cursor: completed ? 'default' : 'pointer',
                              boxShadow: completed ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.35)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {completed ? (
                              <>
                                <CheckCircle2 size={18} />
                                <span>All Sections Completed!</span>
                              </>
                            ) : (
                              <>
                                <Check size={18} />
                                <span>Complete Lesson (+{sheet?.xp_reward || 10} XP)</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '0.72rem 1.4rem',
                              borderRadius: '12px',
                              background: 'rgba(234, 179, 8, 0.08)',
                              border: '1px solid rgba(234, 179, 8, 0.28)',
                              color: '#fbbf24',
                              fontSize: '0.88rem',
                              fontWeight: 700,
                              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
                            }}
                          >
                            <Lock size={16} />
                            <span>Attempt Practice Quiz above to complete lesson</span>
                          </div>
                        )
                      )}
                    </div>
                  )
                })()}
              </article>
            )
          })}
        </div>

        {/* Bottom Lesson Footer Card */}
        <div
          style={{
            marginTop: '3rem',
            background: 'var(--bg-surface, #111522)',
            border: '1.5px solid var(--card-border, rgba(255, 255, 255, 0.08))',
            borderRadius: '20px',
            padding: '2rem 2.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted, #8e9bb0)', fontSize: '0.86rem', marginBottom: '4px' }}>
              <Clock size={15} />
              <span>Estimated duration: {sheet?.estimated_minutes || 10} Mins</span>
              <span>•</span>
              <Award size={15} style={{ color: '#eab308' }} />
              <span>+{sheet?.xp_reward || 10} XP</span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
              {completed ? 'Cheat Sheet Fully Completed' : 'Ready to claim your XP reward?'}
            </div>
          </div>

          <div>
            {completed ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.75rem 1.6rem',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  fontWeight: 800,
                  fontSize: '0.94rem',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  boxShadow: '0 2px 10px rgba(16, 185, 129, 0.15)'
                }}
              >
                <CheckCircle2 size={18} />
                <span>Lesson Completed</span>
              </div>
            ) : (
              <button
                onClick={handleComplete}
                disabled={completing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.75rem 1.8rem',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '0.94rem',
                  border: 'none',
                  cursor: completing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Sparkles size={16} />
                <span>{completing ? 'Saving XP...' : `Mark as Completed (+${sheet?.xp_reward || 10} XP)`}</span>
              </button>
            )}
          </div>
        </div>

        {/* XP Award Celebration Banner */}
        {xpAwarded && xpAwarded > 0 && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '1.25rem 1.5rem',
              borderRadius: '16px',
              background: 'rgba(99, 102, 241, 0.12)',
              border: '1.5px solid rgba(99, 102, 241, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              color: '#f8fafc',
              fontWeight: 700,
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.2)'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
              <Award size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>
                Congratulations! +{xpAwarded} XP Earned
              </div>
              <div style={{ fontSize: '0.84rem', color: '#cbd5e1', marginTop: '2px' }}>
                Your progress has been recorded in the curriculum tracker.
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Copy Protection Toast Notification */}
      {toast.visible && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#0f172a',
            border: '1.5px solid rgba(99, 102, 241, 0.4)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
            color: '#f8fafc',
            padding: '12px 18px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 9999,
            maxWidth: '380px',
            fontSize: '0.84rem',
            lineHeight: 1.4,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <Lock size={18} style={{ color: '#818cf8', flexShrink: 0 }} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
