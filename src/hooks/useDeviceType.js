import { useState, useEffect } from 'react';

export const useDeviceType = () => {
    const [deviceType, setDeviceType] = useState({
        isMobile: globalThis.innerWidth <= 768,
        isTablet: globalThis.innerWidth > 768 && globalThis.innerWidth < 1024,
        isDesktop: globalThis.innerWidth >= 1024 && !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(globalThis.navigator?.userAgent || ''))
    });

    useEffect(() => {
        const handleResize = () => {
            setDeviceType({
                isMobile: globalThis.innerWidth <= 768,
                isTablet: globalThis.innerWidth > 768 && globalThis.innerWidth < 1024,
                isDesktop: globalThis.innerWidth >= 1024 && !(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(globalThis.navigator?.userAgent || ''))
            });
        };

        globalThis.addEventListener('resize', handleResize);
        return () => globalThis.removeEventListener('resize', handleResize);
    }, []);

    return deviceType;
};
