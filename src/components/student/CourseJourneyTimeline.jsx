import React, { useState } from 'react'
import { Check, ChevronDown, ChevronRight, BookOpen, ClipboardList, Code, Play, Zap, Clock, CircleDot, Lock } from 'lucide-react'

function CourseJourneyItem({ item, onModuleAction }) {
    const isActive = item.active || false
    const isLocked = item.isLocked
    
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
    
    const iconColor = item.type === 'live' ? '#ef4444' : '#10b981'

    return (
        <div role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAction(); } }} onClick={handleAction} style={{ 
            position: 'relative', 
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem 1.5rem',
            background: isActive ? '#f3e8ff' : 'transparent',
            borderRadius: '12px',
            transition: 'all 0.2s',
            cursor: isLocked ? 'not-allowed' : 'pointer',
            opacity: isLocked ? 0.6 : 1
        }}>
            {/* Small Green Circle on the line */}
            <div style={{ 
                position: 'absolute', left: '-27px', top: '50%', transform: 'translateY(-50%)',
                width: '16px', height: '16px', borderRadius: '50%', 
                background: 'white', border: '2px solid #10b981',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1 
            }}>
                {item.completed && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />}
            </div>

            {/* Left Content */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ marginTop: '2px', color: iconColor }}>
                    {icon}
                </div>
                <div>
                    <div style={{ fontSize: '1rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem' }}>
                        {item.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                        <span style={{ color: '#64748b' }}>{item.duration} Mins</span>
                        <span style={{ color: '#cbd5e1' }}>•</span>
                        <span style={{ color: typeColor }}>
                            {typeLabel}
                        </span>
                        {item.xp && (
                            <>
                                <span style={{ color: '#cbd5e1' }}>•</span>
                                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 14, height: 14, background: '#fef3c7', borderRadius: '50%', color: '#d97706', fontSize: '0.6rem' }}>xp</span>
                                    {item.xp}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Icon */}
            <div style={{ color: '#64748b' }}>
                {isLocked ? <Lock size={18} /> : <ChevronRight size={20} />}
            </div>
        </div>
    )
}

export default function CourseJourneyTimeline({ course, sessions, challenges, courseResources, assessments, progress, getScheduleDate, onModuleAction }) {
    const [expandedWeek, setExpandedWeek] = useState(1)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    
    // Total weeks (fallback to 12 if not set in course)
    const totalWeeks = course?.duration_weeks || 12

    // Flat map assessments
    const flatAssessments = [
        ...(assessments?.daily || []),
        ...(assessments?.weekly || []),
        ...(assessments?.final || [])
    ]

    const isTaskCompleted = (type, id) => {
        if (type === 'video') {
            return progress?.video_progress?.some(vp => vp.video_id === id) || false
        }
        return false
    }

    const organizeWeekData = (weekNum) => {
        const topicsMap = {}
        
        const addToTopic = (item, type, defaultTopic = 'Introduction') => {
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
            let isLocked = false;
            const itemDate = item.scheduled_time || item.start_time;
            if (itemDate && new Date(itemDate) > new Date()) {
                isLocked = true;
            }
            
            topicsMap[topic].push({ 
                ...item, 
                type: actualType, 
                xp, 
                duration,
                isLocked,
                completed: isTaskCompleted(type, item.id)
            })
        }
        
        const safeSessions = sessions || [];
        safeSessions.filter(v => (v.week_number || 1) === weekNum).forEach(v => addToTopic(v, 'video'));
        
        const safeResources = courseResources || [];
        safeResources.filter(r => (r.week_number || 1) === weekNum).forEach(r => addToTopic(r, 'resource'));
        
        flatAssessments.filter(a => (a.week_number || 1) === weekNum).forEach(a => addToTopic(a, 'assessment'));
        
        const safeChallenges = challenges || [];
        safeChallenges.filter(c => (c.week_number || 1) === weekNum).forEach(c => addToTopic(c, 'coding'));

        return topicsMap
    }

    const topicsMap = organizeWeekData(expandedWeek)
    const topicKeys = Object.keys(topicsMap)

    // Calculate dates for the expanded week
    let dateLabel = "Dates TBD"
    if (getScheduleDate) {
        const start = getScheduleDate(expandedWeek, 1)
        const end = getScheduleDate(expandedWeek, 7)
        if (start && end) {
            const formatOptions = { day: 'numeric', month: 'short' }
            dateLabel = `${start.toLocaleDateString('en-GB', formatOptions)} - ${end.toLocaleDateString('en-GB', formatOptions)}`
        }
    }

    // We don't early return here anymore so the header and dropdown stay visible!
    
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
                            <div 
                                role="button"
                                tabIndex={0}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsDropdownOpen(!isDropdownOpen); } }}
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', 
                                    background: 'white', border: '1px solid #e2e8f0', 
                                    borderRadius: '999px', padding: '0.5rem 1rem', 
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ width: 18, height: 18, borderRadius: '50%', background: statusColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon size={12} color="white" strokeWidth={3} />
                                </div>
                                <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>Week - {expandedWeek}</span>
                                <ChevronDown size={16} color="#64748b" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </div>
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
                                    <div 
                                        key={week}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                setExpandedWeek(week)
                                                setIsDropdownOpen(false)
                                            }
                                        }}
                                        onClick={() => {
                                            setExpandedWeek(week)
                                            setIsDropdownOpen(false)
                                        }}
                                        style={{ 
                                            padding: '0.75rem 1rem', cursor: 'pointer', 
                                            fontWeight: expandedWeek === week ? 700 : 500,
                                            color: expandedWeek === week ? '#6366f1' : '#475569',
                                            background: expandedWeek === week ? '#f8fafc' : 'white',
                                            borderBottom: '1px solid #f1f5f9',
                                            display: 'flex', justifyContent: 'space-between',
                                            fontSize: '0.85rem'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseLeave={e => e.currentTarget.style.background = expandedWeek === week ? '#f8fafc' : 'white'}
                                        onFocus={e => e.currentTarget.style.background = '#f8fafc'}
                                        onBlur={e => e.currentTarget.style.background = expandedWeek === week ? '#f8fafc' : 'white'}
                                    >
                                        <span>{label}</span>
                                        {expandedWeek === week && <Check size={16} color="#6366f1" />}
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem', marginRight: '0.5rem', fontWeight: 500 }}>
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
                            const completedItems = items.filter(i => i.completed).length

                            return (
                                <div key={topic} style={{ marginBottom: '2.5rem' }}>
                                    
                                    {/* Topic Header Node */}
                                    <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                        <div style={{ 
                                            position: 'absolute', left: '-32px', top: '2px', 
                                            width: '26px', height: '26px', borderRadius: '50%', 
                                            background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            zIndex: 1 
                                        }}>
                                            <Check size={16} color="white" strokeWidth={3} />
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
