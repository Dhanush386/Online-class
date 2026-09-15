import { useState } from 'react'
import PropTypes from 'prop-types'
import { ArrowLeft, CheckCircle, XCircle, HelpCircle } from 'lucide-react'
import { formatInlineText } from '../../utils/sanitizeRichText'
import CheatSheetCodeBlock from './CheatSheetCodeBlock'

export default function CheatSheetQuiz({ quiz, onAttend, initialAttended = false }) {
  if (!quiz) return null

  const [selectedOption, setSelectedOption] = useState('')
  const [submitted, setSubmitted] = useState(Boolean(initialAttended))
  const [showAnswer, setShowAnswer] = useState(false)

  const isCorrect = selectedOption === quiz.correctAnswer

  // Normalize legacy placeholder 'Question 1 of 3' or 'Question 1 of 2' to 'Question 1 of 1'
  const displayQuestionNumber = (!quiz.questionNumber || quiz.questionNumber === 'Question 1 of 3' || quiz.questionNumber === 'Question 1 of 2')
    ? 'Question 1 of 1'
    : quiz.questionNumber

  const handleSubmit = () => {
    if (!selectedOption) return
    setSubmitted(true)
    if (onAttend) onAttend(selectedOption)
  }

  const handleToggleAnswer = () => {
    setShowAnswer(prev => !prev)
    if (onAttend) onAttend(selectedOption || 'attended')
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
            Practice Quiz
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted, #8e9bb0)' }}>
            {displayQuestionNumber}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {(submitted || showAnswer || initialAttended) && (
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

      {/* Prompt */}
      <div
        style={{
          fontSize: '1.04rem',
          color: 'var(--text-primary, #f8fafc)',
          lineHeight: 1.6,
          fontWeight: 600,
          marginBottom: '1.25rem'
        }}
        dangerouslySetInnerHTML={{ __html: formatInlineText(quiz.prompt) }}
      />

      {/* Optional Embedded Code Snippet */}
      {quiz.snippet && (
        <div style={{ maxWidth: '520px', marginBottom: '1.25rem' }}>
          <CheatSheetCodeBlock code={quiz.snippet} language="CSS" />
        </div>
      )}

      {/* Options List */}
      <div
        role="radiogroup"
        aria-label={quiz.prompt}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          marginBottom: '1.5rem'
        }}
      >
        {quiz.options.map((option, idx) => {
          const isSelected = selectedOption === option
          const isThisCorrect = option === quiz.correctAnswer

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
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '10px',
                background: optionBg,
                border: `1.5px solid ${optionBorder}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                color: optionColor,
                fontSize: '0.94rem',
                fontWeight: isSelected ? 700 : 500
              }}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setSelectedOption(option)
                }
              }}
            >
              <input
                type="radio"
                name={`quiz-${quiz.questionNumber || 'q'}`}
                value={option}
                checked={isSelected}
                onChange={() => {
                  setSelectedOption(option)
                  if (submitted) setSubmitted(false)
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
                  flexShrink: 0
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
              <span>{option}</span>
            </label>
          )
        })}
      </div>

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
          disabled={!selectedOption}
          style={{
            padding: '0.6rem 1.6rem',
            borderRadius: '8px',
            border: 'none',
            background: selectedOption ? '#6366f1' : 'rgba(255,255,255,0.08)',
            color: selectedOption ? '#ffffff' : 'var(--text-muted, #64748b)',
            fontSize: '0.88rem',
            fontWeight: 700,
            cursor: selectedOption ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s ease',
            boxShadow: selectedOption ? '0 4px 14px rgba(99,102,241,0.35)' : 'none'
          }}
        >
          Check Answer
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
          {showAnswer ? 'Hide Explanation' : 'Show Answer'}
        </button>
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
            <span>{isCorrect ? 'Great job! You selected the right answer.' : 'Review your answer or click "Show Answer" to inspect the explanation.'}</span>
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
          <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={16} />
            <span>Correct Answer: {quiz.correctAnswer}</span>
          </div>
          {quiz.explanation && (
            <div style={{ color: 'var(--text-muted, #8e9bb0)' }}>
              {quiz.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

CheatSheetQuiz.propTypes = {
  quiz: PropTypes.shape({
    questionNumber: PropTypes.string,
    prompt: PropTypes.string.isRequired,
    snippet: PropTypes.string,
    options: PropTypes.arrayOf(PropTypes.string).isRequired,
    correctAnswer: PropTypes.string.isRequired,
    explanation: PropTypes.string
  }).isRequired,
  onAttend: PropTypes.func,
  initialAttended: PropTypes.bool
}
