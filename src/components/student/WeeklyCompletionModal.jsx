// ============================================================
// WeeklyCompletionModal — Celebration overlay with CSS confetti
// Shown when a student completes all required items in a week
// ============================================================

import { useEffect, useState } from 'react'
import { Trophy, Star, Coins, ArrowRight, X, Sparkles } from 'lucide-react'

function getSecureRandom() {
  const array = new Uint32Array(1)
  window.crypto.getRandomValues(array)
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
  onClose,
  onContinue,
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isVisible) {
      // Small delay for entrance animation
      setTimeout(() => setShow(true), 50)

      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => {
        setShow(false)
        setTimeout(onClose, 300)
      }, 8000)

      return () => clearTimeout(timer)
    } else {
      setShow(false)
    }
  }, [isVisible, onClose])

  if (!isVisible) return null

  const GRADE_COLORS = {
    'A+': '#10b981', 'A': '#10b981', 'B': '#3b82f6', 'C': '#f59e0b', 'D': '#f97316', 'F': '#ef4444',
  }

  return (
    <>
      {/* Confetti animation */}
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
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* Backdrop */}
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
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
          {Array.from({ length: 40 }, (_, i) => (
            <ConfettiParticle key={i} index={i} />
          ))}
        </div>

        {/* Modal */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          background: 'white',
          borderRadius: 24,
          padding: '2.5rem 2rem',
          maxWidth: 380,
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
              top: 12,
              right: 12,
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
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            boxShadow: '0 8px 24px rgba(245,158,11,0.3)',
            animation: 'celebrationPulse 1.5s ease-in-out infinite',
          }}>
            <Trophy size={32} color="#fff" />
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: '1.4rem',
            fontWeight: 800,
            color: '#1e293b',
            marginBottom: '0.3rem',
          }}>
            🎉 Week {weekNumber} Complete!
          </h2>

          {/* Grade */}
          <div style={{
            fontSize: '2rem',
            fontWeight: 900,
            color: GRADE_COLORS[grade] || '#3b82f6',
            marginBottom: '1.25rem',
          }}>
            Grade: {grade}
          </div>

          {/* Rewards */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1.5rem',
            marginBottom: '1.5rem',
          }}>
            {/* XP */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Star size={20} color="#6366f1" />
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#6366f1' }}>+{xpEarned}</span>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>XP</span>
            </div>

            {/* Coins */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.3rem',
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: '1.25rem' }}>🪙</span>
              </div>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f59e0b' }}>+{coinsEarned}</span>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>Coins</span>
            </div>
          </div>

          {/* Badge */}
          {badgeName && (
            <div style={{
              padding: '0.6rem 1rem',
              background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.05))',
              borderRadius: 12,
              border: '1px dashed rgba(139,92,246,0.2)',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}>
              <Sparkles size={16} color="#8b5cf6" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#8b5cf6' }}>
                🏅 "{badgeName}" Badge Unlocked!
              </span>
            </div>
          )}

          {/* Next week unlock */}
          {nextWeekNumber && (
            <div style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#3b82f6',
              marginBottom: '1.25rem',
            }}>
              ✨ Week {nextWeekNumber} is now unlocked!
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
