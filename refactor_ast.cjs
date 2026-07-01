const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');
const path = require('path');

const project = new Project({
    compilerOptions: {
        jsx: "preserve"
    }
});

const filePath = path.join(__dirname, 'src/pages/organizer/StudentManagement.jsx');
const sourceFile = project.addSourceFileAtPath(filePath);

const studentManagementFunc = sourceFile.getFunction('StudentManagement');
if (!studentManagementFunc) {
    throw new Error('Could not find StudentManagement function');
}

// Find the return statement
const returnStatement = studentManagementFunc.getStatements().find(s => s.getKind() === SyntaxKind.ReturnStatement);
if (!returnStatement) {
    throw new Error('Could not find return statement');
}

// The return statement has a ParenthesizedExpression, containing a JsxElement
const returnExpr = returnStatement.getExpression();
const jsxElement = returnExpr.getKind() === SyntaxKind.ParenthesizedExpression 
    ? returnExpr.getExpression() 
    : returnExpr;

if (jsxElement.getKind() !== SyntaxKind.JsxElement) {
    throw new Error('Return expression is not a JsxElement');
}

// Get the children of the JsxElement
const children = jsxElement.getJsxChildren();

// The large conditional expression is a JsxExpression
// We need to find the specific JsxExpression that contains the `loading ? ...` ternary.
let mainConditionalExpression = null;
let modalsElements = [];
let foundConditional = false;

for (const child of children) {
    if (child.getKind() === SyntaxKind.JsxExpression) {
        const expr = child.getExpression();
        if (expr && expr.getKind() === SyntaxKind.ConditionalExpression) {
            // Check if it's the `loading ? ...` one
            if (expr.getCondition().getText() === 'loading') {
                mainConditionalExpression = child;
                foundConditional = true;
                continue;
            }
        }
        
        // Modals are after the main conditional
        if (foundConditional) {
            modalsElements.push(child);
        }
    }
}

if (!mainConditionalExpression) {
    throw new Error('Could not find main conditional expression');
}

// mainConditionalExpression.getExpression() is the `loading ? ... : ...`
let currentTernary = mainConditionalExpression.getExpression();

// Extract the branches
// The structure is:
// loading ? <Loading> : (tab === 'team' ? <Team> : (tab === 'groups' ? <Groups> : (filtered.length === 0 ? <Empty> : <List>)))

let loadingBranch = currentTernary.getWhenTrue();
let rest1 = currentTernary.getWhenFalse(); // tab === 'team' ? ...

let teamBranch = rest1.getWhenTrue();
let rest2 = rest1.getWhenFalse(); // tab === 'groups' ? ...

let groupsBranch = rest2.getWhenTrue();
let rest3 = rest2.getWhenFalse(); // filtered.length === 0 ? ...

let emptyBranch = rest3.getWhenTrue();
let listBranch = rest3.getWhenFalse();

// The listBranch might be a ParenthesizedExpression or just the JsxElement
if (listBranch.getKind() === SyntaxKind.ParenthesizedExpression) {
    listBranch = listBranch.getExpression();
}

// Create the helper functions
const teamText = teamBranch.getText();
const groupsText = groupsBranch.getText();
const emptyText = emptyBranch.getText();
const listText = listBranch.getText();
const modalsText = modalsElements.map(m => m.getText()).join('\\n            ');

const helperFunctions = `
    const renderTeamTab = () => (
        ${teamText}
    );

    const renderGroupsTab = () => (
        ${groupsText}
    );

    const renderEmptyState = () => (
        ${emptyText}
    );

    const renderStudentsList = () => (
        ${listText}
    );

    const renderStudentModal = () => (
        <>
            ${modalsText}
        </>
    );
`;

// Insert the helper functions before the return statement
studentManagementFunc.insertStatements(returnStatement.getChildIndex(), helperFunctions);

// Replace the main conditional expression and modals with calls to the helper functions
// First remove the old modals
for (const modal of modalsElements) {
    modal.replaceWithText('');
}

// Replace the main conditional
const newConditionalText = `{loading ? (
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

mainConditionalExpression.replaceWithText(newConditionalText);

sourceFile.saveSync();
console.log('Refactoring complete with ts-morph');
