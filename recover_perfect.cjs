const fs = require('fs');
let code = fs.readFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', 'utf8');

// Fix props validation in RoomContent by destructuring
code = code.replace(
    'function RoomContent({ videoId, videoData, isOrganizer, profile, channelInstance, sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, onLeave, onMinimize, refreshStats, toast, waitingStudents, setWaitingStudents }) {\\n    const { isMobile, isLandscape } = useDeviceOrientation()\\n    const room = useRoomContext()',
    'function RoomContent({ videoId, videoData, isOrganizer, profile, channelInstance, sidebarOpen, setSidebarOpen, sidebarTab, setSidebarTab, onLeave, onMinimize, refreshStats, toast, waitingStudents, setWaitingStudents }) {\\n    const { isMobile, isLandscape } = useDeviceOrientation()\\n    const { id: videoDataId, title: videoDataTitle } = videoData || {};\\n    const { id: profileId } = profile || {};\\n    const { info: toastInfo, success: toastSuccess, warning: toastWarning, error: toastError } = toast || {};\\n    const room = useRoomContext()'
);

// We must also replace the occurrences inside RoomContent. We can use a targeted replace for this.
// Because it's too error-prone to regex it across the whole file, we will slice RoomContent out.
let startIdx = code.indexOf('function RoomContent({ videoId');
let endIdx = code.indexOf('RoomContent.propTypes =');
let rcCode = code.slice(startIdx, endIdx);

// Inside rcCode, replace toast methods and optional chaining:
rcCode = rcCode.replace(/toast\.info/g, 'toastInfo');
rcCode = rcCode.replace(/toast\.success/g, 'toastSuccess');
rcCode = rcCode.replace(/toast\.warning/g, 'toastWarning');
rcCode = rcCode.replace(/toast\.error/g, 'toastError');

rcCode = rcCode.replace(/videoData\?\.id/g, 'videoDataId');
rcCode = rcCode.replace(/videoData\.id/g, 'videoDataId');
rcCode = rcCode.replace(/videoData\?\.title/g, 'videoDataTitle');
rcCode = rcCode.replace(/videoData\.title/g, 'videoDataTitle');

rcCode = rcCode.replace(/profile\?\.id/g, 'profileId');
rcCode = rcCode.replace(/profile\.id/g, 'profileId');

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
if (rcCode.indexOf('const removeReaction') === -1) {
    rcCode = rcCode.replace(
        'const sendReaction = useCallback((emoji) => {',
        'const removeReaction = useCallback((idToRemove) => {\\n        setReactions(prev => prev.filter(r => r.id !== idToRemove))\\n    }, [])\\n\\n    const sendReaction = useCallback((emoji) => {'
    );
    rcCode = rcCode.replace(
        /setTimeout\(\(\) => setReactions\(prev => prev\.filter\(r => r\.id !== id\)\), 2800\)\\n\s+\}, \[room, reactionsDisabled\]\)/,
        "setTimeout(() => removeReaction(id), 2800)\\n    }, [room, reactionsDisabled, removeReaction])"
    );
}

code = code.slice(0, startIdx) + rcCode + code.slice(endIdx);
fs.writeFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', code);
console.log('Restored perfectly');
