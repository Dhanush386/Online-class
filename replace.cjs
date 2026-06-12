const fs = require('fs');
let code = fs.readFileSync('src/pages/student/CodeWorkspace.jsx', 'utf8');

// Replace backgrounds
code = code.replace(/background: '#0f172a'/g, "background: '#f1f5f9'");
code = code.replace(/background: '#1e293b'/g, "background: '#ffffff'");
code = code.replace(/background: '#111827'/g, "background: '#f8fafc'");
code = code.replace(/background: '#334155'/g, "background: '#e2e8f0'");

// Replace borders
code = code.replace(/border: '1px solid #334155'/g, "border: '1px solid #e2e8f0'");
code = code.replace(/borderBottom: '1px solid #334155'/g, "borderBottom: '1px solid #e2e8f0'");
code = code.replace(/borderTop: '1px solid #334155'/g, "borderTop: '1px solid #e2e8f0'");
code = code.replace(/borderLeft: `3px solid \${passed === true \? '#10b981' : passed === false \? '#ef4444' : '#334155'}`/g, "borderLeft: `3px solid ${passed === true ? '#10b981' : passed === false ? '#ef4444' : '#cbd5e1'}`");

// Replace text colors
code = code.replace(/color: '#fff'/g, "color: '#0f172a'");
code = code.replace(/color: '#e2e8f0'/g, "color: '#1e293b'");
code = code.replace(/color: '#cbd5e1'/g, "color: '#334155'");
code = code.replace(/color: '#94a3b8'/g, "color: '#64748b'");

// Re-fix button text colors and specific inverted elements
code = code.replace(/background: '#3b82f6', border: 'none', color: '#0f172a'/g, "background: '#3b82f6', border: 'none', color: '#fff'");
code = code.replace(/background: '#f59e0b', border: 'none', color: '#0f172a'/g, "background: '#f59e0b', border: 'none', color: '#fff'");
code = code.replace(/background: 'linear-gradient\\(135deg, #3b82f6, #2563eb\\)', border: 'none', color: '#0f172a'/g, "background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff'");

// Re-fix tabs
code = code.replace(/color: leftTab === 'description' \? '#0f172a' : '#64748b'/g, "color: leftTab === 'description' ? '#1e293b' : '#64748b'");
code = code.replace(/color: leftTab === 'help' \? '#0f172a' : '#64748b'/g, "color: leftTab === 'help' ? '#1e293b' : '#64748b'");
code = code.replace(/color: leftTab === 'discuss' \? '#0f172a' : '#64748b'/g, "color: leftTab === 'discuss' ? '#1e293b' : '#64748b'");

// Pre tag color fix
code = code.replace(/color: passed \? '#10b981' : '#f87171'/g, "color: passed ? '#059669' : '#dc2626'");
code = code.replace(/color: '#a7f3d0'/g, "color: '#064e3b'");
code = code.replace(/background: '#022c22'/g, "background: '#ecfdf5'");
code = code.replace(/background: '#052e16'/g, "background: '#d1fae5'");

// Run button fix
code = code.replace(/background: '#ffffff', border: '1px solid #e2e8f0', color: '#0f172a'/g, "background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b'");

// Add theme to CodeEditor
code = code.replace(/<CodeEditor /g, "<CodeEditor theme='light' ");

fs.writeFileSync('src/pages/student/CodeWorkspace.jsx', code);
console.log('CodeWorkspace updated!');

let ceCode = fs.readFileSync('src/components/CodeEditor.jsx', 'utf8');
ceCode = ceCode.replace(/const CodeEditor = \(\{ value, onChange, language, placeholder, style, readOnly \}\) => \{/, "const CodeEditor = ({ value, onChange, language, placeholder, style, readOnly, theme = 'dark' }) => {");
ceCode = ceCode.replace(/color: '#e2e8f0',/g, "color: theme === 'light' ? '#1e293b' : '#e2e8f0',");
ceCode = ceCode.replace(/caretColor: '#e2e8f0',/g, "caretColor: theme === 'light' ? '#1e293b' : '#e2e8f0',");

// Syntax highlighting theme adjustments
ceCode = ceCode.replace(/#34d399/g, "${theme === 'light' ? '#059669' : '#34d399'}");
ceCode = ceCode.replace(/#f87171/g, "${theme === 'light' ? '#dc2626' : '#f87171'}");
ceCode = ceCode.replace(/#fbbf24/g, "${theme === 'light' ? '#d97706' : '#fbbf24'}");
ceCode = ceCode.replace(/#60a5fa/g, "${theme === 'light' ? '#2563eb' : '#60a5fa'}");
ceCode = ceCode.replace(/#94a3b8/g, "${theme === 'light' ? '#64748b' : '#94a3b8'}");
ceCode = ceCode.replace(/#c084fc/g, "${theme === 'light' ? '#9333ea' : '#c084fc'}");

// Need to change to template literal in pushToken calls
ceCode = ceCode.replace(/pushToken\(m, '(\$[^']+)'\)/g, "pushToken(m, `$1`)");
ceCode = ceCode.replace(/pushToken\(v, '(\$[^']+)'\)/g, "pushToken(v, `$1`)");
ceCode = ceCode.replace(/pushToken\(s, '(\$[^']+)'\)/g, "pushToken(s, `$1`)");

fs.writeFileSync('src/components/CodeEditor.jsx', ceCode);
console.log('CodeEditor updated!');
