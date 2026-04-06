import { useEffect } from 'react'
import { X, Lock, ShieldAlert, Download, Printer } from 'lucide-react'

export default function ProtectedViewer({ url, type, title, onClose }) {
    
    useEffect(() => {
        // Prevent Right-Click
        const handleContextMenu = (e) => {
            e.preventDefault()
            alert('Content protection is active. Right-click is disabled.')
        }

        // Prevent Save (Ctrl+S) and Print (Ctrl+P)
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'u')) {
                e.preventDefault()
                alert('Downloading or printing this material is restricted by the institution.')
            }
        }

        document.addEventListener('contextmenu', handleContextMenu)
        document.addEventListener('keydown', handleKeyDown)

        // Disable standard browser print
        const style = document.createElement('style')
        style.innerHTML = '@media print { body { display: none !important; } }'
        document.head.appendChild(style)

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu)
            document.removeEventListener('keydown', handleKeyDown)
            document.head.removeChild(style)
        }
    }, [])

    // URL construction for different types
    let viewerUrl = url
    if (type === 'pdf') {
        // Appending #toolbar=0 hides standard PDF controls in many browsers
        viewerUrl = `${url}#toolbar=0&navpanes=0&scrollbar=0`
    } else if (type === 'ppt' || type === 'pptx' || url.includes('.ppt')) {
        // Use Microsoft Office Online Viewer for PPTs
        viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(2, 6, 23, 0.98)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem 2rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15, 23, 42, 0.8)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.15)', borderRadius: 10 }}>
                        <Lock size={18} color="#818cf8" />
                    </div>
                    <div>
                        <h3 style={{ color: 'white', fontSize: '1rem', fontWeight: 700, margin: 0 }}>{title}</h3>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', margin: '2px 0 0' }}>Protected Mode Active • EduStream Viewer</p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }} title="Download Disabled">
                            <Download size={14} /> Disabled
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }} title="Print Disabled">
                            <Printer size={14} /> Disabled
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{ 
                            background: 'rgba(255, 255, 255, 0.05)', 
                            border: 'none', 
                            padding: '0.6rem', 
                            borderRadius: '50%', 
                            cursor: 'pointer', 
                            color: 'white',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Viewer Area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <iframe
                    src={viewerUrl}
                    title={title}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        background: 'white'
                    }}
                    onLoad={() => console.log('Protected document loaded')}
                />
                
                {/* Security Overlay - Transparent layer to catch clicks */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '40px', // Left side catch
                    height: '100%',
                    background: 'transparent',
                    pointerEvents: 'auto'
                }} />
                <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '40px', // Right side catch
                    height: '100%',
                    background: 'transparent',
                    pointerEvents: 'auto'
                }} />
                
                {/* Bottom warning badge */}
                <div style={{
                    position: 'absolute',
                    bottom: '2rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(8px)',
                    padding: '0.5rem 1.25rem',
                    borderRadius: 30,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    pointerEvents: 'none'
                }}>
                    <ShieldAlert size={14} color="#f87171" />
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.8rem', fontWeight: 600 }}>Secured by EduStream Content Protection</span>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    )
}
