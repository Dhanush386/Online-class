import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { escapeHtml, formatInlineText, sanitizeRichHtml } from '../utils/sanitizeRichText'
import CheatSheetPlayground from '../components/cheatsheet/CheatSheetPlayground'
import CheatSheetQuiz from '../components/cheatsheet/CheatSheetQuiz'
import CheatSheetCodeBlock from '../components/cheatsheet/CheatSheetCodeBlock'
import OrganizerPlaygroundEditor, { PRACTICE_TEMPLATES } from '../components/cheatsheet/OrganizerPlaygroundEditor'
import { cheatSheetService } from '../services/cheatSheetService'
import { supabase } from '../lib/supabase'

describe('Cheat Sheet Security: Rich Text & Markdown Sanitizer', () => {
  it('escapes raw HTML tags to prevent unsanitized injection', () => {
    const raw = '<img src=x onerror=alert(1)>'
    const escaped = escapeHtml(raw)
    expect(escaped).toContain('&lt;img')
    expect(escaped).not.toContain('<img')
  })

  it('safely formats backticks into styled code badges', () => {
    const text = 'The CSS `font-family` property specifies the font.'
    const formatted = formatInlineText(text)
    expect(formatted).toContain('<code class="cs-inline-code">font-family</code>')
  })

  it('safely formats bold markdown syntax', () => {
    const text = 'Which of the following is a valid **CSS Property** ?'
    const formatted = formatInlineText(text)
    expect(formatted).toContain('<strong>CSS Property</strong>')
  })

  it('strips script, iframe, object, and event handlers in rich text', () => {
    const malicious = '<p>Normal text</p><script>window.pwned=true</script><iframe src="evil.com"></iframe><img src="x" onerror="steal()" />'
    const cleaned = sanitizeRichHtml(malicious)
    expect(cleaned).toContain('<p>Normal text</p>')
    expect(cleaned).not.toContain('<script>')
    expect(cleaned).not.toContain('window.pwned')
    expect(cleaned).not.toContain('<iframe')
    expect(cleaned).not.toContain('onerror=')
  })

  it('strips javascript: and data: pseudo-schemes', () => {
    const malicious = '<a href="javascript:alert(1)">Click me</a>'
    const cleaned = sanitizeRichHtml(malicious)
    expect(cleaned).not.toContain('javascript:')
  })
})

describe('Cheat Sheet Security: Sandboxed Code Playground', () => {
  it('renders iframe with sandbox="allow-scripts" and strictly OMITS allow-same-origin', () => {
    const { container } = render(
      <CheatSheetPlayground
        starterData={{
          starterHtml: '<h1>Tourism</h1>',
          starterCss: 'h1 { color: blue; }',
          starterJs: 'console.log(1);'
        }}
      />
    )

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()

    const sandboxAttr = iframe.getAttribute('sandbox')
    expect(sandboxAttr).toContain('allow-scripts')
    // CRITICAL SECURITY ASSERTION: Must NOT contain allow-same-origin
    expect(sandboxAttr).not.toContain('allow-same-origin')

    // Must use srcDoc for isolated bundled execution
    expect(iframe.hasAttribute('srcdoc')).toBe(true)
    const srcDocContent = iframe.getAttribute('srcdoc')
    expect(srcDocContent).toContain('Tourism')
    expect(srcDocContent).toContain('h1 { color: blue; }')
  })

  it('renders coding practice challenge briefing with tasks and hint toggle for students', () => {
    render(
      <CheatSheetPlayground
        starterData={{
          title: 'Practice Challenge: Typography & Google Fonts',
          difficulty: 'Intermediate',
          instructions: '1. Import Caveat font\n2. Set font-size to 24px',
          hints: 'Use @import url(...) at top of CSS',
          starterHtml: '<h1>Header</h1>',
          starterCss: 'h1 { color: red; }',
          starterJs: ''
        }}
      />
    )

    expect(screen.getByText('Practice Challenge: Typography & Google Fonts')).toBeDefined()
    expect(screen.getByText('Intermediate')).toBeDefined()
    expect(screen.getByText('Import Caveat font')).toBeDefined()
    expect(screen.getByText('Set font-size to 24px')).toBeDefined()

    // Test hint toggle
    const hintButton = screen.getByText('Need a hint?')
    expect(hintButton).toBeDefined()
    fireEvent.click(hintButton)
    expect(screen.getByText(/Use @import url/)).toBeDefined()
  })
})

describe('Cheat Sheet Organizer: Live Coding Practice Suite', () => {
  it('provides rich preset templates for organizers', () => {
    expect(PRACTICE_TEMPLATES.length).toBeGreaterThanOrEqual(4)
    const typo = PRACTICE_TEMPLATES.find(t => t.id === 'typography')
    expect(typo).toBeDefined()
    expect(typo.data.title).toContain('Typography')
    expect(typo.data.starterHtml).toBeDefined()
    expect(typo.data.starterCss).toBeDefined()
  })

  it('renders live preview runner with secure sandboxed iframe strictly omitting allow-same-origin', () => {
    const handleChange = vi.fn()
    const { container } = render(
      <OrganizerPlaygroundEditor
        playgroundData={{
          title: 'Authoring Challenge',
          difficulty: 'Beginner',
          instructions: '1. Task A\n2. Task B',
          hints: 'Hint A',
          starterHtml: '<div>Organizer Preview</div>',
          starterCss: 'div { color: purple; }',
          starterJs: 'console.log("test")'
        }}
        onChange={handleChange}
      />
    )

    expect(screen.getByText('Live Coding Practice Suite')).toBeDefined()
    expect(screen.getByDisplayValue('Authoring Challenge')).toBeDefined()

    const iframe = container.querySelector('iframe')
    expect(iframe).not.toBeNull()
    const sandboxAttr = iframe.getAttribute('sandbox')
    expect(sandboxAttr).toContain('allow-scripts')
    expect(sandboxAttr).not.toContain('allow-same-origin')
    expect(iframe.getAttribute('srcdoc')).toContain('Organizer Preview')
  })
})

describe('Cheat Sheet Service: Resilient Read Cache & Defaults', () => {
  it('returns default CSS Part 3 cheat sheet when offline or database is unreachable', async () => {
    vi.spyOn(supabase, 'from').mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.reject(new Error('Database unreachable'))
        })
      })
    }))

    const res = await cheatSheetService.getCheatSheet('css-part-3')
    expect(res.data).toBeDefined()
    expect(res.data.title).toContain('Introduction to CSS | Part 3')
    expect(res.data.week_number).toBe(3)
    expect(res.data.day_number).toBe(2)
    expect(res.data.sections).toHaveLength(4)
    expect(res.data.sections[0].title).toBe('1. Font Family')
    expect(res.data.sections[1].title).toBe('2. Font Size')
    expect(res.data.sections[2].title).toBe('3. Font Style')
    expect(res.data.sections[3].title).toBe('4. Font Weight')
  })
})

describe('Cheat Sheet Student Experience: Copy Protection & Neat UI', () => {
  it('strictly protects code blocks with userSelect none and omits copy button to enforce typing practice', () => {
    const { container, queryByText } = render(
      <CheatSheetCodeBlock
        code=".example { color: blue; }"
        language="CSS"
      />
    )

    // Verify Copy Code button is NOT present
    expect(queryByText('Copy Code')).toBeNull()
    expect(queryByText('Code Copied!')).toBeNull()

    // Verify code elements have userSelect none
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    expect(pre.style.userSelect).toBe('none')

    const code = container.querySelector('code')
    expect(code).not.toBeNull()
    expect(code.style.userSelect).toBe('none')
  })

  it('prevents right-click context menu on instructional text and code blocks', () => {
    const handleContextMenu = vi.fn((e) => {
      if (!e.target?.closest('textarea, input, .code-editor-textarea')) {
        e.preventDefault()
      }
    })

    const { getByText } = render(
      <div className="cs-protected-reading" onContextMenu={handleContextMenu}>
        <p className="instructional-text">Protected curriculum theory</p>
        <pre><code className="sample-code">font-style: italic;</code></pre>
      </div>
    )

    const textEl = getByText('Protected curriculum theory')
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    const notCancelledText = textEl.dispatchEvent(event)
    expect(notCancelledText).toBe(false)

    const codeEl = getByText('font-style: italic;')
    const eventCode = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    const notCancelledCode = codeEl.dispatchEvent(eventCode)
    expect(notCancelledCode).toBe(false)

    expect(handleContextMenu).toHaveBeenCalledTimes(2)
  })

  it('accurately displays Question 1 of 1 instead of misleading Question 1 of 3', () => {
    const { getByText } = render(
      <CheatSheetQuiz
        quiz={{
          questionNumber: 'Question 1 of 3', // Legacy placeholder from seed
          prompt: 'Which CSS property is used to set font family?',
          options: ['font-family', 'font-size', 'color', 'text-align'],
          correctAnswer: 'font-family',
          explanation: 'font-family sets the font.'
        }}
      />
    )

    // Should normalize to 'Question 1 of 1' so student is not misled into thinking 3 questions exist
    expect(getByText('Question 1 of 1')).toBeDefined()
  })

  it('triggers onAttend callback and displays Next Section Unlocked badge when quiz is answered', () => {
    const onAttend = vi.fn()
    const { getByText, queryByText } = render(
      <CheatSheetQuiz
        quiz={{
          questionNumber: 'Question 1 of 1',
          prompt: 'Which CSS property sets the font?',
          options: ['font-family', 'color'],
          correctAnswer: 'font-family',
          explanation: 'font-family sets the font.'
        }}
        onAttend={onAttend}
      />
    )

    expect(queryByText('Next Section Unlocked')).toBeNull()

    // Select option
    fireEvent.click(getByText('font-family'))

    // Click Check Answer
    fireEvent.click(getByText('Check Answer'))

    expect(onAttend).toHaveBeenCalledWith('font-family')
    expect(getByText('Next Section Unlocked')).toBeDefined()
  })

  it('renders multi-line code snippet options inside code blocks and validates answers correctly', () => {
    const onAttend = vi.fn()
    const htmlCodeOption = '<!DOCTYPE html>\n<html>\n  <head></head>\n  <body>Your code goes here</body>\n</html>'
    const wrongOption = '<html><body>Incomplete</body></html>'

    const { getByText, container } = render(
      <CheatSheetQuiz
        quiz={{
          type: 'mcq',
          formatAsCode: true,
          questionNumber: 'Question 1 of 1',
          prompt: 'What is the correct Basic Structure of an HTML document?',
          options: [htmlCodeOption, wrongOption],
          correctAnswer: htmlCodeOption,
          explanation: 'HTML documents require DOCTYPE, html, head, and body tags.'
        }}
        onAttend={onAttend}
      />
    )

    // Verify option text is rendered inside code element
    const codeElement = container.querySelector('code')
    expect(codeElement).toBeDefined()
    expect(codeElement.textContent).toContain('Your code goes here')

    // Click to select the code option
    fireEvent.click(codeElement)

    // Submit answer
    fireEvent.click(getByText('Check Answer'))

    expect(onAttend).toHaveBeenCalledWith(htmlCodeOption)
    expect(getByText('Solved')).toBeDefined()
    expect(getByText('Next Section Unlocked')).toBeDefined()
  })

  it('supports interactive write-code questions with smart normalization and next section unlock', () => {
    const onAttend = vi.fn()
    const correctSolution = '<!DOCTYPE html>\n<html>\n  <head></head>\n  <body>\n    Your code goes here\n  </body>\n</html>'

    const { getByText, getByPlaceholderText } = render(
      <CheatSheetQuiz
        quiz={{
          type: 'code_input',
          matchMode: 'flexible',
          questionNumber: 'Question 1 of 1',
          prompt: 'Write the basic boilerplate structure of an HTML document.',
          starterCode: '<!-- Write your HTML structure here -->\n',
          correctAnswer: correctSolution,
          explanation: 'Standard HTML5 documents require the DOCTYPE declaration followed by html, head, and body tags.'
        }}
        onAttend={onAttend}
      />
    )

    expect(getByText('Coding Quiz Challenge')).toBeDefined()
    expect(getByText('Write Your Code Answer')).toBeDefined()

    const textarea = getByPlaceholderText(/Type or paste your code solution here/i)
    expect(textarea.value).toContain('<!-- Write your HTML structure here -->')

    // Student types code with slightly different indentation/spacing (flexible match should accept it!)
    fireEvent.change(textarea, {
      target: {
        value: '<!DOCTYPE html> <html> <head> </head> <body> Your code goes here </body> </html>'
      }
    })

    // Click Check Code
    fireEvent.click(getByText('Check Code'))

    expect(onAttend).toHaveBeenCalled()
    expect(getByText('Solved')).toBeDefined()
    expect(getByText('Next Section Unlocked')).toBeDefined()
    expect(getByText('Great job! Your code solution matches.')).toBeDefined()
  })

  it('locks question options, textarea, and submit button when Show Answer is clicked', () => {
    const onAttend = vi.fn()
    const { getByText } = render(
      <CheatSheetQuiz
        quiz={{
          type: 'mcq',
          questionNumber: 'Question 1 of 1',
          prompt: 'What tag is used for paragraph text?',
          options: ['<p>', '<div>', '<span>'],
          correctAnswer: '<p>',
          explanation: '<p> defines a paragraph.'
        }}
        onAttend={onAttend}
      />
    )

    const showAnswerBtn = getByText('Show Answer')
    const checkAnswerBtn = getByText('Check Answer')

    // Click Show Answer
    fireEvent.click(showAnswerBtn)

    // Submit button must be locked and disabled
    expect(checkAnswerBtn.disabled).toBe(true)
    expect(getByText(/Answer Revealed \(Locked\)/i)).toBeDefined()

    // Explanation and lock notification banner must be visible
    expect(getByText(/Answer revealed for Question 1. You cannot answer this question/i)).toBeDefined()
    expect(getByText('<p> defines a paragraph.')).toBeDefined()

    // Attempting to select an option while Show Answer is active should NOT allow answering
    const optionP = getByText('<p>')
    fireEvent.click(optionP)
    expect(checkAnswerBtn.disabled).toBe(true)

    // Even if student toggles Hide Explanation, this question remains permanently locked
    fireEvent.click(getByText('Hide Explanation'))
    expect(checkAnswerBtn.disabled).toBe(true)
    expect(getByText(/Answer Revealed \(Locked\)/i)).toBeDefined()
  })

  it('locks code editor and submit button when Show Code Solution is clicked', () => {
    const onAttend = vi.fn()
    const { getByText, getByPlaceholderText } = render(
      <CheatSheetQuiz
        quiz={{
          type: 'code_input',
          questionNumber: 'Question 1 of 1',
          prompt: 'Write a bold tag.',
          correctAnswer: '<b>text</b>',
          explanation: '<b> makes text bold.'
        }}
        onAttend={onAttend}
      />
    )

    const showCodeBtn = getByText('Show Code Solution')
    const checkCodeBtn = getByText('Check Code')
    const textarea = getByPlaceholderText(/Type or paste your code solution here/i)

    // Click Show Code Solution
    fireEvent.click(showCodeBtn)

    expect(textarea.disabled).toBe(true)
    expect(checkCodeBtn.disabled).toBe(true)
    expect(getByText(/Answer Revealed \(Locked\)/i)).toBeDefined()
    expect(getByText(/Answer revealed for Question 1. You cannot answer this question/i)).toBeDefined()
  })

  it('locks current question when answer is revealed but allows student to answer the next question', () => {
    const onAttend = vi.fn()
    const { getByText, queryByText } = render(
      <CheatSheetQuiz
        quiz={{
          questions: [
            {
              prompt: 'First question prompt?',
              options: ['Ans 1A', 'Ans 1B'],
              correctAnswer: 'Ans 1A',
              explanation: 'Exp 1'
            },
            {
              prompt: 'Second question prompt?',
              options: ['Ans 2A', 'Ans 2B'],
              correctAnswer: 'Ans 2B',
              explanation: 'Exp 2'
            }
          ]
        }}
        onAttend={onAttend}
      />
    )

    expect(getByText('Question 1 of 2')).toBeDefined()
    expect(getByText('First question prompt?')).toBeDefined()

    // Reveal answer on Question 1
    fireEvent.click(getByText('Show Answer'))

    // Question 1 is locked
    expect(getByText(/Answer Revealed \(Locked\)/i)).toBeDefined()
    expect(getByText(/Answer revealed for Question 1. You cannot answer this question/i)).toBeDefined()

    // Next Question button is available to advance
    const nextBtn = getByText(/Next Question \(2\/2\)/i)
    expect(nextBtn).toBeDefined()
    fireEvent.click(nextBtn)

    // Now on Question 2!
    expect(getByText('Question 2 of 2')).toBeDefined()
    expect(getByText('Second question prompt?')).toBeDefined()

    // In Question 2, the student CAN answer!
    expect(queryByText(/Answer Revealed \(Locked\)/i)).toBeNull()
    const checkAnswerBtnQ2 = getByText('Check Answer')
    expect(checkAnswerBtnQ2.disabled).toBe(true) // because not selected yet

    // Select correct option for Question 2
    fireEvent.click(getByText('Ans 2B'))
    expect(checkAnswerBtnQ2.disabled).toBe(false)

    // Submit Question 2
    fireEvent.click(checkAnswerBtnQ2)

    // Entire quiz is now finished (Q1 revealed, Q2 solved) -> unlocks next section!
    expect(onAttend).toHaveBeenCalledWith('Ans 2B')
    expect(getByText('Next Section Unlocked')).toBeDefined()
  })
})

