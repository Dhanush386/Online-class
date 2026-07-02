import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Check, ChevronDown, ChevronRight, BookOpen, ClipboardList, Code, Play, Zap, Clock, CircleDot, Lock } from 'lucide-react'

const STATUS_ORDER = {
    'current': 0,
    'available': 1,
    'upcoming': 2,
    'locked': 3,
    'completed': 4
};

function CourseJourneyItem({ item, onModuleAction }) {
    const isLocked = item.status === 'locked'
    
    const handleAction = () => {
        if (isLocked) return
        if (onModuleAction) {
            onModuleAction(item.type, { _content: item })
        }
    }

    let icon, typeColor, typeLabel
    switch (item.type) {
        case 'assessment': icon = <ClipboardList size={20} />; typeColor = '#d97706'; typeLabel = 'Quiz'; break
        case 'coding': icon = <Code size={20} />; typeColor = '#f59e0b'; typeLabel = 'Exercise'; break
        case 'video': icon = <Play size={20} />; typeColor = '#9333ea'; typeLabel = 'Recorded Lesson'; break
        case 'live': icon = <Zap size={20} />; typeColor = '#ef4444'; typeLabel = 'Live Class'; break
        case 'resource': icon = <BookOpen size={20} />; typeColor = '#9333ea'; typeLabel = 'Material'; break
        default: icon = <BookOpen size={20} />; typeColor = '#10b981'; typeLabel = 'Lesson'; break
    }
    
    let iconColor = '#6366f1'
    if (item.type === 'live') {
        iconColor = '#ef4444'
    } else if (item.status === 'completed') {
        iconColor = '#10b981'
    }

    let containerStyle = {
        position: 'relative', 
        width: '100%',
        border: '1px solid #e2e8f0',
        textAlign: 'left',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.1rem 1.5rem',
        borderRadius: '12px',
        transition: 'all 0.25s ease',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        background: 'white',
        marginBottom: '0.5rem'
    };

    let statusBadge = null;
    let circleBorderColor = '#cbd5e1';
    let circleBg = 'white';

    if (item.status === 'current') {
        containerStyle.background = 'rgba(99, 102, 241, 0.04)';
        containerStyle.borderColor = '#6366f1';
        containerStyle.boxShadow = '0 4px 20px rgba(99,102,241,0.06)';
        circleBorderColor = '#6366f1';
        statusBadge = <span style={{ padding: '0.25rem 0.6rem', background: '#6366f1', color: 'white', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}><CircleDot size={10} className="animate-pulse" /> Active Focus</span>;
    } else if (item.status === 'completed') {
        containerStyle.background = 'rgba(16, 185, 129, 0.02)';
        containerStyle.borderColor = 'rgba(16, 185, 129, 0.2)';
        circleBorderColor = '#10b981';
        circleBg = '#10b981';
        statusBadge = <span style={{ padding: '0.25rem 0.6rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Completed</span>;
    } else if (item.status === 'upcoming') {
        containerStyle.background = 'rgba(245, 158, 11, 0.01)';
        containerStyle.borderColor = 'rgba(245, 158, 11, 0.3)';
        circleBorderColor = '#f59e0b';
        statusBadge = <span style={{ padding: '0.25rem 0.6rem', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Upcoming</span>;
    } else if (item.status === 'locked') {
        containerStyle.opacity = 0.5;
        statusBadge = <span style={{ padding: '0.25rem 0.6rem', background: '#f1f5f9', color: '#64748b', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Locked</span>;
    } else {
        // available
        containerStyle.boxShadow = '0 2px 8px rgba(0,0,0,0.01)';
        circleBorderColor = '#94a3b8';
        statusBadge = <span style={{ padding: '0.25rem 0.6rem', background: '#f8fafc', color: '#475569', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700 }}>Available</span>;
    }

    return (
        <button onClick={handleAction} style={containerStyle}>
            {/* Custom Dot Indicator */}
            <div style={{ 
                position: 'absolute', left: '-27px', top: '50%', transform: 'translateY(-50%)',
                width: '16px', height: '16px', borderRadius: '50%', 
                background: circleBg, border: `2px solid ${circleBorderColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
                boxShadow: item.status === 'current' ? '0 0 8px rgba(99,102,241,0.4)' : 'none'
            }}>
                {item.status === 'completed' && <Check size={10} color="white" strokeWidth={4} />}
            </div>

            {/* Left Content */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ color: iconColor, display: 'flex', alignItems: 'center' }}>
                    {icon}
                </div>
                <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1e293b', marginBottom: '0.3rem' }}>
                        {item.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', fontWeight: 600 }}>
                        <span style={{ color: '#64748b' }}>{item.duration} Mins</span>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span style={{ color: typeColor }}>{typeLabel}</span>
                        {item.xp && (
                            <>
                                <span style={{ color: '#cbd5e1' }}>•</span>
                                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, background: '#fef3c7', borderRadius: '50%', color: '#d97706', fontSize: '0.6rem', fontWeight: 800 }}>xp</span>
                                    {item.xp}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Status Badge & Icon */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {statusBadge}
                <div style={{ color: '#94a3b8' }}>
                    {isLocked ? <Lock size={15} /> : <ChevronRight size={18} />}
                </div>
            </div>
        </button>
    )
}

export default function CourseJourneyTimeline({ course, sessions, challenges, courseResources, assessments, progress, getScheduleDate, onModuleAction }) {
    const [expandedWeek, setExpandedWeek] = useState(1)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    
    const totalWeeks = course?.duration_weeks || 12

    const flatAssessments = [
        ...(assessments?.daily || []),
        ...(assessments?.weekly || []),
        ...(assessments?.final || [])
    ]

    const isTaskCompleted = (type, id) => {
        if (type === 'video' || type === 'watch') {
            return progress?.video_progress?.some(vp => vp.video_id === id) || false
        }
        if (type === 'coding') {
            return progress?.coding_submissions?.some(cs => cs.challenge_id === id && cs.status === 'accepted') || false
        }
        if (type === 'assessment') {
            return progress?.assessment_submissions?.some(asub => asub.assessment_id === id) || false
        }
        return false
    }

    const organizeWeekData = (weekNum) => {
        const topicsMap = {}
        
        const addToTopic = (item, type, defaultTopic = 'Core Curriculum') => {
            const topic = item.topic || defaultTopic
            if (!topicsMap[topic]) topicsMap[topic] = []
            
            let xp = item.xp_reward || item.points || 10
            let duration = item.duration_minutes || item.estimated_minutes || item.time_limit || 30
            if (type === 'resource') { xp = null }

            let actualType = type;
            if (type === 'video') {
                const recorded = item.video_url && (
                    item.video_url.includes('supabase.co/storage') || 
                    item.video_url.includes('drive.google.com') ||
                    !item.video_url.startsWith('http')
                )
                if (!recorded) actualType = 'live';
            }
            let isLocked = item.isLocked || false;
            const itemDate = item.open_time || item.scheduled_time || item.start_time;
            if (itemDate && new Date(itemDate) > new Date()) {
                isLocked = true;
            }
            
            topicsMap[topic].push({ 
                ...item, 
                type: actualType, 
                xp, 
                duration,
                isLocked
            })
        }
        
        const safeSessions = sessions || [];
        safeSessions.filter(v => (v.week_number || 1) === weekNum).forEach(v => addToTopic(v, 'video'));
        
        const safeResources = courseResources || [];
        safeResources.filter(r => (r.week_number || 1) === weekNum).forEach(r => addToTopic(r, 'resource'));
        
        flatAssessments.filter(a => (a.week_number || 1) === weekNum).forEach(a => addToTopic(a, 'assessment'));
        
        const safeChallenges = challenges || [];
        safeChallenges.filter(c => (c.week_number || 1) === weekNum).forEach(c => addToTopic(c, 'coding'));

        // Apply Status Sorting per Topic
        Object.keys(topicsMap).forEach(topic => {
            let hasCurrent = false;
            
            // First, sort the items chronologically and by type
            let sortedItems = topicsMap[topic].sort((a, b) => {
                const dayA = a.day_of_week || a.day_number || a.day || 0;
                const dayB = b.day_of_week || b.day_number || b.day || 0;
                if (dayA !== dayB) return dayA - dayB;

                const TYPE_ORDER = { 'live': 0, 'video': 1, 'resource': 2, 'coding': 3, 'assessment': 4 };
                const typeA = TYPE_ORDER[a.type] !== undefined ? TYPE_ORDER[a.type] : 99;
                const typeB = TYPE_ORDER[b.type] !== undefined ? TYPE_ORDER[b.type] : 99;
                return typeA - typeB;
            });

            // Then assign status so 'current' (Active Focus) hits the first uncompleted item
            topicsMap[topic] = sortedItems.map(item => {
                const completed = isTaskCompleted(item.type, item.id);
                let status = 'available';

                if (completed) {
                    status = 'completed';
                } else if (item.isLocked) {
                    const itemTime = item.open_time || item.scheduled_time || item.start_time;
                    if (itemTime) {
                        const diffMs = new Date(itemTime) - Date.now();
                        if (diffMs > 0 && diffMs <= 172800000) {
                            status = 'upcoming'; // Scheduled within 2 days
                        } else {
                            status = 'locked';
                        }
                    } else {
                        status = 'locked';
                    }
                } else if (!hasCurrent) {
                    status = 'current';
                    hasCurrent = true;
                }
                return { ...item, status };
            }).sort((a, b) => {
                if (STATUS_ORDER[a.status] !== STATUS_ORDER[b.status]) {
                    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
                }
                
                const dayA = a.day_of_week || a.day_number || a.day || 0;
                const dayB = b.day_of_week || b.day_number || b.day || 0;
                if (dayA !== dayB) return dayA - dayB;

                const TYPE_ORDER = { 'live': 0, 'video': 1, 'resource': 2, 'coding': 3, 'assessment': 4 };
                const typeA = TYPE_ORDER[a.type] !== undefined ? TYPE_ORDER[a.type] : 99;
                const typeB = TYPE_ORDER[b.type] !== undefined ? TYPE_ORDER[b.type] : 99;
                return typeA - typeB;
            });
        });

        return topicsMap
    }

    const topicsMap = organizeWeekData(expandedWeek)
    const topicKeys = Object.keys(topicsMap)

    let dateLabel = "Dates TBD"
    if (getScheduleDate) {
        const start = getScheduleDate(expandedWeek, 1)
        const end = getScheduleDate(expandedWeek, 7)
        if (start && end) {
            const formatOptions = { day: 'numeric', month: 'short' }
            dateLabel = `${start.toLocaleDateString('en-GB', formatOptions)} - ${end.toLocaleDateString('en-GB', formatOptions)}`
        }
    }
    
    return (
        <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '2rem' }}>
            
            {/* Top Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                    Your Schedule
                </h1>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', position: 'relative' }}>
                    {(() => {
                        const now = new Date();
                        const startDateStr = getScheduleDate ? getScheduleDate(expandedWeek, 'start') : null;
                        const endDateStr = getScheduleDate ? getScheduleDate(expandedWeek, 'end') : null;
                        
                        let statusColor = '#3b82f6';
                        let Icon = CircleDot;
                        
                        if (startDateStr && endDateStr) {
                            const startDate = new Date(startDateStr);
                            const endDate = new Date(endDateStr);
                            if (now < startDate) {
                                statusColor = '#94a3b8';
                                Icon = Clock;
                            } else if (now > endDate) {
                                statusColor = '#10b981';
                                Icon = Check;
                            }
                        }

                        return (
                            <button 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '0.85rem', 
                                    background: 'white', border: '1px solid #e2e8f0', 
                                    borderRadius: '999px', padding: '0.5rem 1rem', 
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ width: 18, height: 18, borderRadius: '50%', background: statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon size={12} color="white" strokeWidth={3} />
                                </div>
                                <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem', fontFamily: 'inherit' }}>Week - {expandedWeek}</span>
                                <ChevronDown size={16} color="#64748b" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </button>
                        )
                    })()}

                    {isDropdownOpen && (
                        <div style={{ 
                            position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', 
                            background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', 
                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 50, 
                            maxHeight: '250px', overflowY: 'auto', minWidth: '150px' 
                        }}>
                            {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(week => {
                                let label = `Week ${week}`
                                if (getScheduleDate) {
                                    const ws = getScheduleDate(week, 1)
                                    const we = getScheduleDate(week, 7)
                                    if (ws && we) {
                                        label = `Week ${week} (${ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`
                                    }
                                }
                                return (
                                    <button 
                                        key={week}
                                        onClick={() => {
                                            setExpandedWeek(week)
                                            setIsDropdownOpen(false)
                                        }}
                                        style={{ 
                                            width: '100%',
                                            textAlign: 'left',
                                            border: 'none',
                                            borderBottom: '1px solid #f1f5f9',
                                            padding: '0.85rem 1rem', cursor: 'pointer', 
                                            fontWeight: expandedWeek === week ? 700 : 500,
                                            color: expandedWeek === week ? '#6366f1' : '#475569',
                                            background: expandedWeek === week ? '#f8fafc' : 'white',
                                            display: 'flex', justifyContent: 'space-between',
                                            fontSize: '0.85rem',
                                            fontFamily: 'inherit'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background = expandedWeek === week ? '#f8fafc' : 'white'}
                                        onFocus={e => e.currentTarget.style.background = '#f8fafc'}
                                        onBlur={e => e.currentTarget.style.background = expandedWeek === week ? '#f8fafc' : 'white'}
                                    >
                                        <span>{label}</span>
                                        {expandedWeek === week && <Check size={16} color="#6366f1" />}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem', marginRight: '0.5rem', fontWeight: 500 }}>
                        {dateLabel}
                    </span>
                </div>
            </div>

            {/* The Main Card */}
            <div style={{ 
                position: 'relative', 
                background: 'white', 
                borderRadius: '24px', 
                boxShadow: '0 10px 40px rgba(0,0,0,0.03)', 
                overflow: 'hidden' 
            }}>
                
                {/* Timeline Content */}
                <div style={{ 
                    position: 'relative', zIndex: 2, 
                    background: 'white', 
                    borderRadius: '24px', 
                    padding: '2.5rem 3rem', 
                    minHeight: '400px'
                }}>
                    
                    {/* The Timeline */}
                    <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                        
                        {topicKeys.length === 0 ? (
                            <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                                <h3 style={{ color: '#64748b', fontWeight: 500 }}>No modules found for Week {expandedWeek}.</h3>
                                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>Your real modules will appear here when added to the database.</p>
                            </div>
                        ) : (
                            <>
                                {/* Main Vertical Line */}
                                <div style={{ 
                                    position: 'absolute', left: '7px', top: '10px', bottom: 0, 
                                    width: '2px', background: '#e2e8f0', zIndex: 0 
                                }} />

                                {topicKeys.map((topic, topicIdx) => {
                                    const items = topicsMap[topic] || []
                                    const totalItems = items.length
                                    const completedItems = items.filter(i => i.status === 'completed').length

                                    return (
                                        <div key={topic} style={{ marginBottom: '2.5rem' }}>
                                            
                                            {/* Topic Header Node */}
                                            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                                <div style={{ 
                                                    position: 'absolute', left: '-32px', top: '2px', 
                                                    width: '26px', height: '26px', borderRadius: '50%', 
                                                    background: completedItems === totalItems ? '#10b981' : '#6366f1', 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    zIndex: 1,
                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                }}>
                                                    {completedItems === totalItems ? <Check size={14} color="white" strokeWidth={3} /> : <CircleDot size={14} color="white" />}
                                                </div>
                                                
                                                <div style={{ paddingLeft: '0.5rem' }}>
                                                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                                                        TOPIC
                                                    </div>
                                                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#334155' }}>
                                                        {topic} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({completedItems}/{totalItems})</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Topic Items */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                {items.map((item, idx) => (
                                                    <CourseJourneyItem key={item.id || idx} item={item} onModuleAction={onModuleAction} />
                                                ))}
                                            </div>

                                        </div>
                                    )
                                })}
                            </>
                        )}

                    </div>
                </div>

            </div>
        </div>
    )
}

CourseJourneyItem.propTypes = {
    item: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        status: PropTypes.string,
        type: PropTypes.string,
        title: PropTypes.string,
        duration: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        xp: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }).isRequired,
    onModuleAction: PropTypes.func
}

CourseJourneyTimeline.propTypes = {
    course: PropTypes.object,
    sessions: PropTypes.array,
    challenges: PropTypes.array,
    courseResources: PropTypes.array,
    assessments: PropTypes.object,
    progress: PropTypes.object,
    getScheduleDate: PropTypes.func,
    onModuleAction: PropTypes.func
}
