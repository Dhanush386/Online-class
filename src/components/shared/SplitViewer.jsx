import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import ReactPlayer from 'react-player';
import { X, Lock, ShieldAlert } from 'lucide-react';

const formatSlideUrl = (url) => {
    if (!url) return url;
    
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.endsWith('.pdf')) {
        return `${url}#toolbar=0&navpanes=0&scrollbar=0`;
    }
    
    if (lowerUrl.includes('.ppt') || lowerUrl.includes('.pptx')) {
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    }
    
    if (url.includes('drive.google.com/file/d/')) {
        const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
            return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
        }
    }
    
    return url;
};

export default function SplitViewer({ videoUrl, slideUrl, videoType, title, onClose, onEnded, loadingVideo }) {
    const [splitRatio, setSplitRatio] = useState(35); // 35% video, 65% slides
    const [isDragging, setIsDragging] = useState(false);
    const [isMobile, setIsMobile] = useState(globalThis.innerWidth < 768);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(globalThis.innerWidth < 768);
        globalThis.addEventListener('resize', handleResize);
        
        // Load preference
        const savedRatio = localStorage.getItem('learnova_split_ratio_v2');
        if (savedRatio) {
            setSplitRatio(Number(savedRatio));
        }

        return () => globalThis.removeEventListener('resize', handleResize);
    }, []);

    // Protected Viewer Logic for Slides
    useEffect(() => {
        const handleContextMenu = (e) => {
            e.preventDefault();
            alert('Content protection is active. Right-click is disabled.');
        };

        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'u')) {
                e.preventDefault();
                alert('Downloading or printing this material is restricted by the institution.');
            }
        };

        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);

        const style = document.createElement('style');
        style.innerHTML = '@media print { body { display: none !important; } }';
        document.head.appendChild(style);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu);
            document.removeEventListener('keydown', handleKeyDown);
            style.remove();
        };
    }, []);

    const handleMouseMove = (e) => {
        if (!isDragging || !containerRef.current) return;
        
        // Handle both mouse and touch events
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const containerRect = containerRef.current.getBoundingClientRect();
        const newRatio = ((clientY - containerRect.top) / containerRect.height) * 100;
        
        // Constrain between 20% and 80%
        if (newRatio >= 20 && newRatio <= 80) {
            setSplitRatio(newRatio);
        }
    };

    const handleMouseUp = () => {
        if (isDragging) {
            setIsDragging(false);
            localStorage.setItem('learnova_split_ratio_v2', splitRatio);
        }
    };

    useEffect(() => {
        if (isDragging) {
            globalThis.addEventListener('mousemove', handleMouseMove, { passive: false });
            globalThis.addEventListener('mouseup', handleMouseUp);
            globalThis.addEventListener('touchmove', handleMouseMove, { passive: false });
            globalThis.addEventListener('touchend', handleMouseUp);
        } else {
            globalThis.removeEventListener('mousemove', handleMouseMove);
            globalThis.removeEventListener('mouseup', handleMouseUp);
            globalThis.removeEventListener('touchmove', handleMouseMove);
            globalThis.removeEventListener('touchend', handleMouseUp);
        }
        return () => {
            globalThis.removeEventListener('mousemove', handleMouseMove);
            globalThis.removeEventListener('mouseup', handleMouseUp);
            globalThis.removeEventListener('touchmove', handleMouseMove);
            globalThis.removeEventListener('touchend', handleMouseUp);
        };
    }, [isDragging, splitRatio]); // Re-bind with updated ratio

    // Format slide URL
    const formattedSlideUrl = formatSlideUrl(slideUrl);

    return (
        <div style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 10000, 
            background: 'rgba(2, 6, 23, 0.98)', 
            display: 'flex', 
            flexDirection: 'column',
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.3s ease-out'
        }}>
            {/* Header */}
            <div style={{ height: '60px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }} />
                    <h2 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{title}</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: 20 }}>
                        <Lock size={12} /> Secured Session
                    </div>
                    <button 
                        onClick={onClose} 
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: '0.6rem', cursor: 'pointer', color: 'white', display: 'flex', transition: 'background 0.2s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div 
                ref={containerRef}
                style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                    <>
                        {/* Video Area */}
                        <div style={{ height: `${splitRatio}%`, position: 'relative', background: '#000', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ flex: 1, position: 'relative' }}>
                                {loadingVideo ? (
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: '1rem' }}>
                                        <div style={{ width: 40, height: 40, border: '4px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                        <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.5)' }}>Securing connection...</span>
                                    </div>
                                ) : (
                                    <VideoPlayer 
                                        videoUrl={videoUrl} 
                                        videoType={videoType} 
                                        onEnded={onEnded} 
                                        title={title}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Resize Handle */}
                        <div 
                            role="slider"
                            tabIndex={0}
                            aria-valuemin={20}
                            aria-valuemax={80}
                            aria-valuenow={splitRatio}
                            aria-label="Resize panels"
                            onMouseDown={() => setIsDragging(true)}
                            onTouchStart={() => setIsDragging(true)}
                            style={{ 
                                height: '12px', 
                                background: isDragging ? '#6366f1' : 'rgba(255,255,255,0.05)', 
                                cursor: 'row-resize',
                                display: 'flex',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s',
                                zIndex: 10
                            }}
                            onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
                            onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                        >
                            <div style={{ width: 30, height: 3, background: 'rgba(255,255,255,0.4)', borderRadius: 2, margin: '0 2px' }} />
                            <div style={{ width: 30, height: 3, background: 'rgba(255,255,255,0.4)', borderRadius: 2, margin: '0 2px' }} />
                        </div>

                        {/* Slides Area */}
                        <div style={{ height: `calc(${100 - splitRatio}% - 12px)`, position: 'relative', background: 'white' }}>
                            <SlideViewer url={formattedSlideUrl} title={title} />
                        </div>
                    </>
            </div>

            {isDragging && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'row-resize' }} />
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

SplitViewer.propTypes = {
    videoUrl: PropTypes.string,
    slideUrl: PropTypes.string,
    videoType: PropTypes.string,
    title: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    onEnded: PropTypes.func,
    loadingVideo: PropTypes.bool
};

function VideoPlayer({ videoUrl, videoType, onEnded, title }) {
    if (!videoUrl) return null;

    if (videoType === 'drive-iframe') {
        return (
            <iframe
                src={videoUrl}
                width="100%"
                height="100%"
                style={{ position: 'absolute', top: 0, left: 0, border: 'none' }}
                allow="autoplay; fullscreen"
                allowFullScreen
                title={title}
            />
        );
    }

    return (
        <ReactPlayer
            url={videoUrl}
            controls
            playing={true}
            width="100%"
            height="100%"
            style={{ position: 'absolute', top: 0, left: 0 }}
            onEnded={onEnded}
            config={{
                file: {
                    attributes: {
                        controlsList: 'nodownload',
                        disablePictureInPicture: true,
                        onContextMenu: e => e.preventDefault()
                    }
                }
            }}
        />
    );
}

function SlideViewer({ url, title }) {
    if (!url) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', background: '#f8fafc', flexDirection: 'column', gap: '1rem' }}>
                <ShieldAlert size={48} opacity={0.2} />
                <p>No slides available for this session.</p>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <iframe
                src={url}
                title={title}
                style={{ width: '100%', height: '100%', border: 'none' }}
            />
            
            {/* Security Overlays */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: '40px', height: '100%', background: 'transparent' }} />
            <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', height: '100%', background: 'transparent' }} />
            <div style={{ position: 'absolute', bottom: '1rem', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)', padding: '0.4rem 1rem', borderRadius: 30, border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '0.5rem', pointerEvents: 'none' }}>
                <ShieldAlert size={12} color="#f87171" />
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600 }}>Protected View</span>
            </div>
        </div>
    );
}

VideoPlayer.propTypes = {
    videoUrl: PropTypes.string,
    videoType: PropTypes.string,
    onEnded: PropTypes.func,
    title: PropTypes.string.isRequired
};

SlideViewer.propTypes = {
    url: PropTypes.string,
    title: PropTypes.string.isRequired
};
