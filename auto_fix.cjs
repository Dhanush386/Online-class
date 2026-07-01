const fs = require('fs');
const { execSync } = require('child_process');

let code = fs.readFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', 'utf8');
let lines = code.split('\n');

const applyFixes = () => {
    // 1. Nested Ternary
    const ternaryLine = lines.findIndex(l => l.includes('width: (isMobile && !isLandscape) ? \\'100%\\' : (isMobile && isLandscape ? \\'280px\\' : \\'360px\\')'));
    if (ternaryLine !== -1) {
        lines[ternaryLine] = lines[ternaryLine].replace(
            "width: (isMobile && !isLandscape) ? '100%' : (isMobile && isLandscape ? '280px' : '360px'),",
            "width: (isMobile && !isLandscape) ? '100%' : ((isMobile && isLandscape) ? '280px' : '360px'),"
        );
    }

    // 2. Date.now() Purity
    const dateLine = lines.findIndex(l => l.includes('const joinTimeRef = useRef(Date.now())'));
    if (dateLine !== -1) {
        lines[dateLine] = '    const joinTimeRef = useRef(null)\n    if (joinTimeRef.current === null) joinTimeRef.current = Date.now()';
    }

    // 3. Unused variables & Catch logging
    const warnLine = lines.findIndex(l => l.includes("console.warn('Metadata update not permitted, using data channel only')"));
    if (warnLine !== -1) {
        lines[warnLine] = lines[warnLine].replace(
            "console.warn('Metadata update not permitted, using data channel only')",
            "console.warn('Metadata update not permitted, using data channel only', e)"
        );
    }
    
    // 4. Global window.crypto
    lines = lines.map(l => l.replace(/window\.crypto/g, 'globalThis.crypto'));
    
    // 5. Unused participant
    const partLine = lines.findIndex(l => l.includes('participant && ('));
    // Wait, let's just fix the 5 warnings (missing dependencies)
    // 2033: refreshStats, toast
    const dep2033 = lines.findIndex(l => l.includes('}, [videoData, profile?.id, isOrganizer])'));
    if (dep2033 !== -1) {
        lines[dep2033] = lines[dep2033].replace(
            '}, [videoData, profile?.id, isOrganizer])',
            '}, [videoData, profile?.id, isOrganizer, refreshStats, toast])'
        );
    }
    
    // 2050: toast
    const dep2050 = lines.findIndex(l => l.includes('}, [room, isOrganizer, profile, videoData, onLeave])'));
    if (dep2050 !== -1) {
        lines[dep2050] = lines[dep2050].replace(
            '}, [room, isOrganizer, profile, videoData, onLeave])',
            '}, [room, isOrganizer, profile, videoData, onLeave, toast])'
        );
    }
    
    // 2455: navigate, profile?.id, profile?.role
    const dep2455 = lines.findIndex(l => l.includes('}, [videoId, isOrganizer])'));
    if (dep2455 !== -1) {
        lines[dep2455] = lines[dep2455].replace(
            '}, [videoId, isOrganizer])',
            '}, [videoId, isOrganizer, navigate, profile?.id, profile?.role])'
        );
    }
    
    // 2483: startMeeting, videoId
    const dep2483 = lines.findIndex(l => l.includes('}, [videoData, isOrganizer, instructorPresent, joinStatus, livekitToken])'));
    if (dep2483 !== -1) {
        lines[dep2483] = lines[dep2483].replace(
            '}, [videoData, isOrganizer, instructorPresent, joinStatus, livekitToken])',
            '}, [videoData, isOrganizer, instructorPresent, joinStatus, livekitToken, startMeeting, videoId])'
        );
    }

    fs.writeFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', lines.join('\n'));
};

applyFixes();
console.log('Applied fixes');
