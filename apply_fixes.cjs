const fs = require('fs');
let code = fs.readFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', 'utf8');

// 1. setChatLocked in RoomSidebar
code = code.replace(
    'waitingStudents, raisedHandsCount, videoId, chatLocked, channelInstance,',
    'waitingStudents, raisedHandsCount, videoId, chatLocked, setChatLocked, channelInstance,'
);
code = code.replace(
    'chatLocked: PropTypes.bool.isRequired,\n    channelInstance:',
    'chatLocked: PropTypes.bool.isRequired,\n    setChatLocked: PropTypes.func.isRequired,\n    channelInstance:'
);

// 2. Date.now() purity in RoomContent
code = code.replace(
    'const joinTimeRef = useRef(Date.now())',
    'const joinTimeRef = useRef(null)\n    if (joinTimeRef.current === null) joinTimeRef.current = Date.now()'
);

// 3. removeReaction in sendReaction timeout
code = code.replace(
    'setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2800)\n    }, [room, reactionsDisabled])',
    'setTimeout(() => removeReaction(id), 2800)\n    }, [room, reactionsDisabled, removeReaction])'
);

// 4. toggleHandRaise empty catch block
code = code.replace(
    /console\.warn\('Metadata update not permitted, using data channel only'\)/,
    "console.warn('Metadata update not permitted, using data channel only:', e)"
);

// 5. globalThis.crypto in sendReaction
code = code.replace(
    /window\.crypto\.getRandomValues/,
    'globalThis.crypto.getRandomValues'
);

// 6. Handle Data Received unused variables
code = code.replace(
    'const handleDataReceived = (payload, participant) => {',
    'const handleDataReceived = (payload) => {'
);
code = code.replace(
    '} catch (e) {\n                // Not a JSON data message, ignore\n            }',
    '} catch (error) {\n                // Not a JSON data message, ignore\n                console.debug(\'Ignored non-JSON data channel message:\', error)\n            }'
);

fs.writeFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', code);
console.log('Batch 1 applied!');
