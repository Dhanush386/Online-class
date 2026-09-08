import React, { useState, useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { Lock, Clock, Sparkles, X, ChevronRight, AlertCircle, CheckCircle2, Play, ClipboardList, Code, BookOpen, CircleDot } from 'lucide-react'
import { getItemUnlockTargetDate } from '../../utils/dayAccessEngine'
import { supabase } from '../../lib/supabase'

export default function LockedModuleModal({
    isOpen,
    onClose,
    item,
    courseId,
    enrolledAt,
    userCoins = 0,
    onUnlockSuccess
}) {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 })
    const [isUnlocking, setIsUnlocking] = useState(false)
    const [errorMsg, setErrorMsg] = useState(null)
    const [successMsg, setSuccessMsg] = useState(null)

    // Determine tiered coin cost server-side expectation for UI display
    const coinCost = useMemo(() => {
        if (!item) return 20
        if (item.type === 'assessment') return 15
        if (item.type === 'coding') return 25
        if (item.type === 'resource') return 10
        return 20 // default video/lesson
    }, [item])

    const canAfford = userCoins >= coinCost

    // Live countdown calculation
    useEffect(() => {
        if (!isOpen || !item) return

        const targetDate = getItemUnlockTargetDate(item, enrolledAt)

        const updateTimer = () => {
            const now = new Date()
            const diffMs = targetDate.getTime() - now.getTime()

            if (diffMs <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 })
                return
            }

            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

            setTimeLeft({ days, hours, minutes, seconds, totalMs: diffMs })
        }

        updateTimer()
        const interval = setInterval(updateTimer, 1000)
        return () => clearInterval(interval)
    }, [isOpen, item, enrolledAt])

    if (!isOpen || !item) return null

    const handleUnlockWithCoins = async () => {
        if (isUnlocking || !canAfford) return
        setIsUnlocking(true)
        setErrorMsg(null)

        try {
            const { data, error } = await supabase.rpc('unlock_module_with_coins', {
                p_course_id: courseId,
                p_item_id: item.id
            })

            if (error) {
                throw error
            }

            if (!data?.success) {
                setErrorMsg(data?.error || 'Failed to unlock with coins.')
                setIsUnlocking(false)
                return
            }

            setSuccessMsg(`Unlocked successfully! -${data.cost || coinCost} 🪙`)
            
            setTimeout(() => {
                if (onUnlockSuccess) {
                    onUnlockSuccess(item.id, data.remaining_coins)
                }
                onClose()
            }, 900)
        } catch (err) {
            console.error('Failed early unlock RPC:', err)
            setErrorMsg(err.message || 'Error executing unlock. Please try again.')
        } finally {
            setIsUnlocking(false)
        }
    }

    let typeIcon = <Play size={20} />
    let typeLabel = 'Lesson'
    let typeColor = '#6366f1'
    if (item.type === 'assessment') {
        typeIcon = <ClipboardList size={20} />
        typeLabel = 'Quiz'
        typeColor = '#d97706'
    } else if (item.type === 'coding') {
        typeIcon = <Code size={20} />
        typeLabel = 'Exercise'
        typeColor = '#f59e0b'
    } else if (item.type === 'resource') {
        typeIcon = <BookOpen size={20} />
        typeLabel = 'Material'
        typeColor = '#9333ea'
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)',
            padding: '1rem', animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                position: 'relative', width: '100%', maxWidth: '480px',
                background: 'white', borderRadius: '24px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(226, 232, 240, 0.8)'
            }}>
                {/* Header with gradient badge */}
                <div style={{
                    padding: '1.75rem 1.75rem 1.25rem',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderBottom: '1px solid #e2e8f0',
                    position: 'relative'
                }}>
                    <button 
                        onClick={onClose}
                        style={{
                            position: 'absolute', top: '1.25rem', right: '1.25rem',
                            background: '#e2e8f0', border: 'none', borderRadius: '50%',
                            width: '32px', height: '32px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', cursor: 'pointer', color: '#64748b'
                        }}
                    >
                        <X size={18} />
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
                        <div style={{
                            width: '34px', height: '34px', borderRadius: '10px',
                            background: '#fee2e2', color: '#ef4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Lock size={18} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Content Locked
                        </span>
                    </div>

                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.35rem 0', lineHeight: 1.3 }}>
                        {item.title}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600 }}>
                        <span style={{ color: typeColor, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            {typeIcon} {typeLabel}
                        </span>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span style={{ color: '#64748b' }}>{item.duration || 30} Mins</span>
                        {item.xp && (
                            <>
                                <span style={{ color: '#cbd5e1' }}>•</span>
                                <span style={{ color: '#f59e0b', fontWeight: 700 }}>+{item.xp} XP</span>
                            </>
                        )}
                    </div>
                </div>

                {/* Content Area */}
                <div style={{ padding: '1.75rem' }}>
                    {item.lockedByPrerequisite && !item.isLocked ? (
                        /* Prerequisite Lock on an otherwise accessible day */
                        <div style={{
                            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(139, 92, 246, 0.02) 100%)',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            borderRadius: '16px',
                            padding: '1.5rem',
                            marginBottom: '1.5rem',
                            textAlign: 'center'
                        }}>
                            <div style={{
                                width: '42px', height: '42px', borderRadius: '50%',
                                background: '#e0e7ff', color: '#6366f1',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 0.75rem auto'
                            }}>
                                <CircleDot size={22} className="animate-pulse" />
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.35rem' }}>
                                Complete Active Focus First
                            </div>
                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0', lineHeight: 1.4 }}>
                                You must finish the previous lesson in your journey before accessing this module:
                            </p>
                            {item.activeFocusTitle && (
                                <div style={{
                                    background: 'white',
                                    border: '1px solid #c7d2fe',
                                    borderRadius: '12px',
                                    padding: '0.65rem 1rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    maxWidth: '100%',
                                    boxShadow: '0 2px 8px rgba(99,102,241,0.08)'
                                }}>
                                    <span style={{
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        width: 18, height: 18, borderRadius: '50%', background: '#6366f1', color: 'white'
                                    }}>
                                        <CircleDot size={10} />
                                    </span>
                                    <span style={{ fontWeight: 700, color: '#312e81', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.activeFocusTitle}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Drip Locked (Future Day) */
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            {item.lockedByPrerequisite && item.activeFocusTitle && (
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                                    background: '#eff6ff', border: '1px solid #bfdbfe',
                                    padding: '0.35rem 0.75rem', borderRadius: '999px',
                                    color: '#2563eb', fontSize: '0.75rem', fontWeight: 700,
                                    marginBottom: '1rem'
                                }}>
                                    <AlertCircle size={12} /> Prerequisite: Complete &ldquo;{item.activeFocusTitle}&rdquo; first
                                </div>
                            )}

                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                                <Clock size={16} color="#6366f1" /> Unlocks Automatically In:
                            </div>

                            {/* Digit boxes */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
                                {timeLeft.days > 0 && (
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.6rem 0.8rem', minWidth: '60px' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>{timeLeft.days}</div>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Days</div>
                                    </div>
                                )}
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.6rem 0.8rem', minWidth: '60px' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>
                                        {String(timeLeft.hours).padStart(2, '0')}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Hours</div>
                                </div>
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.6rem 0.8rem', minWidth: '60px' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>
                                        {String(timeLeft.minutes).padStart(2, '0')}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Mins</div>
                                </div>
                                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.6rem 0.8rem', minWidth: '60px' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>
                                        {String(timeLeft.seconds).padStart(2, '0')}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Secs</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Divider with Coin Icon */}
                    <div style={{ position: 'relative', textAlign: 'center', margin: '1.5rem 0' }}>
                        <div style={{ height: '1px', background: '#e2e8f0', width: '100%' }} />
                        <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '0 0.8rem', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                            Or Unlock Early
                        </span>
                    </div>

                    {/* Early Unlock with Coins Box */}
                    <div style={{
                        background: canAfford ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(251, 191, 36, 0.04) 100%)' : '#f8fafc',
                        border: `1px solid ${canAfford ? '#fbbf24' : '#e2e8f0'}`,
                        borderRadius: '16px', padding: '1.25rem', marginBottom: '1rem'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                                    Instant Early Unlock
                                </div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                    Bypass the drip lock immediately
                                </div>
                            </div>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                                background: '#fef3c7', padding: '0.35rem 0.75rem', borderRadius: '999px',
                                border: '1px solid #fde68a', fontWeight: 800, color: '#d97706', fontSize: '0.9rem'
                            }}>
                                <span>🪙</span> {coinCost} Coins
                            </div>
                        </div>

                        {/* Balance readout */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', marginBottom: '1rem' }}>
                            <span>Your Balance:</span>
                            <span style={{ fontWeight: 700, color: canAfford ? '#059669' : '#dc2626' }}>
                                🪙 {userCoins} Coins
                            </span>
                        </div>

                        {/* Unlock Action Button */}
                        <button
                            onClick={handleUnlockWithCoins}
                            disabled={!canAfford || isUnlocking || !!successMsg}
                            style={{
                                width: '100%',
                                padding: '0.85rem 1rem',
                                borderRadius: '12px',
                                border: 'none',
                                background: successMsg 
                                    ? '#10b981' 
                                    : canAfford 
                                        ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                                        : '#cbd5e1',
                                color: 'white',
                                fontWeight: 700,
                                fontSize: '0.92rem',
                                cursor: canAfford && !isUnlocking && !successMsg ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                transition: 'all 0.2s ease',
                                boxShadow: canAfford && !successMsg ? '0 4px 14px rgba(217, 119, 6, 0.3)' : 'none'
                            }}
                        >
                            {isUnlocking ? (
                                <span>Unlocking...</span>
                            ) : successMsg ? (
                                <><CheckCircle2 size={18} /> {successMsg}</>
                            ) : canAfford ? (
                                <><Sparkles size={18} /> Unlock Now (-{coinCost} 🪙)</>
                            ) : (
                                <span>Need {coinCost - userCoins} More Coins</span>
                            )}
                        </button>
                    </div>

                    {/* Messages */}
                    {errorMsg && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                            <AlertCircle size={14} /> {errorMsg}
                        </div>
                    )}

                    {!canAfford && (
                        <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.75rem 0 0 0', textAlign: 'center', lineHeight: 1.4 }}>
                            💡 Earn coins by maintaining daily streaks, solving coding challenges, or getting high scores on quizzes!
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

LockedModuleModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    item: PropTypes.object,
    courseId: PropTypes.string,
    enrolledAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    userCoins: PropTypes.number,
    onUnlockSuccess: PropTypes.func
}
