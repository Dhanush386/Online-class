import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import CodeEditor from '../../components/CodeEditor'
import { Plus, Code, Trash2, Edit2, X, Save, AlertCircle, BookOpen, Search, Filter, Calendar, Clock, Lock, Image, Upload, Sparkles, Loader2, ShieldAlert } from 'lucide-react'
import OrganizerCodingDiscussions from '../../components/OrganizerCodingDiscussions'
import { toLocalInput, toISOWithOffset } from '../../lib/dateUtils'

const LANGUAGES = [
    { id: 'html', name: 'HTML/CSS/JS (Web)', icon: '🌐' },
    { id: 'python', name: 'Python 3', icon: '🐍' },
    { id: 'python_ml', name: 'Python (Scientific/ML)', icon: '🧪' },
    { id: 'java', name: 'Java', icon: '☕' },
    { id: 'cpp', name: 'C++', icon: '⚙️' },
    { id: 'c', name: 'C', icon: '📄' },
    { id: 'sql', name: 'SQL (SQLite)', icon: '💾' }
]

const DIFFICULTIES = ['easy', 'medium', 'hard']

// Organizer Coding Management Page
export default function CodingManagement() {
    const { profile } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()
    const [mainTab, setMainTab] = useState('challenges')
    const [courses, setCourses] = useState([])
    const [challenges, setChallenges] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [editingId, setEditingId] = useState(null)
    const [starterWebCode, setStarterWebCode] = useState({ html: '', css: '', js: '' })
    const [webTab, setWebTab] = useState('html')

    const [formData, setFormData] = useState({
        title: '', description: '', problem_statement: '',
        course_id: '', language: 'python', difficulty: 'easy',
        starter_code: '', solution_code: '', constraints: '', input_format: '', output_format: '',
        xp_reward: 15, open_time: '', close_time: '',
        target_visual_url: '', allowed_assets: '',
        day_number: 1,
        is_combined: false,
        sub_questions: [{ id: 'q1', title: '', problem_statement: '', starter_code: '', xp_reward: 15, test_cases: [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }] }],
        test_cases: [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }]
    })

    const [groups, setGroups] = useState([])

    // AI Generation states
    const [showAIModal, setShowAIModal] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedChallenges, setGeneratedChallenges] = useState([])
    const [aiError, setAiError] = useState('')
    const [aiCourseId, setAiCourseId] = useState('')

    useEffect(() => {
        if (location.state?.courseId) {
            setFormData(prev => ({ 
                ...prev, 
                course_id: location.state.courseId,
                day_number: location.state.day || 1
            }))
            if (location.state.openModal) setShowModal(true)
        }
    }, [location.state])
    const [resourceAccess, setResourceAccess] = useState([])
    const [lockingResource, setLockingResource] = useState(null)

    useEffect(() => {
        if (profile?.id) {
            loadInitialData()
        }
    }, [profile])

    async function loadInitialData() {
        setLoading(true)
        const [
            { data: courseData },
            { data: challengeData },
            { data: groupData },
            { data: accessData }
        ] = await Promise.all([
            supabase.from('courses').select('id, title').eq('organizer_id', profile.id),
            supabase.from('coding_challenges').select('*, courses(title)').order('created_at', { ascending: false }),
            supabase.from('groups').select('*').eq('organizer_id', profile.id),
            supabase.from('resource_access').select('*').eq('resource_type', 'coding')
        ])

        setCourses(courseData || [])
        setChallenges(challengeData || [])
        setGroups(groupData || [])
        setResourceAccess(accessData || [])
        setLoading(false)
    }

    async function handleTCImageUpload(e, idx, field) {
        const file = e.target.files?.[0]
        if (!file) return

        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`
        const filePath = `challenges/test-cases/${fileName}`

        try {
            const { error: uploadError } = await supabase.storage
                .from('study-materials')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('study-materials')
                .getPublicUrl(filePath)

            const newTCData = [...formData.test_cases]
            newTCData[idx][field] = publicUrl
            setFormData(p => ({ ...p, test_cases: newTCData }))
        } catch (err) {
            alert('Error uploading image: ' + err.message)
        }
    }

    async function toggleResourceLock(groupId, resourceId) {
        const existing = resourceAccess.find(a => a.group_id === groupId && a.resource_id === resourceId)
        try {
            if (existing) {
                const { error } = await supabase.from('resource_access')
                    .update({ is_locked: !existing.is_locked })
                    .eq('resource_id', resourceId)
                    .eq('group_id', groupId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('resource_access')
                    .insert({
                        resource_id: resourceId,
                        resource_type: 'coding',
                        group_id: groupId,
                        is_locked: true
                    })
                if (error) throw error
            }
            // Reload access data
            const { data } = await supabase.from('resource_access').select('*').eq('resource_type', 'coding')
            setResourceAccess(data || [])
        } catch (err) {
            console.error('Error toggling lock:', err)
        }
    }

    async function generateChallengesWithAI() {
        if (!aiPrompt.trim()) return;
        if (!aiCourseId) {
            setAiError("Please select a course for the generated challenges.");
            return;
        }
        setIsGenerating(true);
        setAiError('');
        setGeneratedChallenges([]);

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error("Gemini API key is not configured.");

            const prompt = `You are an expert computer science educator. Create coding challenges based on the following topic or text: "${aiPrompt}". 
            Output the response strictly as a JSON array of objects. Do not include any markdown formatting like \`\`\`json.
            Each object must follow this exact structure:
            {
                "title": "Challenge Title",
                "problem_statement": "Detailed markdown description of the problem",
                "language": "python",
                "difficulty": "easy",
                "starter_code": "def solution():\\n  pass",
                "solution_code": "def solution():\\n  return True",
                "constraints": "1 <= N <= 10^5",
                "test_cases": [
                    { "input": "...", "expected_output": "..." }
                ]
            }
            Valid languages: html, python, python_ml, java, cpp, c, sql. Valid difficulties: easy, medium, hard.`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Failed to generate challenges');

            let responseText = data.candidates[0].content.parts[0].text;
            
            // Clean up possible markdown wrappers
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const parsed = JSON.parse(responseText);
            if (!Array.isArray(parsed)) throw new Error("AI did not return an array.");
            
            setGeneratedChallenges(parsed);
        } catch (err) {
            console.error(err);
            setAiError(err.message || 'Error parsing AI response. Please try a clearer prompt.');
        } finally {
            setIsGenerating(false);
        }
    }

    async function handleAddAllGenerated() {
        if (generatedChallenges.length === 0) return;
        setSaving(true);
        try {
            const payloads = generatedChallenges.map(c => ({
                course_id: aiCourseId,
                title: c.title || 'Untitled',
                problem_statement: c.problem_statement || '',
                language: c.language || 'python',
                difficulty: c.difficulty || 'easy',
                starter_code: c.starter_code || '',
                solution_code: c.solution_code || '',
                constraints: c.constraints || '',
                test_cases: Array.isArray(c.test_cases) ? c.test_cases : [],
                xp_reward: c.difficulty === 'hard' ? 30 : c.difficulty === 'medium' ? 20 : 15,
                day_number: 1 // Default
            }));

            const { error } = await supabase.from('coding_challenges').insert(payloads);
            if (error) throw error;

            setShowAIModal(false);
            setAiPrompt('');
            setAiCourseId('');
            setGeneratedChallenges([]);
            loadInitialData();
        } catch (err) {
            alert('Failed to save AI challenges: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.course_id) { setError('Please select a course'); return }

        setSaving(true)
        setError('')

        try {
            let finalStarterCode = formData.starter_code
            if (formData.language === 'html') {
                finalStarterCode = JSON.stringify({
                    html: starterWebCode.html,
                    css: starterWebCode.css,
                    js: starterWebCode.js
                })
            }

            const payload = {
                title: formData.title,
                description: formData.description,
                problem_statement: formData.problem_statement,
                course_id: formData.course_id,
                language: formData.language,
                difficulty: formData.difficulty,
                solution_code: formData.solution_code,
                constraints: formData.constraints,
                input_format: formData.input_format,
                output_format: formData.output_format,
                xp_reward: formData.xp_reward,
                day_number: formData.day_number,
                target_visual_url: formData.target_visual_url,
                starter_code: finalStarterCode,
                test_cases: formData.is_combined ? { is_combined: true, sub_questions: formData.sub_questions } : formData.test_cases.filter(tc => 
                    tc.expected_output?.trim() !== '' || 
                    (formData.language === 'html' && tc.output_image_url?.trim() !== '')
                ),
                open_time: toISOWithOffset(formData.open_time),
                close_time: toISOWithOffset(formData.close_time),
                allowed_assets: (formData.allowed_assets || '').split('\n').map(l => l.trim()).filter(Boolean)
            }

            if (editingId) {
                const { error } = await supabase.from('coding_challenges').update(payload).eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('coding_challenges').insert(payload)
                if (error) throw error
            }

            setShowModal(false)
            resetForm()
            loadInitialData()
        } catch (err) {
            setError(err.message || 'Failed to save challenge')
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this coding challenge?')) return
        const { error } = await supabase.from('coding_challenges').delete().eq('id', id)
        if (!error) {
            setChallenges(challenges.filter(c => c.id !== id))
        } else {
            alert('Error deleting: ' + error.message)
        }
    }


    function openEdit(c) {
        setEditingId(c.id)
        
        let initialStarterCode = c.starter_code || ''
        if (c.language === 'html') {
            try {
                const parsed = JSON.parse(c.starter_code || '{}')
                setStarterWebCode({
                    html: parsed.html || '',
                    css: parsed.css || '',
                    js: parsed.js || ''
                })
            } catch (e) {
                setStarterWebCode({
                    html: c.starter_code || '',
                    css: '',
                    js: ''
                })
            }
        }

        let is_combined = false;
        let sub_questions = [{ id: 'q1', title: '', problem_statement: '', starter_code: '', solution_code: '', xp_reward: 15, test_cases: [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }] }];
        let parsedTestCases = [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }];
        
        if (c.test_cases && !Array.isArray(c.test_cases) && c.test_cases.is_combined) {
            is_combined = true;
            sub_questions = c.test_cases.sub_questions || sub_questions;
        } else if (Array.isArray(c.test_cases)) {
            parsedTestCases = c.test_cases;
        }

        setFormData({
            title: c.title, description: c.description || '',
            problem_statement: c.problem_statement, course_id: c.course_id || '', language: c.language || 'python', difficulty: c.difficulty || 'easy',
            starter_code: initialStarterCode, solution_code: c.solution_code || '', constraints: c.constraints || '',
            input_format: c.input_format || '', output_format: c.output_format || '',
            xp_reward: c.xp_reward || 15,
            open_time: toLocalInput(c.open_time),
            close_time: toLocalInput(c.close_time),
            target_visual_url: c.target_visual_url || '',
            allowed_assets: Array.isArray(c.allowed_assets) ? c.allowed_assets.join('\n') : (c.allowed_assets || ''),
            test_cases: parsedTestCases,
            is_combined,
            sub_questions,
            day_number: c.day_number || 1
        })
        setShowModal(true)
    }

    function resetForm() {
        setFormData({
            title: '', description: '', problem_statement: '',
            course_id: formData.course_id, language: 'python', difficulty: 'easy',
            starter_code: '', solution_code: '', constraints: '', input_format: '', output_format: '',
            xp_reward: 15, open_time: '', close_time: '',
            target_visual_url: '', allowed_assets: '',
            day_number: 1,
            is_combined: false,
            sub_questions: [{ id: 'q1', title: '', problem_statement: '', starter_code: '', solution_code: '', xp_reward: 15, test_cases: [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }] }],
            test_cases: [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }]
        })
        setStarterWebCode({ html: '', css: '', js: '' })
        setEditingId(null)
        setError('')
    }

    const filteredChallenges = challenges.filter(c =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.courses?.title?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="animate-fade-in">
            {/* Header Area */}
            <div className="stack-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Coding Practice</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Create and manage coding challenges for your students</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => navigate('/organizer/proctoring')}
                        className="btn-secondary"
                        style={{ gap: '0.5rem', background: '#fef2f2', color: '#ef4444', borderColor: '#fecaca' }}
                    >
                        <ShieldAlert size={18} /> Live Proctoring
                    </button>
                    <button
                        onClick={() => { setAiPrompt(''); setGeneratedChallenges([]); setShowAIModal(true) }}
                        className="btn-secondary"
                        style={{ gap: '0.5rem', background: '#f5f3ff', color: '#8b5cf6', borderColor: '#ddd6fe' }}
                    >
                        <Sparkles size={18} /> Generate with AI
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowModal(true) }}
                        className="btn-primary"
                        style={{ gap: '0.5rem' }}
                    >
                        <Plus size={18} /> Create Challenge
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--card-border)', marginBottom: '1.5rem' }}>
                <button onClick={() => setMainTab('challenges')} style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: mainTab === 'challenges' ? '2px solid #6366f1' : '2px solid transparent', color: mainTab === 'challenges' ? '#6366f1' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Challenges</button>
                <button onClick={() => setMainTab('discussions')} style={{ padding: '0.75rem 1rem', background: 'none', border: 'none', borderBottom: mainTab === 'discussions' ? '2px solid #6366f1' : '2px solid transparent', color: mainTab === 'discussions' ? '#6366f1' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Discussions</button>
            </div>

            {mainTab === 'challenges' ? (
                <>
                    {/* Filters & Search */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        id="challenge-search"
                        name="challenge-search"
                        type="text"
                        placeholder="Search challenges by title or course..."
                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.8rem', borderRadius: 12, border: '1px solid var(--card-border)', background: 'white', fontSize: '0.9rem' }}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading coding challenges...</p>
                </div>
            ) : filteredChallenges.length === 0 ? (
                <div className="glass-card" style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Code size={32} color="#94a3b8" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Challenges Found</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto 1.5rem' }}>Build interactive coding problems for your students to practice.</p>
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <button onClick={() => setShowModal(true)} className="btn-secondary">
                            <Plus size={18} /> Add Your First Challenge
                        </button>
                        <button onClick={() => { setAiPrompt(''); setGeneratedChallenges([]); setShowAIModal(true) }} className="btn-secondary" style={{ background: '#f5f3ff', color: '#8b5cf6', borderColor: '#ddd6fe' }}>
                            <Sparkles size={18} /> Generate with AI
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {filteredChallenges.map(c => (
                        <div key={c.id} className="glass-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${c.difficulty === 'easy' ? '#10b981' : c.difficulty === 'medium' ? '#f59e0b' : '#ef4444'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <span className="badge" style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.7rem' }}>
                                    {LANGUAGES.find(l => l.id === c.language)?.icon} {c.language.toUpperCase()}
                                </span>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button
                                        onClick={() => setLockingResource(c)}
                                        className="btn-secondary"
                                        title="Access Control"
                                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#6366f1', borderColor: 'rgba(99,102,241,0.2)' }}
                                    >
                                        <Clock size={14} /> Batch
                                    </button>
                                    <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem' }}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {resourceAccess.some(a => a.resource_id === c.id && a.is_locked) && <Lock size={14} color="#ef4444" style={{ flexShrink: 0 }} />}
                                {c.title}
                            </h3>
                            {resourceAccess.filter(a => a.resource_id === c.id && a.is_locked).length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
                                    {resourceAccess.filter(a => a.resource_id === c.id && a.is_locked).map(a => {
                                        const g = groups.find(gr => gr.id === a.group_id)
                                        return g ? <span key={g.id} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontWeight: 600 }}>Locked: {g.name}</span> : null
                                    })}
                                </div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <BookOpen size={12} /> {c.courses?.title} • {c.difficulty.toUpperCase()}
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, height: '2.5rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '1rem' }}>
                                {c.description || 'No description provided.'}
                            </p>
                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.test_cases?.length || 0} Test Cases</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => window.open(`/student/coding/${c.id}?admin=true`, '_blank')}
                                        className="btn-secondary"
                                        style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: '#6366f1', borderColor: 'rgba(99,102,241,0.2)' }}
                                    >
                                        Test Question
                                    </button>
                                    <button onClick={() => openEdit(c)} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>View Details</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )
            }
            </>
            ) : (
                <OrganizerCodingDiscussions />
            )}

            {/* Access Control Modal */}
            {
                lockingResource && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                        <div className="glass-card zoom-in" style={{ width: '100%', maxWidth: 450, padding: 0, overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Access Control</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lockingResource.title}</p>
                                </div>
                                <button onClick={() => setLockingResource(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                    Toggle locks for specific groups. Locked resources are invisible/non-accessible to students in that group.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {groups.filter(g => g.course_id === lockingResource.course_id).length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            No groups/batches created for this course.
                                            {groups.length > 0 && (
                                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#f59e0b' }}>
                                                    Note: Batches are course-specific. You have {groups.length} batch(es) in other courses.
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        groups.filter(g => g.course_id === lockingResource.course_id).map(g => {
                                            const access = resourceAccess.find(a => a.group_id === g.id && a.resource_id === lockingResource.id)
                                            const isLocked = access?.is_locked || false
                                            return (
                                                <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: isLocked ? '#fff1f2' : '#f0fdf4', borderRadius: 10, border: `1px solid ${isLocked ? '#fecaca' : '#bbf7d0'}` }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isLocked ? '#991b1b' : '#166534' }}>{g.name}</div>
                                                    <button
                                                        onClick={() => toggleResourceLock(g.id, lockingResource.id)}
                                                        className={isLocked ? "btn-primary" : "btn-secondary"}
                                                        style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', background: isLocked ? '#ef4444' : 'white' }}
                                                    >
                                                        {isLocked ? 'Unlock' : 'Lock'}
                                                    </button>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                            <div style={{ padding: '1rem 1.5rem', background: '#f8fafc', borderTop: '1px solid var(--card-border)', textAlign: 'right' }}>
                                <button onClick={() => setLockingResource(null)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Done</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal */}
            {
                showModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                        <div className="glass-card animate-scale-in" style={{ width: '90%', maxWidth: 800, maxHeight: '90vh', padding: 0, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {editingId ? 'Edit Challenge' : 'Create New Coding Challenge'}
                                </h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    {editingId && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const c = challenges.find(ch => ch.id === editingId)
                                                if (c) setLockingResource(c)
                                            }}
                                            className="btn-secondary"
                                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', gap: '0.4rem', color: '#6366f1', borderColor: 'rgba(99,102,241,0.2)' }}
                                        >
                                            <Clock size={14} /> Access Control
                                        </button>
                                    )}
                                    <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                                {error && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 10, marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
                                        <AlertCircle size={18} /> {error}
                                    </div>
                                )}

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: window.innerWidth <= 600 ? '1fr' : '1.5fr 1fr 1fr',
                                    gap: '1rem',
                                    marginBottom: '1.25rem'
                                }}>
                                    <div style={{ gridColumn: window.innerWidth <= 600 ? 'span 1' : 'span 1' }}>
                                        <label htmlFor="course-id" className="form-label">Course</label>
                                        <select
                                            id="course-id"
                                            name="course_id"
                                            className="form-input"
                                            value={formData.course_id}
                                            onChange={e => setFormData(p => ({ ...p, course_id: e.target.value }))}
                                            required
                                        >
                                            <option value="">Select Course</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: window.innerWidth <= 600 ? 'span 1' : 'span 1' }}>
                                        <label htmlFor="language" className="form-label">Language</label>
                                        <select id="language" name="language" className="form-input" value={formData.language} onChange={e => setFormData(p => ({ ...p, language: e.target.value }))} required>
                                            {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: window.innerWidth <= 600 ? 'span 1' : 'span 1' }}>
                                        <label htmlFor="difficulty" className="form-label">Difficulty</label>
                                        <select
                                            id="difficulty"
                                            name="difficulty"
                                            className="form-input"
                                            value={formData.difficulty}
                                            onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                                        >
                                            {DIFFICULTIES.map(d => (
                                                <option key={d} value={d}>{d.toUpperCase()}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ gridColumn: window.innerWidth <= 600 ? 'span 1' : 'span 1' }}>
                                        <label htmlFor="xp_reward" className="form-label">XP Reward</label>
                                        <input
                                            id="xp_reward"
                                            name="xp_reward"
                                            type="number"
                                            className="form-input"
                                            value={formData.xp_reward}
                                            onChange={e => setFormData({ ...formData, xp_reward: parseInt(e.target.value) || 15 })}
                                        />
                                    </div>
                                    <div style={{ gridColumn: window.innerWidth <= 600 ? 'span 1' : 'span 1' }}>
                                        <label htmlFor="day_number" className="form-label">Day Number</label>
                                        <input
                                            id="day_number"
                                            name="day_number"
                                            type="number"
                                            className="form-input"
                                            min="1"
                                            value={formData.day_number}
                                            onChange={e => setFormData({ ...formData, day_number: parseInt(e.target.value) || 1 })}
                                            required
                                        />
                                    </div>
                                    <div style={{ gridColumn: window.innerWidth <= 600 ? 'span 1' : 'span 1', display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={formData.is_combined} 
                                                onChange={e => setFormData({ ...formData, is_combined: e.target.checked })} 
                                                style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                            />
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Combined Challenge (Multi-Part)</span>
                                        </label>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label htmlFor="challenge-title-input" className="form-label">Challenge Title</label>
                                    <input
                                        id="challenge-title-input"
                                        name="title"
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. Reverse a String"
                                        value={formData.title}
                                        onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                                        required
                                    />
                                </div>

                                {!formData.is_combined ? (
                                    <>
                                        <div style={{ marginBottom: '1.25rem' }}>
                                            <label htmlFor="problem-statement" className="form-label">Problem Statement (Markdown supported)</label>
                                            <textarea id="problem-statement" name="problem_statement" className="form-input" rows={4} placeholder="Describe the problem clearly..." value={formData.problem_statement} onChange={e => setFormData(p => ({ ...p, problem_statement: e.target.value }))} required style={{ resize: 'vertical' }} />
                                        </div>

                                <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                    <div>
                                        <label htmlFor="starter-code" className="form-label">Starter Code</label>
                                        {formData.language === 'html' ? (
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                                                <div style={{ display: 'flex', background: '#e2e8f0', borderBottom: '1px solid #cbd5e1' }}>
                                                    <button type="button" onClick={() => setWebTab('html')} style={{ padding: '0.4rem 1rem', background: webTab === 'html' ? 'white' : 'transparent', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>HTML</button>
                                                    <button type="button" onClick={() => setWebTab('css')} style={{ padding: '0.4rem 1rem', background: webTab === 'css' ? 'white' : 'transparent', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>CSS</button>
                                                    <button type="button" onClick={() => setWebTab('js')} style={{ padding: '0.4rem 1rem', background: webTab === 'js' ? 'white' : 'transparent', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>JS</button>
                                                </div>
                                                <div style={{ height: '180px', background: '#1e293b' }}>
                                                    {webTab === 'html' && (
                                                        <CodeEditor value={starterWebCode.html} onChange={e => setStarterWebCode(p => ({ ...p, html: e.target.value }))} language="html" placeholder="Initial HTML..." />
                                                    )}
                                                    {webTab === 'css' && (
                                                        <CodeEditor value={starterWebCode.css} onChange={e => setStarterWebCode(p => ({ ...p, css: e.target.value }))} language="css" placeholder="Initial CSS..." />
                                                    )}
                                                    {webTab === 'js' && (
                                                        <CodeEditor value={starterWebCode.js} onChange={e => setStarterWebCode(p => ({ ...p, js: e.target.value }))} language="js" placeholder="Initial JS..." />
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ height: '180px', background: '#1e293b', borderRadius: 8, overflow: 'hidden' }}>
                                                <CodeEditor value={formData.starter_code} onChange={e => setFormData(p => ({ ...p, starter_code: e.target.value }))} language={formData.language} placeholder="Initial code..." />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label htmlFor="constraints" className="form-label">Constraints</label>
                                        <textarea id="constraints" name="constraints" className="form-input" rows={6} placeholder="e.g. 1 <= N <= 10^5" value={formData.constraints} onChange={e => setFormData(p => ({ ...p, constraints: e.target.value }))} style={{ resize: 'none' }} />
                                    </div>
                                </div>

                                <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>Solution Code (Optional)</label>
                                    <div style={{ height: '180px', background: '#1e293b', borderRadius: 8, overflow: 'hidden' }}>
                                        <CodeEditor value={formData.solution_code} onChange={e => setFormData(p => ({ ...p, solution_code: e.target.value }))} language={formData.language} placeholder="Correct answer..." />
                                    </div>
                                </div>

                                {/* Open / Close Time */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                    <div>
                                        <label htmlFor="open-time" className="form-label">Open Time <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                                        <div style={{ position: 'relative' }}>
                                            <Calendar size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input id="open-time" name="open_time" type="datetime-local" className="form-input" style={{ paddingLeft: '2.2rem' }}
                                                value={formData.open_time}
                                                onChange={e => setFormData(p => ({ ...p, open_time: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label htmlFor="close-time" className="form-label">Close Time <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                                        <div style={{ position: 'relative' }}>
                                            <Clock size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input id="close-time" name="close_time" type="datetime-local" className="form-input" style={{ paddingLeft: '2.2rem' }}
                                                value={formData.close_time}
                                                min={formData.open_time || undefined}
                                                onChange={e => setFormData(p => ({ ...p, close_time: e.target.value }))}
                                            />
                                        </div>
                                        {formData.open_time && formData.close_time && (() => {
                                            const mins = Math.round((new Date(formData.close_time) - new Date(formData.open_time)) / 60000)
                                            return mins > 0 ? <div style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600, marginTop: '0.3rem' }}>⏱ {mins} min window</div> : null
                                        })()}
                                    </div>
                                </div>

                                <div style={{ marginBottom: '1.25rem' }}>
                                    <label htmlFor="target-visual" className="form-label">Target Visual Output (URL) <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                                    <input
                                        id="target-visual"
                                        name="target_visual_url"
                                        type="text"
                                        className="form-input"
                                        placeholder="Link to an image or video for the student to replicate"
                                        value={formData.target_visual_url}
                                        onChange={e => setFormData(p => ({ ...p, target_visual_url: e.target.value }))}
                                    />
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Useful for HTML/CSS challenges where students need a visual goal.</p>
                                </div>

                                <div style={{ marginBottom: '1.5rem' }}>
                                    <label htmlFor="allowed-assets" className="form-label">Allowed Assets <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                                    <textarea
                                        id="allowed-assets"
                                        name="allowed_assets"
                                        className="form-input"
                                        rows={3}
                                        placeholder="List links (one per line) students can copy-paste (images, fonts, etc.)"
                                        value={formData.allowed_assets}
                                        onChange={e => setFormData(p => ({ ...p, allowed_assets: e.target.value }))}
                                    />
                                </div>

                                <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', background: '#f8fafc' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Test Cases</h4>
                                        <button type="button" onClick={() => setFormData(p => ({ ...p, test_cases: [...p.test_cases, { input: '', expected_output: '', is_hidden: false }] }))} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                                            <Plus size={14} /> Add Test Case
                                        </button>
                                    </div>
                                    {formData.test_cases.map((tc, idx) => (
                                        <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem', marginBottom: '1rem', background: 'white' }}>
                                            <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <label htmlFor={`tc-input-${idx}`} style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>INPUT (STDIN)</label>
                                                    <textarea id={`tc-input-${idx}`} className="form-input" placeholder="Input" rows={2} value={tc.input} onChange={e => {
                                                        const newTCData = [...formData.test_cases]; newTCData[idx].input = e.target.value; setFormData(p => ({ ...p, test_cases: newTCData }))
                                                    }} style={{ fontSize: '0.8rem' }} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                    <label htmlFor={`tc-output-${idx}`} style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>EXPECTED OUTPUT (STDOUT)</label>
                                                    <textarea id={`tc-output-${idx}`} className="form-input" placeholder="Expected Output" rows={2} value={tc.expected_output} onChange={e => {
                                                        const newTCData = [...formData.test_cases]; newTCData[idx].expected_output = e.target.value; setFormData(p => ({ ...p, test_cases: newTCData }))
                                                    }} style={{ fontSize: '0.8rem' }} />
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', paddingTop: '1.25rem' }}>
                                                    <label htmlFor={`tc-hidden-${idx}`} style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>HIDDEN</label>
                                                    <input
                                                        id={`tc-hidden-${idx}`}
                                                        type="checkbox"
                                                        checked={tc.is_hidden}
                                                        onChange={e => {
                                                            const newTCData = [...formData.test_cases]; newTCData[idx].is_hidden = e.target.checked; setFormData(p => ({ ...p, test_cases: newTCData }))
                                                        }}
                                                    />
                                                </div>
                                                <button type="button" onClick={() => setFormData(p => ({ ...p, test_cases: p.test_cases.filter((_, i) => i !== idx) }))} style={{ background: 'none', border: 'none', color: '#ef4444', padding: '0.5rem', cursor: 'pointer', alignSelf: 'flex-start', marginTop: '1.25rem' }}>
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>

                                            {formData.language === 'html' && (
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingTop: '0.75rem', borderTop: '1px dashed #e2e8f0' }}>
                                                    {['input_image_url', 'output_image_url'].map(field => (
                                                        <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                                                                {field === 'input_image_url' ? 'Input Design Mockup' : 'Target Result Image'}
                                                            </span>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                                <div style={{ 
                                                                    width: 60, 
                                                                    height: 60, 
                                                                    borderRadius: 8, 
                                                                    background: '#f1f5f9', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center',
                                                                    overflow: 'hidden',
                                                                    border: '1px solid #e2e8f0',
                                                                    flexShrink: 0
                                                                }}>
                                                                    {tc[field] ? (
                                                                        <img src={tc[field]} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    ) : (
                                                                        <ImageIcon size={20} color="#cbd5e1" />
                                                                    )}
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    className="form-input"
                                                                    placeholder="Image URL"
                                                                    value={tc[field] || ''}
                                                                    onChange={e => {
                                                                        const newTCData = [...formData.test_cases]
                                                                        newTCData[idx][field] = e.target.value
                                                                        setFormData(p => ({ ...p, test_cases: newTCData }))
                                                                    }}
                                                                    style={{ fontSize: '0.75rem' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                </>
                                ) : (
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', background: '#f8fafc' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sub-Questions</h4>
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, sub_questions: [...p.sub_questions, { id: 'q' + (p.sub_questions.length + 1), title: '', problem_statement: '', starter_code: '', solution_code: '', xp_reward: 15, test_cases: [{ input: '', expected_output: '', is_hidden: false }] }] }))} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                                                <Plus size={14} /> Add Question
                                            </button>
                                        </div>
                                        {formData.sub_questions.map((q, qIdx) => (
                                            <div key={qIdx} style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem', background: 'white' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <h5 style={{ fontWeight: 700 }}>Question {qIdx + 1}</h5>
                                                    <button type="button" onClick={() => setFormData(p => ({ ...p, sub_questions: p.sub_questions.filter((_, i) => i !== qIdx) }))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '1rem', marginBottom: '1rem' }}>
                                                    <div>
                                                        <label className="form-label">Title</label>
                                                        <input className="form-input" value={q.title} onChange={e => { const sq = [...formData.sub_questions]; sq[qIdx].title = e.target.value; setFormData(p => ({ ...p, sub_questions: sq })) }} required />
                                                    </div>
                                                    <div>
                                                        <label className="form-label">XP Reward</label>
                                                        <input type="number" className="form-input" value={q.xp_reward} onChange={e => { const sq = [...formData.sub_questions]; sq[qIdx].xp_reward = parseInt(e.target.value) || 0; setFormData(p => ({ ...p, sub_questions: sq })) }} required />
                                                    </div>
                                                </div>
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label className="form-label">Problem Statement</label>
                                                    <textarea className="form-input" rows={3} value={q.problem_statement} onChange={e => { const sq = [...formData.sub_questions]; sq[qIdx].problem_statement = e.target.value; setFormData(p => ({ ...p, sub_questions: sq })) }} required />
                                                </div>
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label className="form-label">Starter Code</label>
                                                    <div style={{ height: '120px', background: '#1e293b', borderRadius: 8, overflow: 'hidden' }}>
                                                        <CodeEditor value={q.starter_code} onChange={e => { const sq = [...formData.sub_questions]; sq[qIdx].starter_code = e.target.value; setFormData(p => ({ ...p, sub_questions: sq })) }} language={formData.language} placeholder="Initial code..." />
                                                    </div>
                                                </div>
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label className="form-label">Solution Code (Optional)</label>
                                                    <div style={{ height: '120px', background: '#1e293b', borderRadius: 8, overflow: 'hidden' }}>
                                                        <CodeEditor value={q.solution_code || ''} onChange={e => { const sq = [...formData.sub_questions]; sq[qIdx].solution_code = e.target.value; setFormData(p => ({ ...p, sub_questions: sq })) }} language={formData.language} placeholder="Correct answer..." />
                                                    </div>
                                                </div>
                                                <div style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: 8 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                        <strong style={{ fontSize: '0.85rem' }}>Test Cases for Q{qIdx + 1}</strong>
                                                        <button type="button" onClick={() => { const sq = [...formData.sub_questions]; sq[qIdx].test_cases.push({ input: '', expected_output: '', is_hidden: false }); setFormData(p => ({ ...p, sub_questions: sq })) }} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>+ TC</button>
                                                    </div>
                                                    {q.test_cases.map((tc, tcIdx) => (
                                                        <div key={tcIdx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                                                            <textarea className="form-input" placeholder="Input" value={tc.input} onChange={e => { const sq = [...formData.sub_questions]; sq[qIdx].test_cases[tcIdx].input = e.target.value; setFormData(p => ({ ...p, sub_questions: sq })) }} style={{ flex: 1, height: '40px', minHeight: '40px' }} />
                                                            <textarea className="form-input" placeholder="Expected" value={tc.expected_output} onChange={e => { const sq = [...formData.sub_questions]; sq[qIdx].test_cases[tcIdx].expected_output = e.target.value; setFormData(p => ({ ...p, sub_questions: sq })) }} style={{ flex: 1, height: '40px', minHeight: '40px' }} />
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                <span style={{ fontSize: '0.6rem' }}>Hide</span>
                                                                <input type="checkbox" checked={tc.is_hidden} onChange={e => { const sq = [...formData.sub_questions]; sq[qIdx].test_cases[tcIdx].is_hidden = e.target.checked; setFormData(p => ({ ...p, sub_questions: sq })) }} />
                                                            </div>
                                                            <button type="button" onClick={() => { const sq = [...formData.sub_questions]; sq[qIdx].test_cases = sq[qIdx].test_cases.filter((_, i) => i !== tcIdx); setFormData(p => ({ ...p, sub_questions: sq })) }} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>Cancel</button>
                                    <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
                                        {saving ? 'Saving...' : (editingId ? <><Save size={18} /> Update</> : <><Plus size={18} /> Create Challenge</>)}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* AI Generation Modal */}
            {showAIModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 700, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f3ff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b5cf6' }}>
                                <Sparkles size={20} />
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>AI Coding Challenge Generator</h2>
                            </div>
                            <button onClick={() => setShowAIModal(false)} style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                            {aiError && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 10, marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
                                    <AlertCircle size={18} /> {aiError}
                                </div>
                            )}

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Select Course</label>
                                <select
                                    className="form-input"
                                    value={aiCourseId}
                                    onChange={e => setAiCourseId(e.target.value)}
                                    style={{ marginBottom: '1rem' }}
                                >
                                    <option value="">-- Choose a course --</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>

                                <label className="form-label">Topic or Content</label>
                                <textarea
                                    className="form-input"
                                    rows={4}
                                    placeholder="e.g. Generate 3 Python challenges about array manipulation..."
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                    style={{ resize: 'none' }}
                                />
                                <div style={{ textAlign: 'right', marginTop: '0.75rem' }}>
                                    <button 
                                        onClick={generateChallengesWithAI} 
                                        className="btn-primary" 
                                        disabled={isGenerating || !aiPrompt.trim()}
                                        style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}
                                    >
                                        {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : <><Sparkles size={18} /> Generate</>}
                                    </button>
                                </div>
                            </div>

                            {generatedChallenges.length > 0 && (
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Review Generated Challenges</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {generatedChallenges.map((c, idx) => (
                                            <div key={idx} style={{ padding: '1rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{idx + 1}. {c.title}</span>
                                                    <span style={{ fontSize: '0.7rem', background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{c.language} • {c.difficulty}</span>
                                                </div>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{c.problem_statement?.substring(0, 100)}...</p>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {Array.isArray(c.test_cases) ? c.test_cases.length : 0} Test Cases
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'white' }}>
                            <button onClick={() => setShowAIModal(false)} className="btn-secondary">Cancel</button>
                            {generatedChallenges.length > 0 && (
                                <button onClick={handleAddAllGenerated} className="btn-primary" disabled={saving} style={{ background: '#10b981', borderColor: '#10b981' }}>
                                    {saving ? 'Saving...' : `Add All ${generatedChallenges.length} Challenges`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
