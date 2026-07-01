const fs = require('node:fs');
let code = fs.readFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', 'utf8');

code = code.replace(
    /width: \(isMobile && !isLandscape\) \? '100%' : \(isMobile && isLandscape\) \? '280px' : '360px', \/\/ Original ternary\\n\s+\/\/ wait, let's just refactor this:\\n/,
    "width: (isMobile && !isLandscape) ? '100%' : ((isMobile && isLandscape) ? '280px' : '360px'),"
);

// Actually, I can just use a simple regex replace:
code = code.replace(
    /style=\{\{\s*width: \(isMobile && !isLandscape\) \? '100%' : \(\(isMobile && isLandscape\) \? '280px' : '360px'\),\s*height: \(isMobile && !isLandscape\) \? '60%' : '100%',/g,
    "style={{\n                            width: sidebarWidth,\n                            height: (isMobile && !isLandscape) ? '60%' : '100%',"
);

// We need to inject sidebarWidth computation right before the eturn statement.
// Wait, this is inside RoomContent's massive return statement.
const returnIdx = code.indexOf(String.raw`return (\n        <div`);
if (returnIdx !== -1) {
    const sidebarWidthCode = "let sidebarWidth;\n    if (isMobile && !isLandscape) {\n        sidebarWidth = '100%';\n    } else {\n        sidebarWidth = (isMobile && isLandscape) ? '280px' : '360px';\n    }\n\n    ";
    code = code.slice(0, returnIdx) + sidebarWidthCode + code.slice(returnIdx);
}

// Wait, the broken code is width: (isMobile && !isLandscape) ? '100%' : (isMobile && isLandscape) ? '280px' : '360px', // Original ternary\n        // wait, let's just refactor this:\n
code = code.replace(
    /width: \(isMobile && !isLandscape\) \? '100%' : \(isMobile && isLandscape\) \? '280px' : '360px', \/\/ Original ternary\\n\s+\/\/ wait, let's just refactor this:\\n/g,
    "width: sidebarWidth,"
);

fs.writeFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', code);
console.log('Fixed ternary syntax');
