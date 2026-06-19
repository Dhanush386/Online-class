import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, Edit2, X, Save, AlertCircle, ChevronLeft, HelpCircle, CheckCircle2, Clock, Sparkles, Loader2 } from 'lucide-react'

export default function AssessmentQuestions() {
    const { assessmentId } = useParams()
    const [assessment, setAssessment] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const [formData, setFormData] = useState({
        question_text: '',
        image_url: '',
        image_file: null,
        options: ['', '', '', ''],
        correct_answer: [] // Changed to array for multi-select support
    })
    const [editingId, setEditingId] = useState(null)
    const [groups, setGroups] = useState([])
    const [resourceAccess, setResourceAccess] = useState([])
    const [showLockModal, setShowLockModal] = useState(false)

    // AI Generation states
    const [showAIModal, setShowAIModal] = useState(false)
    const [aiPrompt, setAiPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedQuestions, setGeneratedQuestions] = useState([])
    const [aiError, setAiError] = useState('')

    useEffect(() => {
        if (assessmentId) {
            loadData()
        }
    }, [assessmentId])

    async function loadData() {
        const [
            { data: assessData },
            { data: questData },
            { data: groupData },
            { data: accessData }
        ] = await Promise.all([
            supabase.from('assessments').select('*, courses(title)').eq('id', assessmentId).single(),
            supabase.from('questions').select('*').eq('assessment_id', assessmentId).order('created_at', { ascending: true }),
            supabase.from('groups').select('*').in('course_id', [assessmentId]), // This is wrong, need courseId from assessmentId
            supabase.from('resource_access').select('*').eq('resource_id', assessmentId).eq('resource_type', 'assessment')
        ])

        // Correction: Need to get course_id first or use a join
        const { data: aData } = await supabase.from('assessments').select('course_id').eq('id', assessmentId).single()
        if (aData) {
            const { data: gData } = await supabase.from('groups').select('*').eq('course_id', aData.course_id)
            setGroups(gData || [])
        }

        setAssessment(assessData)
        setQuestions(questData || [])
        setResourceAccess(accessData || [])
        setLoading(false)
    }

    async function toggleResourceLock(groupId) {
        const existing = resourceAccess.find(a => a.group_id === groupId && a.resource_id === assessmentId)
        try {
            if (existing) {
                const { error } = await supabase.from('resource_access')
                    .update({ is_locked: !existing.is_locked })
                    .eq('resource_id', assessmentId)
                    .eq('group_id', groupId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('resource_access')
                    .insert({
                        resource_id: assessmentId,
                        resource_type: 'assessment',
                        group_id: groupId,
                        is_locked: true
                    })
                if (error) throw error
            }
            // Reload access data
            const { data } = await supabase.from('resource_access').select('*').eq('resource_id', assessmentId).eq('resource_type', 'assessment')
            setResourceAccess(data || [])
        } catch (err) {
            console.error('Error toggling lock:', err)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (formData.options.some(opt => !opt.trim())) { setError('All options are required'); return }
        if (formData.correct_answer.length === 0) { setError('Please select at least one correct answer'); return }

        setSaving(true)
        setError('')

        try {
            let finalImageUrl = formData.image_url;

            if (formData.image_file) {
                const file = formData.image_file;
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                const filePath = `questions/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('study-materials')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('study-materials')
                    .getPublicUrl(filePath);
                
                finalImageUrl = publicUrl;
            }

            const payload = {
                assessment_id: assessmentId,
                question_text: formData.question_text,
                image_url: finalImageUrl || null,
                options: formData.options,
                // Store as JSON string if it's an array to support multi-choice cleanly
                correct_answer: JSON.stringify(formData.correct_answer)
            }

            if (editingId) {
                const { error } = await supabase.from('questions').update(payload).eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('questions').insert(payload)
                if (error) throw error
            }

            setShowModal(false)
            resetForm()
            loadData()
        } catch (err) {
            setError(err.message || 'Failed to save question')
        } finally {
            setSaving(false)
        }
    }

    async function generateQuestionsWithAI() {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        setAiError('');
        setGeneratedQuestions([]);

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error("Gemini API key is not configured.");

            const prompt = `You are an expert educator. Create multiple-choice questions based on the following topic or text: "${aiPrompt}". 
            Output the response strictly as a JSON array of objects. Do not include any markdown formatting like \`\`\`json.
            Each object must follow this exact structure:
            {
                "question_text": "The question here",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": ["Option A"]
            }`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error?.message || 'Failed to generate questions');

            let responseText = data.candidates[0].content.parts[0].text;
            
            // Clean up possible markdown wrappers
            responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            
            const parsedQuestions = JSON.parse(responseText);
            if (!Array.isArray(parsedQuestions)) throw new Error("AI did not return an array.");
            
            setGeneratedQuestions(parsedQuestions);
        } catch (err) {
            console.error(err);
            setAiError(err.message || 'Error parsing AI response. Please try a clearer prompt.');
        } finally {
            setIsGenerating(false);
        }
    }

    async function handleAddAllGenerated() {
        if (generatedQuestions.length === 0) return;
        setSaving(true);
        try {
            const payloads = generatedQuestions.map(q => ({
                assessment_id: assessmentId,
                question_text: q.question_text,
                options: q.options,
                correct_answer: JSON.stringify(q.correct_answer || [])
            }));

            const { error } = await supabase.from('questions').insert(payloads);
            if (error) throw error;

            setShowAIModal(false);
            setAiPrompt('');
            setGeneratedQuestions([]);
            loadData();
        } catch (err) {
            alert('Failed to save AI questions: ' + err.message);
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id) {
        if (!confirm('Delete this question?')) return
        const { error } = await supabase.from('questions').delete().eq('id', id)
        if (!error) {
            setQuestions(questions.filter(q => q.id !== id))
        } else {
            alert('Error deleting: ' + error.message)
        }
    }
    function openEdit(q) {
        let correctAnswers = []
        try {
            // Support both old string format and new JSON array format
            if (q.correct_answer?.startsWith('[') && q.correct_answer?.endsWith(']')) {
                correctAnswers = JSON.parse(q.correct_answer)
            } else if (q.correct_answer) {
                correctAnswers = [q.correct_answer]
            }
        } catch (e) {
            correctAnswers = [q.correct_answer]
        }

        setEditingId(q.id)
        setFormData({
            question_text: q.question_text,
            image_url: q.image_url || '',
            image_file: null,
            options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
            correct_answer: correctAnswers
        })
        setShowModal(true)
    }

    function resetForm() {
        setFormData({ question_text: '', image_url: '', image_file: null, options: ['', '', '', ''], correct_answer: [] })
        setEditingId(null)
        setError('')
    }

    if (loading && !assessment) return <div style={{ padding: '2rem' }}>Loading assessment...</div>

    return (
        <div className="animate-fade-in">
            {/* Header */}
            {/* Header */}
            <div style={{ 
                position: 'sticky', 
                top: 0, 
                zIndex: 30, 
                background: 'rgba(248, 250, 252, 0.8)', 
                backdropFilter: 'blur(8px)',
                padding: '1.5rem 2rem',
                margin: '-1.5rem -2rem 2rem -2rem',
                borderBottom: '1px solid var(--card-border)'
            }}>
                <Link to="/organizer/assessments" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#6366f1', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                    <ChevronLeft size={16} /> Back to Assessments
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{assessment?.title}</h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            {assessment?.courses?.title} • {questions.length} Questions
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={() => { setAiPrompt(''); setGeneratedQuestions([]); setShowAIModal(true) }}
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
                            <Plus size={18} /> Add Question
                        </button>
                        <button
                            onClick={() => setShowLockModal(true)}
                            className="btn-secondary"
                            style={{ gap: '0.5rem' }}
                        >
                            <Clock size={18} /> Access Control
                        </button>
                    </div>
                </div>
            </div>

            {/* Questions List */}
            {questions.length === 0 ? (
                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>
                    <HelpCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.2, display: 'block' }} />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Questions Yet</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Start building your quiz by adding the first question.</p>
                    <button onClick={() => setShowModal(true)} className="btn-secondary" style={{ marginBottom: '0.75rem' }}>
                        <Plus size={18} /> Add Multiple Choice Question
                    </button>
                    <button onClick={() => { setAiPrompt(''); setGeneratedQuestions([]); setShowAIModal(true) }} className="btn-secondary" style={{ background: '#f5f3ff', color: '#8b5cf6', borderColor: '#ddd6fe' }}>
                        <Sparkles size={18} /> Generate with AI
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {questions.map((q, idx) => (
                        <div key={q.id} className="glass-card" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ width: 28, height: 28, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                                        {idx + 1}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{q.question_text}</h4>
                                        {q.image_url && (
                                            <img src={q.image_url} alt="Question reference" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--card-border)', alignSelf: 'flex-start' }} />
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem', alignSelf: 'flex-start' }}>
                                    <button onClick={() => openEdit(q)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.4rem' }}>
                                        <Edit2 size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(q.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginLeft: '2.75rem' }}>
                                {q.options.map((opt, i) => {
                                    let isCorrect = false
                                    try {
                                        if (q.correct_answer?.startsWith('[') && q.correct_answer?.endsWith(']')) {
                                            isCorrect = JSON.parse(q.correct_answer).includes(opt)
                                        } else {
                                            isCorrect = opt === q.correct_answer
                                        }
                                    } catch (e) {
                                        isCorrect = opt === q.correct_answer
                                    }

                                    return (
                                        <div key={i} style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: 10,
                                            background: isCorrect ? '#ecfdf5' : '#f8fafc',
                                            border: `1px solid ${isCorrect ? '#10b98140' : '#e2e8f0'}`,
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            color: isCorrect ? '#065f46' : 'var(--text-primary)'
                                        }}>
                                            <div style={{ width: 18, height: 18, background: isCorrect ? '#10b981' : '#cbd5e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                                                {isCorrect ? <CheckCircle2 size={12} /> : String.fromCharCode(65 + i)}
                                            </div>
                                            {opt}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                    
                    {/* Add Question Button at the Bottom */}
                    <div style={{ textAlign: 'center', marginTop: '1rem', padding: '2rem', border: '2px dashed var(--card-border)', borderRadius: 16 }}>
                        <button
                            onClick={() => { resetForm(); setShowModal(true) }}
                            className="btn-secondary"
                            style={{ gap: '0.5rem', padding: '0.75rem 2rem' }}
                        >
                            <Plus size={18} /> Add Next Question
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 600, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {editingId ? 'Edit Question' : 'New Question'}
                            </h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                            {error && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 10, marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
                                    <AlertCircle size={18} /> {error}
                                </div>
                            )}

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label htmlFor="question-text" className="form-label">Question Text</label>
                                <textarea
                                    id="question-text"
                                    name="question_text"
                                    className="form-input"
                                    rows={3}
                                    placeholder="Enter the question..."
                                    value={formData.question_text}
                                    onChange={e => setFormData(p => ({ ...p, question_text: e.target.value }))}
                                    required
                                    style={{ resize: 'none' }}
                                    autoFocus
                                />
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <label className="form-label" style={{ marginBottom: 0 }}>Image (optional)</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                            type="button" 
                                            onClick={() => setFormData(p => ({ ...p, image_file: null }))}
                                            style={{ fontSize: '0.7rem', background: 'none', border: 'none', color: !formData.image_file ? '#6366f1' : 'var(--text-muted)', fontWeight: !formData.image_file ? 700 : 500, cursor: 'pointer' }}
                                        >URL</button>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>|</span>
                                        <button 
                                            type="button" 
                                            onClick={() => document.getElementById('question-image-upload').click()}
                                            style={{ fontSize: '0.7rem', background: 'none', border: 'none', color: formData.image_file ? '#6366f1' : 'var(--text-muted)', fontWeight: formData.image_file ? 700 : 500, cursor: 'pointer' }}
                                        >Desktop Upload</button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column' }}>
                                    {formData.image_file ? (
                                        <div style={{ padding: '0.75rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                                                <span style={{ fontWeight: 600 }}>{formData.image_file.name}</span>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({(formData.image_file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                            </div>
                                            <button type="button" onClick={() => setFormData(p => ({ ...p, image_file: null }))} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                                            <input
                                                id="image-url"
                                                name="image_url"
                                                type="url"
                                                className="form-input"
                                                placeholder="https://example.com/image.png"
                                                value={formData.image_url}
                                                onChange={e => setFormData(p => ({ ...p, image_url: e.target.value }))}
                                            />
                                            {formData.image_url && (
                                                <img src={formData.image_url} alt="Preview" style={{ height: '42px', width: '42px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--card-border)', flexShrink: 0 }} onError={(e) => e.target.style.display = 'none'} />
                                            )}
                                        </div>
                                    )}
                                    <input 
                                        id="question-image-upload"
                                        type="file" 
                                        style={{ display: 'none' }} 
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files[0]
                                            if (file) {
                                                setFormData(p => ({ ...p, image_file: file, image_url: '' }))
                                            }
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <label className="form-label" style={{ marginBottom: 0 }}>Options & Correct Answers</label>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(p => ({ ...p, options: [...p.options, ''] }))}
                                        style={{ fontSize: '0.75rem', color: '#6366f1', background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                    >
                                        <Plus size={14} /> Add Option
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {formData.options.map((opt, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ flexShrink: 0 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={formData.correct_answer.includes(opt) && opt !== ''}
                                                    onChange={(e) => {
                                                        const isChecked = e.target.checked
                                                        setFormData(p => {
                                                            const newAnswers = isChecked 
                                                                ? [...p.correct_answer, opt]
                                                                : p.correct_answer.filter(val => val !== opt)
                                                            return { ...p, correct_answer: newAnswers }
                                                        })
                                                    }}
                                                    disabled={!opt.trim()}
                                                    style={{ width: 18, height: 18, cursor: opt.trim() ? 'pointer' : 'default' }}
                                                />
                                            </div>
                                            <div style={{ flex: 1, position: 'relative' }}>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                                    value={opt}
                                                    onChange={e => {
                                                        const newOpts = [...formData.options]
                                                        const oldVal = newOpts[i]
                                                        newOpts[i] = e.target.value
                                                        
                                                        setFormData(p => ({
                                                            ...p,
                                                            options: newOpts,
                                                            correct_answer: p.correct_answer.map(val => val === oldVal ? e.target.value : val)
                                                        }))
                                                    }}
                                                    required
                                                />
                                                {formData.options.length > 2 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newOpts = formData.options.filter((_, idx) => idx !== i)
                                                            setFormData(p => ({
                                                                ...p,
                                                                options: newOpts,
                                                                correct_answer: p.correct_answer.filter(val => val !== opt)
                                                            }))
                                                        }}
                                                        style={{ position: 'absolute', right: -30, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary" style={{ padding: '0.6rem 1.25rem' }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.6rem 1.5rem', gap: '0.5rem' }}>
                                    {saving ? 'Saving...' : (editingId ? <><Save size={18} /> Update</> : <><Plus size={18} /> Add Question</>)}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* AI Generation Modal */}
            {showAIModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 700, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f3ff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b5cf6' }}>
                                <Sparkles size={20} />
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>AI Question Generator</h2>
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
                                <label className="form-label">Topic or Content</label>
                                <textarea
                                    className="form-input"
                                    rows={4}
                                    placeholder="e.g. Generate 5 multiple choice questions about React Hooks..."
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                    style={{ resize: 'none' }}
                                />
                                <div style={{ textAlign: 'right', marginTop: '0.75rem' }}>
                                    <button 
                                        onClick={generateQuestionsWithAI} 
                                        className="btn-primary" 
                                        disabled={isGenerating || !aiPrompt.trim()}
                                        style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}
                                    >
                                        {isGenerating ? <><Loader2 size={18} className="animate-spin" /> Generating...</> : <><Sparkles size={18} /> Generate</>}
                                    </button>
                                </div>
                            </div>

                            {generatedQuestions.length > 0 && (
                                <div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>Review Generated Questions</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {generatedQuestions.map((q, idx) => (
                                            <div key={idx} style={{ padding: '1rem', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem' }}>{idx + 1}. {q.question_text}</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                                                    {q.options.map((opt, oIdx) => {
                                                        const isCorrect = Array.isArray(q.correct_answer) ? q.correct_answer.includes(opt) : opt === q.correct_answer;
                                                        return (
                                                            <div key={oIdx} style={{ padding: '0.4rem 0.6rem', background: isCorrect ? '#ecfdf5' : 'white', border: `1px solid ${isCorrect ? '#10b981' : '#cbd5e1'}`, borderRadius: 6, color: isCorrect ? '#065f46' : 'var(--text-secondary)' }}>
                                                                {opt}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', background: 'white' }}>
                            <button onClick={() => setShowAIModal(false)} className="btn-secondary">Cancel</button>
                            {generatedQuestions.length > 0 && (
                                <button onClick={handleAddAllGenerated} className="btn-primary" disabled={saving} style={{ background: '#10b981', borderColor: '#10b981' }}>
                                    {saving ? 'Saving...' : `Add All ${generatedQuestions.length} Questions`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Access Control Modal */}
            {showLockModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card zoom-in" style={{ width: '100%', maxWidth: 450, padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Access Control</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{assessment?.title}</p>
                            </div>
                            <button onClick={() => setShowLockModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '1.5rem', maxHeight: '60vh', overflowY: 'auto' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                                Toggle locks for specific groups. Locked resources are invisible/non-accessible to students in that group.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {groups.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                        No groups created for this course.
                                    </div>
                                ) : (
                                    groups.map(g => {
                                        const access = resourceAccess.find(a => a.group_id === g.id && a.resource_id === assessmentId)
                                        const isLocked = access?.is_locked || false
                                        return (
                                            <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: isLocked ? '#fff1f2' : '#f0fdf4', borderRadius: 10, border: `1px solid ${isLocked ? '#fecaca' : '#bbf7d0'}` }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isLocked ? '#991b1b' : '#166534' }}>{g.name}</div>
                                                <button
                                                    onClick={() => toggleResourceLock(g.id)}
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
                            <button onClick={() => setShowLockModal(false)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
