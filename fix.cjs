const fs = require('fs');
let code = fs.readFileSync('src/components/CodeEditor.jsx', 'utf8');

// The issue: pushToken(m, '${theme === 'light' ? '#059669' : '#34d399'}')
// We need it to be: pushToken(m, theme === 'light' ? '#059669' : '#34d399')
// Or: pushToken(m, `${theme === 'light' ? '#059669' : '#34d399'}`)

code = code.replace(/'\$\{theme === 'light' \? '([^']+)' : '([^']+)'\}'/g, "theme === 'light' ? '$1' : '$2'");

fs.writeFileSync('src/components/CodeEditor.jsx', code);
console.log('Fixed CodeEditor syntax!');
