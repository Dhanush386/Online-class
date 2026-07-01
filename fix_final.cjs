const fs = require('node:fs');
let code = fs.readFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', 'utf8');

// 1. Destructure in RoomContent (which fixes the props validation)
let startIdx = code.indexOf('function RoomContent({ videoId,');
let endIdx = code.indexOf('RoomContent.propTypes =');
let roomContentCode = code.slice(startIdx, endIdx);

roomContentCode = roomContentCode.replace(
    'const { isMobile, isLandscape } = useDeviceOrientation()',
    'const { isMobile, isLandscape } = useDeviceOrientation()\n    const { id: videoDataId, title: videoDataTitle } = videoData || {};\n    const { id: profileId } = profile || {};\n    const { info: toastInfo, success: toastSuccess, warning: toastWarning, error: toastError } = toast || {};'
);

// ONLY replace occurrences of toast and videoData inside RoomContent Code block!
roomContentCode = roomContentCode.replace(/toast\.info/g, 'toastInfo');
roomContentCode = roomContentCode.replace(/toast\.success/g, 'toastSuccess');
roomContentCode = roomContentCode.replace(/toast\.warning/g, 'toastWarning');
roomContentCode = roomContentCode.replace(/toast\.error/g, 'toastError');

roomContentCode = roomContentCode.replace(/videoData\?\.id/g, 'videoDataId');
roomContentCode = roomContentCode.replace(/videoData\.id/g, 'videoDataId');
roomContentCode = roomContentCode.replace(/videoData\?\.title/g, 'videoDataTitle');
roomContentCode = roomContentCode.replace(/videoData\.title/g, 'videoDataTitle');

roomContentCode = roomContentCode.replace(/profile\?\.id/g, 'profileId');
roomContentCode = roomContentCode.replace(/profile\.id/g, 'profileId');

// 2. Fix nested ternary IN wrapperStyle
roomContentCode = roomContentCode.replace(
    /width: \(isMobile && !isLandscape\) \? '100%' : \(isMobile && isLandscape \? '280px' : '360px'\),/g,
    "width: (isMobile && !isLandscape) ? '100%' : ((isMobile && isLandscape) ? '280px' : '360px'),"
);

// 3. globalThis.crypto
roomContentCode = roomContentCode.replace(
    /window\.crypto\.getRandomValues/g,
    'globalThis.crypto.getRandomValues'
);

// 4. toggleHandRaise catch
roomContentCode = roomContentCode.replace(
    /} catch \(e\) \{\n\s+\/\/ Permission denied — metadata not available, that's OK\n\s+console\.warn\('Metadata update not permitted, using data channel only'\)/,
    "} catch (e) {\n            // Permission denied — metadata not available, that's OK\n            console.warn('Metadata update not permitted, using data channel only:', e)"
);

// 5. Date.now() purity
roomContentCode = roomContentCode.replace(
    'const joinTimeRef = useRef(Date.now())',
    'const joinTimeRef = useRef(null)\n    if (joinTimeRef.current === null) joinTimeRef.current = Date.now()'
);

// 6. removeReaction helper and sendReaction timeout
if (roomContentCode.indexOf('const removeReaction') === -1) {
    roomContentCode = roomContentCode.replace(
        'const sendReaction = useCallback((emoji) => {',
        'const removeReaction = useCallback((idToRemove) => {\n        setReactions(prev => prev.filter(r => r.id !== idToRemove))\n    }, [])\n\n    const sendReaction = useCallback((emoji) => {'
    );
    roomContentCode = roomContentCode.replace(
        /setTimeout\(\(\) => setReactions\(prev => prev\.filter\(r => r\.id !== id\)\), 2800\)\n\s+\}, \[room, reactionsDisabled\]\)/,
        "setTimeout(() => removeReaction(id), 2800)\n    }, [room, reactionsDisabled, removeReaction])"
    );
}

code = code.slice(0, startIdx) + roomContentCode + code.slice(endIdx);
fs.writeFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', code);
console.log('Restored perfectly!');
