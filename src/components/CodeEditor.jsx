import React, { useRef, useEffect } from 'react'

const CodeEditor = ({ value, onChange, language, placeholder, style, readOnly }) => {
    const textareaRef = useRef(null)
    const preRef = useRef(null)

    // Sync scrolling
    const handleScroll = () => {
        if (preRef.current && textareaRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop
            preRef.current.scrollLeft = textareaRef.current.scrollLeft
        }
    }

    // Basic Syntax Highlighting Logic
    const highlight = (code, lang) => {
        if (!code) return ''

        // Escaping HTML
        let html = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')

        if (lang === 'html' || lang === 'web') {
            // Tags
            html = html.replace(/(&lt;\/?[a-z1-6]+)(&gt;| )/gi, '<span style="color: #f87171">$1</span>$2')
            // Attributes
            html = html.replace(/ ([a-z-]+)=/gi, ' <span style="color: #fbbf24">$1</span>=')
            // Strings
            html = html.replace(/"([^"]*)"/g, '<span style="color: #34d399">"$1"</span>')
        } else if (lang === 'css') {
            // Properties
            html = html.replace(/([a-z-]+):/gi, '<span style="color: #60a5fa">$1</span>:')
            // Values
            html = html.replace(/: ([^;]+);/g, ': <span style="color: #fbbf24">$1</span>;')
            // Selectors (very basic)
            html = html.replace(/^([.#a-z][^{]+) {/gim, '<span style="color: #f87171">$1</span> {')
        } else {
            // JS / Python / SQL Common
            const keywords = {
                js: /\b(const|let|var|function|return|if|else|for|while|import|export|class|from|await|async|try|catch|new|this)\b/g,
                python: /\b(def|class|return|if|else|elif|for|while|import|from|as|try|except|with|async|await|in|is|not|and|or|lambda)\b/g,
                sql: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|JOIN|LEFT|RIGHT|INNER|ON|GROUP|BY|ORDER|LIMIT|ASC|DESC)\b/gi
            }

            const activeKeywords = keywords[lang] || keywords.js
            html = html.replace(activeKeywords, '<span style="color: #c084fc">$1</span>')
            
            // Strings
            html = html.replace(/"([^"]*)"/g, '<span style="color: #34d399">"$1"</span>')
            html = html.replace(/'([^']*)'/g, '<span style="color: #34d399">\'$1\'</span>')
            
            // Numbers
            html = html.replace(/\b(\d+)\b/g, '<span style="color: #fbbf24">$1</span>')

            // Comments
            if (lang === 'python') {
                html = html.replace(/(#.*)/g, '<span style="color: #94a3b8">$1</span>')
            } else if (lang === 'sql') {
                html = html.replace(/(--.*)/g, '<span style="color: #94a3b8">$1</span>')
            } else {
                html = html.replace(/(\/\/.*)/g, '<span style="color: #94a3b8">$1</span>')
            }
        }

        return html
    }

    const handleKeyDown = (e) => {
        if (readOnly) return
        
        const start = e.target.selectionStart
        const end = e.target.selectionEnd
        const val = e.target.value

        // Handle Tab
        if (e.key === 'Tab') {
            e.preventDefault()
            const newVal = val.substring(0, start) + '  ' + val.substring(end)
            onChange({ target: { value: newVal } })
            
            // Set cursor position after render
            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = start + 2
            }, 0)
        }

        // Handle Auto-closing characters
        const pairMap = {
            '(': ')',
            '[': ']',
            '{': '}',
            '"': '"',
            "'": "'"
        }

        if (pairMap[e.key]) {
            e.preventDefault()
            const pair = pairMap[e.key]
            const newVal = val.substring(0, start) + e.key + pair + val.substring(end)
            onChange({ target: { value: newVal } })

            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = start + 1
            }, 0)
        }

        // Handle Enter for intelligent indentation
        if (e.key === 'Enter') {
            e.preventDefault()
            const lines = val.substring(0, start).split('\n')
            const currentLine = lines[lines.length - 1]
            const indentation = currentLine.match(/^\s*/)[0]
            
            // Extra indent if line ends with : or {
            let extra = ''
            if (currentLine.trim().endsWith(':') || currentLine.trim().endsWith('{')) {
                extra = '  '
            }

            const newVal = val.substring(0, start) + '\n' + indentation + extra + val.substring(end)
            onChange({ target: { value: newVal } })

            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = start + 1 + indentation.length + extra.length
                handleScroll()
            }, 0)
        }
    }

    useEffect(() => {
        handleScroll()
    }, [value])

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', fontVariantLigatures: 'none', ...style }}>
            {/* The Highlight Display Layer */}
            <pre
                ref={preRef}
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    margin: 0,
                    padding: '1.5rem',
                    pointerEvents: 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    background: 'transparent',
                    color: '#e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: '1rem',
                    lineHeight: 1.5,
                    border: 'none',
                    overflow: 'auto',
                    boxSizing: 'border-box'
                }}
                dangerouslySetInnerHTML={{ __html: highlight(value, language) + '<br/>' }}
            />

            {/* The Invisible Input Layer */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={onChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                placeholder={placeholder}
                spellCheck={false}
                readOnly={readOnly}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    padding: '1.5rem',
                    background: 'transparent',
                    color: 'transparent', // Hide the text, use caret only
                    caretColor: '#e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: '1rem',
                    lineHeight: 1.5,
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: 'auto',
                    boxSizing: 'border-box',
                    zIndex: 1
                }}
            />
        </div>
    )
}

export default CodeEditor
