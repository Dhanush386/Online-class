const fs = require('node:fs');
let code = fs.readFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', 'utf8');

// Fix props validation in RoomContent by destructuring
code = code.replace(
    String.raw`function RoomContent({ videoId, videoData, isOrganizer, profile, channelInstance, sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, onLeave, onMinimize, refreshStats, toast, waitingStudents, setWaitingStudents }) {\n    const { isMobile, isLandscape } = useDeviceOrientation()\n    const room = useRoomContext()`,
    String.raw`function RoomContent({ videoId, videoData, isOrganizer, profile, channelInstance, sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, onLeave, onMinimize, refreshStats, toast, waitingStudents, setWaitingStudents }) {\n    const { isMobile, isLandscape } = useDeviceOrientation()\n    const { id: videoDataId, title: videoDataTitle } = videoData || {};\n    const { id: profileId } = profile || {};\n    const { info: toastInfo, success: toastSuccess, warning: toastWarning, error: toastError } = toast || {};\n    const room = useRoomContext()`
);

// We must also replace the occurrences inside RoomContent. We can use a targeted replace for this.
// Because it's too error-prone to regex it across the whole file, we will slice RoomContent out.
let startIdx = code.indexOf('function RoomContent({ videoId');
let endIdx = code.indexOf('RoomContent.propTypes =');
let rcCode = code.slice(startIdx, endIdx);

// Inside rcCode, replace toast methods and optional chaining:
rcCode = rcCode.replaceAll('toast.info', 'toastInfo');
rcCode = rcCode.replaceAll('toast.success', 'toastSuccess');
rcCode = rcCode.replaceAll('toast.warning', 'toastWarning');
rcCode = rcCode.replaceAll('toast.error', 'toastError');

rcCode = rcCode.replaceAll('videoData?.id', 'videoDataId');
rcCode = rcCode.replaceAll('videoData.id', 'videoDataId');
rcCode = rcCode.replaceAll('videoData?.title', 'videoDataTitle');
rcCode = rcCode.replaceAll('videoData.title', 'videoDataTitle');

rcCode = rcCode.replaceAll('profile?.id', 'profileId');
rcCode = rcCode.replaceAll('profile.id', 'profileId');

// Nested Ternary Extract
rcCode = rcCode.replace(
    /const wrapperStyle = \{\s+width: \(isMobile && !isLandscape\) \? '100%' : \(isMobile && isLandscape \? '280px' : '360px'\),/g,
    "let sidebarWidth;\n    if (isMobile && !isLandscape) {\n        sidebarWidth = '100%';\n    } else {\n        sidebarWidth = (isMobile && isLandscape) ? '280px' : '360px';\n    }\n\n    const wrapperStyle = {\n        width: sidebarWidth,"
);
// Also fix the case where it's not wrapperStyle but direct style inline:
rcCode = rcCode.replace(
    /style=\{\{\s*width: \(isMobile && !isLandscape\) \? '100%' : \(isMobile && isLandscape\) \? '280px' : '360px',/g,
    "style={{\n                            width: (isMobile && !isLandscape) ? '100%' : ((isMobile && isLandscape) ? '280px' : '360px'),"
);
rcCode = rcCode.replace(
    /style=\{\{\s*width: \(isMobile && !isLandscape\) \? '100%' : \(isMobile && isLandscape \? '280px' : '360px'\),/g,
    "style={{\n                            width: (isMobile && !isLandscape) ? '100%' : ((isMobile && isLandscape) ? '280px' : '360px'),"
);

// Purity of Date.now() inside useRef
rcCode = rcCode.replace(
    'const joinTimeRef = useRef(Date.now())',
    'const joinTimeRef = useRef(null)\n    if (joinTimeRef.current === null) joinTimeRef.current = Date.now()'
);

// Hand raise catch logging
rcCode = rcCode.replace(
    /console\.warn\('Metadata update not permitted, using data channel only'\)/,
    "console.warn('Metadata update not permitted, using data channel only:', e)"
);

// globalThis crypto
rcCode = rcCode.replace(
    /window\.crypto\.getRandomValues/g,
    'globalThis.crypto.getRandomValues'
);

// Extract emoveReaction inside sendReaction
if (!rcCode.includes('const removeReaction')) {
    rcCode = rcCode.replace(
        'const sendReaction = useCallback((emoji) => {',
        String.raw`const removeReaction = useCallback((idToRemove) => {\n        setReactions(prev => prev.filter(r => r.id !== idToRemove))\n    }, [])\n\n    const sendReaction = useCallback((emoji) => {`
    );
    rcCode = rcCode.replace(
        /setTimeout\(\(\) => setReactions\(prev => prev\.filter\(r => r\.id !== id\)\), 2800\)\\n\s+\}, \[room, reactionsDisabled\]\)/,
        String.raw`setTimeout(() => removeReaction(id), 2800)\n    }, [room, reactionsDisabled, removeReaction])`
    );
}

code = code.slice(0, startIdx) + rcCode + code.slice(endIdx);
fs.writeFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', code);
console.log('Restored perfectly');
