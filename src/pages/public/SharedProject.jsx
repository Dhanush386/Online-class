import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Code, Eye, ExternalLink, Calendar } from 'lucide-react'

export default function SharedProject({ subdomainSlug }) {
    const { projectId } = useParams()
    const [project, setProject] = useState(null)
    const [author, setAuthor] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [previewContent, setPreviewContent] = useState('')

    const identifier = subdomainSlug || projectId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);

    useEffect(() => {
        async function loadProject() {
            setLoading(true)
            try {
                // 1. Fetch project data
                let query = supabase.from('published_projects').select('*');
                if (isUuid) {
                    query = query.eq('id', identifier);
                } else {
                    query = query.eq('slug', identifier);
                }

                const { data: pData, error: pErr } = await query.single()

                if (pErr) throw pErr
                if (!pData) throw new Error("Project not found.")

                setProject(pData)

                // 2. Fetch author data separately (since users table might not be exposed directly via select, but typically we want to show author name. Wait, users table is public? In our schema, `users` is public)
                if (pData.user_id) {
                    const { data: uData } = await supabase
                        .from('users')
                        .select('name')
                        .eq('id', pData.user_id)
                        .single()
                    if (uData) setAuthor(uData.name)
                }

                // 3. Build Preview HTML
                const combinedCode = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            ${pData.css || ''}
                        </style>
                    </head>
                    <body>
                        ${pData.html || ''}
                        <script>
                            ${pData.js || ''}
                        </script>
                    </body>
                    </html>
                `
                setPreviewContent(combinedCode)

                // 4. Increment view count
                const { error: viewErr } = await supabase.rpc('increment_project_views', { p_id: pData.id })
                if (viewErr) console.error("Failed to increment view:", viewErr)

            } catch (err) {
                console.error("Error loading project:", err)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        if (identifier) {
            loadProject()
        }
    }, [identifier])

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-primary)', color: 'white' }}>
                <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        )
    }

    if (error || !project) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--text-primary)', color: 'white' }}>
                <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: 400, background: 'var(--text-primary)', border: '1px solid var(--card-border)' }}>
                    <div style={{ width: 64, height: 64, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Code size={32} color="#ef4444" />
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Project Unavailable</h1>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>This web project link is invalid or the project has been removed.</p>
                    <Link to="/login" className="btn-primary" style={{ display: 'inline-flex' }}>Return to Learnova</Link>
                </div>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff' }}>
            {/* Top Bar */}
            <header style={{
                height: 60,
                background: 'var(--text-primary)',
                borderBottom: '1px solid var(--card-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 1.5rem',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    {/* Learnova Branding */}
                    <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
                        <img 
                            src="/logo.png" 
                            alt="Learnova" 
                            style={{ 
                                height: 32, 
                                width: 32,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '1px solid rgba(255,255,255,0.2)'
                            }} 
                        />
                    </Link>

                    {/* Divider */}
                    <div style={{ width: 1, height: 24, background: 'var(--card-border)' }} />

                    {/* Project Info */}
                    <div>
                        <h1 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'white', margin: 0 }}>{project.title}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            <span>by {author || 'Unknown Developer'}</span>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={12} /> {project.views + 1} views</span>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {new Date(project.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                {/* Right side Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => {
                            navigator.clipboard.writeText(globalThis.location.href)
                            alert("Link copied to clipboard!")
                        }}
                        style={{
                            background: 'none',
                            border: '1px solid var(--text-secondary)',
                            color: 'white',
                            padding: '0.4rem 1rem',
                            borderRadius: 6,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <ExternalLink size={14} /> Share
                    </button>
                    <Link to="/register" className="btn-primary" style={{ padding: '0.4rem 1.25rem' }}>Join Learnova</Link>
                </div>
            </header>

            {/* iFrame Container */}
            <div style={{ flex: 1, backgroundColor: 'white', position: 'relative' }}>
                {project.description && (
                    <div style={{ position: 'absolute', bottom: 20, left: 20, maxWidth: 400, background: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', padding: '1rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: 'white', zIndex: 10, fontSize: '0.85rem', lineHeight: 1.5, pointerEvents: 'none' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#818cf8' }}>About this project:</div>
                        {project.description}
                    </div>
                )}

                {/* 
                    Using srcDoc for live rendering of the custom HTML/CSS/JS.
                    Sandbox restricts some capabilities for security, but allows scripts so they can run JS.
                */}
                <iframe
                    title={project.title}
                    srcDoc={previewContent}
                    sandbox="allow-scripts"
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        backgroundColor: '#ffffff'
                    }}
                />
            </div>
        </div>
    )
}
