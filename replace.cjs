const fs = require('node:fs');
let code = fs.readFileSync('src/pages/student/CodeWorkspace.jsx', 'utf8');

// Replace backgrounds
code = code.replaceAll("background: '#0f172a'", "background: '#f1f5f9'");
code = code.replaceAll("background: '#1e293b'", "background: '#ffffff'");
code = code.replaceAll("background: '#111827'", "background: '#f8fafc'");
code = code.replaceAll("background: '#334155'", "background: '#e2e8f0'");

// Replace borders
code = code.replaceAll("border: '1px solid #334155'", "border: '1px solid #e2e8f0'");
code = code.replaceAll("borderBottom: '1px solid #334155'", "borderBottom: '1px solid #e2e8f0'");
code = code.replaceAll("borderTop: '1px solid #334155'", "borderTop: '1px solid #e2e8f0'");
code = code.replaceAll("borderLeft: `3px solid ${passed === true ? '#10b981' : passed === false ? '#ef4444' : '#334155'}`", "borderLeft: `3px solid ${passed === true ? '#10b981' : passed === false ? '#ef4444' : '#cbd5e1'}`");

// Replace text colors
code = code.replaceAll("color: '#fff'", "color: '#0f172a'");
code = code.replaceAll("color: '#e2e8f0'", "color: '#1e293b'");
code = code.replaceAll("color: '#cbd5e1'", "color: '#334155'");
code = code.replaceAll("color: '#94a3b8'", "color: '#64748b'");

// Re-fix button text colors and specific inverted elements
code = code.replaceAll("background: '#3b82f6', border: 'none', color: '#0f172a'", "background: '#3b82f6', border: 'none', color: '#fff'");
code = code.replaceAll("background: '#f59e0b', border: 'none', color: '#0f172a'", "background: '#f59e0b', border: 'none', color: '#fff'");
code = code.replaceAll("background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#0f172a'", "background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff'");

// Re-fix tabs
code = code.replaceAll("color: leftTab === 'description' ? '#0f172a' : '#64748b'", "color: leftTab === 'description' ? '#1e293b' : '#64748b'");
code = code.replaceAll("color: leftTab === 'help' ? '#0f172a' : '#64748b'", "color: leftTab === 'help' ? '#1e293b' : '#64748b'");
code = code.replaceAll("color: leftTab === 'discuss' ? '#0f172a' : '#64748b'", "color: leftTab === 'discuss' ? '#1e293b' : '#64748b'");

// Pre tag color fix
code = code.replaceAll("color: passed ? '#10b981' : '#f87171'", "color: passed ? '#059669' : '#dc2626'");
code = code.replaceAll("color: '#a7f3d0'", "color: '#064e3b'");
code = code.replaceAll("background: '#022c22'", "background: '#ecfdf5'");
code = code.replaceAll("background: '#052e16'", "background: '#d1fae5'");

// Run button fix
code = code.replaceAll("background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a'", "background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b'");

// Add theme to CodeEditor
code = code.replaceAll("<CodeEditor ", "<CodeEditor theme='light' ");

fs.writeFileSync('src/pages/student/CodeWorkspace.jsx', code);
console.log('CodeWorkspace updated!');

let ceCode = fs.readFileSync('src/components/CodeEditor.jsx', 'utf8');
ceCode = ceCode.replace("const CodeEditor = ({ value, onChange, language, placeholder, style, readOnly }) => {", "const CodeEditor = ({ value, onChange, language, placeholder, style, readOnly, theme = 'dark' }) => {");
ceCode = ceCode.replaceAll("color: '#e2e8f0',", "color: theme === 'light' ? '#1e293b' : '#e2e8f0',");
ceCode = ceCode.replaceAll("caretColor: '#e2e8f0',", "caretColor: theme === 'light' ? '#1e293b' : '#e2e8f0',");

// Syntax highlighting theme adjustments
ceCode = ceCode.replaceAll("#34d399", "${theme === 'light' ? '#059669' : '#34d399'}");
ceCode = ceCode.replaceAll("#f87171", "${theme === 'light' ? '#dc2626' : '#f87171'}");
ceCode = ceCode.replaceAll("#fbbf24", "${theme === 'light' ? '#d97706' : '#fbbf24'}");
ceCode = ceCode.replaceAll("#60a5fa", "${theme === 'light' ? '#2563eb' : '#60a5fa'}");
ceCode = ceCode.replaceAll("#94a3b8", "${theme === 'light' ? '#64748b' : '#94a3b8'}");
ceCode = ceCode.replaceAll("#c084fc", "${theme === 'light' ? '#9333ea' : '#c084fc'}");

// Need to change to template literal in pushToken calls
ceCode = ceCode.replace(/pushToken\(m, '(\$[^']+)'\)/g, "pushToken(m, `$1`)");
ceCode = ceCode.replace(/pushToken\(v, '(\$[^']+)'\)/g, "pushToken(v, `$1`)");
ceCode = ceCode.replace(/pushToken\(s, '(\$[^']+)'\)/g, "pushToken(s, `$1`)");

fs.writeFileSync('src/components/CodeEditor.jsx', ceCode);
console.log('CodeEditor updated!');
