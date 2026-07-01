const fs = require('node:fs');

const path = 'src/pages/organizer/StudentManagement.jsx';
let lines = fs.readFileSync(path, 'utf8').split('\n');

const teamTabJSX = lines.slice(652, 768).join('\n');
const groupsTabJSX = lines.slice(769, 836).join('\n');
const emptyStateJSX = lines.slice(837, 841).join('\n');
const studentsJSX = lines.slice(842, 1072).join('\n');

const renderFunctions = `
    function renderTeamTab() {
        return (
${teamTabJSX}
        )
    }

    function renderGroupsTab() {
        return (
${groupsTabJSX}
        )
    }

    function renderEmptyState() {
        return (
${emptyStateJSX}
        )
    }

    function renderStudentsList() {
        return (
${studentsJSX}
        )
    }
`;

const newBlock = `            ) : tab === 'team' ? renderTeamTab() 
            : tab === 'groups' ? renderGroupsTab() 
            : filtered.length === 0 ? renderEmptyState() 
            : renderStudentsList()}`;

// Replace lines 652 to 1073 (indices 651 to 1072)
lines.splice(651, 1072 - 651 + 1, newBlock);

const returnIndex = lines.findIndex(l => l.trim() === "return (");

// Insert renderFunctions right before the return statement
lines.splice(returnIndex, 0, renderFunctions);

const newContent = lines.join('\n');

fs.writeFileSync(path, newContent, 'utf8');
console.log("Refactored successfully via strict line numbers");
