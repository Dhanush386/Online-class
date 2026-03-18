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

        const tokens = []
        const pushToken = (match, color) => {
            tokens.push(`<span style="color: ${color}">${match}</span>`)
            return `___TOKEN_${tokens.length - 1}___`
        }

        if (lang === 'html' || lang === 'web') {
            // 1. Strings (inside attributes) - process first
            html = html.replace(/"([^"]*)"/g, m => pushToken(m, '#34d399'))
            // 2. Tags
            html = html.replace(/(&lt;\/?[a-z1-6]+)(&gt;| )/gi, m => pushToken(m, '#f87171'))
            // 3. Attributes
            html = html.replace(/ ([a-z-]+)=/gi, m => pushToken(m, '#fbbf24'))
        } else if (lang === 'css') {
            // 1. Values (often contains strings/urls)
            html = html.replace(/: ([^;]+);/g, (m, v) => ': ' + pushToken(v, '#fbbf24') + ';')
            // 2. Properties
            html = html.replace(/([a-z-]+):/gi, m => pushToken(m, '#60a5fa'))
            // 3. Selectors
            html = html.replace(/^([.#a-z][^{]+) {/gim, (m, s) => pushToken(s, '#f87171') + ' {')
        } else {
            // JS / Python / SQL Common
            // 1. Comments (lowest priority to overlap, but highest to ignore)
            const commentRegex = lang === 'python' ? /(#.*)/g : lang === 'sql' ? /(--.*)/g : /(\/\/.*)/g
            html = html.replace(commentRegex, m => pushToken(m, '#94a3b8'))

            // 2. Strings
            html = html.replace(/"([^"]*)"/g, m => pushToken(m, '#34d399'))
            html = html.replace(/'([^']*)'/g, m => pushToken(m, '#34d399'))

            // 3. Keywords
            const keywords = {
                js: /\b(const|let|var|function|return|if|else|for|while|import|export|class|from|await|async|try|catch|new|this)\b/g,
                python: /\b(def|class|return|if|else|elif|for|while|import|from|as|try|except|with|async|await|in|is|not|and|or|lambda|print)\b/g,
                sql: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|JOIN|LEFT|RIGHT|INNER|ON|GROUP|BY|ORDER|LIMIT|ASC|DESC)\b/gi
            }
            const activeKeywords = keywords[lang] || keywords.js
            html = html.replace(activeKeywords, m => pushToken(m, '#c084fc'))

            // 4. Numbers
            html = html.replace(/\b(\d+)\b/g, m => pushToken(m, '#fbbf24'))
        }

        // Restore tokens
        return html.replace(/___TOKEN_(\d+)___/g, (m, id) => tokens[id])
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
