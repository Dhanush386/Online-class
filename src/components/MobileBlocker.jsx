import { Monitor, TabletSmartphone, XCircle, Laptop } from 'lucide-react'

export default function MobileBlocker() {
    return (
        <div className="mobile-blocker">
            <div className="mobile-blocker-content animate-scale-up">
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                    <div style={{ width: 80, height: 80, background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TabletSmartphone size={40} color="#ef4444" />
                    </div>
                    <div style={{ position: 'absolute', top: -5, right: '50%', marginRight: -45, background: 'white', borderRadius: '50%', padding: 2 }}>
                        <XCircle size={28} color="#ef4444" fill="white" />
                    </div>
                </div>

                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Learnova is optimized for Desktop</h1>

                <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                    Learnova's coding environment requires a larger screen. Please switch to one of the following devices:
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', color: '#6366f1' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <Monitor size={28} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>PC</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <Laptop size={28} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Laptop</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <TabletSmartphone size={28} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tablet</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
