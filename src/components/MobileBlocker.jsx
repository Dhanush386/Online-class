import { Monitor, Keyboard, MousePointer2, AlertTriangle, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useDeviceType } from '../hooks/useDeviceType'

export default function MobileBlocker() {
    const navigate = useNavigate()
    const { profile } = useAuth()
    const { isMobile, isTablet } = useDeviceType()
    const returnPath = profile?.role === 'organizer' ? '/organizer' : '/student'
    
    let deviceName = 'Unsupported Screen'
    if (isMobile) {
        deviceName = 'Mobile Phone'
    } else if (isTablet) {
        deviceName = 'Tablet'
    }

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <div className="animate-scale-up" style={{ width: '100%', maxWidth: 420, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <Monitor size={32} color="#3b82f6" />
                </div>

                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ffffff', marginBottom: '0.85rem' }}>Desktop Required</h1>
                
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                    This feature is designed for laptops and desktop computers to provide the best experience.
                </p>

                <div style={{ width: '100%', background: '#0f172a', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700, marginBottom: '0.85rem' }}>Required Setup</div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#e2e8f0', fontSize: '0.85rem' }}><Keyboard size={16} color="#10b981" /> Physical Keyboard</li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#e2e8f0', fontSize: '0.85rem' }}><MousePointer2 size={16} color="#10b981" /> Precision Mouse/Trackpad</li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', color: '#e2e8f0', fontSize: '0.85rem' }}><Monitor size={16} color="#10b981" /> Minimum Width: 1024px</li>
                    </ul>
                </div>

                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 8, marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                        <AlertTriangle size={18} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Current Device:</span>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f87171' }}>{deviceName}</span>
                </div>

                <button onClick={() => navigate(returnPath)} style={{ width: '100%', background: '#3b82f6', color: '#ffffff', border: 'none', padding: '0.875rem', borderRadius: 8, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'background 0.2s' }}>
                    <ArrowLeft size={18} /> Return to Dashboard
                </button>
            </div>
        </div>
    )
}
