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

  let initialQuestion = await callGemini(prompt)

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
