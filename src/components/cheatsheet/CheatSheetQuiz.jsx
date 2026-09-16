import { useState } from 'react'
import PropTypes from 'prop-types'
import { CheckCircle, XCircle, HelpCircle, Code2, RotateCcw, Send, ChevronRight, Lock } from 'lucide-react'
import { formatInlineText } from '../../utils/sanitizeRichText'
import CheatSheetCodeBlock from './CheatSheetCodeBlock'

/**
 * Normalizes code strings for flexible comparison so minor whitespace,
 * quotation, or formatting differences don't penalize students.
 */
function normalizeCodeForComparison(code, matchMode = 'flexible') {
  if (!code || typeof code !== 'string') return ''
  if (matchMode === 'exact') return code.trim()

  const clean = code.replace(/\r\n/g, '\n').trim()

  if (matchMode === 'contains') {
    return clean
      .replace(/["'`]/g, '"')
      .replace(/\s+/g, ' ')
      .toLowerCase()
  }

  // Flexible match (default)
  return clean
    .replace(/["'`]/g, '"') // normalize quotes
    .replace(/;\s*([}\n])/g, '$1') // normalize trailing semicolons before closing brackets
    .replace(/\s*([<>{}();,:=])\s*/g, '$1') // remove extra whitespace around syntax operators
    .replace(/\s+/g, ' ') // collapse multi-whitespace
    .toLowerCase()
}

/**
 * Helper to determine if an option or string contains code syntax.
 */
function isCodeContent(text, forceFormat = false) {
  if (forceFormat) return true
  if (typeof text !== 'string' || !text.trim()) return false
  if (text.includes('\n')) return true
  if (/^<!DOCTYPE/i.test(text.trim())) return true
  if (/<\/?[a-z][\s\S]*>/i.test(text)) return true
  if (/[{}();]/.test(text) && /[:=]/.test(text)) return true
  if (/^\.[a-zA-Z0-9_-]+\s*\{/.test(text.trim())) return true
  if (/(function|const|let|var|class|return|import|export)\s+/i.test(text)) return true
  return false
}

export default function CheatSheetQuiz({ quiz, onAttend, initialAttended = false }) {
  // Normalize questions list (supports both single quiz object or quiz.questions array)
  const questionsList = (quiz && Array.isArray(quiz.questions) && quiz.questions.length > 0)
    ? quiz.questions
    : (quiz ? [quiz] : [])

  const [activeQIdx, setActiveQIdx] = useState(0)
  const currentQ = questionsList[activeQIdx] || quiz

  // Per-question state map: { [idx]: { selectedOption, codeAnswer, submitted, isCorrect } }
  const [answersMap, setAnswersMap] = useState({})
  const [showAnswer, setShowAnswer] = useState(false)

  // Current active question state
  const currentAnswerState = answersMap[activeQIdx] || {}
  const selectedOption = currentAnswerState.selectedOption || ''
  const codeAnswer = currentAnswerState.codeAnswer ?? (currentQ?.starterCode || '')
  const submitted = Boolean(currentAnswerState.submitted || initialAttended)

  if (!quiz || questionsList.length === 0) return null

  const isCodeInput = currentQ.type === 'code_input' || currentQ.type === 'coding'

  // Determine correctness for current question
  const isCorrect = isCodeInput
    ? (currentQ.matchMode === 'contains'
        ? normalizeCodeForComparison(codeAnswer, 'contains').includes(normalizeCodeForComparison(currentQ.correctAnswer, 'contains'))
        : normalizeCodeForComparison(codeAnswer, currentQ.matchMode || 'flexible') === normalizeCodeForComparison(currentQ.correctAnswer, currentQ.matchMode || 'flexible'))
    : selectedOption === currentQ.correctAnswer

  // All questions solved?
  const allSolved = questionsList.every((q, idx) => {
    const s = answersMap[idx]
    if (!s || !s.submitted) return false
    return s.isCorrect
  })

  // Normalize display badge
  const displayQuestionNumber = questionsList.length > 1
    ? `Question ${activeQIdx + 1} of ${questionsList.length}`
    : ((!currentQ.questionNumber || currentQ.questionNumber === 'Question 1 of 3' || currentQ.questionNumber === 'Question 1 of 2')
        ? 'Question 1 of 1'
        : currentQ.questionNumber)

  const handleSubmit = () => {
    // If showAnswer is open, do not allow submitting
    if (showAnswer) return

    if (isCodeInput) {
      if (!codeAnswer.trim()) return
    } else {
      if (!selectedOption) return
    }

    const updatedState = {
      ...answersMap,
      [activeQIdx]: {
        selectedOption,
        codeAnswer,
        submitted: true,
        isCorrect
      }
    }
    setAnswersMap(updatedState)

    // Check if this submission solves all questions (or if single question)
    const isNowAllSolved = questionsList.every((q, idx) => {
      if (idx === activeQIdx) return isCorrect
      return updatedState[idx]?.isCorrect
    })

    if (isNowAllSolved && onAttend) {
      onAttend(isCodeInput ? codeAnswer : selectedOption)
    } else if (questionsList.length === 1 && onAttend) {
      onAttend(isCodeInput ? codeAnswer : selectedOption)
    }
  }

  const handleToggleAnswer = () => {
    // Toggling show answer simply reveals the explanation; it does NOT submit/attend the question
    setShowAnswer(prev => !prev)
  }

  const handleResetCode = () => {
    if (showAnswer) return
    setAnswersMap(prev => ({
      ...prev,
      [activeQIdx]: {
        ...(prev[activeQIdx] || {}),
        codeAnswer: currentQ.starterCode || '',
        submitted: false
      }
    }))
  }

  const handleCodeKeyDown = (e) => {
    if (showAnswer) return
    if (e.key === 'Tab') {
      e.preventDefault()
      const { selectionStart, selectionEnd, value } = e.target
      const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd)
      setAnswersMap(prev => ({
        ...prev,
        [activeQIdx]: {
          ...(prev[activeQIdx] || {}),
          codeAnswer: newValue,
          submitted: false
        }
      }))
      setTimeout(() => {
        if (e.target) {
          e.target.selectionStart = selectionStart + 2
          e.target.selectionEnd = selectionStart + 2
        }
      }, 0)
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
        borderRadius: '16px',
        padding: '1.75rem',
        margin: '2rem 0',
        background: 'var(--bg-surface, #111522)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
      }}
      role="region"
      aria-label="Self-Check Practice Question"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '1rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 10px',
              borderRadius: '20px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontSize: '0.74rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            {isCodeInput ? 'Coding Quiz Challenge' : 'Practice Quiz'}
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #8e9bb0)' }}>
            {displayQuestionNumber}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(allSolved || initialAttended) && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 8px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontSize: '0.74rem',
                fontWeight: 700
              }}
            >
              <CheckCircle size={13} /> Next Section Unlocked
            </span>
          )}
          {submitted && isCorrect && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.82rem', fontWeight: 700 }}>
              <CheckCircle size={14} /> Solved
            </span>
          )}
        </div>
      </div>

      {/* Multi-Question Selector Tabs (when quiz has multiple questions) */}
      {questionsList.length > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '1.25rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
            flexWrap: 'wrap'
          }}
        >
          <span style={{ fontSize: '0.76rem', color: 'var(--text-muted, #8e9bb0)', fontWeight: 700, marginRight: '4px' }}>
            Questions ({questionsList.length}):
          </span>
          {questionsList.map((q, idx) => {
            const isQDone = answersMap[idx]?.isCorrect
            const isActive = idx === activeQIdx

            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setActiveQIdx(idx)
                  setShowAnswer(false)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: isActive ? '1.5px solid #6366f1' : '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
                  background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-elevated, #161b28)',
                  color: isQDone ? '#34d399' : (isActive ? '#ffffff' : 'var(--text-muted, #8e9bb0)'),
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {isQDone && <CheckCircle size={12} color="#10b981" />}
                <span>Question {idx + 1}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Prompt */}
      <div
        style={{
          fontSize: '1.04rem',
          color: 'var(--text-primary, #f8fafc)',
          lineHeight: 1.6,
          fontWeight: 600,
          marginBottom: '1.25rem'
        }}
        dangerouslySetInnerHTML={{ __html: formatInlineText(currentQ.prompt) }}
      />

      {/* Optional Embedded Code Snippet in Question */}
      {currentQ.snippet && (
        <div style={{ maxWidth: '600px', marginBottom: '1.25rem' }}>
          <CheatSheetCodeBlock code={currentQ.snippet} language="CSS" />
        </div>
      )}

      {/* Notice Banner when Show Answer is active */}
      {showAnswer && !submitted && (
        <div
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#f59e0b',
            fontSize: '0.82rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Lock size={15} style={{ flexShrink: 0 }} />
          <span>Answer explanation is visible. Click &ldquo;Hide Explanation&rdquo; to select and submit your answer.</span>
        </div>
      )}

      {/* BRANCH A: Interactive Code Input Answer Mode */}
      {isCodeInput ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              background: '#0b0f19',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              opacity: showAnswer ? 0.65 : 1
            }}
          >
            {/* Editor Header Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 14px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Code2 size={15} color="#818cf8" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#c7d2fe', letterSpacing: '0.02em' }}>
                  Write Your Code Answer
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetCode}
                disabled={showAnswer}
                title="Reset code to starter template"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'none',
                  border: 'none',
                  color: showAnswer ? 'var(--text-muted, #475569)' : 'var(--text-muted, #94a3b8)',
                  fontSize: '0.72rem',
                  cursor: showAnswer ? 'not-allowed' : 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>

            {/* Code Input Area */}
            <textarea
              disabled={showAnswer}
              value={codeAnswer}
              onChange={(e) => {
                if (showAnswer) return
                setAnswersMap(prev => ({
                  ...prev,
                  [activeQIdx]: {
                    ...(prev[activeQIdx] || {}),
                    codeAnswer: e.target.value,
                    submitted: false
                  }
                }))
              }}
              onKeyDown={handleCodeKeyDown}
              placeholder="Type or paste your code solution here... (Press Ctrl+Enter to submit)"
              rows={Math.max(4, (codeAnswer.split('\n').length || 1) + 1)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '14px',
                color: '#f8fafc',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: '0.9rem',
                lineHeight: 1.55,
                outline: 'none',
                resize: 'vertical',
                minHeight: '110px',
                cursor: showAnswer ? 'not-allowed' : 'text'
              }}
            />
          </div>
          <span style={{ display: 'block', marginTop: '6px', fontSize: '0.74rem', color: 'var(--text-muted, #8e9bb0)' }}>
            Tip: Press Tab to indent, and Ctrl+Enter (or Cmd+Enter) to submit code.
          </span>
        </div>
      ) : (
        /* BRANCH B: Multiple Choice Options Mode (with Code Snippet Support) */
        <div
          role="radiogroup"
          aria-label={currentQ.prompt}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            opacity: showAnswer ? 0.75 : 1
          }}
        >
          {(currentQ.options || []).map((option, idx) => {
            const isSelected = selectedOption === option
            const isThisCorrect = option === currentQ.correctAnswer
            const isCode = isCodeContent(option, currentQ.formatAsCode)

            let optionBg = 'var(--bg-elevated, #161b28)'
            let optionBorder = 'var(--card-border, rgba(255, 255, 255, 0.08))'
            let optionColor = 'var(--text-primary, #f8fafc)'
            let radioBorder = '#64748b'
            let radioBg = 'transparent'

            if (isSelected) {
              optionBg = 'rgba(99, 102, 241, 0.12)'
              optionBorder = 'rgba(99, 102, 241, 0.45)'
              radioBorder = '#6366f1'
              radioBg = '#6366f1'
            }

            if (submitted || showAnswer) {
              if (isThisCorrect) {
                optionBg = 'rgba(16, 185, 129, 0.14)'
                optionBorder = 'rgba(16, 185, 129, 0.5)'
                optionColor = '#34d399'
                radioBorder = '#10b981'
                radioBg = '#10b981'
              } else if (isSelected && !isCorrect) {
                optionBg = 'rgba(239, 68, 68, 0.14)'
                optionBorder = 'rgba(239, 68, 68, 0.45)'
                optionColor = '#f87171'
                radioBorder = '#ef4444'
                radioBg = '#ef4444'
              }
            }

            return (
              <label
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: isCode ? 'flex-start' : 'center',
                  gap: '12px',
                  padding: isCode ? '12px 14px' : '10px 14px',
                  borderRadius: '10px',
                  background: optionBg,
                  border: `1.5px solid ${optionBorder}`,
                  cursor: showAnswer ? 'not-allowed' : 'pointer',
                  pointerEvents: showAnswer ? 'none' : 'auto',
                  transition: 'all 0.15s ease',
                  color: optionColor,
                  fontSize: '0.94rem',
                  fontWeight: isSelected ? 700 : 500
                }}
                role="radio"
                aria-checked={isSelected}
                tabIndex={showAnswer ? -1 : 0}
                onKeyDown={(e) => {
                  if (showAnswer) return
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setAnswersMap(prev => ({
                      ...prev,
                      [activeQIdx]: {
                        ...(prev[activeQIdx] || {}),
                        selectedOption: option,
                        submitted: false
                      }
                    }))
                  }
                }}
              >
                <input
                  type="radio"
                  disabled={showAnswer}
                  name={`quiz-${currentQ.questionNumber || activeQIdx || 'q'}`}
                  value={option}
                  checked={isSelected}
                  onChange={() => {
                    if (showAnswer) return
                    setAnswersMap(prev => ({
                      ...prev,
                      [activeQIdx]: {
                        ...(prev[activeQIdx] || {}),
                        selectedOption: option,
                        submitted: false
                      }
                    }))
                  }}
                  style={{ display: 'none' }}
                />
                <span
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `2px solid ${radioBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: isCode ? '3px' : '0'
                  }}
                >
                  {isSelected && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: radioBg
                      }}
                    />
                  )}
                </span>

                {isCode ? (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <pre
                      style={{
                        margin: 0,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
                        fontSize: '0.88rem',
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        color: isSelected ? '#ffffff' : 'inherit'
                      }}
                    >
                      <code>{option}</code>
                    </pre>
                  </div>
                ) : (
                  <span style={{ lineHeight: 1.5 }}>{option}</span>
                )}
              </label>
            )
          })}
        </div>
      )}

      {/* Buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginTop: '1.25rem',
          flexWrap: 'wrap'
        }}
      >
        <button
          type="button"
          onClick={handleSubmit}
          disabled={showAnswer || (isCodeInput ? !codeAnswer.trim() : !selectedOption)}
          title={showAnswer ? 'Hide answer to submit' : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '0.6rem 1.6rem',
            borderRadius: '8px',
            border: 'none',
            background: (!showAnswer && (isCodeInput ? codeAnswer.trim() : selectedOption)) ? '#6366f1' : 'rgba(255,255,255,0.08)',
            color: (!showAnswer && (isCodeInput ? codeAnswer.trim() : selectedOption)) ? '#ffffff' : 'var(--text-muted, #64748b)',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: (!showAnswer && (isCodeInput ? codeAnswer.trim() : selectedOption)) ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            boxShadow: (!showAnswer && (isCodeInput ? codeAnswer.trim() : selectedOption)) ? '0 4px 14px rgba(99,102,241,0.35)' : 'none'
          }}
        >
          {isCodeInput ? (
            <>
              <Send size={14} /> Check Code
            </>
          ) : (
            'Check Answer'
          )}
        </button>

        <button
          type="button"
          onClick={handleToggleAnswer}
          style={{
            padding: '0.6rem 1.4rem',
            borderRadius: '8px',
            border: '1.5px solid rgba(99, 102, 241, 0.35)',
            background: showAnswer ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
            color: '#818cf8',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {showAnswer ? 'Hide Explanation' : (isCodeInput ? 'Show Code Solution' : 'Show Answer')}
        </button>

        {/* Next Question Navigation button if multiple questions */}
        {questionsList.length > 1 && submitted && isCorrect && activeQIdx < questionsList.length - 1 && (
          <button
            type="button"
            onClick={() => {
              setActiveQIdx(prev => prev + 1)
              setShowAnswer(false)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginLeft: 'auto'
            }}
          >
            <span>Next Question ({activeQIdx + 2}/{questionsList.length})</span>
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* Feedback Message */}
      {submitted && (
        <div
          style={{
            marginTop: '1.25rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: isCorrect ? '#34d399' : '#f87171',
            fontSize: '0.9rem'
          }}
        >
          {isCorrect ? (
            <CheckCircle size={18} color="#10b981" style={{ marginTop: '2px', flexShrink: 0 }} />
          ) : (
            <XCircle size={18} color="#ef4444" style={{ marginTop: '2px', flexShrink: 0 }} />
          )}
          <div>
            <strong>{isCorrect ? 'Correct!' : 'Not quite.'}</strong>{' '}
            <span>
              {isCorrect
                ? (isCodeInput ? 'Great job! Your code solution matches.' : 'Great job! You selected the right answer.')
                : (isCodeInput
                    ? 'Your code did not match the expected answer. Review your syntax, check tags, or click "Show Code Solution".'
                    : 'Review your answer or click "Show Answer" to inspect the explanation.')}
            </span>
          </div>
        </div>
      )}

      {/* Rationale Reveal */}
      {showAnswer && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            background: 'var(--bg-elevated, #161b28)',
            border: '1px solid var(--card-border, rgba(255, 255, 255, 0.08))',
            fontSize: '0.9rem',
            color: 'var(--text-secondary, #cbd5e1)',
            lineHeight: 1.6
          }}
        >
          <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={16} />
            <span>{isCodeInput ? 'Expected Code Solution:' : 'Correct Answer:'}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '6px',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.78rem',
              fontWeight: 600,
              marginBottom: '0.75rem'
            }}
          >
            <Lock size={13} style={{ flexShrink: 0 }} />
            <span>Answering is locked while viewing this answer. Click &ldquo;Hide Explanation&rdquo; above to answer and submit.</span>
          </div>

          {/* Render code block for answer if code input or code option */}
          {isCodeInput || isCodeContent(currentQ.correctAnswer, currentQ.formatAsCode) ? (
            <div style={{ marginBottom: '0.75rem' }}>
              <CheatSheetCodeBlock code={currentQ.correctAnswer} language="CSS" />
            </div>
          ) : (
            <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
              {currentQ.correctAnswer}
            </div>
          )}

          {currentQ.explanation && (
            <div style={{ color: 'var(--text-muted, #8e9bb0)' }}>
              {currentQ.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

CheatSheetQuiz.propTypes = {
  quiz: PropTypes.shape({
    type: PropTypes.oneOf(['mcq', 'code_input', 'coding']),
    formatAsCode: PropTypes.bool,
    matchMode: PropTypes.oneOf(['flexible', 'exact', 'contains']),
    starterCode: PropTypes.string,
    questionNumber: PropTypes.string,
    prompt: PropTypes.string,
    snippet: PropTypes.string,
    options: PropTypes.arrayOf(PropTypes.string),
    correctAnswer: PropTypes.string,
    explanation: PropTypes.string,
    questions: PropTypes.arrayOf(PropTypes.object)
  }),
  onAttend: PropTypes.func,
  initialAttended: PropTypes.bool
}
