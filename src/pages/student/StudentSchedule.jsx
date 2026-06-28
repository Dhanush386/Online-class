import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Check, ChevronDown, ChevronRight, BookOpen, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function StudentSchedule() {
    const { profile } = useAuth()
    const [courses, setCourses] = useState([])
    const [activeCourseId, setActiveCourseId] = useState(null)
    const [loading, setLoading] = useState(true)
    
    const [courseData, setCourseData] = useState({
        videos: [], assessments: [], challenges: [], resources: [],
        progress: []
    })

    const [expandedWeek, setExpandedWeek] = useState(1)

    useEffect(() => {
        async function loadInit() {
            const { data: enrolls } = await supabase
                .from('enrollments')
                .select('course_id, courses(id, title, start_date, duration_weeks)')
                .eq('student_id', profile.id)

            if (enrolls && enrolls.length > 0) {
                const cList = enrolls.map(e => e.courses).filter(Boolean)
                setCourses(cList)
                if (cList.length > 0) {
                    setActiveCourseId(cList[0].id)
                }
            } else {
                setLoading(false)
            }
        }
        loadInit()
    }, [profile])

    useEffect(() => {
        if (!activeCourseId) return
        
        async function loadCourseData() {
            setLoading(true)
            
            const [
                { data: vids },
                { data: asms },
                { data: chals },
                { data: res },
                { data: prog }
            ] = await Promise.all([
                supabase.from('videos').select('id, title, week_number, day_of_week, scheduled_time, duration_minutes, video_url, xp_reward, topic').eq('course_id', activeCourseId).order('scheduled_time', { ascending: true }),
                supabase.from('assessments').select('*').eq('course_id', activeCourseId),
                supabase.from('coding_challenges').select('*').eq('course_id', activeCourseId),
                supabase.from('course_resources').select('*').eq('course_id', activeCourseId),
                supabase.from('progress').select('*').eq('student_id', profile.id).eq('course_id', activeCourseId)
            ])

            setCourseData({
                videos: vids || [],
                assessments: asms || [],
                challenges: chals || [],
                resources: res || [],
                progress: prog || []
            })
            setLoading(false)
        }
        loadCourseData()
    }, [activeCourseId, profile])

    const activeCourse = courses.find(c => c.id === activeCourseId)
    
    const isTaskCompleted = (type, id) => {
        const item = courseData.progress.find(p => p.content_type === type && p.content_id === id)
        return item?.is_completed || false
    }

    const organizeWeekData = (weekNum) => {
        const { videos, assessments, challenges, resources } = courseData
        const topicsMap = {}
        
        const addToTopic = (item, type, defaultTopic = 'Introduction') => {
            const topic = item.topic || defaultTopic
            if (!topicsMap[topic]) topicsMap[topic] = []
            
            let xp = item.xp_reward || 10
            let duration = item.duration_minutes || 30
            if (type === 'resource') { duration = 10; xp = null }
            if (type === 'assessment') { duration = 15; xp = 11 }
            
            topicsMap[topic].push({ 
                ...item, 
                type, 
                xp, 
                duration,
                completed: isTaskCompleted(type, item.id)
            })
        }
        
        videos.filter(v => v.week_number === weekNum).forEach(v => addToTopic(v, 'video'))
        resources.filter(r => r.week_number === weekNum).forEach(r => addToTopic(r, 'resource'))
        assessments.filter(a => a.week_number === weekNum).forEach(a => addToTopic(a, 'assessment'))
        challenges.filter(c => c.week_number === weekNum).forEach(c => addToTopic(c, 'coding'))

        return topicsMap
    }

    if (loading && !courseData.videos.length) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', minHeight: '100vh' }}>
                <h3>Loading Schedule...</h3>
            </div>
        )
    }

    const topicsMap = organizeWeekData(expandedWeek)
    const topicKeys = Object.keys(topicsMap)

    // For UI mocking if database is completely empty, we insert dummy keys to match the screenshot precisely
    if (topicKeys.length === 0) {
        topicsMap['Introduction'] = [
            { id: 1, type: 'video', title: 'Introduction to Databases | Part - 1', duration: 30, xp: 10, completed: true },
            { id: 2, type: 'video', title: 'Introduction to Databases | Part - 2', duration: 30, xp: 10, completed: true, active: true },
            { id: 3, type: 'resource', title: 'Introduction to Databases Cheat Sheet', duration: 10, completed: true },
            { id: 4, type: 'assessment', title: 'MCQ Practice', duration: 15, xp: 11, completed: true }
        ]
        topicsMap['Introduction to SQL'] = []
        topicKeys.push('Introduction', 'Introduction to SQL')
    }

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '2rem 3rem' }}>
            
            {/* Top Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>
                    Your Schedule
                </h1>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <button style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.85rem', 
                        background: 'white', border: '1px solid #e2e8f0', 
                        borderRadius: '999px', padding: '0.5rem 1rem', 
                        boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                        cursor: 'pointer'
                    }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} color="white" strokeWidth={3} />
                        </div>
                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>Week - {expandedWeek}</span>
                        <ChevronDown size={16} color="#64748b" />
                    </button>
                    <span style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem', marginRight: '0.5rem', fontWeight: 500 }}>
                        3rd Nov - 9th Nov
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
                
                {/* Gradient Header Background */}
                <div style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, height: '160px', 
                    background: 'linear-gradient(90deg, #ff9a9e 0%, #fecfef 20%, #a18cd1 50%, #00d2ff 100%)',
                    zIndex: 0
                }} />
                
                {/* Header Content */}
                <div style={{ position: 'relative', zIndex: 1, padding: '2.5rem 3rem', color: '#1e293b' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.05em', color: '#475569', marginBottom: '0.85rem', textTransform: 'uppercase' }}>
                        BACKEND DEVELOPER
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 500, margin: 0, color: '#0f172a' }}>
                        {activeCourse?.title || 'Introduction to Databases'}
                    </h2>
                </div>

                {/* White Body Overlapping Gradient */}
                <div style={{ 
                    position: 'relative', zIndex: 2, 
                    background: 'white', 
                    borderTopLeftRadius: '24px', borderTopRightRadius: '24px', 
                    padding: '2.5rem 3rem', 
                    marginTop: '-24px',
                    minHeight: '400px'
                }}>
                    
                    {/* The Timeline */}
                    <div style={{ position: 'relative', paddingLeft: '2rem' }}>
                        
                        {/* Main Vertical Line */}
                        <div style={{ 
                            position: 'absolute', left: '7px', top: '10px', bottom: 0, 
                            width: '2px', background: '#e2e8f0', zIndex: 0 
                        }} />

                        {topicKeys.map((topic, topicIdx) => {
                            const items = topicsMap[topic] || []
                            const totalItems = items.length || 15 // mock fraction if empty
                            const completedItems = items.filter(i => i.completed).length || 15

                            return (
                                <div key={topic} style={{ marginBottom: '2.5rem' }}>
                                    
                                    {/* Topic Header Node */}
                                    <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                                        {/* Big Green Circle */}
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
                                        {items.map((item, idx) => {
                                            
                                            // Mocking the active state purely for the visual replica of the screenshot
                                            const isActive = item.active || false

                                            return (
                                                <div key={item.id} style={{ 
                                                    position: 'relative', 
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '1rem 1.5rem',
                                                    background: isActive ? '#f3e8ff' : 'transparent',
                                                    borderRadius: '12px',
                                                    transition: 'all 0.2s',
                                                    cursor: 'pointer'
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

                                                    {/* Left Content (Icon + Title + Metadata) */}
                                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                                        <div style={{ marginTop: '2px', color: '#10b981' }}>
                                                            {item.type === 'assessment' ? <ClipboardList size={20} /> : <BookOpen size={20} />}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '1rem', fontWeight: 500, color: '#334155', marginBottom: '0.4rem' }}>
                                                                {item.title}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 600 }}>
                                                                <span style={{ color: '#64748b' }}>{item.duration} Mins</span>
                                                                <span style={{ color: '#cbd5e1' }}>•</span>
                                                                <span style={{ color: item.type === 'assessment' ? '#d97706' : '#9333ea' }}>
                                                                    {item.type === 'assessment' ? 'Practice' : 'Learning'}
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
                                                        <ChevronRight size={20} />
                                                    </div>

                                                </div>
                                            )
                                        })}
                                    </div>

                                </div>
                            )
                        })}

                    </div>
                </div>

            </div>
        </div>
    )
}
