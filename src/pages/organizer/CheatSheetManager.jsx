import { useState, useEffect, useRef } from 'react'
import {
  FileText, Plus, Edit2, Trash2, Eye, ExternalLink,
  Save, X, Check, Clock, Award, BookOpen, AlertTriangle,
  HelpCircle, ListOrdered, Code2, ChevronDown, ChevronUp,
  Layers, Type, Search, Filter, Sparkles, Calendar,
  ArrowUp, ArrowDown, Settings, CheckCircle2, ShieldCheck
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cheatSheetService, DAY_NAMES, formatDayName } from '../../services/cheatSheetService'
import CheatSheetCodeBlock from '../../components/cheatsheet/CheatSheetCodeBlock'
import CheatSheetNote from '../../components/cheatsheet/CheatSheetNote'
import CheatSheetFontPreview from '../../components/cheatsheet/CheatSheetFontPreview'
import CheatSheetQuiz from '../../components/cheatsheet/CheatSheetQuiz'
import CheatSheetPlayground from '../../components/cheatsheet/CheatSheetPlayground'
import OrganizerPlaygroundEditor, { PRACTICE_TEMPLATES } from '../../components/cheatsheet/OrganizerPlaygroundEditor'
import { formatInlineText } from '../../utils/sanitizeRichText'
import useGoogleFonts from '../../hooks/useGoogleFonts'

export default function CheatSheetManager() {
  const { user, profile } = useAuth()
  const [sheets, setSheets] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [editSheet, setEditSheet] = useState(null)
  const [activeEditorTab, setActiveEditorTab] = useState('sections') // 'sections' | 'settings' | 'preview'
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [addSectionMenuOpen, setAddSectionMenuOpen] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all')
  const addMenuRef = useRef(null)

  // Ensure Google Fonts configured in the editor are dynamically loaded for live preview
  const allEditorFonts = (editSheet?.sections || [])
    .flatMap(sec => sec.fontPreview?.fonts || [])
  useGoogleFonts(allEditorFonts)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
        setAddSectionMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [sheetsRes, coursesRes] = await Promise.all([
        cheatSheetService.listCheatSheets(),
        supabase.from('courses').select('id, title').order('title')
      ])

      setSheets(sheetsRes.data || [])
      setCourses(coursesRes.data || [])
    } catch (err) {
      console.error('Error loading cheat sheets:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCreate = () => {
    setEditSheet({
      title: '',
      slug: '',
      topic_badge: 'Introduction to HTML & CSS',
      breadcrumb_title: '',
      description: '',
      course_id: courses[0]?.id || null,
      week_number: 1,
      day_number: 1,
      day_of_week: 1,
      day_name: 'Monday',
      estimated_minutes: 10,
      xp_reward: 10,
      status: 'published',
      sections: [
        {
          id: `sec-${Date.now()}-1`,
          type: 'standard',
          title: '1. Example Topic',
          description: 'Explain the core concept here. Use backticks like `property-name` for highlighting.',
          codeBlock: {
            language: 'CSS',
            code: '.example {\n  font-size: 16px;\n}'
          },
          note: {
            items: [
              'Key takeaway rule or concept for students.'
            ]
          }
        }
      ]
    })
    setActiveEditorTab('sections')
    setSaveError(null)
    setSaveSuccess(false)
    setCollapsedSections({})
  }

  const handleOpenEdit = (sheet) => {
    setEditSheet(JSON.parse(JSON.stringify(sheet)))
    setActiveEditorTab('sections')
    setSaveError(null)
    setSaveSuccess(false)
    setCollapsedSections({})
  }

  const handleSave = async () => {
    if (!editSheet.title?.trim()) {
      setSaveError('Please enter a title for the cheat sheet.')
      setActiveEditorTab('settings')
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      await cheatSheetService.saveCheatSheet(editSheet)
      await loadData()
      setSaveSuccess(true)
      setTimeout(() => {
        setEditSheet(null)
        setSaveSuccess(false)
      }, 700)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveError(err.message || 'Failed to save cheat sheet. Check course ownership.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await cheatSheetService.deleteCheatSheet(id)
      setSheets(prev => prev.filter(s => s.id !== id))
      setDeleteConfirmId(null)
    } catch (err) {
      alert('Failed to delete cheat sheet: ' + err.message)
    }
  }

  // Add new section from dropdown
  const handleAddSectionType = (type) => {
    setAddSectionMenuOpen(false)
    setEditSheet(prev => {
      const count = (prev.sections || []).length + 1
      let newSec = {
        id: `sec-${Date.now()}`,
        type: 'standard',
        title: `${count}. New Topic`,
        description: ''
      }

      if (type === 'quiz') {
        newSec.title = `${count}. Practice Question`
        newSec.description = 'Test your understanding with this practice question.'
        newSec.quiz = {
          questionNumber: 'Question 1 of 1',
          prompt: 'Which CSS property is used to change font family?',
          options: ['font-family', 'font-weight', 'text-style', 'font-size'],
          correctAnswer: 'font-family',
          explanation: 'The `font-family` property specifies the font for an element.'
        }
      } else if (type === 'note') {
        newSec.title = `${count}. Important Guidelines`
        newSec.description = 'Review the following essential rules before continuing.'
        newSec.note = {
          items: [
            'Always provide a fallback font family such as sans-serif or serif.',
            'Wrap multi-word font family names in quotes (e.g., "Caveat").'
          ]
        }
      } else if (type === 'table') {
        newSec.title = `${count}. Supported Values`
        newSec.description = 'Common property values and syntax options:'
        newSec.valueTable = {
          title: 'Syntax values reference:',
          header: 'Value',
          values: ['normal', 'italic', 'oblique']
        }
      } else if (type === 'playground') {
        newSec.title = `${count}. Hands-On Coding Practice`
        newSec.description = 'Write and test your code directly in the sandbox below.'
        const defaultChallenge = PRACTICE_TEMPLATES[0].data
        newSec.playground = {
          title: defaultChallenge.title,
          difficulty: defaultChallenge.difficulty,
          instructions: defaultChallenge.instructions,
          hints: defaultChallenge.hints,
          starterHtml: defaultChallenge.starterHtml,
          starterCss: defaultChallenge.starterCss,
          starterJs: defaultChallenge.starterJs
        }
      } else if (type === 'fonts') {
        newSec.title = `${count}. Google Fonts Preview`
        newSec.description = 'Google Fonts allow you to use thousands of modern open-source typefaces.'
        newSec.fontPreview = {
          text: 'Explore these widely used Google Font families:',
          sampleWord: 'Tourism',
          fonts: [
            { name: '"Caveat"', family: 'Caveat', style: 'normal', weight: '700' },
            { name: '"Roboto"', family: 'Roboto', style: 'normal', weight: '400' }
          ]
        }
      } else {
        newSec.codeBlock = {
          language: 'CSS',
          code: '/* Add CSS rules here */\n.heading {\n  font-size: 24px;\n  color: #6366f1;\n}'
        }
      }

      return {
        ...prev,
        sections: [...(prev.sections || []), newSec]
      }
    })
  }

  const handleRemoveSection = (index) => {
    setEditSheet(prev => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index)
    }))
  }

  const handleMoveSection = (index, direction) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= sections.length) return prev
      const temp = sections[index]
      sections[index] = sections[targetIndex]
      sections[targetIndex] = temp
      return { ...prev, sections }
    })
  }

  const toggleSectionCollapse = (secId) => {
    setCollapsedSections(prev => ({
      ...prev,
      [secId]: !prev[secId]
    }))
  }

  const handleUpdateSection = (index, field, value) => {
    setEditSheet(prev => {
      const updated = [...prev.sections]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, sections: updated }
    })
  }

  const handleToggleSubblock = (secIdx, blockKey, defaultVal) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const target = { ...sections[secIdx] }
      if (target[blockKey]) {
        delete target[blockKey]
      } else {
        target[blockKey] = defaultVal
      }
      sections[secIdx] = target
      return { ...prev, sections }
    })
  }

  const handleUpdateQuiz = (secIdx, field, val) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      sec.quiz = { ...(sec.quiz || {}), [field]: val }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleUpdateQuizOption = (secIdx, optIdx, val) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const options = [...(sec.quiz?.options || ['', '', '', ''])]
      const oldVal = options[optIdx]
      options[optIdx] = val
      sec.quiz = {
        ...(sec.quiz || {}),
        options,
        correctAnswer: sec.quiz?.correctAnswer === oldVal ? val : (sec.quiz?.correctAnswer || options[0])
      }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleAddQuizOption = (secIdx) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const options = [...(sec.quiz?.options || ['', '', '', ''])]
      if (options.length >= 6) return prev
      options.push(`Option ${String.fromCharCode(65 + options.length)}`)
      sec.quiz = { ...(sec.quiz || {}), options }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleRemoveQuizOption = (secIdx, optIdx) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const options = [...(sec.quiz?.options || [])]
      if (options.length <= 2) return prev
      const removedVal = options[optIdx]
      options.splice(optIdx, 1)
      sec.quiz = {
        ...(sec.quiz || {}),
        options,
        correctAnswer: sec.quiz?.correctAnswer === removedVal ? (options[0] || '') : (sec.quiz?.correctAnswer || '')
      }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleAddNoteItem = (secIdx) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const items = [...(sec.note?.items || []), 'New key takeaway point']
      sec.note = { ...(sec.note || {}), items }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleUpdateNoteItem = (secIdx, itemIdx, val) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const items = [...(sec.note?.items || [])]
      items[itemIdx] = val
      sec.note = { ...(sec.note || {}), items }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleRemoveNoteItem = (secIdx, itemIdx) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const items = (sec.note?.items || []).filter((_, i) => i !== itemIdx)
      sec.note = { ...(sec.note || {}), items }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleAddValueItem = (secIdx) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const values = [...(sec.valueTable?.values || []), 'new-value']
      sec.valueTable = { ...(sec.valueTable || { header: 'Value' }), values }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleUpdateValueItem = (secIdx, valIdx, val) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const values = [...(sec.valueTable?.values || [])]
      values[valIdx] = val
      sec.valueTable = { ...(sec.valueTable || { header: 'Value' }), values }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleRemoveValueItem = (secIdx, valIdx) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const values = (sec.valueTable?.values || []).filter((_, i) => i !== valIdx)
      sec.valueTable = { ...(sec.valueTable || { header: 'Value' }), values }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  // Google Font Families Showcase Handlers (Fully Organizer Customizable)
  const handleUpdateFontPreview = (secIdx, field, val) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      sec.fontPreview = { ...(sec.fontPreview || { fonts: [] }), [field]: val }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleAddFontItem = (secIdx, fontObj) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const defaultFonts = [
        { name: '"Roboto"', family: 'Roboto', style: 'normal', weight: '700', uppercase: false }
      ]
      const currentFonts = [...(sec.fontPreview?.fonts || defaultFonts)]
      const fonts = [...currentFonts, fontObj || { name: '"Inter"', family: 'Inter', style: 'normal', weight: '700', uppercase: false }]
      sec.fontPreview = {
        ...(sec.fontPreview || { text: 'You can use one of the below values of the font-family property,', sampleWord: 'Tourism' }),
        fonts
      }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleUpdateFontItem = (secIdx, fontIdx, field, val) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const fonts = [...(sec.fontPreview?.fonts || [])]
      fonts[fontIdx] = { ...fonts[fontIdx], [field]: val }
      sec.fontPreview = { ...(sec.fontPreview || {}), fonts }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  const handleRemoveFontItem = (secIdx, fontIdx) => {
    setEditSheet(prev => {
      const sections = [...prev.sections]
      const sec = { ...sections[secIdx] }
      const fonts = (sec.fontPreview?.fonts || []).filter((_, i) => i !== fontIdx)
      sec.fontPreview = { ...(sec.fontPreview || {}), fonts }
      sections[secIdx] = sec
      return { ...prev, sections }
    })
  }

  // Filtered sheets
  const filteredSheets = sheets.filter(sheet => {
    const matchesSearch =
      !searchQuery.trim() ||
      sheet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sheet.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sheet.topic_badge?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCourse =
      selectedCourseFilter === 'all' ||
      (selectedCourseFilter === 'standalone' && !sheet.course_id) ||
      sheet.course_id === selectedCourseFilter

    const matchesStatus =
      selectedStatusFilter === 'all' || sheet.status === selectedStatusFilter

    return matchesSearch && matchesCourse && matchesStatus
  })

  // Aggregate stats
  const publishedCount = sheets.filter(s => s.status === 'published').length
  const draftCount = sheets.filter(s => s.status === 'draft').length
  const totalSections = sheets.reduce((acc, s) => acc + (s.sections || []).length, 0)

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1240px', margin: '0 auto' }}>
      {/* Hero Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.06) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.22)',
          borderRadius: '20px',
          padding: '2rem 2.25rem',
          marginBottom: '2rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
            pointerEvents: 'none'
          }}
        />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.6rem' }}>
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
              <Sparkles size={12} />
              <span>Interactive Learning CMS</span>
            </span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)',
              fontWeight: 900,
              color: 'var(--text-primary, #f8fafc)',
              margin: '0 0 0.5rem 0',
              letterSpacing: '-0.02em'
            }}
          >
            Cheat Sheet Manager
          </h1>

          <p style={{ color: 'var(--text-secondary, #cbd5e1)', margin: 0, fontSize: '0.96rem', maxWidth: '680px', lineHeight: 1.6 }}>
            Design and publish comprehensive interactive study modules with macOS-style code blocks, self-check quizzes, live sandboxed playgrounds, and auto-graded completion XP.
          </p>
        </div>

        <div>
          <button
            onClick={handleOpenCreate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0.75rem 1.6rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.94rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(99, 102, 241, 0.4)',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(99, 102, 241, 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 4px 18px rgba(99, 102, 241, 0.4)'
            }}
          >
            <Plus size={18} />
            <span>Create Cheat Sheet</span>
          </button>
        </div>
      </div>

      {/* Quick Statistics Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}
      >
        <div className="cs-stat-card">
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
              {sheets.length}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #8e9bb0)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Cheat Sheets
            </div>
          </div>
        </div>

        <div className="cs-stat-card">
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>
              {publishedCount}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #8e9bb0)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Published & Active
            </div>
          </div>
        </div>

        <div className="cs-stat-card">
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b' }}>
              {draftCount}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #8e9bb0)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Draft Modules
            </div>
          </div>
        </div>

        <div className="cs-stat-card">
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
              {totalSections}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted, #8e9bb0)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Interactive Sections
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          background: 'var(--bg-surface, #111522)',
          border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
          borderRadius: '16px',
          padding: '1rem 1.25rem',
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #8e9bb0)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, topic, or slug..."
              style={{
                width: '100%',
                padding: '0.55rem 0.8rem 0.55rem 2.25rem',
                borderRadius: '8px',
                border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
                background: 'var(--bg-elevated, #161b28)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.86rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #8e9bb0)', fontWeight: 600 }}>Course:</span>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
                background: 'var(--bg-elevated, #161b28)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.84rem'
              }}
            >
              <option value="all">All Courses</option>
              <option value="standalone">Standalone / Demo</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #8e9bb0)', fontWeight: 600 }}>Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
                background: 'var(--bg-elevated, #161b28)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '0.84rem'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Sheets List Cards */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 1rem' }}>
          <div className="loader-ring" />
        </div>
      ) : filteredSheets.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            background: 'var(--bg-surface, #111522)',
            borderRadius: '20px',
            border: '1.5px dashed var(--card-border, rgba(255, 255, 255, 0.12))'
          }}
        >
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto' }}>
            <BookOpen size={30} />
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary, #f8fafc)', fontSize: '1.25rem', fontWeight: 800 }}>
            {searchQuery ? 'No Matching Cheat Sheets' : 'No Cheat Sheets Yet'}
          </h3>
          <p style={{ color: 'var(--text-secondary, #cbd5e1)', marginBottom: '1.75rem', maxWidth: '420px', margin: '0 auto 1.75rem auto', lineHeight: 1.6, fontSize: '0.92rem' }}>
            {searchQuery ? 'Try adjusting your search query or clear the filter.' : 'Create your first interactive cheat sheet module with rich sections and live playgrounds.'}
          </p>
          <button
            onClick={searchQuery ? () => setSearchQuery('') : handleOpenCreate}
            style={{
              padding: '0.65rem 1.5rem',
              background: '#6366f1',
              color: '#ffffff',
              borderRadius: '10px',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
            }}
          >
            {searchQuery ? 'Clear Search' : 'Create Cheat Sheet'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.5rem' }}>
          {filteredSheets.map(sheet => {
            const courseObj = courses.find(c => c.id === sheet.course_id)
            const sectionList = sheet.sections || []

            return (
              <div
                key={sheet.id}
                className="cs-organizer-card"
              >
                <div>
                  {/* Top Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: sheet.status === 'published' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: sheet.status === 'published' ? '#10b981' : '#f59e0b',
                        border: `1px solid ${sheet.status === 'published' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                        letterSpacing: '0.04em'
                      }}
                    >
                      {sheet.status?.toUpperCase()}
                    </span>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.76rem',
                        color: 'var(--text-secondary, #cbd5e1)',
                        fontWeight: 600,
                        background: 'var(--bg-elevated, #161b28)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))'
                      }}
                    >
                      <Calendar size={12} style={{ color: '#6366f1' }} />
                      <span>Week {sheet.week_number || 1} • {formatDayName(sheet.day_of_week || sheet.day_number || 1)}</span>
                    </span>
                  </div>

                  {/* Course / Topic Tag */}
                  <div style={{ fontSize: '0.76rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
                    {courseObj?.title || sheet.topic_badge || 'Interactive Cheat Sheet'}
                  </div>

                  {/* Title */}
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', color: 'var(--text-primary, #f8fafc)', fontWeight: 800, lineHeight: 1.3 }}>
                    {sheet.title}
                  </h3>

                  {/* Description */}
                  <p style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.88rem', margin: '0 0 1.25rem 0', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {sheet.description || 'Comprehensive syllabus study module with code examples and quizzes.'}
                  </p>

                  {/* Metric Chips */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary, #cbd5e1)',
                      marginBottom: '1.25rem',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-elevated, #161b28)',
                      border: '1px solid var(--card-border, rgba(255, 255, 255, 0.05))'
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={13} style={{ color: '#818cf8' }} />
                      <span>{sheet.estimated_minutes || 10} Mins</span>
                    </span>

                    <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>•</span>

                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Award size={13} style={{ color: '#eab308' }} />
                      <span>+{sheet.xp_reward || 10} XP</span>
                    </span>

                    <span style={{ color: 'rgba(255, 255, 255, 0.15)' }}>•</span>

                    <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                      {sectionList.length} Sections
                    </span>
                  </div>
                </div>

                {/* Footer Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
                    paddingTop: '1rem',
                    marginTop: '0.25rem'
                  }}
                >
                  <a
                    href={`/student/cheatsheet/${sheet.slug || sheet.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#818cf8',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Eye size={14} />
                    <span>Student View</span>
                    <ExternalLink size={12} />
                  </a>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => handleOpenEdit(sheet)}
                      title="Edit Cheat Sheet"
                      style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
                        border: '1px solid rgba(99, 102, 241, 0.35)',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)'}
                    >
                      <Edit2 size={13} style={{ color: '#818cf8' }} />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setDeleteConfirmId(sheet.id)}
                      title="Delete Cheat Sheet"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        padding: '6px 8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        color: '#ef4444',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                        e.currentTarget.style.borderColor = '#ef4444'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.25)'
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface, #111522)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
            }}
          >
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
              <AlertTriangle size={22} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary, #f8fafc)', fontSize: '1.2rem', fontWeight: 800 }}>
              Delete Cheat Sheet?
            </h4>
            <p style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Are you sure you want to permanently delete this cheat sheet? Students will lose access to its contents.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: '0.55rem 1.2rem',
                  background: 'var(--bg-elevated, #161b28)',
                  border: '1px solid var(--card-border, rgba(255, 255, 255, 0.12))',
                  color: 'var(--text-secondary, #cbd5e1)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.88rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  padding: '0.55rem 1.4rem',
                  background: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  boxShadow: '0 2px 10px rgba(239, 68, 68, 0.35)'
                }}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Authoring & Editor Modal (Full IDE-Style Experience) */}
      {editSheet && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface, #111522)',
              borderRadius: '20px',
              maxWidth: '1120px',
              width: '100%',
              height: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px var(--card-border, rgba(255, 255, 255, 0.1))',
              border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
              overflow: 'hidden',
              color: 'var(--text-primary, #f8fafc)'
            }}
          >
            {/* Modal Top Header Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.75rem',
                borderBottom: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
                background: 'var(--bg-elevated, #161b28)',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Edit2 size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
                    {editSheet.id ? 'Edit Cheat Sheet' : 'Create New Cheat Sheet'}
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #8e9bb0)' }}>
                    {editSheet.title || 'Untitled Module'} • {editSheet.sections?.length || 0} Sections
                  </span>
                </div>
              </div>

              {/* Mode Tabs (Sections | Settings | Live Preview) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'var(--bg-surface, #111522)',
                  borderRadius: '10px',
                  padding: '3px',
                  border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))'
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveEditorTab('sections')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeEditorTab === 'sections' ? '#6366f1' : 'transparent',
                    color: activeEditorTab === 'sections' ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Layers size={14} />
                  <span>Sections ({editSheet.sections?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveEditorTab('settings')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeEditorTab === 'settings' ? '#6366f1' : 'transparent',
                    color: activeEditorTab === 'settings' ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Settings size={14} />
                  <span>Curriculum Settings</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveEditorTab('preview')}
                  style={{
                    padding: '5px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: activeEditorTab === 'preview' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
                    color: activeEditorTab === 'preview' ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Eye size={14} />
                  <span>Student Preview</span>
                </button>
              </div>

              {/* Action Buttons in Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: saveSuccess ? '#10b981' : '#6366f1',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
                    transition: 'all 0.15s'
                  }}
                >
                  {saveSuccess ? <Check size={15} /> : <Save size={15} />}
                  <span>{saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Sheet'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditSheet(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted, #8e9bb0)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Close Modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Error Alert if any */}
            {saveError && (
              <div style={{ padding: '0.75rem 1.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderBottom: '1px solid rgba(239, 68, 68, 0.25)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} />
                <span>{saveError}</span>
              </div>
            )}

            {/* Modal Body Container */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.75rem', background: 'var(--bg-surface, #111522)' }}>
              {/* TAB 1: CURRICULUM SETTINGS */}
              {activeEditorTab === 'settings' && (
                <div style={{ maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                  {/* Card: Basic Information */}
                  <div className="cs-editor-section-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                      <FileText size={18} style={{ color: '#818cf8' }} />
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
                        Basic Information
                      </h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                          Title *
                        </label>
                        <input
                          type="text"
                          className="cs-editor-input"
                          value={editSheet.title}
                          onChange={(e) => setEditSheet({ ...editSheet, title: e.target.value })}
                          placeholder="e.g. Introduction to CSS | Part 3"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                          URL Slug
                        </label>
                        <input
                          type="text"
                          className="cs-editor-input"
                          value={editSheet.slug}
                          onChange={(e) => setEditSheet({ ...editSheet, slug: e.target.value })}
                          placeholder="e.g. css-part-3"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                          Topic Badge Pill
                        </label>
                        <input
                          type="text"
                          className="cs-editor-input"
                          value={editSheet.topic_badge}
                          onChange={(e) => setEditSheet({ ...editSheet, topic_badge: e.target.value })}
                          placeholder="e.g. Introduction to HTML & CSS"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                          Course Association (Enrollment Guard)
                        </label>
                        <select
                          className="cs-editor-input"
                          value={editSheet.course_id || ''}
                          onChange={(e) => setEditSheet({ ...editSheet, course_id: e.target.value || null })}
                        >
                          <option value="">-- Standalone / Demo Sheet --</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                        Lesson Description
                      </label>
                      <textarea
                        className="cs-editor-input"
                        rows={3}
                        value={editSheet.description || ''}
                        onChange={(e) => setEditSheet({ ...editSheet, description: e.target.value })}
                        placeholder="Explain the objectives and takeaways of this interactive cheat sheet..."
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                  </div>

                  {/* Card: Schedule & Gamification */}
                  <div className="cs-editor-section-box">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
                      <Calendar size={18} style={{ color: '#38bdf8' }} />
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)' }}>
                        Schedule & Gamification
                      </h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                          Week Number
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="cs-editor-input"
                          value={editSheet.week_number}
                          onChange={(e) => setEditSheet({ ...editSheet, week_number: parseInt(e.target.value) || 1 })}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                          Day of Week
                        </label>
                        <select
                          className="cs-editor-input"
                          value={editSheet.day_of_week || editSheet.day_number || 1}
                          onChange={(e) => {
                            const dow = parseInt(e.target.value) || 1
                            const wk = parseInt(editSheet.week_number) || 1
                            setEditSheet({
                              ...editSheet,
                              day_of_week: dow,
                              day_number: (wk - 1) * 7 + dow,
                              day_name: DAY_NAMES[dow] || 'Monday'
                            })
                          }}
                        >
                          <option value={1}>Monday</option>
                          <option value={2}>Tuesday</option>
                          <option value={3}>Wednesday</option>
                          <option value={4}>Thursday</option>
                          <option value={5}>Friday</option>
                          <option value={6}>Saturday</option>
                          <option value={7}>Sunday</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                          Estimated Minutes
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="cs-editor-input"
                          value={editSheet.estimated_minutes}
                          onChange={(e) => setEditSheet({ ...editSheet, estimated_minutes: parseInt(e.target.value) || 10 })}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                          Completion XP Reward
                        </label>
                        <input
                          type="number"
                          min="0"
                          className="cs-editor-input"
                          value={editSheet.xp_reward}
                          onChange={(e) => setEditSheet({ ...editSheet, xp_reward: parseInt(e.target.value) || 10 })}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px' }}>
                          Publish Status
                        </label>
                        <select
                          className="cs-editor-input"
                          value={editSheet.status}
                          onChange={(e) => setEditSheet({ ...editSheet, status: e.target.value })}
                        >
                          <option value="published">Published (Visible to Enrolled Students)</option>
                          <option value="draft">Draft (Hidden from Students)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SECTIONS BUILDER */}
              {activeEditorTab === 'sections' && (
                <div style={{ maxWidth: '980px', margin: '0 auto' }}>
                  {/* Sticky Section Control Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '1.5rem',
                      padding: '0.75rem 1.25rem',
                      background: 'var(--bg-elevated, #161b28)',
                      borderRadius: '14px',
                      border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--text-primary, #f8fafc)' }}>
                        Section Blocks ({(editSheet.sections || []).length})
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #8e9bb0)', marginLeft: '8px' }}>
                        Reorder, customize theory topics, code blocks, notes, and challenges.
                      </span>
                    </div>

                    <div style={{ position: 'relative' }} ref={addMenuRef}>
                      <button
                        type="button"
                        onClick={() => setAddSectionMenuOpen(prev => !prev)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.55rem 1.2rem',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)'
                        }}
                      >
                        <Plus size={15} />
                        <span>Add Section</span>
                        <ChevronDown size={14} style={{ transform: addSectionMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      </button>

                      {addSectionMenuOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            background: '#161b28',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: '12px',
                            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
                            zIndex: 200,
                            minWidth: '280px',
                            overflow: 'hidden',
                            padding: '6px'
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleAddSectionType('standard')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              border: 'none',
                              background: 'transparent',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <FileText size={15} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>Topic & Code</div>
                              <div style={{ fontSize: '0.72rem', color: '#8e9bb0' }}>Theory explanation & syntax snippet</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddSectionType('quiz')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              border: 'none',
                              background: 'transparent',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <HelpCircle size={15} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>Practice Quiz</div>
                              <div style={{ fontSize: '0.72rem', color: '#8e9bb0' }}>Self-check question with options</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddSectionType('note')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              border: 'none',
                              background: 'transparent',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <ListOrdered size={15} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>Important Rules</div>
                              <div style={{ fontSize: '0.72rem', color: '#8e9bb0' }}>Amber highlight callout list</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddSectionType('table')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              border: 'none',
                              background: 'transparent',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Layers size={15} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>Values Table</div>
                              <div style={{ fontSize: '0.72rem', color: '#8e9bb0' }}>Property values list</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddSectionType('playground')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              border: 'none',
                              background: 'transparent',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Code2 size={15} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>Coding Challenge</div>
                              <div style={{ fontSize: '0.72rem', color: '#8e9bb0' }}>Live practice runner suite</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddSectionType('fonts')}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              border: 'none',
                              background: 'transparent',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <Type size={15} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>Google Fonts Showcase</div>
                              <div style={{ fontSize: '0.72rem', color: '#8e9bb0' }}>Interactive typefaces & preview</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {(editSheet.sections || []).map((sec, idx) => {
                      const isCollapsed = Boolean(collapsedSections[sec.id || idx])

                      return (
                        <div
                          key={sec.id || idx}
                          className="cs-editor-section-box"
                        >
                          {/* Section Card Header */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.75rem',
                              paddingBottom: isCollapsed ? 0 : '1rem',
                              borderBottom: isCollapsed ? 'none' : '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
                              marginBottom: isCollapsed ? 0 : '1.25rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                              <span
                                style={{
                                  background: 'rgba(99, 102, 241, 0.15)',
                                  color: '#818cf8',
                                  border: '1px solid rgba(99, 102, 241, 0.3)',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800
                                }}
                              >
                                #{idx + 1}
                              </span>

                              <input
                                type="text"
                                className="cs-editor-input"
                                value={sec.title}
                                onChange={(e) => handleUpdateSection(idx, 'title', e.target.value)}
                                placeholder="Section Title..."
                                style={{ fontWeight: 700, fontSize: '0.96rem', maxWidth: '420px' }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {/* Reorder Buttons */}
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveSection(idx, -1)}
                                style={{
                                  background: 'var(--bg-surface, #111522)',
                                  border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
                                  padding: '5px',
                                  borderRadius: '6px',
                                  color: idx === 0 ? '#475569' : 'var(--text-secondary, #cbd5e1)',
                                  cursor: idx === 0 ? 'not-allowed' : 'pointer'
                                }}
                                title="Move Up"
                              >
                                <ArrowUp size={14} />
                              </button>

                              <button
                                type="button"
                                disabled={idx === (editSheet.sections.length - 1)}
                                onClick={() => handleMoveSection(idx, 1)}
                                style={{
                                  background: 'var(--bg-surface, #111522)',
                                  border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
                                  padding: '5px',
                                  borderRadius: '6px',
                                  color: idx === (editSheet.sections.length - 1) ? '#475569' : 'var(--text-secondary, #cbd5e1)',
                                  cursor: idx === (editSheet.sections.length - 1) ? 'not-allowed' : 'pointer'
                                }}
                                title="Move Down"
                              >
                                <ArrowDown size={14} />
                              </button>

                              {/* Collapse/Expand */}
                              <button
                                type="button"
                                onClick={() => toggleSectionCollapse(sec.id || idx)}
                                style={{
                                  background: 'var(--bg-surface, #111522)',
                                  border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))',
                                  padding: '5px',
                                  borderRadius: '6px',
                                  color: 'var(--text-secondary, #cbd5e1)',
                                  cursor: 'pointer'
                                }}
                                title={isCollapsed ? 'Expand Section' : 'Collapse Section'}
                              >
                                {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                              </button>

                              {/* Delete Section */}
                              <button
                                type="button"
                                onClick={() => handleRemoveSection(idx)}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  padding: '5px',
                                  borderRadius: '6px',
                                  color: '#ef4444',
                                  cursor: 'pointer'
                                }}
                                title="Delete Section"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Section Card Body */}
                          {!isCollapsed && (
                            <div>
                              {/* Section Description */}
                              <div style={{ marginBottom: '1.25rem' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary, #cbd5e1)', marginBottom: '4px' }}>
                                  Section Explanation (supports `inline-code` and **bold**)
                                </label>
                                <textarea
                                  className="cs-editor-input"
                                  rows={2}
                                  value={sec.description || ''}
                                  onChange={(e) => handleUpdateSection(idx, 'description', e.target.value)}
                                  placeholder="Provide the conceptual explanation for this section..."
                                />
                              </div>

                              {/* Attached Subcomponents Manager */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {/* 1. Values Table Subblock */}
                                {sec.valueTable && (
                                  <div style={{ background: 'var(--bg-surface, #111522)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>Values Reference Table</span>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSubblock(idx, 'valueTable', null)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                      >
                                        Remove Table
                                      </button>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '0.75rem' }}>
                                      <input
                                        type="text"
                                        className="cs-editor-input"
                                        value={sec.valueTable.header || ''}
                                        onChange={(e) => {
                                          const vt = { ...sec.valueTable, header: e.target.value }
                                          handleUpdateSection(idx, 'valueTable', vt)
                                        }}
                                        placeholder="Table Header (e.g. Value)"
                                        style={{ maxWidth: '180px' }}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddValueItem(idx)}
                                        style={{ padding: '0 12px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                      >
                                        + Add Value
                                      </button>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {(sec.valueTable.values || []).map((val, vIdx) => (
                                        <div key={vIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-elevated, #161b28)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))' }}>
                                          <input
                                            type="text"
                                            value={val}
                                            onChange={(e) => handleUpdateValueItem(idx, vIdx, e.target.value)}
                                            style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.82rem', width: '90px', outline: 'none' }}
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveValueItem(idx, vIdx)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* 2. Code Block Subblock */}
                                {sec.codeBlock && (
                                  <div style={{ background: 'var(--bg-surface, #111522)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#818cf8' }}>Syntax Code Snippet</span>
                                        <select
                                          className="cs-editor-input"
                                          value={sec.codeBlock.language || 'CSS'}
                                          onChange={(e) => {
                                            const cb = { ...sec.codeBlock, language: e.target.value }
                                            handleUpdateSection(idx, 'codeBlock', cb)
                                          }}
                                          style={{ padding: '2px 8px', fontSize: '0.76rem', width: 'auto' }}
                                        >
                                          <option value="CSS">CSS</option>
                                          <option value="HTML">HTML</option>
                                          <option value="JS">JavaScript</option>
                                        </select>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleSubblock(idx, 'codeBlock', null)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                      >
                                        Remove Code Block
                                      </button>
                                    </div>

                                    <textarea
                                      className="cs-editor-input"
                                      rows={5}
                                      value={sec.codeBlock.code || ''}
                                      onChange={(e) => {
                                        const cb = { ...sec.codeBlock, code: e.target.value }
                                        handleUpdateSection(idx, 'codeBlock', cb)
                                      }}
                                      style={{ fontFamily: 'monospace', fontSize: '0.86rem', color: '#f8fafc', background: '#0a1020' }}
                                    />
                                  </div>
                                )}

                                {/* 3. Important Notes Subblock */}
                                {sec.note && (
                                  <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f59e0b' }}>Important Rules & Takeaways</span>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSubblock(idx, 'note', null)}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                      >
                                        Remove Notes
                                      </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.75rem' }}>
                                      {(sec.note.items || []).map((item, itemIdx) => (
                                        <div key={itemIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {itemIdx + 1}
                                          </span>
                                          <input
                                            type="text"
                                            className="cs-editor-input"
                                            value={item}
                                            onChange={(e) => handleUpdateNoteItem(idx, itemIdx, e.target.value)}
                                            placeholder="Key rule or takeaway..."
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveNoteItem(idx, itemIdx)}
                                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                          >
                                            <Trash2 size={13} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleAddNoteItem(idx)}
                                      style={{ padding: '4px 10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                      + Add Another Point
                                    </button>
                                  </div>
                                )}

                                {/* 4. Quiz Subblock */}
                                {sec.quiz && (
                                  <div style={{ background: 'var(--bg-surface, #111522)', padding: '1.25rem', borderRadius: '12px', border: '1.5px solid rgba(16, 185, 129, 0.35)', boxShadow: '0 4px 18px rgba(0,0,0,0.25)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <HelpCircle size={16} />
                                        </div>
                                        <div>
                                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#10b981' }}>Practice Quiz Question</span>
                                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #8e9bb0)', display: 'block' }}>Create multiple-choice or direct code answer challenges for students</span>
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {/* Question Type Switcher */}
                                        <div style={{ display: 'flex', background: 'var(--bg-elevated, #161b28)', padding: '2px', borderRadius: '8px', border: '1px solid var(--card-border, rgba(255,255,255,0.08))' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateQuiz(idx, 'type', 'mcq')}
                                            style={{
                                              padding: '4px 10px',
                                              borderRadius: '6px',
                                              border: 'none',
                                              fontSize: '0.74rem',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              background: (!sec.quiz.type || sec.quiz.type === 'mcq') ? '#10b981' : 'transparent',
                                              color: (!sec.quiz.type || sec.quiz.type === 'mcq') ? '#ffffff' : 'var(--text-muted, #8e9bb0)',
                                              transition: 'all 0.15s ease'
                                            }}
                                          >
                                            Multiple Choice
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              handleUpdateQuiz(idx, 'type', 'code_input')
                                              if (!sec.quiz.matchMode) handleUpdateQuiz(idx, 'matchMode', 'flexible')
                                              if (!sec.quiz.correctAnswer && sec.quiz.options?.[0]) {
                                                handleUpdateQuiz(idx, 'correctAnswer', sec.quiz.options[0])
                                              }
                                            }}
                                            style={{
                                              padding: '4px 10px',
                                              borderRadius: '6px',
                                              border: 'none',
                                              fontSize: '0.74rem',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              background: sec.quiz.type === 'code_input' ? '#6366f1' : 'transparent',
                                              color: sec.quiz.type === 'code_input' ? '#ffffff' : 'var(--text-muted, #8e9bb0)',
                                              transition: 'all 0.15s ease'
                                            }}
                                          >
                                            Write Code Answer
                                          </button>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleToggleSubblock(idx, 'quiz', null)}
                                          style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                        >
                                          Remove Quiz
                                        </button>
                                      </div>
                                    </div>

                                    {/* Question Badge & Prompt */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px', marginBottom: '0.85rem' }}>
                                      <div>
                                        <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '3px', fontWeight: 700 }}>
                                          Question Badge:
                                        </label>
                                        <input
                                          type="text"
                                          className="cs-editor-input"
                                          value={sec.quiz.questionNumber || 'Question 1 of 1'}
                                          onChange={(e) => handleUpdateQuiz(idx, 'questionNumber', e.target.value)}
                                          placeholder="e.g. Question 1 of 1"
                                        />
                                      </div>
                                      <div>
                                        <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '3px', fontWeight: 700 }}>
                                          Question Prompt:
                                        </label>
                                        <input
                                          type="text"
                                          className="cs-editor-input"
                                          value={sec.quiz.prompt || ''}
                                          onChange={(e) => handleUpdateQuiz(idx, 'prompt', e.target.value)}
                                          placeholder="e.g. What is the correct Basic Structure of an HTML document?"
                                        />
                                      </div>
                                    </div>

                                    {/* Code Snippet in Question */}
                                    <div style={{ marginBottom: '0.85rem' }}>
                                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '3px', fontWeight: 700 }}>
                                        Code Snippet in Question (Optional):
                                      </label>
                                      <textarea
                                        className="cs-editor-input"
                                        rows={2}
                                        value={sec.quiz.snippet || ''}
                                        onChange={(e) => handleUpdateQuiz(idx, 'snippet', e.target.value)}
                                        placeholder=".heading { font-style: _______; }"
                                        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.85rem' }}
                                      />
                                    </div>

                                    {/* BRANCH 1: Multiple Choice Options Mode */}
                                    {(!sec.quiz.type || sec.quiz.type === 'mcq') && (
                                      <div style={{ marginBottom: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                                          <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)', fontWeight: 700 }}>
                                            Answer Options (Select the radio to set the correct answer):
                                          </label>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem', color: '#818cf8', cursor: 'pointer', userSelect: 'none' }}>
                                              <input
                                                type="checkbox"
                                                checked={Boolean(sec.quiz.formatAsCode)}
                                                onChange={(e) => handleUpdateQuiz(idx, 'formatAsCode', e.target.checked)}
                                                style={{ accentColor: '#6366f1', cursor: 'pointer' }}
                                              />
                                              Format options as Code (Monospace & Syntax)
                                            </label>

                                            {(sec.quiz.options || []).length < 6 && (
                                              <button
                                                type="button"
                                                onClick={() => handleAddQuizOption(idx)}
                                                style={{
                                                  padding: '2px 8px',
                                                  background: 'rgba(16, 185, 129, 0.15)',
                                                  color: '#10b981',
                                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                                  borderRadius: '4px',
                                                  fontSize: '0.72rem',
                                                  fontWeight: 700,
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                + Add Option
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                          {(sec.quiz.options || ['', '', '', '']).map((opt, optIdx) => {
                                            const isCorrect = sec.quiz.correctAnswer === opt && opt.trim() !== ''
                                            const isMultiLine = opt.includes('\n') || (opt.length > 55) || sec.quiz.formatAsCode

                                            return (
                                              <div
                                                key={optIdx}
                                                style={{
                                                  display: 'flex',
                                                  alignItems: isMultiLine ? 'flex-start' : 'center',
                                                  gap: '10px',
                                                  background: 'var(--bg-elevated, #161b28)',
                                                  padding: '8px 12px',
                                                  borderRadius: '8px',
                                                  border: isCorrect ? '1.5px solid rgba(16, 185, 129, 0.6)' : '1px solid var(--card-border, rgba(255, 255, 255, 0.08))'
                                                }}
                                              >
                                                <div style={{ paddingTop: isMultiLine ? '6px' : '0' }}>
                                                  <input
                                                    type="radio"
                                                    name={`quiz-correct-${sec.id || idx}`}
                                                    checked={isCorrect}
                                                    onChange={() => handleUpdateQuiz(idx, 'correctAnswer', opt)}
                                                    title="Mark as correct answer"
                                                    style={{ cursor: 'pointer', accentColor: '#10b981', width: '16px', height: '16px' }}
                                                  />
                                                </div>

                                                <div style={{ flex: 1 }}>
                                                  <textarea
                                                    className="cs-editor-input"
                                                    rows={isMultiLine ? Math.max(2, (opt.split('\n').length || 1)) : 1}
                                                    value={opt}
                                                    onChange={(e) => handleUpdateQuizOption(idx, optIdx, e.target.value)}
                                                    onKeyDown={(e) => {
                                                      if (e.key === 'Tab') {
                                                        e.preventDefault()
                                                        const { selectionStart, selectionEnd, value } = e.target
                                                        const newVal = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd)
                                                        handleUpdateQuizOption(idx, optIdx, newVal)
                                                      }
                                                    }}
                                                    placeholder={`Option ${optIdx + 1} (paste text or code here)...`}
                                                    style={{
                                                      fontFamily: (sec.quiz.formatAsCode || opt.includes('<') || opt.includes('{')) ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' : 'inherit',
                                                      fontSize: '0.85rem',
                                                      lineHeight: 1.45,
                                                      whiteSpace: 'pre',
                                                      resize: 'vertical'
                                                    }}
                                                  />
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: isMultiLine ? '6px' : '0' }}>
                                                  {isCorrect && (
                                                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 800, whiteSpace: 'nowrap', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                                      Correct
                                                    </span>
                                                  )}
                                                  {(sec.quiz.options || []).length > 2 && (
                                                    <button
                                                      type="button"
                                                      onClick={() => handleRemoveQuizOption(idx, optIdx)}
                                                      title="Remove this option"
                                                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px 4px' }}
                                                    >
                                                      <Trash2 size={13} />
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* BRANCH 2: Direct Code Input Mode */}
                                    {sec.quiz.type === 'code_input' && (
                                      <div style={{ marginBottom: '0.85rem' }}>
                                        {/* Match Sensitivity */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                                          <label style={{ fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)', fontWeight: 700 }}>
                                            Correct Code Solution (What student must write):
                                          </label>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #8e9bb0)' }}>Match Rule:</span>
                                            <select
                                              value={sec.quiz.matchMode || 'flexible'}
                                              onChange={(e) => handleUpdateQuiz(idx, 'matchMode', e.target.value)}
                                              style={{
                                                background: 'var(--bg-elevated, #161b28)',
                                                color: '#818cf8',
                                                border: '1px solid rgba(99, 102, 241, 0.3)',
                                                borderRadius: '6px',
                                                padding: '2px 8px',
                                                fontSize: '0.72rem',
                                                fontWeight: 700,
                                                outline: 'none',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              <option value="flexible">Flexible (Ignores whitespace & quotes)</option>
                                              <option value="exact">Exact Code Match</option>
                                              <option value="contains">Contains Required Code</option>
                                            </select>
                                          </div>
                                        </div>

                                        {/* Correct Code Solution Textarea */}
                                        <textarea
                                          className="cs-editor-input"
                                          rows={4}
                                          value={sec.quiz.correctAnswer || ''}
                                          onChange={(e) => handleUpdateQuiz(idx, 'correctAnswer', e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Tab') {
                                              e.preventDefault()
                                              const { selectionStart, selectionEnd, value } = e.target
                                              const newVal = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd)
                                              handleUpdateQuiz(idx, 'correctAnswer', newVal)
                                            }
                                          }}
                                          placeholder={`<!DOCTYPE html>\n<html>\n  <head></head>\n  <body>\n    Your code goes here\n  </body>\n</html>`}
                                          style={{
                                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                            fontSize: '0.86rem',
                                            lineHeight: 1.5,
                                            border: '1.5px solid rgba(16, 185, 129, 0.4)',
                                            background: 'rgba(16, 185, 129, 0.03)'
                                          }}
                                        />

                                        {/* Starter Code for student (optional) */}
                                        <div style={{ marginTop: '8px' }}>
                                          <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted, #8e9bb0)', marginBottom: '3px' }}>
                                            Starter / Skeleton Code for Student (Optional):
                                          </label>
                                          <textarea
                                            className="cs-editor-input"
                                            rows={2}
                                            value={sec.quiz.starterCode || ''}
                                            onChange={(e) => handleUpdateQuiz(idx, 'starterCode', e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Tab') {
                                                e.preventDefault()
                                                const { selectionStart, selectionEnd, value } = e.target
                                                const newVal = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd)
                                                handleUpdateQuiz(idx, 'starterCode', newVal)
                                              }
                                            }}
                                            placeholder="// Students will start with this template..."
                                            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.84rem' }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Explanation Rationale */}
                                    <div>
                                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '3px', fontWeight: 700 }}>
                                        Explanation Rationale (Shown upon review):
                                      </label>
                                      <textarea
                                        className="cs-editor-input"
                                        rows={2}
                                        value={sec.quiz.explanation || ''}
                                        onChange={(e) => handleUpdateQuiz(idx, 'explanation', e.target.value)}
                                        placeholder="Explain why this answer or code is correct..."
                                      />
                                    </div>
                                  </div>
                                )}

                                {/* 5. Live Practice Playground Subblock */}
                                {sec.playground && (
                                  <div>
                                    <OrganizerPlaygroundEditor
                                      playgroundData={sec.playground}
                                      onChange={(updatedData) => handleUpdateSection(idx, 'playground', updatedData)}
                                      onRemove={() => handleToggleSubblock(idx, 'playground', null)}
                                    />
                                  </div>
                                )}

                                {/* 6. Google Fonts Showcase Subblock (Fully Organizer Customizable) */}
                                {sec.fontPreview && (
                                  <div style={{ background: 'var(--bg-surface, #111522)', padding: '1.25rem', borderRadius: '12px', border: '1.5px solid rgba(168, 85, 247, 0.35)', boxShadow: '0 4px 18px rgba(0,0,0,0.2)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          <Type size={16} />
                                        </div>
                                        <div>
                                          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#c084fc' }}>Supported Google Font Families Showcase</span>
                                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #8e9bb0)', display: 'block' }}>Customize sample preview text, typography families, font weights, and all-caps styling</span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleToggleSubblock(idx, 'fontPreview', null)}
                                        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#ef4444', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                                      >
                                        Remove Fonts Block
                                      </button>
                                    </div>

                                    {/* Intro text & Sample preview word */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', marginBottom: '1rem' }}>
                                      <div>
                                        <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '4px', fontWeight: 700 }}>
                                          Introductory Guidance Text:
                                        </label>
                                        <input
                                          type="text"
                                          className="cs-editor-input"
                                          value={sec.fontPreview.text || ''}
                                          onChange={(e) => handleUpdateFontPreview(idx, 'text', e.target.value)}
                                          placeholder='e.g. You can use one of the below values of the font-family property,'
                                        />
                                      </div>

                                      <div>
                                        <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '4px', fontWeight: 700 }}>
                                          Sample Word / Sentence to Render:
                                        </label>
                                        <input
                                          type="text"
                                          className="cs-editor-input"
                                          value={sec.fontPreview.sampleWord || ''}
                                          onChange={(e) => handleUpdateFontPreview(idx, 'sampleWord', e.target.value)}
                                          placeholder='e.g. Tourism'
                                        />
                                      </div>
                                    </div>

                                    {/* Font items list */}
                                    <div style={{ marginBottom: '1rem' }}>
                                      <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '6px', fontWeight: 700 }}>
                                        Configured Google Font Families ({(sec.fontPreview.fonts || []).length}):
                                      </label>

                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {(sec.fontPreview.fonts || []).map((f, fIdx) => (
                                          <div
                                            key={fIdx}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              flexWrap: 'wrap',
                                              gap: '10px',
                                              background: 'var(--bg-elevated, #161b28)',
                                              padding: '8px 12px',
                                              borderRadius: '8px',
                                              border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))'
                                            }}
                                          >
                                            {/* Display code badge name */}
                                            <div style={{ width: '130px' }}>
                                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #8e9bb0)', display: 'block' }}>Display Badge:</span>
                                              <input
                                                type="text"
                                                value={f.name || `"${f.family}"`}
                                                onChange={(e) => handleUpdateFontItem(idx, fIdx, 'name', e.target.value)}
                                                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#818cf8', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.82rem', width: '100%', outline: 'none' }}
                                              />
                                            </div>

                                            {/* Google Font Family */}
                                            <div style={{ width: '130px' }}>
                                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #8e9bb0)', display: 'block' }}>Font Family:</span>
                                              <input
                                                type="text"
                                                value={f.family || ''}
                                                onChange={(e) => handleUpdateFontItem(idx, fIdx, 'family', e.target.value)}
                                                placeholder="e.g. Caveat"
                                                style={{ background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#f8fafc', fontWeight: 600, fontSize: '0.82rem', width: '100%', outline: 'none' }}
                                              />
                                            </div>

                                            {/* Weight */}
                                            <div style={{ width: '90px' }}>
                                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #8e9bb0)', display: 'block' }}>Weight:</span>
                                              <select
                                                value={f.weight || '700'}
                                                onChange={(e) => handleUpdateFontItem(idx, fIdx, 'weight', e.target.value)}
                                                style={{ background: 'var(--bg-surface, #111522)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '4px', fontSize: '0.75rem', padding: '2px 4px', width: '100%' }}
                                              >
                                                <option value="400">400 (Reg)</option>
                                                <option value="600">600 (Semi)</option>
                                                <option value="700">700 (Bold)</option>
                                                <option value="800">800 (Extra)</option>
                                                <option value="900">900 (Black)</option>
                                              </select>
                                            </div>

                                            {/* Style */}
                                            <div style={{ width: '80px' }}>
                                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #8e9bb0)', display: 'block' }}>Style:</span>
                                              <select
                                                value={f.style || 'normal'}
                                                onChange={(e) => handleUpdateFontItem(idx, fIdx, 'style', e.target.value)}
                                                style={{ background: 'var(--bg-surface, #111522)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', borderRadius: '4px', fontSize: '0.75rem', padding: '2px 4px', width: '100%' }}
                                              >
                                                <option value="normal">Normal</option>
                                                <option value="italic">Italic</option>
                                              </select>
                                            </div>

                                            {/* Uppercase toggle */}
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: 'var(--text-secondary, #cbd5e1)', cursor: 'pointer', marginTop: '12px' }}>
                                              <input
                                                type="checkbox"
                                                checked={Boolean(f.uppercase)}
                                                onChange={(e) => handleUpdateFontItem(idx, fIdx, 'uppercase', e.target.checked)}
                                                style={{ accentColor: '#c084fc' }}
                                              />
                                              <span>ALL CAPS</span>
                                            </label>

                                            {/* Live Mini Preview rendered in exact font */}
                                            <div style={{ flex: 1, minWidth: '120px', textAlign: 'center', marginTop: '6px' }}>
                                              <span
                                                style={{
                                                  fontFamily: `"${(f.family || '').replace(/["']/g, '')}", sans-serif`,
                                                  fontSize: '1.25rem',
                                                  fontWeight: f.weight || '700',
                                                  fontStyle: f.style || 'normal',
                                                  color: '#f8fafc'
                                                }}
                                              >
                                                {f.uppercase ? (sec.fontPreview.sampleWord || 'Tourism').toUpperCase() : (sec.fontPreview.sampleWord || 'Tourism')}
                                              </span>
                                            </div>

                                            {/* Delete Font Button */}
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveFontItem(idx, fIdx)}
                                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', marginTop: '6px' }}
                                              title="Delete Font"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Add Font & Preset Buttons */}
                                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleAddFontItem(idx, { name: '"Inter"', family: 'Inter', style: 'normal', weight: '700', uppercase: false })}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: 'rgba(168, 85, 247, 0.18)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.35)', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                                      >
                                        <Plus size={13} /> Add Custom Font
                                      </button>

                                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #8e9bb0)', marginLeft: '4px' }}>Quick Presets:</span>

                                      <button
                                        type="button"
                                        onClick={() => handleAddFontItem(idx, { name: '"Poppins"', family: 'Poppins', style: 'normal', weight: '700', uppercase: false })}
                                        style={{ padding: '3px 8px', background: 'var(--bg-elevated, #161b28)', color: '#cbd5e1', border: '1px solid var(--card-border, rgba(255,255,255,0.08))', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer' }}
                                      >
                                        + Poppins
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleAddFontItem(idx, { name: '"Caveat"', family: 'Caveat', style: 'normal', weight: '700', uppercase: false })}
                                        style={{ padding: '3px 8px', background: 'var(--bg-elevated, #161b28)', color: '#cbd5e1', border: '1px solid var(--card-border, rgba(255,255,255,0.08))', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer' }}
                                      >
                                        + Caveat
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleAddFontItem(idx, { name: '"Lobster"', family: 'Lobster', style: 'normal', weight: '400', uppercase: false })}
                                        style={{ padding: '3px 8px', background: 'var(--bg-elevated, #161b28)', color: '#cbd5e1', border: '1px solid var(--card-border, rgba(255,255,255,0.08))', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer' }}
                                      >
                                        + Lobster
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleAddFontItem(idx, { name: '"Pacifico"', family: 'Pacifico', style: 'normal', weight: '400', uppercase: false })}
                                        style={{ padding: '3px 8px', background: 'var(--bg-elevated, #161b28)', color: '#cbd5e1', border: '1px solid var(--card-border, rgba(255,255,255,0.08))', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer' }}
                                      >
                                        + Pacifico
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleAddFontItem(idx, { name: '"Dancing Script"', family: 'Dancing Script', style: 'normal', weight: '700', uppercase: false })}
                                        style={{ padding: '3px 8px', background: 'var(--bg-elevated, #161b28)', color: '#cbd5e1', border: '1px solid var(--card-border, rgba(255,255,255,0.08))', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer' }}
                                      >
                                        + Dancing Script
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleAddFontItem(idx, { name: '"Monoton"', family: 'Monoton', style: 'normal', weight: '400', uppercase: true })}
                                        style={{ padding: '3px 8px', background: 'var(--bg-elevated, #161b28)', color: '#cbd5e1', border: '1px solid var(--card-border, rgba(255,255,255,0.08))', borderRadius: '6px', fontSize: '0.74rem', cursor: 'pointer' }}
                                      >
                                        + Monoton
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Component Insertion Buttons Strip */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '8px',
                                  marginTop: '1.25rem',
                                  paddingTop: '0.85rem',
                                  borderTop: '1px solid var(--card-border, rgba(255, 255, 255, 0.06))'
                                }}
                              >
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted, #8e9bb0)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '4px' }}>
                                  + Attach Component:
                                </span>

                                {!sec.codeBlock && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSubblock(idx, 'codeBlock', { language: 'CSS', code: '/* Code here */' })}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    <Code2 size={12} /> Code Snippet
                                  </button>
                                )}

                                {!sec.note && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSubblock(idx, 'note', { items: ['Key takeaway rule for students.'] })}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    <ListOrdered size={12} /> Important Note
                                  </button>
                                )}

                                {!sec.valueTable && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSubblock(idx, 'valueTable', { title: 'Syntax values reference:', header: 'Value', values: ['normal', 'italic', 'oblique'] })}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    <Layers size={12} /> Values Table
                                  </button>
                                )}

                                {!sec.quiz && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSubblock(idx, 'quiz', { type: 'mcq', questionNumber: 'Question 1 of 1', prompt: 'Sample question prompt?', options: ['Option A', 'Option B', 'Option C', 'Option D'], correctAnswer: 'Option A', explanation: 'Sample rationale.' })}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    <HelpCircle size={12} /> Quiz Question
                                  </button>
                                )}

                                {!sec.playground && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const defaultChallenge = PRACTICE_TEMPLATES[0].data
                                      handleToggleSubblock(idx, 'playground', {
                                        title: defaultChallenge.title,
                                        difficulty: defaultChallenge.difficulty,
                                        instructions: defaultChallenge.instructions,
                                        hints: defaultChallenge.hints,
                                        starterHtml: defaultChallenge.starterHtml,
                                        starterCss: defaultChallenge.starterCss,
                                        starterJs: defaultChallenge.starterJs
                                      })
                                    }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.3)', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    <Code2 size={12} /> Live Coding Challenge
                                  </button>
                                )}

                                {!sec.fontPreview && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSubblock(idx, 'fontPreview', {
                                      text: 'You can use one of the below values of the font-family property,',
                                      sampleWord: 'Tourism',
                                      fonts: [
                                        { name: '"Roboto"', family: 'Roboto', style: 'normal', weight: '700', uppercase: false },
                                        { name: '"Caveat"', family: 'Caveat', style: 'normal', weight: '700', uppercase: false },
                                        { name: '"Lobster"', family: 'Lobster', style: 'normal', weight: '400', uppercase: false },
                                        { name: '"Bree Serif"', family: 'Bree Serif', style: 'normal', weight: '400', uppercase: false },
                                        { name: '"Playfair Display"', family: 'Playfair Display', style: 'normal', weight: '700', uppercase: false },
                                        { name: '"Monoton"', family: 'Monoton', style: 'normal', weight: '400', uppercase: true },
                                        { name: '"Playfair Display SC"', family: 'Playfair Display SC', style: 'normal', weight: '700', uppercase: true }
                                      ]
                                    })}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.12)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    <Type size={12} /> Google Fonts Showcase
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: STUDENT PREVIEW */}
              {activeEditorTab === 'preview' && (
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                  {/* Hero Document Header in Preview */}
                  <div
                    style={{
                      background: 'linear-gradient(180deg, var(--bg-surface, #111522) 0%, var(--bg-elevated, #161b28) 100%)',
                      borderRadius: '16px',
                      border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
                      padding: '1.75rem 2rem',
                      marginBottom: '1.75rem'
                    }}
                  >
                    <div style={{ fontSize: '0.78rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                      {editSheet.topic_badge || 'Interactive Cheat Sheet'}
                    </div>

                    <h1 style={{ margin: '0 0 0.75rem 0', fontSize: '2rem', fontWeight: 900, color: 'var(--text-primary, #f8fafc)' }}>
                      {editSheet.title || 'Untitled Sheet'}
                    </h1>

                    {editSheet.description && (
                      <p style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.96rem', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
                        {editSheet.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem', color: 'var(--text-secondary, #cbd5e1)', borderTop: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))', paddingTop: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={14} style={{ color: '#818cf8' }} /> {editSheet.estimated_minutes || 10} Mins
                      </span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Award size={14} style={{ color: '#eab308' }} /> +{editSheet.xp_reward || 10} XP
                      </span>
                      <span>•</span>
                      <span>Week {editSheet.week_number || 1} • {formatDayName(editSheet.day_of_week || editSheet.day_number || 1)}</span>
                    </div>
                  </div>

                  {/* Section List in Preview */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    {(editSheet.sections || []).map((sec, i) => (
                      <article
                        key={i}
                        className="cs-section-card"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                          <span style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                            Section 0{i + 1}
                          </span>
                        </div>

                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary, #f8fafc)', margin: '0 0 1rem 0' }}>
                          {sec.title}
                        </h2>

                        {sec.description && (
                          <div
                            style={{ color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.65, fontSize: '0.98rem', marginBottom: '1.25rem' }}
                            dangerouslySetInnerHTML={{ __html: formatInlineText(sec.description) }}
                          />
                        )}

                        {sec.valueTable && (
                          <div style={{ margin: '1.25rem 0' }}>
                            {sec.valueTable.title && (
                              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary, #cbd5e1)', marginBottom: '0.5rem' }} dangerouslySetInnerHTML={{ __html: formatInlineText(sec.valueTable.title) }} />
                            )}
                            <div style={{ maxWidth: '180px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--card-border, rgba(255, 255, 255, 0.1))' }}>
                              <div style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#ffffff', padding: '6px 12px', fontSize: '0.78rem', fontWeight: 800, textAlign: 'center' }}>
                                {sec.valueTable.header || 'Value'}
                              </div>
                              {(sec.valueTable.values || []).map((val, vIdx) => (
                                <div key={vIdx} style={{ padding: '6px 10px', background: vIdx % 2 === 0 ? 'var(--bg-elevated, #161b28)' : 'var(--bg-surface, #111522)', color: '#38bdf8', fontSize: '0.85rem', textAlign: 'center', fontFamily: 'monospace', borderTop: '1px solid var(--card-border, rgba(255, 255, 255, 0.05))' }}>
                                  {val}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {sec.codeBlock && (
                          <CheatSheetCodeBlock code={sec.codeBlock.code} language={sec.codeBlock.language} />
                        )}

                        {sec.fontPreview && (
                          <CheatSheetFontPreview data={sec.fontPreview} />
                        )}

                        {sec.note && (
                          <CheatSheetNote items={sec.note.items} />
                        )}

                        {sec.quiz && (
                          <CheatSheetQuiz quiz={sec.quiz} />
                        )}

                        {sec.playground && (
                          <CheatSheetPlayground starterData={sec.playground} />
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Footer Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 1.75rem',
                borderTop: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
                background: 'var(--bg-elevated, #161b28)'
              }}
            >
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted, #8e9bb0)' }}>
                {activeEditorTab === 'sections' && '💡 Tip: Click "+ Attach Component" to add quizzes, notes, or code blocks to any section.'}
                {activeEditorTab === 'settings' && '💡 Tip: Link with an enrolled course to protect study material with enrollment guards.'}
                {activeEditorTab === 'preview' && '👁️ Live Student Preview: Exact look and feel experienced by enrolled students.'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setEditSheet(null)}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid var(--card-border, rgba(255, 255, 255, 0.15))',
                    background: 'transparent',
                    color: 'var(--text-secondary, #cbd5e1)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.86rem'
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.6rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: saveSuccess ? '#10b981' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 10px rgba(99, 102, 241, 0.35)',
                    transition: 'all 0.15s'
                  }}
                >
                  {saveSuccess ? <Check size={16} /> : <Save size={16} />}
                  <span>{saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Cheat Sheet'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
