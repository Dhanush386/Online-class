const fs = require('fs');
let code = fs.readFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', 'utf8');

// 7. Destructuring in RoomContent
let startIdx = code.indexOf('function RoomContent({ videoId,');
let endIdx = code.indexOf('RoomContent.propTypes =');
let roomContentCode = code.slice(startIdx, endIdx);

roomContentCode = roomContentCode.replace(
    'const { isMobile, isLandscape } = useDeviceOrientation()',
    'const { isMobile, isLandscape } = useDeviceOrientation()\n    const { id: videoDataId, title: videoDataTitle } = videoData || {};\n    const { id: profileId } = profile || {};\n    const { info: toastInfo, success: toastSuccess, warning: toastWarning, error: toastError } = toast || {};'
);

roomContentCode = roomContentCode.replace(/toast\.info/g, 'toastInfo');
roomContentCode = roomContentCode.replace(/toast\.success/g, 'toastSuccess');
roomContentCode = roomContentCode.replace(/toast\.warning/g, 'toastWarning');
roomContentCode = roomContentCode.replace(/toast\.error/g, 'toastError');
roomContentCode = roomContentCode.replace(/videoData\.id/g, 'videoDataId');
roomContentCode = roomContentCode.replace(/videoData\?\.id/g, 'videoDataId');
roomContentCode = roomContentCode.replace(/videoData\.title/g, 'videoDataTitle');
roomContentCode = roomContentCode.replace(/videoData\?\.title/g, 'videoDataTitle');
roomContentCode = roomContentCode.replace(/profile\.id/g, 'profileId');
roomContentCode = roomContentCode.replace(/profile\?\.id/g, 'profileId');

code = code.slice(0, startIdx) + roomContentCode + code.slice(endIdx);

// 8. Destructuring in RoomSidebar
startIdx = code.indexOf('function RoomSidebar(props) {');
endIdx = code.indexOf('RoomSidebar.propTypes =');
let sidebarCode = code.slice(startIdx, endIdx);

sidebarCode = sidebarCode.replace(
    'announcementText, setAnnouncementText, videoData',
    'announcementText, setAnnouncementText, videoData: { title: videoDataTitle } = {}'
);
sidebarCode = sidebarCode.replace(/videoData\?\.title/g, 'videoDataTitle');

// 9. Nested Ternary in RoomSidebar
sidebarCode = sidebarCode.replace(
    /const wrapperStyle = \{\s+width: \(isMobile && !isLandscape\) \? '100%' : \(isMobile && isLandscape \? '280px' : '360px'\),/,
    "let sidebarWidth;\n    if (isMobile && !isLandscape) {\n        sidebarWidth = '100%';\n    } else {\n        sidebarWidth = (isMobile && isLandscape) ? '280px' : '360px';\n    }\n\n    const wrapperStyle = {\n        width: sidebarWidth,"
);

code = code.slice(0, startIdx) + sidebarCode + code.slice(endIdx);

// 10. Destructuring in RoomHeader
startIdx = code.indexOf('function RoomHeader({ videoData,');
endIdx = code.indexOf('RoomHeader.propTypes =');
let headerCode = code.slice(startIdx, endIdx);

headerCode = headerCode.replace(
    'function RoomHeader({ videoData,',
    'function RoomHeader({ videoData: { title: videoDataTitle } = {},'
);
headerCode = headerCode.replace(/videoData\?\.title/g, 'videoDataTitle');

code = code.slice(0, startIdx) + headerCode + code.slice(endIdx);

fs.writeFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', code);
console.log('Batch 2 applied!');
