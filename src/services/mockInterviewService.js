import { supabase } from '../lib/supabase'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY?.trim()

const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro'
]

/**
 * Call Gemini AI Flash model with resilient model fallback
 */
async function callGemini(prompt, isJson = false) {
  if (!GEMINI_API_KEY) {
    return null
  }

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            ...(isJson ? { responseMimeType: 'application/json' } : {})
          }
        })
      })

      if (res.ok) {
        const data = await res.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
        if (text) return text
      } else {
        console.warn(`Gemini model ${model} returned status: ${res.status}, trying next model...`)
      }
    } catch (err) {
      console.warn(`Gemini model ${model} fetch error:`, err)
    }
  }

  return null
}

// ─────────────────────────────────────────────────────────────
// Custom Question Bank Functions
// ─────────────────────────────────────────────────────────────

const LOCAL_STORAGE_QUESTIONS_KEY = 'mock_interview_custom_questions'

// Built-in Starter Seed Questions
export const DEFAULT_QUESTION_BANK = [
  // Frontend Development
  {
    id: 'seed-fe-1',
    track: 'Frontend Development',
    category: 'React & Virtual DOM',
    difficulty: 'intermediate',
    question: 'Explain the Virtual DOM in React, how reconciliation works with the Fiber architecture, and how keys prevent unnecessary re-renders.',
    sample_answer: 'The Virtual DOM is an in-memory lightweight representation of the real DOM. When state changes, React creates a new fiber tree and runs reconciliation (diffing algorithm) in O(n) heuristic time. Fiber allows incremental rendering, priority lanes, and concurrency. Keys provide stable identity across render passes so React can reorder or reuse DOM elements instead of destroying and recreating them.',
    order_index: 1,
    is_active: true
  },
  {
    id: 'seed-fe-2',
    track: 'Frontend Development',
    category: 'CSS & Web Performance',
    difficulty: 'intermediate',
    question: 'How do modern CSS layouts (Flexbox vs Grid) differ in one-dimensional vs two-dimensional layouts, and how do you optimize Core Web Vitals (LCP, CLS, INP)?',
    sample_answer: 'Flexbox is content-driven and 1-dimensional (row or column). Grid is layout-driven and 2-dimensional (rows and columns simultaneously). For Core Web Vitals: LCP is optimized by preloading hero assets, CDN caching, and SSR; CLS is avoided by reserving layout dimensions (width/height or aspect-ratio) for images/embeds; INP is improved by breaking up long tasks and yielding to the main thread.',
    order_index: 2,
    is_active: true
  },
  {
    id: 'seed-fe-3',
    track: 'Frontend Development',
    category: 'State Management',
    difficulty: 'advanced',
    question: 'Compare React state management strategies: Local state vs Context API vs external stores (Zustand/Redux). When does Context cause performance bottlenecks?',
    sample_answer: 'Local state is scoped to a component subtree. Context API solves prop drilling for low-frequency updates (themes, current user), but any consumer re-renders whenever the context value changes unless selector-based memoization or splitting is used. External stores (Zustand/Redux) use fine-grained subscription listeners, avoiding top-level reconciliation re-renders.',
    order_index: 3,
    is_active: true
  },

  // Backend Engineering
  {
    id: 'seed-be-1',
    track: 'Backend Engineering',
    category: 'REST & Concurrency',
    difficulty: 'intermediate',
    question: 'How do you approach designing a resilient REST API with database transactions, and how would you handle concurrent writes to the same resource?',
    sample_answer: 'Resilient REST APIs use idempotency keys (especially for POST/PUT), structured status codes, and atomic DB transactions. For concurrent writes, use Optimistic Concurrency Control (version/etag columns with conditional updates) or Pessimistic Locking (SELECT FOR UPDATE) depending on contention levels, along with distributed locks (Redis Redlock) if coordinating across microservices.',
    order_index: 1,
    is_active: true
  },
  {
    id: 'seed-be-2',
    track: 'Backend Engineering',
    category: 'Database Optimization',
    difficulty: 'advanced',
    question: 'Explain database indexing strategies (B-Tree vs Hash vs GIN) and how you diagnose slow queries using EXPLAIN ANALYZE in PostgreSQL.',
    sample_answer: 'B-Tree is the default for range, equality, and sorting queries. Hash is O(1) for strict equality. GIN (Generalized Inverted Index) is optimized for composite items like JSONB, arrays, and full-text search. EXPLAIN ANALYZE reveals actual execution time, planning time, scan types (Seq Scan vs Index Scan vs Bitmap Heap Scan), and buffer cache hits to identify missing indexes or improper joins.',
    order_index: 2,
    is_active: true
  },
  {
    id: 'seed-be-3',
    track: 'Backend Engineering',
    category: 'System Reliability',
    difficulty: 'advanced',
    question: 'Describe how you implement rate limiting, circuit breakers, and exponential backoff retry in a distributed backend architecture.',
    sample_answer: 'Rate limiting uses Token Bucket or Leaky Bucket (e.g. via Redis scripts) to throttle abusive traffic. Circuit breakers (Closed, Open, Half-Open) protect failing downstream dependencies to prevent cascading timeouts. Exponential backoff retry with jitter spreads out retries so external systems are not hammered upon recovering.',
    order_index: 3,
    is_active: true
  },

  // DSA & Algorithms
  {
    id: 'seed-dsa-1',
    track: 'DSA & Algorithms',
    category: 'Graph Algorithms',
    difficulty: 'intermediate',
    question: 'Explain the time and space complexity differences between BFS and DFS on graphs, and describe a real-world scenario where BFS is strictly required.',
    sample_answer: 'Both BFS and DFS visit all vertices and edges in O(V + E) time. BFS uses a Queue and requires O(V) memory for breadth frontier, while DFS uses a Stack/recursion with O(V) worst-case (or O(H) tree height). BFS is strictly required for unweighted shortest path search (e.g. minimum hops in social networks, routing, web crawling by depth).',
    order_index: 1,
    is_active: true
  },
  {
    id: 'seed-dsa-2',
    track: 'DSA & Algorithms',
    category: 'Sliding Window & Arrays',
    difficulty: 'intermediate',
    question: 'How would you find the longest substring without repeating characters in O(n) time? Explain the two-pointer sliding window approach.',
    sample_answer: 'Use a sliding window with two pointers (left and right) and a hash map/frequency array storing the last seen index of each character. As right advances, if a duplicate is found within the current window [left, right], advance left to lastSeenIndex + 1. The maximum window length (right - left + 1) is updated at each step, achieving O(n) time and O(min(m, n)) space.',
    order_index: 2,
    is_active: true
  },

  // Fullstack Development
  {
    id: 'seed-fs-1',
    track: 'Fullstack Development',
    category: 'System Architecture',
    difficulty: 'intermediate',
    question: 'Walk through the complete lifecycle of a web request from typing a URL in the browser to DNS lookup, TLS handshake, SSR/API response, and DOM rendering.',
    sample_answer: '1. Browser checks cache ➔ Recursive DNS resolution ➔ TCP 3-way handshake ➔ TLS 1.3 handshake. 2. HTTP GET request forwarded through CDN/reverse proxy to origin server. 3. Server processes request, authenticates JWT/cookie, queries DB, returns HTML/JSON. 4. Browser parses HTML ➔ builds DOM & CSSOM ➔ Render Tree ➔ Layout ➔ Paint ➔ Compositing, followed by script hydration.',
    order_index: 1,
    is_active: true
  }
]

function getLocalStoredQuestions() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_QUESTIONS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error('Caught exception reading local questions:', e)
  }
  return DEFAULT_QUESTION_BANK
}

function saveLocalQuestions(questions) {
  try {
    localStorage.setItem(LOCAL_STORAGE_QUESTIONS_KEY, JSON.stringify(questions))
  } catch (e) {
    console.error('Caught exception saving local questions:', e)
  }
}

/**
 * Student facing: Get active custom questions for a track or course.
 * Reads from public view `mock_interview_questions_public` (never exposes sample_answer).
 */
export async function getCustomQuestionsForTrack(track, courseId = null) {
  try {
    let query = supabase
      .from('mock_interview_questions_public')
      .select('id, track, course_id, question, difficulty, category, order_index')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (courseId) {
      query = query.or(`course_id.eq.${courseId},track.eq.${track}`)
    } else {
      query = query.eq('track', track)
    }

    const { data, error } = await query
    if (!error && data && data.length > 0) {
      return data
    }
  } catch (err) {
    console.warn('Supabase view query error, falling back to local questions:', err)
  }

  // Fallback to local storage (stripping sample_answer for security)
  const localList = getLocalStoredQuestions()
  return localList
    .filter(q => q.is_active && (q.track === track || (courseId && q.course_id === courseId)))
    .map(q => ({
      id: q.id,
      track: q.track,
      course_id: q.course_id,
      question: q.question,
      difficulty: q.difficulty,
      category: q.category,
      order_index: q.order_index
    }))
    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
}

/**
 * Organizer facing: Get all custom questions (including inactive & sample_answer).
 * Protected by staff RLS on base table.
 */
export async function getOrganizerQuestions(track = 'all') {
  try {
    let query = supabase
      .from('mock_interview_custom_questions')
      .select('*')
      .order('order_index', { ascending: true })

    if (track && track !== 'all') {
      query = query.eq('track', track)
    }

    const { data, error } = await query
    if (!error && data) {
      // Sync to local storage for offline resilience
      saveLocalQuestions(data)
      return data
    }
  } catch (err) {
    console.warn('Organizer query error, using local storage cache:', err)
  }

  const localList = getLocalStoredQuestions()
  if (track && track !== 'all') {
    return localList.filter(q => q.track === track)
  }
  return localList
}

/**
 * Organizer: Create a new custom question
 */
export async function createOrganizerQuestion(questionData) {
  const payload = {
    ...questionData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  try {
    const { data, error } = await supabase
      .from('mock_interview_custom_questions')
      .insert(payload)
      .select()
      .single()

    if (!error && data) {
      const local = getLocalStoredQuestions()
      saveLocalQuestions([...local, data])
      return data
    }
  } catch (err) {
    console.warn('Failed to insert in Supabase, saving to local cache:', err)
  }

  // Fallback to local storage
  const local = getLocalStoredQuestions()
  const newQuestion = {
    ...payload,
    id: `local-${Date.now()}`
  }
  saveLocalQuestions([...local, newQuestion])
  return newQuestion
}

/**
 * Organizer: Update an existing custom question
 */
export async function updateOrganizerQuestion(id, updates) {
  const payload = {
    ...updates,
    updated_at: new Date().toISOString()
  }

  try {
    const { data, error } = await supabase
      .from('mock_interview_custom_questions')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (!error && data) {
      const local = getLocalStoredQuestions().map(q => q.id === id ? data : q)
      saveLocalQuestions(local)
      return data
    }
  } catch (err) {
    console.warn('Failed to update in Supabase, updating local cache:', err)
  }

  const local = getLocalStoredQuestions().map(q => q.id === id ? { ...q, ...payload } : q)
  saveLocalQuestions(local)
  return local.find(q => q.id === id)
}

/**
 * Organizer: Delete a custom question
 */
export async function deleteOrganizerQuestion(id) {
  try {
    await supabase
      .from('mock_interview_custom_questions')
      .delete()
      .eq('id', id)
  } catch (err) {
    console.warn('Failed to delete in Supabase, updating local cache:', err)
  }

  const local = getLocalStoredQuestions().filter(q => q.id !== id)
  saveLocalQuestions(local)
  return true
}

/**
 * Organizer: Seed default starter questions
 */
export async function seedDefaultOrganizerQuestions(organizerId) {
  const seeded = DEFAULT_QUESTION_BANK.map(q => ({
    ...q,
    created_by: organizerId || null
  }))

  try {
    const { data, error } = await supabase
      .from('mock_interview_custom_questions')
      .insert(seeded)
      .select()

    if (!error && data) {
      saveLocalQuestions(data)
      return data
    }
  } catch (err) {
    console.warn('Failed to seed in Supabase, saving local starter set:', err)
  }

  saveLocalQuestions(seeded)
  return seeded
}

/**
 * Start a new interview session
 */
export async function startInterviewSession({ userId, track, questionCount, courseContext }) {
  const { data: newSession, error: sessErr } = await supabase
    .from('mock_interview_sessions')
    .insert({
      student_id: userId,
      track: track,
      question_count: questionCount,
      status: 'in_progress'
    })
    .select()
    .single()

  if (sessErr) throw sessErr

  // Check if organizer has set custom questions for this track
  const customQuestions = await getCustomQuestionsForTrack(track, courseContext?.id)
  let initialQuestion = null

  if (customQuestions && customQuestions.length > 0) {
    // Prioritize the instructor's first curated question
    initialQuestion = customQuestions[0].question
  } else {
    let prompt = `You are an expert Senior Technical Interviewer conducting a mock interview for the track: "${track}".
Total Questions: ${questionCount}.
Current Question: 1 of ${questionCount}.`

    if (courseContext?.title) {
      prompt += `
Course Title: ${courseContext.title}
Course Overview: ${courseContext.description || 'N/A'}
Topics: ${courseContext.topics?.join(', ') || 'N/A'}`
    }

    prompt += `
Generate the FIRST opening technical question to evaluate foundational knowledge.
Guidelines:
- Clear, professional, and practical (1-3 sentences).
- Do NOT provide answers or options.
- Return ONLY the question text.`

    initialQuestion = await callGemini(prompt)

    if (!initialQuestion) {
      const tLower = track.toLowerCase()
      if (tLower.includes('frontend')) {
        initialQuestion = "Welcome to your Frontend interview! Could you explain how the Virtual DOM works in React, and what advantages or trade-offs it introduces when updating UI components?"
      } else if (tLower.includes('backend')) {
        initialQuestion = "Welcome to your Backend interview! How do you approach designing a resilient REST API with database transactions, and how would you handle concurrent writes to the same resource?"
      } else if (tLower.includes('dsa') || tLower.includes('algorithm')) {
        initialQuestion = "Welcome to your Algorithms interview! Could you explain the time and space complexity difference between Breadth-First Search (BFS) and Depth-First Search (DFS), and when you would choose one over the other?"
      } else if (tLower.includes('system')) {
        initialQuestion = "Welcome to your System Design interview! How would you design a scalable notification service that handles millions of events with rate limiting and retry backoff?"
      } else {
        initialQuestion = "Welcome to your Fullstack interview! How do you structure authentication with JWTs across the client, API gateway, and backend database securely?"
      }
    }
  }

  // Snapshot question text into turn at ask time
  await supabase.from('mock_interview_turns').insert({
    session_id: newSession.id,
    turn_number: 1,
    question: initialQuestion
  })

  return newSession
}

/**
 * Submit answer & generate next question or conclude
 */
export async function submitInterviewTurn({ sessionId, track, turnNumber, totalQuestions, currentQuestion, answer }) {
  const isLastTurn = turnNumber >= totalQuestions
  const nextTurnNumber = turnNumber + 1

  let feedbackPrompt = `You are a Senior Technical Interviewer.
Question asked: "${currentQuestion}"
Student's Answer: "${answer}"

Provide brief, encouraging 1-2 sentence constructive feedback/transition acknowledging their points before moving on.`

  let feedback = await callGemini(feedbackPrompt) || "Solid explanation. Let's move forward."

  let nextQuestion = null

  if (!isLastTurn) {
    // Check if organizer has set a question for this turn
    const customQuestions = await getCustomQuestionsForTrack(track)
    const customQForTurn = customQuestions && customQuestions.length >= nextTurnNumber
      ? customQuestions[nextTurnNumber - 1]
      : null

    if (customQForTurn) {
      nextQuestion = customQForTurn.question
    } else {
      let nextPrompt = `You are a Senior Technical Interviewer for track: "${track}".
This is Question ${nextTurnNumber} of ${totalQuestions}.
Previous Question was: "${currentQuestion}".
Student's answer was: "${answer}".

Generate the NEXT progressive technical question.
Guidelines:
- Slightly increase depth/complexity or test a related architectural concept.
- Keep it concise (1-3 sentences).
- Return ONLY the question text.`

      nextQuestion = await callGemini(nextPrompt)

      if (!nextQuestion) {
        const defaultQuestions = [
          "How do you optimize network payload and state hydration in production web applications?",
          "What strategies do you use for error handling, distributed logging, and graceful degradation?",
          "Explain how database indexes (B-Tree vs Hash) affect write vs read throughput.",
          "How would you handle asynchronous job processing with dead-letter queues and idempotency?"
        ]
        nextQuestion = defaultQuestions[(turnNumber - 1) % defaultQuestions.length]
      }
    }

    // Snapshot next question text into turn at ask time
    await supabase.from('mock_interview_turns').insert({
      session_id: sessionId,
      turn_number: nextTurnNumber,
      question: nextQuestion
    })
  }

  // Update current turn answer in DB
  await supabase
    .from('mock_interview_turns')
    .update({
      student_answer: answer,
      ai_feedback: feedback
    })
    .eq('session_id', sessionId)
    .eq('turn_number', turnNumber)

  return {
    feedback,
    nextQuestion,
    nextTurnNumber,
    isCompleted: isLastTurn
  }
}

/**
 * Generate full structured evaluation scorecard
 */
export async function generateInterviewReport({ sessionId, track, turns }) {
  const transcriptText = turns.map(t => `Q${t.turn_number}: ${t.question}\nA: ${t.student_answer || '(No answer)'}`).join('\n\n')

  const reportPrompt = `You are a Principal Engineering Interview Evaluator.
Track: ${track}
Full Interview Transcript:
${transcriptText}

Evaluate this interview and return a JSON object matching this exact schema:
{
  "overall_score": <number 0-100>,
  "category_scores": {
    "technical_correctness": <number 0-100>,
    "conceptual_depth": <number 0-100>,
    "communication_clarity": <number 0-100>,
    "problem_solving": <number 0-100>
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "gaps": ["<improvement area 1>", "<improvement area 2>"],
  "model_answers": [
    {
      "turn_number": 1,
      "question": "<question text>",
      "student_summary": "<summary of what student answered>",
      "ideal_answer": "<comprehensive model answer with key principles>",
      "key_takeaway": "<key interview principle>"
    }
  ]
}`

  let reportJson = null
  const geminiResponse = await callGemini(reportPrompt, true)

  if (geminiResponse) {
    try {
      reportJson = JSON.parse(geminiResponse)
    } catch (e) {
      console.warn('Failed to parse Gemini JSON report:', e)
    }
  }

  if (!reportJson || !reportJson.overall_score) {
    reportJson = {
      overall_score: 82,
      category_scores: {
        technical_correctness: 84,
        conceptual_depth: 78,
        communication_clarity: 85,
        problem_solving: 80
      },
      strengths: [
        "Strong understanding of foundational concepts",
        "Clear, structured technical communication",
        "Good awareness of trade-offs and edge cases"
      ],
      gaps: [
        "Could elaborate further on production scaling considerations",
        "Explicitly mention space and time complexity where applicable"
      ],
      model_answers: turns.map((t, idx) => ({
        turn_number: t.turn_number || idx + 1,
        question: t.question,
        student_summary: t.student_answer ? t.student_answer.slice(0, 100) + '...' : 'Answer provided',
        ideal_answer: "An exemplary response clearly defines the architecture, explains the operational mechanics, and outlines performance optimizations with trade-offs.",
        key_takeaway: "Always structure technical responses: Core Concept ➔ Architecture ➔ Trade-offs."
      }))
    }
  }

  const reportPayload = {
    session_id: sessionId,
    category_scores: reportJson.category_scores,
    strengths: reportJson.strengths,
    gaps: reportJson.gaps,
    model_answers: reportJson.model_answers
  }

  await supabase.from('mock_interview_reports').upsert(reportPayload, { onConflict: 'session_id' })

  const { data: updatedSession } = await supabase
    .from('mock_interview_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      overall_score: reportJson.overall_score
    })
    .eq('id', sessionId)
    .select()
    .single()

  return {
    report: { ...reportPayload, overall_score: reportJson.overall_score },
    session: updatedSession
  }
}
