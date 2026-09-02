import { Suspense, lazy, useState } from 'react'
import PropTypes from 'prop-types'

// Lazy load Spline to avoid heavy initial bundle block
const Spline = lazy(() => import('@splinetool/react-spline'))

/**
 * Reusable Spline 3D Scene Viewer
 * @param {string} scene - URL to .splinecode scene
 * @param {string} className - Optional styling classes
 * @param {object} style - Inline styles
 * @param {function} onLoad - Callback when scene loads
 */
export default function SplineScene({
    scene = 'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode',
    className = '',
    style = {},
    onLoad
}) {
    const [isLoaded, setIsLoaded] = useState(false)

    function handleSplineLoad(splineApp) {
        setIsLoaded(true)
        if (onLoad) onLoad(splineApp)
    }

    return (
        <div
            className={`spline-container ${className}`}
            style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                ...style
            }}
        >
            {/* Loading placeholder skeleton */}
            {!isLoaded && (
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'radial-gradient(circle at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 70%)',
                        zIndex: 0,
                        pointerEvents: 'none'
                    }}
                >
                    <div
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: '50%',
                            border: '3px solid rgba(99,102,241,0.2)',
                            borderTopColor: 'var(--primary-500, #6366f1)',
                            animation: 'spin 0.8s linear infinite'
                        }}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.75rem', fontWeight: 600 }}>
                        Loading 3D Experience...
                    </span>
                </div>
            )}

            <Suspense fallback={null}>
                <Spline
                    scene={scene}
                    onLoad={handleSplineLoad}
                    style={{
                        width: '100%',
                        height: '100%',
                        opacity: isLoaded ? 1 : 0,
                        transition: 'opacity 0.5s ease'
                    }}
                />
            </Suspense>
        </div>
    )
}

SplineScene.propTypes = {
    scene: PropTypes.string.isRequired,
    className: PropTypes.string,
    style: PropTypes.object,
    onLoad: PropTypes.func
}
