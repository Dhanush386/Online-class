import { useState, useEffect } from 'react'
import { X, Download, Smartphone } from 'lucide-react'

export default function PWAInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Check if already in standalone mode
        const isStandalone = globalThis.matchMedia('(display-mode: standalone)').matches || globalThis.navigator.standalone
        
        // Listen for the beforeinstallprompt event
        const handler = (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault()
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e)
            
            // Only show if not already installed and not dismissed this session
            if (!isStandalone && !sessionStorage.getItem('pwa_banner_dismissed')) {
                setIsVisible(true)
            }
        }

        globalThis.addEventListener('beforeinstallprompt', handler)

        // For iOS or cases where beforeinstallprompt doesn't fire but we want to show it
        // We can check if it's mobile and not standalone
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
        if (isMobile && !isStandalone && !sessionStorage.getItem('pwa_banner_dismissed')) {
            // Wait a bit to show
            const timer = setTimeout(() => setIsVisible(true), 3000)
            return () => clearTimeout(timer)
        }

        return () => globalThis.removeEventListener('beforeinstallprompt', handler)
    }, [])

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            // If no deferred prompt (like on iOS), show a simple alert or instructions
            alert('To install: Tap the share button and select "Add to Home Screen"')
            return
        }
        
        // Show the prompt
        deferredPrompt.prompt()
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice
        console.log(`User response to the install prompt: ${outcome}`)
        
        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null)
        setIsVisible(false)
    }

    const dismissBanner = () => {
        setIsVisible(false)
        sessionStorage.setItem('pwa_banner_dismissed', 'true')
    }

    if (!isVisible) return null

    return (
        <div className="pwa-banner-container">
            <div className="pwa-banner-content">
                <div className="pwa-banner-info">
                    <div className="pwa-icon-box">
                        <Smartphone size={20} />
                    </div>
                    <div>
                        <h4 className="pwa-title">Install Learnova App</h4>
                        <p className="pwa-subtitle">Get the best experience on your phone</p>
                    </div>
                </div>
                <div className="pwa-banner-actions">
                    <button onClick={handleInstallClick} className="pwa-install-btn">
                        <Download size={16} />
                        Install
                    </button>
                    <button onClick={dismissBanner} className="pwa-close-btn">
                        <X size={20} />
                    </button>
                </div>
            </div>

            <style>{`
                .pwa-banner-container {
                    position: fixed;
                    top: 1rem;
                    left: 1rem;
                    right: 1rem;
                    z-index: 10000;
                    animation: slideDown 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .pwa-banner-content {
                    background: rgba(15, 23, 42, 0.9);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 0.75rem 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
                }

                .pwa-banner-info {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .pwa-icon-box {
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    flex-shrink: 0;
                }

                .pwa-title {
                    color: white;
                    font-size: 0.875rem;
                    font-weight: 700;
                    margin: 0;
                }

                .pwa-subtitle {
                    color: var(--text-muted);
                    font-size: 0.75rem;
                    margin: 0;
                }

                .pwa-banner-actions {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .pwa-install-btn {
                    background: white;
                    color: #0f172a;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 8px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.375rem;
                    transition: transform 0.2s ease;
                }

                .pwa-install-btn:active {
                    transform: scale(0.95);
                }

                .pwa-close-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    transition: background 0.2s ease;
                }

                .pwa-close-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                @keyframes slideDown {
                    from { transform: translateY(-100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                @media (min-width: 768px) {
                    .pwa-banner-container {
                        max-width: 400px;
                        left: auto;
                        right: 1.5rem;
                        top: 1.5rem;
                    }
                }
            `}</style>
        </div>
    )
}
