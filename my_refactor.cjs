const fs = require('node:fs');
const path = require('node:path');

const filePath = path.join(__dirname, 'src', 'pages', 'organizer', 'StudentManagement.jsx');
let content = fs.readFileSync(filePath, 'utf-8').replaceAll('\r\n', '\n');

// Find the start of the return block
const mainReturnRegex = /return \(\s*<div className="animate-fade-in">\s*<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>/;
const returnMatch = mainReturnRegex.exec(content);
if (!returnMatch) throw new Error("Could not find main return block");

const returnIndex = returnMatch.index;

const injectIndex = content.lastIndexOf('    return (', returnIndex);

const teamTabStart = content.indexOf(`            ) : tab === 'team' ? (\n                <div className="animate-fade-in">`);
const groupsTabStart = content.indexOf(`            ) : tab === 'groups' ? (\n                <div className="animate-fade-in">`);
const emptyStateStart = content.indexOf(`            ) : filtered.length === 0 ? (\n                <div className="glass-card" style={{ padding: '4rem', textAlign: 'center' }}>`);
const studentsListStart = content.indexOf(`            ) : (\n                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>`);
const studentsListEnd = content.indexOf(`            )}\n\n            {assigningTo && (`);
const assignModalStart = content.indexOf(`            {assigningTo && (`);
const fileEnd = content.indexOf(`        </div>\n    )\n}`);

if (teamTabStart === -1) console.log("Failed: teamTabStart");
if (groupsTabStart === -1) console.log("Failed: groupsTabStart");
if (emptyStateStart === -1) console.log("Failed: emptyStateStart");
if (studentsListStart === -1) console.log("Failed: studentsListStart");
if (assignModalStart === -1) console.log("Failed: assignModalStart");
if (fileEnd === -1) console.log("Failed: fileEnd");

if (teamTabStart === -1 || groupsTabStart === -1 || emptyStateStart === -1 || studentsListStart === -1 || assignModalStart === -1 || fileEnd === -1) {
    throw new Error("Could not find all blocks");
}

const teamContent = content.substring(
    teamTabStart + `            ) : tab === 'team' ? (\n`.length,
    groupsTabStart
).trimEnd();

const groupsContent = content.substring(
    groupsTabStart + `            ) : tab === 'groups' ? (\n`.length,
    emptyStateStart
).trimEnd();

const emptyStateContent = content.substring(
    emptyStateStart + `            ) : filtered.length === 0 ? (\n`.length,
    studentsListStart
).trimEnd();

const studentsListActualContent = content.substring(
    content.indexOf(`                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>`, studentsListStart),
    content.indexOf(`                </div>\n            )}\n\n            {assigningTo && (`, studentsListStart) + `                </div>`.length
);

const modalsContent = content.substring(assignModalStart, fileEnd).trimEnd();


const helpers = String.raw`
    const renderTeamTab = () => (
${teamContent}
    );

    const renderGroupsTab = () => (
${groupsContent}
    );

    const renderEmptyState = () => (
${emptyStateContent}
    );

    const renderStudentsList = () => (
${studentsListActualContent}
    );

    const renderStudentModal = () => (
        <>
${modalsContent.split('\n').map(line => '        ' + line).join('\n').replace(/^ {8}/gm, '')}
        </>
    );
`;

const newConditional = `            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading data...</p>
                </div>
            ) : tab === 'team' ? (
                renderTeamTab()
            ) : tab === 'groups' ? (
                renderGroupsTab()
            ) : filtered.length === 0 ? (
                renderEmptyState()
            ) : (
                renderStudentsList()
            )}

            {renderStudentModal()}`;

let newContent = content.substring(0, injectIndex) + helpers + '\n' + content.substring(injectIndex, content.indexOf(`            {loading ? (`));

newContent += newConditional;
newContent += `\n        </div>\n    )\n}\n` + content.substring(content.indexOf(`\nfunction StudentProfileModal`));

fs.writeFileSync(filePath, newContent, 'utf-8');
console.log("Refactoring complete");
