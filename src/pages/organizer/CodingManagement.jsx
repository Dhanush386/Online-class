import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import CodeEditor from '../../components/CodeEditor'
import { Plus, Code, Trash2, Edit2, X, Save, AlertCircle, BookOpen, Search, Calendar, Clock, Lock, Image as ImageIcon, Upload, Sparkles, Loader2, ShieldAlert, Eye, BarChart3, CheckCircle2, XCircle, Users } from 'lucide-react'
import ProctoringReportModal from '../../components/organizer/ProctoringReportModal'
import OrganizerCodingDiscussions from '../../components/OrganizerCodingDiscussions'
import { toLocalInput, toISOWithOffset, getDefaultUnlockTime } from '../../lib/dateUtils'
import ReactMarkdown from 'react-markdown'

const LANGUAGES = [
    { id: 'html', name: 'HTML/CSS/JS (Web)', icon: '🌐' },
    { id: 'python', name: 'Python 3', icon: '🐍' },
    { id: 'python_ml', name: 'Python (Scientific/ML)', icon: '🧪' },
    { id: 'java', name: 'Java', icon: '☕' },
    { id: 'cpp', name: 'C++', icon: '⚙️' },
    { id: 'c', name: 'C', icon: '📄' },
    { id: 'sql', name: 'SQL (SQLite)', icon: '💾' }
]

const DIFFICULTIES = ['beginner', 'easy', 'medium', 'hard', 'advanced', 'expert']

// Organizer Coding Management Page

const getTabColor = (t) => {
    if (t === 'html') return '#ef4444';
    if (t === 'css') return '#3b82f6';
    return '#f59e0b';
};

const getDifficultyColor = (diff) => {
    if (diff === 'beginner') return '#06b6d4';
    if (diff === 'easy') return '#10b981';
    if (diff === 'medium') return '#f59e0b';
    if (diff === 'hard') return '#ef4444';
    if (diff === 'advanced') return '#8b5cf6';
    if (diff === 'expert') return '#dc2626';
    return '#6b7280';
};

const getRiskBg = (score) => {
    if (score >= 100) return '#fef2f2';
    if (score >= 60) return '#fff7ed';
    return '#ecfdf5';
};

const getRiskColor = (score) => {
    if (score >= 100) return '#ef4444';
    if (score >= 60) return '#f97316';
    return '#10b981';
};

const getRiskBorder = (score) => {
    if (score >= 100) return '#fecaca';
    if (score >= 60) return '#ffedd5';
    return '#a7f3d0';
};

function HtmlSpecificOptions({ formData, setFormData, wcTab, setWcTab }) {
    const handleRemoveHtml = (idx) => {
        setFormData(p => ({
            ...p,
            web_testcases: { ...p.web_testcases, html: p.web_testcases.html.filter((_, i) => i !== idx) }
        }))
    }
    const handleUpdateHtml = (idx, field, value) => {
        setFormData(p => {
            const arr = [...(p.web_testcases?.html || [])]
            arr[idx] = { ...arr[idx], [field]: value }
            return { ...p, web_testcases: { ...p.web_testcases, html: arr } }
        })
    }
    const handleAddHtml = () => {
        setFormData(p => ({
            ...p,
            web_testcases: { ...p.web_testcases, html: [...(p.web_testcases?.html || []), { id: crypto.randomUUID(), description: '', selector: '', minCount: 1 }] }
        }))
    }
    const handleRemoveCss = (idx) => {
        setFormData(p => ({
            ...p,
            web_testcases: { ...p.web_testcases, css: p.web_testcases.css.filter((_, i) => i !== idx) }
        }))
    }
    const handleUpdateCss = (idx, field, value) => {
        setFormData(p => {
            const arr = [...(p.web_testcases?.css || [])]
            arr[idx] = { ...arr[idx], [field]: value }
            return { ...p, web_testcases: { ...p.web_testcases, css: arr } }
        })
    }
    const handleAddCss = () => {
        setFormData(p => ({
            ...p,
            web_testcases: { ...p.web_testcases, css: [...(p.web_testcases?.css || []), { id: crypto.randomUUID(), description: '', selector: '', property: '', value: '' }] }
        }))
    }
    const handleRemoveJs = (idx) => {
        setFormData(p => ({
            ...p,
            web_testcases: { ...p.web_testcases, js: p.web_testcases.js.filter((_, i) => i !== idx) }
        }))
    }
    const handleUpdateJs = (idx, field, value) => {
        setFormData(p => {
            const arr = [...(p.web_testcases?.js || [])]
            arr[idx] = { ...arr[idx], [field]: value }
            return { ...p, web_testcases: { ...p.web_testcases, js: arr } }
        })
    }
    const handleAddJs = () => {
        setFormData(p => ({
            ...p,
            web_testcases: { ...p.web_testcases, js: [...(p.web_testcases?.js || []), { id: crypto.randomUUID(), description: '', keyword: '' }] }
        }))
    }

    return (
        <>
            {/* Reference iFrame URL */}
            <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid #bfdbfe', borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                    <div style={{ width: 28, height: 28, background: '#3b82f6', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'white', fontSize: '0.7rem', fontWeight: 800 }}>{'<>'}</span>
                    </div>
                    <label htmlFor="reference-iframe-url" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', margin: 0 }}>
                        Reference iFrame URL <span style={{ color: '#60a5fa', fontWeight: 400 }}>(optional)</span>
                    </label>
                </div>
                <input
                    id="reference-iframe-url"
                    name="reference_iframe_url"
                    type="url"
                    className="form-input"
                    placeholder="https://example.com — students see this as a live demo inside the challenge"
                    value={formData.reference_iframe_url}
                    onChange={e => setFormData(p => ({ ...p, reference_iframe_url: e.target.value }))}
                />
                {formData.reference_iframe_url && !formData.reference_iframe_url.startsWith('https://') && (
                    <p style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.35rem', fontWeight: 600 }}>⚠ URL must start with https://</p>
                )}
                <p style={{ fontSize: '0.7rem', color: '#3b82f6', marginTop: '0.35rem' }}>Students see a live embedded demo beside the challenge description — great for "Build this page" tasks.</p>
            </div>

            {/* Frontend Testcase Engine */}
            <div style={{ marginBottom: '1.5rem', border: '1px solid #6366f130', borderRadius: 14, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '1rem 1.25rem', background: 'linear-gradient(135deg, #1e1b4b, #312e81)', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{ width: 32, height: 32, background: '#6366f1', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>🧪</div>
                    <div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff' }}>Frontend Testcase Engine</div>
                        <div style={{ fontSize: '0.68rem', color: '#a5b4fc' }}>HTML DOM · CSS Style · JS Code validation — like HackerRank for frontend</div>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                        {['html', 'css', 'js'].map(t => {
                            const count = (formData.web_testcases?.[t] || []).filter(x => t === 'js' ? x.keyword?.trim() : x.selector?.trim()).length
                            return count > 0 ? (
                                <span key={t} style={{ fontSize: '0.85rem', fontWeight: 700, padding: '0.15rem 0.5rem', background: getTabColor(t), color: 'white', borderRadius: 10 }}>
                                    {t.toUpperCase()} {count}
                                </span>
                            ) : null
                        })}
                    </div>
                </div>

                {/* Tab Bar */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--card-border)', background: 'var(--bg-base)' }}>
                    {[
                        { id: 'html', label: 'HTML DOM', icon: '🏷', color: '#ef4444', desc: 'Check elements exist' },
                        { id: 'css',  label: 'CSS Style', icon: '🎨', color: '#3b82f6', desc: 'Check computed styles' },
                        { id: 'js',   label: 'JS Code',  icon: '⚙', color: '#f59e0b', desc: 'Check code patterns' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setWcTab(tab.id)}
                            style={{
                                flex: 1, padding: '0.85rem 0.5rem', border: 'none', cursor: 'pointer',
                                background: wcTab === tab.id ? 'white' : 'transparent',
                                borderBottom: wcTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
                                color: wcTab === tab.id ? tab.color : 'var(--text-muted)',
                                fontWeight: wcTab === tab.id ? 700 : 500,
                                fontSize: '0.78rem', transition: 'all 0.15s'
                            }}
                        >
                            <span style={{ marginRight: '0.35rem' }}>{tab.icon}</span>{tab.label}
                            <span style={{ marginLeft: '0.35rem', fontSize: '0.6rem', opacity: 0.7 }}>
                                ({(formData.web_testcases?.[tab.id] || []).length})
                            </span>
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div style={{ padding: '1rem', background: 'white' }}>
                    {/* HTML DOM Tab */}
                    {wcTab === 'html' && (
                        <div>
                            <p style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.85rem' }}>
                                Check that specific HTML elements exist by tag name. <code style={{ background: '#f1f5f9', padding: '0 4px', borderRadius: 3 }}>minCount</code> is optional (default: 1).
                            </p>
                            {(formData.web_testcases?.html || []).map((tc, idx) => (
                                <div key={tc.id || `html-tc-${idx}`} style={{ border: '1px solid #fee2e2', borderRadius: 10, padding: '0.85rem', marginBottom: '0.6rem', background: '#fff5f5', position: 'relative' }}>
                                    <button type="button" onClick={() => handleRemoveHtml(idx)}
                                        style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '2px' }}>
                                        <Trash2 size={14} />
                                    </button>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 100px', gap: '0.6rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>DESCRIPTION</div>
                                            <input className="form-input" style={{ fontSize: '0.8rem' }} placeholder="Page should have a main heading"
                                                value={tc.description || ''} onChange={e => handleUpdateHtml(idx, 'description', e.target.value)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#ef4444', display: 'block', marginBottom: '0.25rem' }}>HTML ELEMENT *</div>
                                            <input className="form-input" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }} placeholder="h1, p, button, form"
                                                value={tc.selector || ''} onChange={e => handleUpdateHtml(idx, 'selector', e.target.value)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>MIN COUNT</div>
                                            <input type="number" min="1" className="form-input" style={{ fontSize: '0.8rem' }} placeholder="1"
                                                value={tc.minCount || ''} onChange={e => handleUpdateHtml(idx, 'minCount', Number.parseInt(e.target.value) || 1)} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button"
                                onClick={handleAddHtml}
                                style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1.5px dashed #fca5a5', background: '#fff5f5', color: '#ef4444', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                <Plus size={14} /> Add HTML Testcase
                            </button>
                        </div>
                    )}

                    {/* CSS Style Tab */}
                    {wcTab === 'css' && (
                        <div>
                            <p style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.85rem' }}>
                                Check computed CSS properties. Leave <code style={{ background: '#f1f5f9', padding: '0 4px', borderRadius: 3 }}>Expected Value</code> empty to just check the property is set.
                            </p>
                            {(formData.web_testcases?.css || []).map((tc, idx) => (
                                <div key={tc.id || `css-tc-${idx}`} style={{ border: '1px solid #bfdbfe', borderRadius: 10, padding: '0.85rem', marginBottom: '0.6rem', background: '#eff6ff', position: 'relative' }}>
                                    <button type="button" onClick={() => handleRemoveCss(idx)}
                                        style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer' }}>
                                        <Trash2 size={14} />
                                    </button>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 160px 140px', gap: '0.6rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>DESCRIPTION</div>
                                            <input className="form-input" style={{ fontSize: '0.8rem' }} placeholder="Container should use flexbox"
                                                value={tc.description || ''} onChange={e => handleUpdateCss(idx, 'description', e.target.value)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: '0.25rem' }}>CSS SELECTOR *</div>
                                            <input className="form-input" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }} placeholder=".container"
                                                value={tc.selector || ''} onChange={e => handleUpdateCss(idx, 'selector', e.target.value)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: '0.25rem' }}>CSS PROPERTY *</div>
                                            <input className="form-input" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }} placeholder="display"
                                                value={tc.property || ''} onChange={e => handleUpdateCss(idx, 'property', e.target.value)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>EXPECTED VALUE</div>
                                            <input className="form-input" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }} placeholder="flex"
                                                value={tc.value || ''} onChange={e => handleUpdateCss(idx, 'value', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button"
                                onClick={handleAddCss}
                                style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1.5px dashed #93c5fd', background: '#eff6ff', color: '#3b82f6', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                <Plus size={14} /> Add CSS Testcase
                            </button>
                        </div>
                    )}

                    {/* JS Code Tab */}
                    {wcTab === 'js' && (
                        <div>
                            <p style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: '0.85rem' }}>
                                Check that specific functions, methods, or keywords appear in the student's JavaScript code.
                            </p>
                            {(formData.web_testcases?.js || []).map((tc, idx) => (
                                <div key={tc.id || `js-tc-${idx}`} style={{ border: '1px solid #fde68a', borderRadius: 10, padding: '0.85rem', marginBottom: '0.6rem', background: '#fffbeb', position: 'relative' }}>
                                    <button type="button" onClick={() => handleRemoveJs(idx)}
                                        style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#d97706', cursor: 'pointer' }}>
                                        <Trash2 size={14} />
                                    </button>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: '0.6rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>DESCRIPTION</div>
                                            <input className="form-input" style={{ fontSize: '0.8rem' }} placeholder="Submit button should use addEventListener"
                                                value={tc.description || ''} onChange={e => handleUpdateJs(idx, 'description', e.target.value)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#d97706', display: 'block', marginBottom: '0.25rem' }}>JS KEYWORD *</div>
                                            <input className="form-input" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }} placeholder="addEventListener"
                                                value={tc.keyword || ''} onChange={e => handleUpdateJs(idx, 'keyword', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button type="button"
                                onClick={handleAddJs}
                                style={{ width: '100%', padding: '0.55rem', borderRadius: 8, border: '1.5px dashed #fcd34d', background: '#fffbeb', color: '#d97706', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                <Plus size={14} /> Add JS Testcase
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}

HtmlSpecificOptions.propTypes = {
    formData: PropTypes.shape({
        reference_iframe_url: PropTypes.string,
        web_testcases: PropTypes.shape({
            html: PropTypes.arrayOf(
                PropTypes.shape({
                    id: PropTypes.string,
                    description: PropTypes.string,
                    selector: PropTypes.string,
                    minCount: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
                })
            ),
            css: PropTypes.arrayOf(
                PropTypes.shape({
                    id: PropTypes.string,
                    description: PropTypes.string,
                    selector: PropTypes.string,
                    property: PropTypes.string,
                    value: PropTypes.string
                })
            ),
            js: PropTypes.arrayOf(
                PropTypes.shape({
                    id: PropTypes.string,
                    description: PropTypes.string,
                    keyword: PropTypes.string
                })
            )
        })
    }).isRequired,
    setFormData: PropTypes.func.isRequired,
    wcTab: PropTypes.string.isRequired,
    setWcTab: PropTypes.func.isRequired
}

function StandardTestCases({ formData, setFormData }) {
    const handleAddTestCase = () => {
        setFormData(p => ({
            ...p,
            test_cases: [...p.test_cases, { id: crypto.randomUUID(), input: '', expected_output: '', is_hidden: false }]
        }))
    }

    const handleUpdateTestCase = (idx, field, value) => {
        setFormData(p => {
            const arr = [...p.test_cases]
            arr[idx] = { ...arr[idx], [field]: value }
            return { ...p, test_cases: arr }
        })
    }

    const handleRemoveTestCase = (idx) => {
        setFormData(p => ({
            ...p,
            test_cases: p.test_cases.filter((_, i) => i !== idx)
        }))
    }

    async function handleTCImageUpload(e, idx, field) {
        const file = e.target.files?.[0]
        if (!file) return

        const fileExt = file.name.split('.').pop()
        const fileName = `${crypto.randomUUID().split("-")[0]}-${Date.now()}.${fileExt}`
        const filePath = `challenges/test-cases/${fileName}`

        try {
            const { error: uploadError } = await supabase.storage
                .from('study-materials')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('study-materials')
                .getPublicUrl(filePath)

            setFormData(p => {
                const newTCData = [...p.test_cases]
                newTCData[idx] = { ...newTCData[idx], [field]: publicUrl }
                return { ...p, test_cases: newTCData }
            })
        } catch (err) {
            alert('Error uploading image: ' + err.message)
        }
    }

    return (
        <div style={{ border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', background: 'var(--bg-base)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Test Cases</h4>
                <button type="button" onClick={handleAddTestCase} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                    <Plus size={14} /> Add Test Case
                </button>
            </div>
            {formData.test_cases.map((tc, idx) => (
                <div key={tc.id || `std-tc-${idx}`} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem', marginBottom: '1rem', background: 'white' }}>
                    <div className="stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '0.85rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label htmlFor={`tc-input-${idx}`} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>INPUT (STDIN)</label>
                            <textarea id={`tc-input-${idx}`} className="form-input" placeholder="Input" rows={2} value={tc.input} onChange={e => handleUpdateTestCase(idx, 'input', e.target.value)} style={{ fontSize: '0.8rem' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <label htmlFor={`tc-output-${idx}`} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>EXPECTED OUTPUT (STDOUT)</label>
                            <textarea id={`tc-output-${idx}`} className="form-input" placeholder="Expected Output" rows={2} value={tc.expected_output} onChange={e => handleUpdateTestCase(idx, 'expected_output', e.target.value)} style={{ fontSize: '0.8rem' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', paddingTop: '1.25rem' }}>
                            <label htmlFor={`tc-hidden-${idx}`} style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>HIDDEN</label>
                            <input
                                id={`tc-hidden-${idx}`}
                                type="checkbox"
                                checked={tc.is_hidden}
                                onChange={e => handleUpdateTestCase(idx, 'is_hidden', e.target.checked)}
                            />
                        </div>
                        <button type="button" onClick={() => handleRemoveTestCase(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', padding: '0.5rem', cursor: 'pointer', alignSelf: 'flex-start', marginTop: '1.25rem' }}>
                            <Trash2 size={18} />
                        </button>
                    </div>

                    {formData.language === 'html' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', paddingTop: '0.85rem', borderTop: '1px dashed #e2e8f0' }}>
                            {['input_image_url', 'output_image_url'].map(field => (
                                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase' }}>
                                            {field === 'input_image_url' ? 'Input Design Mockup' : 'Target Result Image'}
                                        </span>
                                        {tc[field] && (
                                            <button 
                                                type="button" 
                                                onClick={() => handleUpdateTestCase(idx, field, '')}
                                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, padding: 0 }}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    
                                    <label style={{ 
                                        position: 'relative',
                                        width: '100%', 
                                        height: 120, 
                                        borderRadius: 8, 
                                        background: 'var(--bg-base)', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        border: '1px dashed #cbd5e1',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}>
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            style={{ display: 'none' }}
                                            onChange={e => handleTCImageUpload(e, idx, field)}
                                        />
                                        {tc[field] ? (
                                            <>
                                                <img src={tc[field]} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                                <div 
                                                    style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} 
                                                    onMouseEnter={e => e.currentTarget.style.opacity = 1} 
                                                    onMouseLeave={e => e.currentTarget.style.opacity = 0}
                                                >
                                                    <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <Upload size={16} /> Change Image
                                                    </span>
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                                                <Upload size={24} color="#94a3b8" />
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Click to upload</span>
                                            </div>
                                        )}
                                    </label>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

StandardTestCases.propTypes = {
    formData: PropTypes.shape({
        language: PropTypes.string,
        test_cases: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.string,
                input: PropTypes.string,
                expected_output: PropTypes.string,
                is_hidden: PropTypes.bool,
                input_image_url: PropTypes.string,
                output_image_url: PropTypes.string
            })
        )
    }).isRequired,
    setFormData: PropTypes.func.isRequired
}

function SubQuestionItem({
    q,
    qIdx,
    language,
    handleRemoveQuestion,
    handleUpdateQuestionField,
    handleAddTestCase,
    handleRemoveTestCase,
    handleUpdateTestCaseField
}) {
    return (
        <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h5 style={{ fontWeight: 700 }}>Question {qIdx + 1}</h5>
                <button type="button" onClick={() => handleRemoveQuestion(qIdx)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                    <label htmlFor={`sq-title-${qIdx}`} className="form-label">Title</label>
                    <input id={`sq-title-${qIdx}`} className="form-input" value={q.title} onChange={e => handleUpdateQuestionField(qIdx, 'title', e.target.value)} required />
                </div>
                <div>
                    <label htmlFor={`sq-xp-${qIdx}`} className="form-label">XP Reward</label>
                    <input id={`sq-xp-${qIdx}`} type="number" className="form-input" value={q.xp_reward} onChange={e => handleUpdateQuestionField(qIdx, 'xp_reward', Number.parseInt(e.target.value) || 0)} required />
                </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <label htmlFor={`sq-ps-${qIdx}`} className="form-label">Problem Statement</label>
                <textarea id={`sq-ps-${qIdx}`} className="form-input" rows={3} value={q.problem_statement} onChange={e => handleUpdateQuestionField(qIdx, 'problem_statement', e.target.value)} required />
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <div className="form-label">Starter Code</div>
                <div style={{ height: '120px', background: 'var(--bg-base)', borderRadius: 8, overflow: 'hidden' }}>
                    <CodeEditor value={q.starter_code} onChange={e => handleUpdateQuestionField(qIdx, 'starter_code', e.target.value)} language={language} placeholder="Initial code..." />
                </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
                <div className="form-label">Solution Code (Optional)</div>
                <div style={{ height: '120px', background: 'var(--bg-base)', borderRadius: 8, overflow: 'hidden' }}>
                    <CodeEditor value={q.solution_code || ''} onChange={e => handleUpdateQuestionField(qIdx, 'solution_code', e.target.value)} language={language} placeholder="Correct answer..." />
                </div>
            </div>
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#f1f5f9', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.85rem' }}>Test Cases for Q{qIdx + 1}</strong>
                    <button type="button" onClick={() => handleAddTestCase(qIdx)} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>+ TC</button>
                </div>
                {q.test_cases.map((tc, tcIdx) => (
                    <div key={tc.id || `tc-${tcIdx}`} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
                        <textarea className="form-input" placeholder="Input" value={tc.input} onChange={e => handleUpdateTestCaseField(qIdx, tcIdx, 'input', e.target.value)} style={{ flex: 1, height: '40px', minHeight: '40px' }} />
                        <textarea className="form-input" placeholder="Expected" value={tc.expected_output} onChange={e => handleUpdateTestCaseField(qIdx, tcIdx, 'expected_output', e.target.value)} style={{ flex: 1, height: '40px', minHeight: '40px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.6rem' }}>Hide</span>
                            <input type="checkbox" checked={tc.is_hidden} onChange={e => handleUpdateTestCaseField(qIdx, tcIdx, 'is_hidden', e.target.checked)} />
                        </div>
                        <button type="button" onClick={() => handleRemoveTestCase(qIdx, tcIdx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                    </div>
                ))}
            </div>
        </div>
    )
}

SubQuestionItem.propTypes = {
    q: PropTypes.shape({
        id: PropTypes.string,
        title: PropTypes.string,
        problem_statement: PropTypes.string,
        starter_code: PropTypes.string,
        solution_code: PropTypes.string,
        xp_reward: PropTypes.number,
        test_cases: PropTypes.arrayOf(
            PropTypes.shape({
                input: PropTypes.string,
                expected_output: PropTypes.string,
                is_hidden: PropTypes.bool
            })
        )
    }).isRequired,
    qIdx: PropTypes.number.isRequired,
    language: PropTypes.string.isRequired,
    handleRemoveQuestion: PropTypes.func.isRequired,
    handleUpdateQuestionField: PropTypes.func.isRequired,
    handleAddTestCase: PropTypes.func.isRequired,
    handleRemoveTestCase: PropTypes.func.isRequired,
    handleUpdateTestCaseField: PropTypes.func.isRequired
}

function SubQuestions({ formData, setFormData }) {
    const handleAddQuestion = () => {
        setFormData(p => ({
            ...p,
            sub_questions: [
                ...p.sub_questions,
                {
                    id: 'q' + (p.sub_questions.length + 1),
                    title: '',
                    problem_statement: '',
                    starter_code: '',
                    solution_code: '',
                    xp_reward: 15,
                    test_cases: [{ input: '', expected_output: '', is_hidden: false }]
                }
            ]
        }))
    }

    const handleRemoveQuestion = (qIdx) => {
        setFormData(p => ({
            ...p,
            sub_questions: p.sub_questions.filter((_, i) => i !== qIdx)
        }))
    }

    const handleUpdateQuestionField = (qIdx, field, value) => {
        setFormData(p => {
            const sq = [...p.sub_questions]
            sq[qIdx] = { ...sq[qIdx], [field]: value }
            return { ...p, sub_questions: sq }
        })
    }

    const handleAddTestCase = (qIdx) => {
        setFormData(p => {
            const sq = [...p.sub_questions]
            sq[qIdx] = {
                ...sq[qIdx],
                test_cases: [...sq[qIdx].test_cases, { input: '', expected_output: '', is_hidden: false }]
            }
            return { ...p, sub_questions: sq }
        })
    }

    const handleRemoveTestCase = (qIdx, tcIdx) => {
        setFormData(p => {
            const sq = [...p.sub_questions]
            sq[qIdx] = {
                ...sq[qIdx],
                test_cases: sq[qIdx].test_cases.filter((_, i) => i !== tcIdx)
            }
            return { ...p, sub_questions: sq }
        })
    }

    const handleUpdateTestCaseField = (qIdx, tcIdx, field, value) => {
        setFormData(p => {
            const sq = [...p.sub_questions]
            const tcArr = [...sq[qIdx].test_cases]
            tcArr[tcIdx] = { ...tcArr[tcIdx], [field]: value }
            sq[qIdx] = { ...sq[qIdx], test_cases: tcArr }
            return { ...p, sub_questions: sq }
        })
    }

    return (
        <div style={{ border: '1px solid var(--card-border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', background: 'var(--bg-base)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Sub-Questions</h4>
                <button type="button" onClick={handleAddQuestion} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>
                    <Plus size={14} /> Add Question
                </button>
            </div>
            {formData.sub_questions.map((q, qIdx) => (
                <SubQuestionItem
                    key={q.id}
                    q={q}
                    qIdx={qIdx}
                    language={formData.language}
                    handleRemoveQuestion={handleRemoveQuestion}
                    handleUpdateQuestionField={handleUpdateQuestionField}
                    handleAddTestCase={handleAddTestCase}
                    handleRemoveTestCase={handleRemoveTestCase}
                    handleUpdateTestCaseField={handleUpdateTestCaseField}
                />
            ))}
        </div>
    )
}

SubQuestions.propTypes = {
    formData: PropTypes.shape({
        language: PropTypes.string,
        sub_questions: PropTypes.arrayOf(
            PropTypes.shape({
                id: PropTypes.string,
                title: PropTypes.string,
                problem_statement: PropTypes.string,
                starter_code: PropTypes.string,
                solution_code: PropTypes.string,
                xp_reward: PropTypes.number,
                test_cases: PropTypes.arrayOf(
                    PropTypes.shape({
                        input: PropTypes.string,
                        expected_output: PropTypes.string,
                        is_hidden: PropTypes.bool
                    })
                )
            })
        )
    }).isRequired,
    setFormData: PropTypes.func.isRequired
}

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
    const [wcTab, setWcTab] = useState('html')

    const [wizardStep, setWizardStep] = useState(1);
    const [statusTab, setStatusTab] = useState('all');
    const [formData, setFormData] = useState({
        title: '', description: '', problem_statement: '',
        course_id: '', language: 'python', difficulty: 'easy',
        starter_code: '', solution_code: '', constraints: '', input_format: '', output_format: '',
        xp_reward: 15, coin_reward: 0, estimated_minutes: 15, open_time: getDefaultUnlockTime(), close_time: '',
        target_visual_url: '', allowed_assets: '',
        week_number: 1, day_of_week: 1,
        is_combined: false,
        reference_iframe_url: '',
        web_testcases: { html: [], css: [], js: [] },
        sub_questions: [{ id: 'q1', title: '', problem_statement: '', starter_code: '', xp_reward: 15, test_cases: [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }] }],
        test_cases: [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }],
        
        status: 'published', admin_notes: '', challenge_version: 1,
        learning_objectives: [], learning_outcomes: [], tags: [], skills: [], difficulty_score: 50,
        note: '', resources: [], challenge_assets: [], css_colors: [], css_fonts: [], concepts_review: '',
        expected_outputs: { desktop: '', tablet: '', mobile: '', gif: '', dark: '', light: '' },
        video_explanation_url: '',
        hints: [], common_mistakes: [], acceptance_criteria: [], submission_checklist: [],
        prerequisites: [], related_challenges: [], ai_metadata: {}, evaluation_prompt: ''
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
                week_number: location.state.week || 1,
                day_of_week: location.state.day || 1
            }))
            if (location.state.openModal) setShowModal(true)
        }
    }, [location.state])
    const [resourceAccess, setResourceAccess] = useState([])
    const [lockingResource, setLockingResource] = useState(null)

    // Submissions View States
    const [viewingSubmissions, setViewingSubmissions] = useState(null)
    const [submissionsData, setSubmissionsData] = useState([])
    const [submissionsLoading, setSubmissionsLoading] = useState(false)
    const [submissionsSearch, setSubmissionsSearch] = useState('')
    const [proctorSessionsMap, setProctorSessionsMap] = useState({})
    const [viewingReportSession, setViewingReportSession] = useState(null)
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [previewProblem, setPreviewProblem] = useState(false)

    async function handleImageUpload(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            setIsUploadingImage(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${crypto.randomUUID().split("-")[0]}.${fileExt}`;
            const filePath = `${profile.id}/coding-images/${fileName}`;
            
            const { error } = await supabase.storage.from('study-materials').upload(filePath, file, { cacheControl: '3600', upsert: false });
            if (error) throw error;
            
            const { data: { publicUrl } } = supabase.storage.from('study-materials').getPublicUrl(filePath);
            
            setFormData(prev => ({
                ...prev,
                problem_statement: prev.problem_statement ? `${prev.problem_statement}\n\n![Image](${publicUrl})` : `![Image](${publicUrl})`
            }));
        } catch (err) {
            console.error('Error uploading image:', err);
            alert('Failed to upload image: ' + err.message);
        } finally {
            setIsUploadingImage(false);
            e.target.value = null;
        }
    }

    async function handleResourceImageUpload(e, i) {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            setIsUploadingImage(true);
            const fileExt = file.name.split('.').pop();
            const fileName = `${crypto.randomUUID().split("-")[0]}.${fileExt}`;
            const filePath = `${profile.id}/coding-images/${fileName}`;
            
            const { error } = await supabase.storage.from('study-materials').upload(filePath, file, { cacheControl: '3600', upsert: false });
            if (error) throw error;
            
            const { data: { publicUrl } } = supabase.storage.from('study-materials').getPublicUrl(filePath);
            
            const arr = [...formData.resources];
            arr[i] = typeof arr[i] === 'string' ? { description: arr[i], url: publicUrl } : { ...arr[i], url: publicUrl };
            setFormData({ ...formData, resources: arr });
        } catch (err) {
            console.error('Error uploading resource image:', err);
            alert('Failed to upload image: ' + err.message);
        } finally {
            setIsUploadingImage(false);
            e.target.value = null;
        }
    }

    async function loadSubmissions(challenge) {
        setViewingSubmissions(challenge)
        setSubmissionsLoading(true)
        setSubmissionsSearch('')
        try {
            const [
                { data: subs },
                { data: pSessions }
            ] = await Promise.all([
                supabase
                    .from('coding_submissions')
                    .select('*, users!inner(name, email)')
                    .eq('challenge_id', challenge.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('proctoring_sessions')
                    .select('id, student_id, final_risk_score, review_status')
                    .eq('challenge_id', challenge.id)
            ])

            const pMap = {}
            if (pSessions) {
                pSessions.forEach(s => {
                    pMap[s.student_id] = s
                })
            }
            setProctorSessionsMap(pMap)

            // Keep the best attempt (or most recent accepted) per student
            const bestByStudent = {}
            ;(subs || []).forEach(s => {
                const current = bestByStudent[s.student_id]
                if (
                    !current ||
                    (s.status === 'accepted' && current.status !== 'accepted') ||
                    ((s.score || 0) > (current.score || 0))
                ) {
                    bestByStudent[s.student_id] = s
                }
            })
            setSubmissionsData(Object.values(bestByStudent))
        } catch (err) {
            console.error('Error loading submissions:', err)
        } finally {
            setSubmissionsLoading(false)
        }
    }

    const filteredSubmissions = submissionsData.filter(m => {
        if (!submissionsSearch) return true
        const q = submissionsSearch.toLowerCase()
        return m.users?.name?.toLowerCase().includes(q) || m.users?.email?.toLowerCase().includes(q)
    })

    const submissionsStats = {
        total: submissionsData.length,
        avgScore: submissionsData.length > 0 ? Math.round(submissionsData.reduce((sum, m) => sum + (m.score || 0), 0) / submissionsData.length) : 0,
        passed: submissionsData.filter(m => m.status === 'accepted').length,
    }

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
            responseText = responseText.replaceAll('```json', '').replaceAll('```', '').trim();
            
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
            const payloads = generatedChallenges.map(c => {
                let xp_reward = 15;
                if (c.difficulty === 'hard') {
                    xp_reward = 30;
                } else if (c.difficulty === 'medium') {
                    xp_reward = 20;
                }

                return {
                    course_id: aiCourseId,
                    title: c.title || 'Untitled',
                    problem_statement: c.problem_statement || '',
                    language: c.language || 'python',
                    difficulty: c.difficulty || 'easy',
                    starter_code: c.starter_code || '',
                    solution_code: c.solution_code || '',
                    constraints: c.constraints || '',
                    test_cases: Array.isArray(c.test_cases) ? c.test_cases : [],
                    xp_reward,
                    week_number: 1, day_of_week: 1 // Default
                };
            });

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

            // Build web_testcases — filter out empty entries
            const cleanWebTc = formData.language === 'html' ? {
                html: (formData.web_testcases?.html || []).filter(t => t.selector?.trim()),
                css:  (formData.web_testcases?.css  || []).filter(t => t.selector?.trim() && t.property?.trim()),
                js:   (formData.web_testcases?.js   || []).filter(t => t.keyword?.trim())
            } : null
            const hasWebTc = cleanWebTc && (cleanWebTc.html.length || cleanWebTc.css.length || cleanWebTc.js.length)

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
                coin_reward: formData.coin_reward || 0,
                estimated_minutes: formData.estimated_minutes || 15,
                difficulty_score: formData.difficulty_score || 50,
                week_number: formData.week_number,
                day_of_week: formData.day_of_week,
                target_visual_url: formData.target_visual_url,
                starter_code: finalStarterCode,
                test_cases: formData.is_combined ? { is_combined: true, sub_questions: formData.sub_questions } : formData.test_cases.filter(tc => 
                    tc.expected_output?.trim() !== '' || 
                    (formData.language === 'html' && tc.output_image_url?.trim() !== '')
                ),
                open_time: toISOWithOffset(formData.open_time),
                close_time: toISOWithOffset(formData.close_time),
                allowed_assets: (formData.allowed_assets || '').split('\n').map(l => l.trim()).filter(Boolean),
                reference_iframe_url: formData.language === 'html' ? (formData.reference_iframe_url || null) : null,
                required_keywords: null,
                web_testcases: hasWebTc ? cleanWebTc : null,
                
                status: formData.status || 'published',
                admin_notes: formData.admin_notes || '',
                learning_objectives: formData.learning_objectives || [],
                learning_outcomes: formData.learning_outcomes || [],
                tags: formData.tags || [],
                skills: formData.skills || [],
                note: formData.note || '',
                resources: formData.resources || [],
                challenge_assets: formData.challenge_assets || [],
                css_colors: formData.css_colors || [],
                css_fonts: formData.css_fonts || [],
                concepts_review: formData.concepts_review || '',
                expected_outputs: formData.expected_outputs || { desktop: '', tablet: '', mobile: '', gif: '', dark: '', light: '' },
                video_explanation_url: formData.video_explanation_url || '',
                hints: formData.hints || [],
                common_mistakes: formData.common_mistakes || [],
                acceptance_criteria: formData.acceptance_criteria || [],
                submission_checklist: formData.submission_checklist || [],
                prerequisites: formData.prerequisites || [],
                related_challenges: formData.related_challenges || [],
                ai_metadata: formData.ai_metadata || {},
                evaluation_prompt: formData.evaluation_prompt || ''
            }
            
            if (editingId) {
                // If editing a published challenge, bump version
                if (payload.status === 'published') {
                    const currentChallenge = challenges.find(c => c.id === editingId);
                    if (currentChallenge) {
                        payload.challenge_version = (currentChallenge.challenge_version || 1) + 1;
                    }
                }

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
        if (error) {
            alert('Error deleting: ' + error.message)
        } else {
            setChallenges(challenges.filter(c => c.id !== id))
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
                console.warn('Failed to parse starter web code JSON, falling back to raw html', e);
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

        // Parse web_testcases back (it's already JSONB arrays)
        const wt = c.web_testcases || {}
        const loadedWebTc = {
            html: Array.isArray(wt.html) ? wt.html : [],
            css:  Array.isArray(wt.css)  ? wt.css  : [],
            js:   Array.isArray(wt.js)   ? wt.js   : []
        }

        setFormData({
            title: c.title, description: c.description || '',
            problem_statement: c.problem_statement, course_id: c.course_id || '', language: c.language || 'python', difficulty: c.difficulty || 'easy',
            starter_code: initialStarterCode, solution_code: c.solution_code || '', constraints: c.constraints || '',
            input_format: c.input_format || '', output_format: c.output_format || '',
            xp_reward: c.xp_reward || 15, coin_reward: c.coin_reward || 0,
            estimated_minutes: c.estimated_minutes || 15, difficulty_score: c.difficulty_score || 50,
            open_time: toLocalInput(c.open_time),
            close_time: toLocalInput(c.close_time),
            target_visual_url: c.target_visual_url || '',
            allowed_assets: Array.isArray(c.allowed_assets) ? c.allowed_assets.join('\n') : (c.allowed_assets || ''),
            test_cases: parsedTestCases,
            is_combined,
            sub_questions,
            week_number: c.week_number || 1,
            day_of_week: c.day_of_week || 1,
            reference_iframe_url: c.reference_iframe_url || '',
            web_testcases: loadedWebTc,
            
            status: c.status || 'published', admin_notes: c.admin_notes || '', challenge_version: c.challenge_version || 1,
            learning_objectives: c.learning_objectives || [], learning_outcomes: c.learning_outcomes || [],
            tags: c.tags || [], skills: c.skills || [],
            note: c.note || '', resources: c.resources || [], challenge_assets: c.challenge_assets || [],
            css_colors: c.css_colors || [], css_fonts: c.css_fonts || [], concepts_review: c.concepts_review || '',
            expected_outputs: c.expected_outputs || { desktop: '', tablet: '', mobile: '', gif: '', dark: '', light: '' },
            video_explanation_url: c.video_explanation_url || '',
            hints: c.hints || [], common_mistakes: c.common_mistakes || [],
            acceptance_criteria: c.acceptance_criteria || [], submission_checklist: c.submission_checklist || [],
            prerequisites: c.prerequisites || [], related_challenges: c.related_challenges || [],
            ai_metadata: c.ai_metadata || {}, evaluation_prompt: c.evaluation_prompt || ''
        })
        setShowModal(true)
    }

    function resetForm() {
        setFormData({
            title: '', description: '', problem_statement: '',
            course_id: formData.course_id, language: 'python', difficulty: 'easy',
            starter_code: '', solution_code: '', constraints: '', input_format: '', output_format: '',
            xp_reward: 15, open_time: getDefaultUnlockTime(), close_time: '',
            target_visual_url: '', allowed_assets: '',
            week_number: 1, day_of_week: 1,
            is_combined: false,
            reference_iframe_url: '',
            web_testcases: { html: [], css: [], js: [] },
            sub_questions: [{ id: 'q1', title: '', problem_statement: '', starter_code: '', solution_code: '', xp_reward: 15, test_cases: [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }] }],
            test_cases: [{ input: '', expected_output: '', is_hidden: false, input_image_url: '', output_image_url: '' }]
        })
        setStarterWebCode({ html: '', css: '', js: '' })
        setEditingId(null)
        setError('')
    }

    const filteredChallenges = challenges.filter(c => {
        const matchesSearch = c.title.toLowerCase().includes(search.toLowerCase()) ||
                              c.courses?.title?.toLowerCase().includes(search.toLowerCase());
        const matchesTab = statusTab === 'all' || (c.status || 'published') === statusTab;
        return matchesSearch && matchesTab;
    })


    const renderAccessControlModal = () => {
        return (
            <>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    {groups.filter(g => g.course_id === lockingResource.course_id).length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                            No groups/batches created for this course.
                                            {groups.length > 0 && (
                                                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#f59e0b' }}>
                                                    Note: Batches are course-specific. You have {groups.length} batch(es) in other courses.
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        groups.filter(g => g.course_id === lockingResource.course_id).map(g => {
                                            const access = resourceAccess.find(a => a.group_id === g.id && a.resource_id === lockingResource.id)
                                            const isLocked = access?.is_locked || false
                                            return (
                                                <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: isLocked ? '#fff1f2' : '#f0fdf4', borderRadius: 10, border: `1px solid ${isLocked ? '#fecaca' : '#bbf7d0'}` }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: isLocked ? '#991b1b' : '#166534' }}>{g.name}</div>
                                                    <button
                                                        onClick={() => toggleResourceLock(g.id, lockingResource.id)}
                                                        className={isLocked ? "btn-primary" : "btn-secondary"}
                                                        style={{ padding: '0.3rem 0.85rem', fontSize: '0.85rem', background: isLocked ? '#ef4444' : 'white' }}
                                                    >
                                                        {isLocked ? 'Unlock' : 'Lock'}
                                                    </button>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                            <div style={{ padding: '1rem 1.5rem', background: 'var(--bg-base)', borderTop: '1px solid var(--card-border)', textAlign: 'right' }}>
                                <button onClick={() => setLockingResource(null)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Done</button>
                            </div>
                        </div>
                    </div>
                )
            }
            </>
        );
    };


    const renderHtmlSpecificOptions = () => (
        <HtmlSpecificOptions formData={formData} setFormData={setFormData} wcTab={wcTab} setWcTab={setWcTab} />
    );


    const renderChallengeModal = () => {
        const renderSubmitButtonText = () => {
            if (saving) return 'Saving...';
            if (editingId) return <><Save size={18} /> Update</>;
            return <><Save size={18} /> Publish Challenge</>;
        };

        const renderStepIndicator = () => (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem', overflowX: 'auto' }}>
                {[
                    { s: 1, label: 'Basic Info' },
                    { s: 2, label: 'Description' },
                    { s: 3, label: 'Code & Tests' },
                    { s: 4, label: 'Guidance & AI' },
                    { s: 5, label: 'Preview' }
                ].map(step => (
                    <button
                        key={step.s}
                        type="button"
                        onClick={() => setWizardStep(step.s)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: wizardStep === step.s ? '#6366f1' : 'transparent',
                            color: wizardStep === step.s ? 'white' : 'var(--text-muted)',
                            border: '1px solid',
                            borderColor: wizardStep === step.s ? '#6366f1' : 'var(--card-border)',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {step.s}. {step.label}
                    </button>
                ))}
            </div>
        );

        return (
            <>
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div className="glass-card animate-scale-in" style={{ width: '95%', maxWidth: 1000, height: '90vh', padding: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {editingId ? 'Edit Challenge (Wizard)' : 'Create New Coding Challenge (Wizard)'}
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
                                {renderStepIndicator()}
                                
                                {error && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 10, marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
                                        <AlertCircle size={18} /> {error}
                                    </div>
                                )}

                                {wizardStep === 1 && (
                                    <div className="animate-fade-in">
                                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Step 1: Basic Info</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                            <div style={{ gridColumn: 'span 3' }}>
                                                <label className="form-label">Challenge Title</label>
                                                <input required className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                                            </div>
                                            <div>
                                                <label className="form-label">Course</label>
                                                <select required className="form-input" value={formData.course_id} onChange={e => setFormData({...formData, course_id: e.target.value})}>
                                                    <option value="">Select Course</option>
                                                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="form-label">Language</label>
                                                <select required className="form-input" value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})}>
                                                    {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="form-label">Difficulty</label>
                                                <select className="form-input" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})}>
                                                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="form-label">XP Reward</label>
                                                <input type="number" className="form-input" value={formData.xp_reward} onChange={e => setFormData({...formData, xp_reward: Number(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="form-label">Coin Reward</label>
                                                <input type="number" className="form-input" value={formData.coin_reward} onChange={e => setFormData({...formData, coin_reward: Number(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="form-label">Estimated Time (mins)</label>
                                                <input type="number" className="form-input" value={formData.estimated_minutes} onChange={e => setFormData({...formData, estimated_minutes: Number(e.target.value)})} />
                                            </div>
                                            <div>
                                                <label className="form-label">Status</label>
                                                <select className="form-input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                    <option value="draft">Draft</option>
                                                    <option value="published">Published</option>
                                                    <option value="archived">Archived</option>
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '1.5rem' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={formData.is_combined} onChange={e => setFormData({ ...formData, is_combined: e.target.checked })} style={{ width: '1.2rem', height: '1.2rem' }} />
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Combined Challenge (Multi-Part)</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {wizardStep === 2 && (
                                    <div className="animate-fade-in">
                                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Step 2: Description & Content</h3>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                    <label className="form-label" style={{ margin: 0 }}>Problem Statement</label>
                                                    <div style={{ display: 'flex', background: 'var(--bg-elevated)', border: '1px solid var(--card-border)', borderRadius: 6, overflow: 'hidden' }}>
                                                        <button type="button" onClick={() => setPreviewProblem(false)} style={{ padding: '0.2rem 0.8rem', fontSize: '0.75rem', background: !previewProblem ? 'var(--primary-500, #6366f1)' : 'transparent', color: !previewProblem ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Write</button>
                                                        <button type="button" onClick={() => setPreviewProblem(true)} style={{ padding: '0.2rem 0.8rem', fontSize: '0.75rem', background: previewProblem ? 'var(--primary-500, #6366f1)' : 'transparent', color: previewProblem ? '#fff' : 'var(--text-muted)', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Preview</button>
                                                    </div>
                                                </div>
                                                <label className="btn-secondary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}>
                                                    {isUploadingImage ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                                                    {isUploadingImage ? 'Uploading...' : 'Add Image'}
                                                    <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={isUploadingImage} />
                                                </label>
                                            </div>
                                            {previewProblem ? (
                                                <div className="markdown-preview" style={{ minHeight: '144px', padding: '0.75rem', border: '1px solid var(--card-border)', borderRadius: 8, background: 'var(--bg-base)', overflowY: 'auto', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                    <style>{'.markdown-preview img { max-width: 100%; border-radius: 8px; border: 1px solid var(--card-border); margin-top: 1rem; margin-bottom: 1rem; }'}</style>
                                                    {formData.problem_statement ? <ReactMarkdown>{formData.problem_statement}</ReactMarkdown> : <span style={{ color: 'var(--text-muted)' }}>Nothing to preview</span>}
                                                </div>
                                            ) : (
                                                <textarea rows={6} className="form-input" required value={formData.problem_statement} onChange={e => setFormData({...formData, problem_statement: e.target.value})} style={{ resize: 'vertical' }} />
                                            )}
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">Note (Highlight)</label>
                                            <textarea rows={3} className="form-input" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} placeholder="e.g. Note: Do not change the function signature." />
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">Video Explanation URL</label>
                                            <input type="url" className="form-input" value={formData.video_explanation_url} onChange={e => setFormData({...formData, video_explanation_url: e.target.value})} placeholder="e.g. YouTube link" />
                                        </div>
                                        {/* Simplified arrays for Phase 1 - just using JSON string editing for complex fields to save time, organizer can edit JSON directly */}
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">Expected Outputs (JSON)</label>
                                            <textarea rows={3} className="form-input" value={typeof formData.expected_outputs === 'string' ? formData.expected_outputs : JSON.stringify(formData.expected_outputs, null, 2)} onChange={e => setFormData({...formData, expected_outputs: e.target.value})} />
                                        </div>
                                        <div style={{ marginBottom: '1rem', background: 'var(--bg-base)', padding: '1rem', borderRadius: 8, border: '1px solid var(--card-border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <label className="form-label" style={{ margin: 0 }}>Resources</label>
                                                <button type="button" onClick={() => setFormData(p => ({ ...p, resources: [...(Array.isArray(p.resources) ? p.resources : []), { description: '', url: '' }] }))} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>+ Add Resource</button>
                                            </div>
                                            {(Array.isArray(formData.resources) ? formData.resources : []).map((res, i) => (
                                                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                                                    <input type="text" className="form-input" placeholder="Description (e.g. Use this background image)" value={res.description || (typeof res === 'string' ? res : '')} onChange={e => {
                                                        const arr = [...formData.resources];
                                                        arr[i] = typeof arr[i] === 'string' ? e.target.value : { ...arr[i], description: e.target.value };
                                                        setFormData({ ...formData, resources: arr });
                                                    }} />
                                                    <div style={{ display: 'flex', flex: 1, gap: '0.5rem', alignItems: 'center' }}>
                                                        <input type="url" className="form-input" placeholder="URL" style={{ flex: 1 }} value={res.url || ''} onChange={e => {
                                                            const arr = [...formData.resources];
                                                            arr[i] = typeof arr[i] === 'string' ? { description: arr[i], url: e.target.value } : { ...arr[i], url: e.target.value };
                                                            setFormData({ ...formData, resources: arr });
                                                        }} />
                                                        <label className="btn-secondary" style={{ padding: '0 0.5rem', height: '100%', minHeight: '38px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0, flexShrink: 0 }}>
                                                            {isUploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                                            <input type="file" accept="image/*" onChange={(e) => handleResourceImageUpload(e, i)} style={{ display: 'none' }} disabled={isUploadingImage} />
                                                        </label>
                                                    </div>
                                                    <button type="button" onClick={() => setFormData({ ...formData, resources: formData.resources.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.5rem' }}>✕</button>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ marginBottom: '1rem', background: 'var(--bg-base)', padding: '1rem', borderRadius: 8, border: '1px solid var(--card-border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <label className="form-label" style={{ margin: 0 }}>CSS Colors</label>
                                                <button type="button" onClick={() => setFormData(p => ({ ...p, css_colors: [...(Array.isArray(p.css_colors) ? p.css_colors : []), { label: '', value: '' }] }))} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>+ Add Color</button>
                                            </div>
                                            {(Array.isArray(formData.css_colors) ? formData.css_colors : []).map((color, i) => (
                                                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <input type="text" className="form-input" placeholder="Label (e.g. Background color)" value={color.label || (typeof color === 'string' ? color : '')} onChange={e => {
                                                        const arr = [...formData.css_colors];
                                                        arr[i] = typeof arr[i] === 'string' ? e.target.value : { ...arr[i], label: e.target.value };
                                                        setFormData({ ...formData, css_colors: arr });
                                                    }} />
                                                    <input type="text" className="form-input" placeholder="Value (e.g. orange)" value={color.value || ''} onChange={e => {
                                                        const arr = [...formData.css_colors];
                                                        arr[i] = typeof arr[i] === 'string' ? { label: arr[i], value: e.target.value } : { ...arr[i], value: e.target.value };
                                                        setFormData({ ...formData, css_colors: arr });
                                                    }} />
                                                    <button type="button" onClick={() => setFormData({ ...formData, css_colors: formData.css_colors.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.5rem' }}>✕</button>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ marginBottom: '1rem', background: 'var(--bg-base)', padding: '1rem', borderRadius: 8, border: '1px solid var(--card-border)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                                <label className="form-label" style={{ margin: 0 }}>CSS Fonts</label>
                                                <button type="button" onClick={() => setFormData(p => ({ ...p, css_fonts: [...(Array.isArray(p.css_fonts) ? p.css_fonts : []), ''] }))} className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>+ Add Font</button>
                                            </div>
                                            {(Array.isArray(formData.css_fonts) ? formData.css_fonts : []).map((font, i) => (
                                                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                    <input type="text" className="form-input" placeholder="Font Name (e.g. Roboto)" value={font.name || (typeof font === 'string' ? font : '')} onChange={e => {
                                                        const arr = [...formData.css_fonts];
                                                        arr[i] = e.target.value;
                                                        setFormData({ ...formData, css_fonts: arr });
                                                    }} />
                                                    <button type="button" onClick={() => setFormData({ ...formData, css_fonts: formData.css_fonts.filter((_, idx) => idx !== i) })} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0.5rem' }}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">Target Visual URL (Legacy)</label>
                                            <input type="url" className="form-input" value={formData.target_visual_url} onChange={e => setFormData({...formData, target_visual_url: e.target.value})} />
                                        </div>
                                    </div>
                                )}

                                {wizardStep === 3 && (
                                    <div className="animate-fade-in">
                                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Step 3: Code & Tests</h3>
                                        {formData.is_combined ? (
                                            <SubQuestions formData={formData} setFormData={setFormData} />
                                        ) : (
                                            <>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                                                    <div>
                                                        <label className="form-label">Starter Code</label>
                                                        {formData.language === 'html' ? (
                                                            <div style={{ height: '200px', background: 'var(--bg-base)', border: '1px solid var(--card-border)', borderRadius: 8, overflow: 'hidden' }}>
                                                                <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--card-border)' }}>
                                                                    <button type="button" onClick={() => setWebTab('html')} style={{ padding: '0.4rem 1rem', background: webTab === 'html' ? 'var(--primary-500)' : 'transparent', color: webTab === 'html' ? '#fff' : 'var(--text-muted)', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>HTML</button>
                                                                    <button type="button" onClick={() => setWebTab('css')} style={{ padding: '0.4rem 1rem', background: webTab === 'css' ? 'var(--primary-500)' : 'transparent', color: webTab === 'css' ? '#fff' : 'var(--text-muted)', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>CSS</button>
                                                                    <button type="button" onClick={() => setWebTab('js')} style={{ padding: '0.4rem 1rem', background: webTab === 'js' ? 'var(--primary-500)' : 'transparent', color: webTab === 'js' ? '#fff' : 'var(--text-muted)', border: 'none', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>JS</button>
                                                                </div>
                                                                <div style={{ height: '180px' }}>
                                                                    {webTab === 'html' && <CodeEditor value={starterWebCode.html} onChange={e => setStarterWebCode(p => ({ ...p, html: e.target.value }))} language="html" />}
                                                                    {webTab === 'css' && <CodeEditor value={starterWebCode.css} onChange={e => setStarterWebCode(p => ({ ...p, css: e.target.value }))} language="css" />}
                                                                    {webTab === 'js' && <CodeEditor value={starterWebCode.js} onChange={e => setStarterWebCode(p => ({ ...p, js: e.target.value }))} language="js" />}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div style={{ height: '200px', background: 'var(--bg-base)', borderRadius: 8, overflow: 'hidden' }}>
                                                                <CodeEditor value={formData.starter_code} onChange={e => setFormData(p => ({ ...p, starter_code: e.target.value }))} language={formData.language} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <label className="form-label">Solution Code</label>
                                                        <div style={{ height: '200px', background: 'var(--bg-base)', borderRadius: 8, overflow: 'hidden' }}>
                                                            <CodeEditor value={formData.solution_code} onChange={e => setFormData(p => ({ ...p, solution_code: e.target.value }))} language={formData.language} />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label className="form-label">Constraints</label>
                                                    <textarea rows={3} className="form-input" value={formData.constraints} onChange={e => setFormData({...formData, constraints: e.target.value})} />
                                                </div>
                                                {formData.language === 'html' && renderHtmlSpecificOptions()}
                                                <StandardTestCases formData={formData} setFormData={setFormData} />
                                            </>
                                        )}
                                    </div>
                                )}

                                {wizardStep === 4 && (
                                    <div className="animate-fade-in">
                                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Step 4: Guidance & AI</h3>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">Hints (JSON array of level 1-4 and text)</label>
                                            <textarea rows={4} className="form-input" value={typeof formData.hints === 'string' ? formData.hints : JSON.stringify(formData.hints, null, 2)} onChange={e => setFormData({...formData, hints: e.target.value})} />
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">Common Mistakes (JSON array of strings)</label>
                                            <textarea rows={3} className="form-input" value={typeof formData.common_mistakes === 'string' ? formData.common_mistakes : JSON.stringify(formData.common_mistakes)} onChange={e => setFormData({...formData, common_mistakes: e.target.value})} />
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">Concepts Review (Markdown)</label>
                                            <textarea rows={4} className="form-input" value={formData.concepts_review} onChange={e => setFormData({...formData, concepts_review: e.target.value})} />
                                        </div>
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label className="form-label">Admin Notes (Hidden from students)</label>
                                            <textarea rows={3} className="form-input" value={formData.admin_notes} onChange={e => setFormData({...formData, admin_notes: e.target.value})} />
                                        </div>
                                    </div>
                                )}

                                {wizardStep === 5 && (
                                    <div className="animate-fade-in">
                                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Step 5: Preview & Publish</h3>
                                        <div style={{ background: 'var(--bg-base)', padding: '2rem', borderRadius: 12, border: '1px solid var(--card-border)', textAlign: 'center' }}>
                                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>The challenge is ready to be {formData.status === 'published' ? 'published' : 'saved as ' + formData.status}.</p>
                                            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formData.title || 'Untitled Challenge'}</p>
                                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Difficulty: {formData.difficulty} • XP: {formData.xp_reward} • Time: {formData.estimated_minutes}m</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-base)' }}>
                                <div>
                                    {wizardStep > 1 && (
                                        <button type="button" onClick={() => setWizardStep(s => s - 1)} className="btn-secondary" style={{ padding: '0.5rem 1.25rem' }}>Back</button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.85rem' }}>
                                    {wizardStep < 5 ? (
                                        <button type="button" onClick={() => setWizardStep(s => s + 1)} className="btn-primary" style={{ padding: '0.5rem 1.25rem' }}>Next Step</button>
                                    ) : (
                                        <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.5rem 1.5rem', background: formData.status === 'published' ? '#10b981' : '#f59e0b', border: 'none', color: 'white' }}>
                                            {renderSubmitButtonText()}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </>
        );
    };
    const renderAIModal = () => {
        return (
            <>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '1rem', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 10, marginBottom: '1.5rem', color: '#dc2626', fontSize: '0.875rem' }}>
                                    <AlertCircle size={18} /> {aiError}
                                </div>
                            )}

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label htmlFor="ai-course-id" className="form-label">Select Course</label>\n                                <select id="ai-course-id"
                                    className="form-input"
                                    value={aiCourseId}
                                    onChange={e => setAiCourseId(e.target.value)}
                                    style={{ marginBottom: '1rem' }}
                                >
                                    <option value="">-- Choose a course --</option>
                                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                                </select>

                                <label htmlFor="ai-prompt" className="form-label">Topic or Content</label>\n                                <textarea id="ai-prompt"
                                    className="form-input"
                                    rows={4}
                                    placeholder="e.g. Generate 3 Python challenges about array manipulation..."
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                    style={{ resize: 'none' }}
                                />
                                <div style={{ textAlign: 'right', marginTop: '0.85rem' }}>
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
                                            <div key={c.title || `gen-${idx}`} style={{ padding: '1rem', background: 'var(--bg-base)', borderRadius: 12, border: '1px solid var(--card-border)' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{idx + 1}. {c.title}</span>
                                                    <span style={{ fontSize: '0.7rem', background: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{c.language} • {c.difficulty}</span>
                                                </div>
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{c.problem_statement?.substring(0, 100)}...</p>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
            </>
        );
    };

    const handleSubmissionMouseEnter = (e) => { e.currentTarget.style.border = '1px solid #6366f130' }
    const handleSubmissionMouseLeave = (e) => { e.currentTarget.style.border = '1px solid transparent' }
    const handleViewReportSession = (e) => {
        const studentId = e.currentTarget.dataset.studentId;
        const challengeId = e.currentTarget.dataset.challengeId;
        if (studentId && challengeId) {
            setViewingReportSession({ studentId, challengeId });
        }
    }

    const renderSubmissionsContent = () => {
        if (submissionsLoading) {
            return (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading submissions...</p>
                </div>
            );
        }
        if (filteredSubmissions.length === 0) {
            return (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <Users size={40} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{submissionsData.length === 0 ? 'No students have submitted this challenge yet.' : 'No results match your search.'}</p>
                </div>
            );
        }
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '0.5rem 0.85rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', borderBottom: '1px solid var(--card-border)' }}>
                    <span>Student</span>
                    <span style={{ textAlign: 'center' }}>Score (XP)</span>
                    <span style={{ textAlign: 'center' }}>Status</span>
                    <span style={{ textAlign: 'center' }}>Proctoring</span>
                </div>
                {filteredSubmissions
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .map((sub, idx) => {
                        const passed = sub.status === 'accepted'
                        return (
                            <div key={sub.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '1rem', padding: '0.85rem', borderRadius: 10, background: idx % 2 === 0 ? 'var(--bg-base)' : 'transparent', alignItems: 'center', border: '1px solid transparent', transition: 'all 0.15s ease' }}
                                onMouseEnter={handleSubmissionMouseEnter}
                                onMouseLeave={handleSubmissionMouseLeave}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: passed ? '#ecfdf5' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, color: passed ? '#059669' : '#dc2626', flexShrink: 0 }}>
                                        {sub.users?.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{sub.users?.name || 'Unknown'}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{sub.users?.email}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {sub.score || 0} XP
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    {passed ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#059669' }}>
                                            <CheckCircle2 size={14} /> Accepted
                                        </span>
                                    ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600, color: '#dc2626' }}>
                                            <XCircle size={14} /> Failed / {sub.status || 'Attempted'}
                                        </span>
                                    )}
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    {proctorSessionsMap[sub.student_id] ? (
                                        <button
                                            data-student-id={sub.student_id}
                                            data-challenge-id={sub.challenge_id}
                                            onClick={handleViewReportSession}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: 6,
                                                background: getRiskBg(proctorSessionsMap[sub.student_id].final_risk_score),
                                                color: getRiskColor(proctorSessionsMap[sub.student_id].final_risk_score),
                                                border: `1px solid ${getRiskBorder(proctorSessionsMap[sub.student_id].final_risk_score)}`,
                                                fontSize: '0.85rem',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            🛡️ {proctorSessionsMap[sub.student_id].final_risk_score} Risk
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None</span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
            </div>
        );
    };

    const renderSubmissionsModal = () => {
        return (
            <>
            {/* View Submissions Modal */}
            {viewingSubmissions && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1.5rem' }}>
                    <div className="glass-card animate-scale-in" style={{ width: '100%', maxWidth: 800, padding: 0, overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                        {/* Header */}
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <BarChart3 size={20} color="#6366f1" /> Student Submissions
                                </h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{viewingSubmissions.title} — {viewingSubmissions.courses?.title}</p>
                            </div>
                            <button onClick={() => setViewingSubmissions(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>

                        {/* Summary Stats */}
                        <div style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--card-border)', background: 'var(--bg-base)' }}>
                            <div style={{ flex: 1, padding: '0.85rem', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--card-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>{submissionsStats.total}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Submissions</div>
                            </div>
                            <div style={{ flex: 1, padding: '0.85rem', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--card-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{submissionsStats.avgScore} XP</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Avg Score</div>
                            </div>
                            <div style={{ flex: 1, padding: '0.85rem', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--card-border)', textAlign: 'center' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{submissionsStats.passed}/{submissionsStats.total}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Accepted</div>
                            </div>
                        </div>

                        {/* Search */}
                        <div style={{ padding: '0.85rem 1.5rem', borderBottom: '1px solid var(--card-border)' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Search students by name or email..."
                                    value={submissionsSearch}
                                    onChange={e => setSubmissionsSearch(e.target.value)}
                                    style={{ paddingLeft: '2rem', fontSize: '0.8rem' }}
                                />
                            </div>
                        </div>

                        {/* Student List */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>
                            {renderSubmissionsContent()}
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--card-border)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setViewingSubmissions(null)} className="btn-secondary" style={{ fontSize: '0.85rem' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
            </>
        );
    };

    const renderProctoringModal = () => {
        return (
            <>
                {viewingReportSession && (
                    <ProctoringReportModal 
                        studentId={viewingReportSession.studentId}
                        challengeId={viewingReportSession.challengeId}
                        onClose={() => setViewingReportSession(null)}
                    />
                )}
            </>
        );
    };

    const renderChallengeList = () => {
        const renderLockedGroups = (challengeId) => {
            const nodes = [];
            for (const access of resourceAccess) {
                if (access.resource_id === challengeId && access.is_locked) {
                    for (const g of groups) {
                        if (g.id === access.group_id) {
                            nodes.push(<span key={g.id} style={{ fontSize: '0.85rem', padding: '0.1rem 0.4rem', background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontWeight: 600 }}>Locked: {g.name}</span>);
                            break;
                        }
                    }
                }
            }
            if (nodes.length === 0) return null;
            return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.85rem' }}>{nodes}</div>;
        };
        if (loading) {
            return (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading coding challenges...</p>
                </div>
            )
        }

        if (filteredChallenges.length === 0) {
            return (
                <div className="glass-card" style={{ padding: '5rem 2rem', textAlign: 'center' }}>
                    <div style={{ width: 64, height: 64, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Code size={32} color="var(--text-muted)" />
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
            )
        }

        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                {filteredChallenges.map(c => (
                    <div key={c.id} className="glass-card" style={{ padding: '1.25rem', borderLeft: `4px solid ${getDifficultyColor(c.difficulty)}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
                            <span className="badge" style={{ background: '#f1f5f9', color: 'var(--text-muted)', fontSize: '0.7rem' }}>
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
                        {renderLockedGroups(c.id)}
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <BookOpen size={12} /> {c.courses?.title} • {c.difficulty.toUpperCase()}
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                background: 'rgba(245,158,11,0.1)', color: '#d97706',
                                border: '1px solid rgba(245,158,11,0.25)', borderRadius: '999px',
                                padding: '0.15rem 0.55rem', fontSize: '0.72rem', fontWeight: 700
                            }}>
                                ⚡ {c.xp_reward || 15} XP
                            </span>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, height: '2.5rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '1rem' }}>
                            {c.description || 'No description provided.'}
                        </p>
                        <div style={{ borderTop: '1px solid var(--sidebar-border)', paddingTop: '0.85rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.85rem' }}>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{c.test_cases?.length || 0} Test Cases</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <button
                                    onClick={() => loadSubmissions(c)}
                                    className="btn-primary"
                                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: 'white' }}
                                >
                                    <Eye size={14} /> Submissions
                                </button>
                                <button
                                    onClick={() => globalThis.open(`/student/coding/${c.id}?admin=true`, '_blank')}
                                    className="btn-secondary"
                                    style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', color: '#6366f1', borderColor: 'rgba(99,102,241,0.2)' }}
                                >
                                    Test Question
                                </button>
                                <button onClick={() => openEdit(c)} className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}>View Details</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div className="animate-fade-in">
            {/* Header Area */}
            <div className="stack-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>Coding Practice</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>Create and manage coding challenges for your students</p>
                </div>
                <div style={{ display: 'flex', gap: '0.85rem' }}>
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
                <button onClick={() => setMainTab('challenges')} style={{ padding: '0.85rem 1rem', background: 'none', border: 'none', borderBottom: mainTab === 'challenges' ? '2px solid #6366f1' : '2px solid transparent', color: mainTab === 'challenges' ? '#6366f1' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Challenges</button>
                <button onClick={() => setMainTab('discussions')} style={{ padding: '0.85rem 1rem', background: 'none', border: 'none', borderBottom: mainTab === 'discussions' ? '2px solid #6366f1' : '2px solid transparent', color: mainTab === 'discussions' ? '#6366f1' : 'var(--text-muted)', fontWeight: 600, cursor: 'pointer' }}>Discussions</button>
            </div>

            {mainTab === 'challenges' ? (
                <>
                    {/* Filters & Search */}
                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--card-border)' }}>
                    {['all', 'published', 'draft', 'archived'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setStatusTab(tab)}
                            style={{
                                padding: '0.4rem 1rem',
                                background: statusTab === tab ? '#6366f1' : 'transparent',
                                color: statusTab === tab ? '#fff' : 'var(--text-muted)',
                                border: 'none',
                                borderRadius: '20px',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textTransform: 'capitalize'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        id="challenge-search"
                        name="challenge-search"
                        type="text"
                        placeholder="Search challenges by title or course..."
                        style={{ width: '100%', padding: '0.85rem 1rem 0.85rem 2.8rem', borderRadius: 12, border: '1px solid var(--card-border)', background: 'white', fontSize: '0.9rem' }}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* List */}
            {renderChallengeList()}
            </>
            ) : (
                <OrganizerCodingDiscussions />
            )}


            {renderAccessControlModal()}
            {renderChallengeModal()}
            {renderAIModal()}
            {renderSubmissionsModal()}
            {renderProctoringModal()}
        </div>
    )
}
