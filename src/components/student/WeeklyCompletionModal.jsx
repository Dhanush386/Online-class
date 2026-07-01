// ============================================================
// WeeklyCompletionModal — Celebration overlay with CSS confetti
// Shown when a student completes all required items in a week
// ============================================================

import { useEffect, useState } from 'react'
import { Trophy, Star, ArrowRight, X, Sparkles } from 'lucide-react'
import PropTypes from 'prop-types'

function getSecureRandom() {
  const array = new Uint32Array(1)
  globalThis.crypto.getRandomValues(array)
  return array[0] / (0xffffffff + 1)
}

// CSS-only confetti particles
function ConfettiParticle({ index }) {
  const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']
  const color = colors[index % colors.length]
  const left = getSecureRandom() * 100
  const delay = getSecureRandom() * 0.5
  const duration = 2 + getSecureRandom() * 2
  const size = 6 + getSecureRandom() * 6

  return (
    <div style={{
      position: 'absolute',
      left: `${left}%`,
      top: -10,
      width: size,
      height: size,
      background: color,
      borderRadius: getSecureRandom() > 0.5 ? '50%' : '2px',
      animation: `confettiFall ${duration}s ease-out ${delay}s forwards`,
      opacity: 0,
      zIndex: 1,
    }} />
  )
}

export default function WeeklyCompletionModal({
  isVisible,
  weekNumber,
  xpEarned = 100,
  coinsEarned = 25,
  grade = 'A',
  badgeName = null,
  nextWeekNumber = null,
  aiSummary = null,
  attendancePercentage = 0,
  videoPercentage = 0,
  codingPercentage = 0,
  quizPercentage = 0,
  onClose,
  onContinue,
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isVisible) {
      setTimeout(() => setShow(true), 50)
      const timer = setTimeout(() => {
        setShow(false)
        setTimeout(onClose, 300)
      }, 10000) // Keep open slightly longer to read summary

      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  const GRADE_COLORS = {
    'A+': '#10b981', 'A': '#10b981', 'B': '#3b82f6', 'C': '#f59e0b', 'D': '#f97316', 'F': '#ef4444',
  }

  const getStars = (grade) => {
    let stars = 0
    if (grade === 'A+') stars = 10
    else if (grade === 'A') stars = 9
    else if (grade === 'B') stars = 8
    else if (grade === 'C') stars = 6
    else if (grade === 'D') stars = 4
    else stars = 2

    return (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.2rem', color: '#f59e0b', fontSize: '1.2rem', marginBottom: '0.85rem' }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <span key={`star-${num}`}>{num <= stars ? '★' : '☆'}</span>
        ))}
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(600px) rotate(720deg); opacity: 0; }
        }
        @keyframes celebrationPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Backdrop */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: show ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}>
        {/* Confetti */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {Array.from({ length: 45 }, (_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </div>

        {/* Modal */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          background: 'white',
          borderRadius: 24,
          padding: '2.2rem 1.8rem',
          maxWidth: 420,
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
          animation: show ? 'fadeInUp 0.4s ease-out' : 'none',
        }}>
          {/* Close */}
          <button
            onClick={() => { setShow(false); setTimeout(onClose, 300) }}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 4,
            }}
          >
            <X size={18} />
          </button>

          {/* Trophy */}
          <div style={{
            width: 68,
            height: 68,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 8px 24px rgba(245,158,11,0.3)',
            animation: 'celebrationPulse 1.5s ease-in-out infinite',
          }}>
            <Trophy size={30} color="#fff" />
          </div>

          {/* Title */}
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.2rem' }}>
            🎉 Week {weekNumber} Completed!
          </h2>

          {/* Grade Stars */}
          {getStars(grade)}

          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: GRADE_COLORS[grade] || '#3b82f6', marginBottom: '1.25rem' }}>
            Grade: {grade}
          </div>

          {/* Sub-percentages Report Card */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: '1rem',
            textAlign: 'left',
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.4rem', marginBottom: '0.2rem' }}>Performance Metrics</div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
              <span style={{ color: '#475569' }}>Live Attendance</span>
              <span style={{ color: '#1e293b', fontWeight: 700 }}>{attendancePercentage}%</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
              <span style={{ color: '#475569' }}>Watch Progress</span>
              <span style={{ color: '#1e293b', fontWeight: 700 }}>{videoPercentage}%</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
              <span style={{ color: '#475569' }}>Coding Challenges</span>
              <span style={{ color: '#1e293b', fontWeight: 700 }}>{codingPercentage}%</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600 }}>
              <span style={{ color: '#475569' }}>Assessments & Quizzes</span>
              <span style={{ color: '#1e293b', fontWeight: 700 }}>{quizPercentage}%</span>
            </div>
          </div>

          {/* AI Coach Summary Card */}
          {aiSummary && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.03), rgba(139,92,246,0.03))',
              border: '1px dashed #c084fc',
              borderRadius: 16,
              padding: '1.1rem',
              textAlign: 'left',
              marginBottom: '1.5rem',
              boxShadow: '0 4px 12px rgba(139,92,246,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                <Sparkles size={14} color="#8b5cf6" /> AI Coach Summary
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#4b5563', lineHeight: 1.5, fontStyle: 'italic' }}>
                "{aiSummary}"
              </p>
            </div>
          )}

          {/* Rewards */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={18} color="#6366f1" />
              </div>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#6366f1' }}>+{xpEarned}</span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>XP</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.15rem' }}>🪙</span>
              </div>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f59e0b' }}>+{coinsEarned}</span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>Coins</span>
            </div>
          </div>

          {/* Badge Unlocked */}
          {badgeName && (
            <div style={{ padding: '0.6rem 1rem', background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.05))', borderRadius: 12, border: '1px dashed rgba(139,92,246,0.2)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} color="#8b5cf6" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b5cf6' }}>🏅 "{badgeName}" Badge Unlocked!</span>
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={() => {
              setShow(false)
              setTimeout(() => {
                onContinue?.()
                onClose()
              }, 300)
            }}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
              border: 'none',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Continue to Week {nextWeekNumber || weekNumber + 1}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  )
}

ConfettiParticle.propTypes = {
  index: PropTypes.number
}

WeeklyCompletionModal.propTypes = {
  isVisible: PropTypes.bool,
  weekNumber: PropTypes.number,
  xpEarned: PropTypes.number,
  coinsEarned: PropTypes.number,
  grade: PropTypes.string,
  badgeName: PropTypes.string,
  nextWeekNumber: PropTypes.number,
  aiSummary: PropTypes.string,
  attendancePercentage: PropTypes.number,
  videoPercentage: PropTypes.number,
  codingPercentage: PropTypes.number,
  quizPercentage: PropTypes.number,
  onClose: PropTypes.func,
  onContinue: PropTypes.func
}

ConfettiParticle.propTypes = {
  index: PropTypes.number
}

WeeklyCompletionModal.propTypes = {
  isVisible: PropTypes.bool,
  weekNumber: PropTypes.number,
  xpEarned: PropTypes.number,
  coinsEarned: PropTypes.number,
  grade: PropTypes.string,
  badgeName: PropTypes.string,
  nextWeekNumber: PropTypes.number,
  onClose: PropTypes.func,
  onContinue: PropTypes.func
}
