import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { ChevronLeft, Clock } from 'lucide-react'

export function WorkspaceHeader({
    canBypass,
    currentIndex,
    challenge,
    isStarted,
    violationCount,
    timeLeft,
    formatTime
}) {
    return (
        <header style={{ height: 48, background: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 1rem' }}>
            <Link to={canBypass ? "/organizer/coding" : "/student/coding"} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}>
                <ChevronLeft size={18} /> CODING PRACTICE - {currentIndex + 1}
            </Link>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {violationCount > 0 && !canBypass && (
                    <div style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, background: '#fef2f2', padding: '4px 10px', borderRadius: 4, border: '1px solid #fee2e2' }}>
                        Violations: {violationCount}/3
                    </div>
                )}
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{challenge?.title}</span>
                {isStarted && !canBypass && (
                    <div style={{ padding: '4px 10px', background: '#e2e8f0', borderRadius: 4, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: timeLeft <= 300 ? '#ef4444' : 'var(--text-primary)' }}>
                        <Clock size={14} /> {formatTime(timeLeft)}
                    </div>
                )}
                <div style={{ padding: '2px 8px', background: '#10b981', borderRadius: 4, fontSize: '0.85rem', fontWeight: 800 }}>VER 7.1</div>
            </div>
        </header>
    )
}

WorkspaceHeader.propTypes = {
    canBypass: PropTypes.bool,
    currentIndex: PropTypes.number,
    challenge: PropTypes.shape({
        title: PropTypes.string
    }),
    isStarted: PropTypes.bool,
    violationCount: PropTypes.number,
    timeLeft: PropTypes.number,
    formatTime: PropTypes.func
}
