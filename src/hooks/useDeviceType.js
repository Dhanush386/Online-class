import { useState, useEffect } from 'react';

export const useDeviceType = () => {
    const [deviceType, setDeviceType] = useState({
        isMobile: window.innerWidth <= 768,
        isTablet: window.innerWidth > 768 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024 && !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    });

    useEffect(() => {
        const handleResize = () => {
            setDeviceType({
                isMobile: window.innerWidth <= 768,
                isTablet: window.innerWidth > 768 && window.innerWidth < 1024,
                isDesktop: window.innerWidth >= 1024 && !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return deviceType;
};
