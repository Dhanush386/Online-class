import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'

// Feature flag: set VITE_LIVE_CLASS_PROVIDER=jitsi in .env to use legacy Jitsi
const PROVIDER = import.meta.env.VITE_LIVE_CLASS_PROVIDER || 'livekit'

const LiveClassroomLiveKit = lazy(() => import('./LiveClassroomLiveKit'))
const LiveClassroomJitsi = lazy(() => import('./LiveClassroomJitsi'))

const LoadingFallback = () => (
    <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#020617', flexDirection: 'column', gap: '1rem'
    }}>
        <Loader2 size={32} className="animate-spin" color="#6366f1" />
        <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Loading Learnova Meet...</p>
    </div>
)

export default function LiveClassroom() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            {PROVIDER === 'livekit' ? <LiveClassroomLiveKit /> : <LiveClassroomJitsi />}
        </Suspense>
    )
}
