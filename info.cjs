const fs = require('node:fs');
const lines = fs.readFileSync('src/pages/organizer/LiveClassroomLiveKit.jsx', 'utf8').split('\n');
const idx = lines.findIndex(l => l.includes('width: (isMobile && !isLandscape)'));
console.log('--- Ternary ---');
console.log(idx + ': ' + lines[idx-1]);
console.log((idx+1) + ': ' + lines[idx]);
console.log((idx+2) + ': ' + lines[idx+1]);

const dateIdx = lines.findIndex(l => l.includes('const joinTimeRef = useRef(Date.now())'));
console.log('--- Date.now ---');
console.log(dateIdx + ': ' + lines[dateIdx-1]);
console.log((dateIdx+1) + ': ' + lines[dateIdx]);
console.log((dateIdx+2) + ': ' + lines[dateIdx+1]);

const metaIdx = lines.findIndex(l => l.includes("console.warn('Metadata update not permitted"));
console.log('--- Meta ---');
console.log(metaIdx + ': ' + lines[metaIdx-1]);
console.log((metaIdx+1) + ': ' + lines[metaIdx]);
console.log((metaIdx+2) + ': ' + lines[metaIdx+1]);

const e1 = lines.findIndex(l => l.includes("catch (e)") && l.includes("} catch (e) { console.error("));
console.log('--- E1 ---');
console.log((e1+1) + ': ' + lines[e1]);

const cryptoIdx = lines.findIndex(l => l.includes('window.crypto'));
console.log('--- Crypto ---');
console.log((cryptoIdx+1) + ': ' + lines[cryptoIdx]);
