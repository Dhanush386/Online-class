import React, { useRef, useEffect } from 'react'
import PropTypes from 'prop-types'

const CodeEditor = ({
    value,
    onChange,
    language,
    placeholder,
    style,
    readOnly,
    theme = 'dark',
    showLineNumbers = true,
    fontSize = '14px'
}) => {
    const textareaRef = useRef(null)
    const preRef = useRef(null)
    const lineNumbersRef = useRef(null)

    // Sync scrolling across textarea, pre highlight overlay, and line numbers gutter
    const handleScroll = () => {
        if (textareaRef.current) {
            const top = textareaRef.current.scrollTop
            const left = textareaRef.current.scrollLeft
            if (preRef.current) {
                preRef.current.scrollTop = top
                preRef.current.scrollLeft = left
            }
            if (lineNumbersRef.current) {
                lineNumbersRef.current.scrollTop = top
            }
        }
    }

    // Syntax Highlighting Logic
    const highlight = (code, lang) => {
        if (!code) return ''

        // Escaping HTML
        let html = code
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')

        const tokens = []
        const pushToken = (match, color) => {
            tokens.push(`<span style="color: ${color}">${match}</span>`)
            return `___TOKEN_${tokens.length - 1}___`
        }

        if (lang === 'html' || lang === 'web') {
            // Doctypes
            html = html.replace(/(&lt;!DOCTYPE html&gt;)/gi, m => pushToken(m, '#94a3b8'))
            // Strings (inside attributes)
            html = html.replace(/"([^"]*)"/g, m => pushToken(m, theme === 'light' ? '#059669' : '#34d399'))
            // Opening & closing tags (e.g. <html>, </html>, <head>, </body>)
            html = html.replace(/(&lt;\/?[a-z1-6]+)(&gt;| )/gi, m => pushToken(m, theme === 'light' ? '#dc2626' : '#f43f5e'))
            html = html.replace(/(&lt;\/[a-z1-6]+&gt;)/gi, m => pushToken(m, theme === 'light' ? '#dc2626' : '#f43f5e'))
            // Attributes
            html = html.replace(/ ([a-z-]+)=/gi, m => pushToken(m, theme === 'light' ? '#d97706' : '#fbbf24'))
        } else if (lang === 'css') {
            // Values
            html = html.replace(/: ([^;]+);/g, (m, v) => ': ' + pushToken(v, theme === 'light' ? '#d97706' : '#fbbf24') + ';')
            // Properties
            html = html.replace(/\b([a-z-]+):/gi, m => pushToken(m, theme === 'light' ? '#2563eb' : '#60a5fa'))
            // Selectors
            html = html.replace(/^([.#a-z][^{]+) {/gim, (m, s) => pushToken(s, theme === 'light' ? '#dc2626' : '#f43f5e') + ' {')
        } else {
            // JS / Python / SQL Common
            let commentRegex
            if (lang === 'python') {
                commentRegex = /(#.*)/g
            } else if (lang === 'sql') {
                commentRegex = /(--.*)/g
            } else {
                commentRegex = /(\/\/.*)/g
            }
            html = html.replace(commentRegex, m => pushToken(m, '#64748b'))

            html = html.replace(/"([^"]*)"/g, m => pushToken(m, theme === 'light' ? '#059669' : '#34d399'))
            html = html.replace(/'([^']*)'/g, m => pushToken(m, theme === 'light' ? '#059669' : '#34d399'))

            const keywords = {
                js: new RegExp(String.raw`\b(${'const let var function return if else for while import export class from await async try catch new this'.replaceAll(' ', '|')})\b`, 'g'),
                python: new RegExp(String.raw`\b(${'def class return if else elif for while import from as try except with async await in is not and or lambda print'.replaceAll(' ', '|')})\b`, 'g'),
                sql: new RegExp(String.raw`\b(${'SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE DROP JOIN LEFT RIGHT INNER ON GROUP BY ORDER LIMIT ASC DESC'.replaceAll(' ', '|')})\b`, 'gi')
            }
            const activeKeywords = keywords[lang] || keywords.js
            html = html.replace(activeKeywords, m => pushToken(m, theme === 'light' ? '#9333ea' : '#c084fc'))

            html = html.replace(/\b(\d+)\b/g, m => pushToken(m, theme === 'light' ? '#d97706' : '#fbbf24'))
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

            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = start + 2
            }, 0)
        }

        // Handle Auto-closing pairs
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

        // Handle HTML tag auto-closing
        if (e.key === '>' && (language === 'html' || language === 'web')) {
            const before = val.substring(0, start)
            const lastOpenIdx = before.lastIndexOf('<')
            const lastCloseIdx = before.lastIndexOf('>')

            if (lastOpenIdx !== -1 && lastOpenIdx > lastCloseIdx) {
                const tagText = before.slice(lastOpenIdx)
                const tagMatch = tagText.match(/^<([a-z1-6]+)(?:[\s/][^>]*)?$/i)

                if (tagMatch) {
                    e.preventDefault()
                    const tagName = tagMatch[1]
                    const closingTag = `></${tagName}>`
                    const newVal = val.substring(0, start) + closingTag + val.substring(end)
                    onChange({ target: { value: newVal } })

                    setTimeout(() => {
                        e.target.selectionStart = e.target.selectionEnd = start + 1
                    }, 0)
                    return
                }
            }
        }

        // Handle Enter for intelligent indentation
        if (e.key === 'Enter') {
            e.preventDefault()
            const lines = val.substring(0, start).split('\n')
            const currentLine = lines[lines.length - 1]
            const indentation = currentLine.match(/^\s*/)[0]

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

    const lines = (value || '').split('\n')

    return (
        <div
            style={{
                display: 'flex',
                position: 'relative',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                fontVariantLigatures: 'none',
                background: theme === 'light' ? '#ffffff' : '#0b0f19',
                ...style
            }}
        >
            {/* Line Numbers Gutter */}
            {showLineNumbers && (
                <div
                    ref={lineNumbersRef}
                    aria-hidden="true"
                    style={{
                        width: '44px',
                        height: '100%',
                        paddingTop: '1.25rem',
                        paddingBottom: '1.25rem',
                        paddingRight: '12px',
                        overflow: 'hidden',
                        userSelect: 'none',
                        textAlign: 'right',
                        color: theme === 'light' ? '#94a3b8' : '#475569',
                        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                        fontSize: fontSize,
                        lineHeight: 1.5,
                        borderRight: theme === 'light' ? '1px solid #e2e8f0' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: theme === 'light' ? '#f8fafc' : '#070a12',
                        flexShrink: 0,
                        boxSizing: 'border-box'
                    }}
                >
                    {lines.map((_, i) => (
                        <div key={i}>{i + 1}</div>
                    ))}
                </div>
            )}

            {/* Code Editor Canvas (Highlight pre overlay + Textarea input) */}
            <div style={{ position: 'relative', flex: 1, height: '100%', overflow: 'hidden' }}>
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
                        padding: '1.25rem',
                        pointerEvents: 'none',
                        whiteSpace: 'pre',
                        background: 'transparent',
                        color: theme === 'light' ? 'var(--text-primary)' : '#e2e8f0',
                        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                        fontSize: fontSize,
                        lineHeight: 1.5,
                        border: 'none',
                        overflow: 'auto',
                        boxSizing: 'border-box'
                    }}
                    dangerouslySetInnerHTML={{ __html: highlight(value, language) + '<br/>' }}
                />

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
                        padding: '1.25rem',
                        background: 'transparent',
                        color: 'transparent',
                        caretColor: theme === 'light' ? '#000000' : '#ffffff',
                        fontFamily: 'Consolas, Monaco, "Andale Mono", "Ubuntu Mono", monospace',
                        fontSize: fontSize,
                        lineHeight: 1.5,
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        whiteSpace: 'pre',
                        overflow: 'auto',
                        boxSizing: 'border-box',
                        zIndex: 1
                    }}
                />
            </div>
        </div>
    )
}

CodeEditor.propTypes = {
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
    language: PropTypes.string,
    placeholder: PropTypes.string,
    style: PropTypes.object,
    readOnly: PropTypes.bool,
    theme: PropTypes.string,
    showLineNumbers: PropTypes.bool,
    fontSize: PropTypes.string
}

export default CodeEditor
