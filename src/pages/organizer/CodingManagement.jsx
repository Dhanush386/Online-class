import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Plus, Code, Trash2, Edit2, X, Save, AlertCircle, BookOpen, Search, Filter, Calendar, Clock } from 'lucide-react'

const LANGUAGES = [
    { id: 'html', name: 'HTML/CSS/JS (Web)', icon: '🌐' },
    { id: 'python', name: 'Python 3', icon: '🐍' },
    { id: 'java', name: 'Java', icon: '☕' },
    { id: 'cpp', name: 'C++', icon: '⚙️' },
    { id: 'c', name: 'C', icon: '📄' },
    { id: 'sql', name: 'SQL (SQLite)', icon: '💾' }
]

const DIFFICULTIES = ['easy', 'medium', 'hard']

// Organizer Coding Management Page
export default function CodingManagement() {
    const { profile } = useAuth()
    const [courses, setCourses] = useState([])
    const [challenges, setChallenges] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [editingId, setEditingId] = useState(null)

    const [formData, setFormData] = useState({
        title: '', description: '', problem_statement: '',
        course_id: '', language: 'python', difficulty: 'easy',
        starter_code: '', constraints: '', input_format: '', output_format: '',
        xp_reward: 15, open_time: '', close_time: '',
        test_cases: [{ input: '', expected_output: '', is_hidden: false }]
    })

    useEffect(() => {
        if (profile?.id) {
            loadInitialData()
        }
    }, [profile])

    async function loadInitialData() {
        setLoading(true)
        const [{ data: courseData }, { data: challengeData }] = await Promise.all([
            supabase.from('courses').select('id, title').eq('organizer_id', profile.id),
            supabase.from('coding_challenges').select('*, courses(title)').order('created_at', { ascending: false })
        ])

        setCourses(courseData || [])
        setChallenges(challengeData || [])
        setLoading(false)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!formData.course_id) { setError('Please select a course'); return }

        setSaving(true)
        setError('')

        try {
            const payload = {
                ...formData,
                test_cases: formData.test_cases.filter(tc => tc.expected_output.trim() !== ''),
                open_time: formData.open_time ? new Date(formData.open_time).toISOString() : null,
                close_time: formData.close_time ? new Date(formData.close_time).toISOString() : null,
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

    function toLocalInput(utcStr) {
        if (!utcStr) return ''
        const d = new Date(utcStr)
        const pad = n => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }

    function openEdit(c) {
        setEditingId(c.id)
        setFormData({
            title: c.title, description: c.description || '',
            problem_statement: c.problem_statement, course_id: c.course_id,
            language: c.language, difficulty: c.difficulty,
            starter_code: c.starter_code || '', constraints: c.constraints || '',
            input_format: c.input_format || '', output_format: c.output_format || '',
            xp_reward: c.xp_reward || 15,
            open_time: toLocalInput(c.open_time),
            close_time: toLocalInput(c.close_time),
            test_cases: c.test_cases || [{ input: '', expected_output: '', is_hidden: false }]
        })
        setShowModal(true)
    }

    function resetForm() {
        setFormData({
            title: '', description: '', problem_statement: '',
            course_id: '', language: 'python', difficulty: 'easy',
            starter_code: '', constraints: '', input_format: '', output_format: '',
            xp_reward: 15, open_time: '', close_time: '',
            test_cases: [{ input: '', expected_output: '', is_hidden: false }]
        })
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
                <button
                    onClick={() => { resetForm(); setShowModal(true) }}
                    className="btn-primary"
                    style={{ gap: '0.5rem' }}
                >
                    <Plus size={18} /> Create Challenge
                </button>
            </div>

            {/* Filters & Search */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
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
                    <button onClick={() => setShowModal(true)} className="btn-secondary">
                        <Plus size={18} /> Add Your First Challenge
                    </button>
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
                                    <button onClick={() => openEdit(c)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem' }}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>{c.title}</h3>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <BookOpen size={12} /> {c.courses?.title} • {c.difficulty.toUpperCase()}
                            </div>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, height: '2.5rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '1rem' }}>
                                {c.description || 'No description provided.'}
                            </p>
                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.test_cases?.length || 0} Test Cases</span>
                                <button onClick={() => openEdit(c)} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>View Details</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div className="glass-card animate-scale-in" style={{ width: '90%', maxWidth: 800, maxHeight: '90vh', padding: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {editingId ? 'Edit Challenge' : 'Create New Coding Challenge'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
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
                                    <label className="form-label">Course</label>
                                    <select className="form-input" value={formData.course_id} onChange={e => setFormData(p => ({ ...p, course_id: e.target.value }))} required>
                                        <option value="">Select Course</option>
                                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: window.innerWidth <= 600 ? 'span 1' : 'span 1' }}>
                                    <label className="form-label">Language</label>
                                    <select className="form-input" value={formData.language} onChange={e => setFormData(p => ({ ...p, language: e.target.value }))} required>
                                        {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ gridColumn: window.innerWidth <= 600 ? 'span 1' : 'span 1' }}>
                                    <label className="form-label">Difficulty</label>
                                    <select
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
                                    <label className="form-label">XP Reward</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={formData.xp_reward}
                                        onChange={e => setFormData({ ...formData, xp_reward: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label">Challenge Title</label>
                                <input type="text" className="form-input" placeholder="e.g. Reverse a String" value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} required />
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label className="form-label">Problem Statement (Markdown supported)</label>
                                <textarea className="form-input" rows={4} placeholder="Describe the problem clearly..." value={formData.problem_statement} onChange={e => setFormData(p => ({ ...p, problem_statement: e.target.value }))} required style={{ resize: 'vertical' }} />
                            </div>

                            <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <label className="form-label">Starter Code</label>
                                    <textarea className="form-input" rows={6} placeholder="Inital code for the student..." value={formData.starter_code} onChange={e => setFormData(p => ({ ...p, starter_code: e.target.value }))} style={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
                                </div>
                                <div>
                                    <label className="form-label">Constraints</label>
                                    <textarea className="form-input" rows={6} placeholder="e.g. 1 <= N <= 10^5" value={formData.constraints} onChange={e => setFormData(p => ({ ...p, constraints: e.target.value }))} style={{ resize: 'none' }} />
                                </div>
                            </div>

                            {/* Open / Close Time */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                <div>
                                    <label className="form-label">Open Time <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <Calendar size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input type="datetime-local" className="form-input" style={{ paddingLeft: '2.2rem' }}
                                            value={formData.open_time}
                                            onChange={e => setFormData(p => ({ ...p, open_time: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Close Time <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <Clock size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                        <input type="datetime-local" className="form-input" style={{ paddingLeft: '2.2rem' }}
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

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', background: '#f8fafc' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Test Cases</h4>
                                    <button type="button" onClick={() => setFormData(p => ({ ...p, test_cases: [...p.test_cases, { input: '', expected_output: '', is_hidden: false }] }))} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                                        <Plus size={14} /> Add Test Case
                                    </button>
                                </div>
                                {formData.test_cases.map((tc, idx) => (
                                    <div key={idx} className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                                        <textarea className="form-input" placeholder="Input" rows={2} value={tc.input} onChange={e => {
                                            const newTCData = [...formData.test_cases]; newTCData[idx].input = e.target.value; setFormData(p => ({ ...p, test_cases: newTCData }))
                                        }} style={{ fontSize: '0.8rem' }} />
                                        <textarea className="form-input" placeholder="Expected Output" rows={2} value={tc.expected_output} onChange={e => {
                                            const newTCData = [...formData.test_cases]; newTCData[idx].expected_output = e.target.value; setFormData(p => ({ ...p, test_cases: newTCData }))
                                        }} style={{ fontSize: '0.8rem' }} />
                                        <div style={{ display: 'flex', flexDirection: window.innerWidth <= 768 ? 'row' : 'column', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                                            <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>HIDDEN</label>
                                            <input
                                                type="checkbox"
                                                checked={tc.is_hidden}
                                                onChange={e => {
                                                    const newTCData = [...formData.test_cases]; newTCData[idx].is_hidden = e.target.checked; setFormData(p => ({ ...p, test_cases: newTCData }))
                                                }}
                                            />
                                        </div>
                                        <button type="button" onClick={() => setFormData(p => ({ ...p, test_cases: p.test_cases.filter((_, i) => i !== idx) }))} style={{ background: 'none', border: 'none', color: '#ef4444', padding: '0.5rem', cursor: 'pointer', alignSelf: 'center' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
                                    {saving ? 'Saving...' : (editingId ? <><Save size={18} /> Update</> : <><Plus size={18} /> Create Challenge</>)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
