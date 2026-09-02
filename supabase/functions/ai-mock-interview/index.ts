import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
    action?: 'start' | 'answer' | 'report';
    track?: string;
    questionCount?: number;
    sessionId?: string;
    turnNumber?: number;
    answer?: string;
    courseId?: string;
    courseContext?: {
        title?: string;
        description?: string;
        topics?: string[];
    };
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const apiKey = Deno.env.get('GEMINI_API_KEY')
        const isProduction = Deno.env.get('DENO_ENV') === 'production' || Deno.env.get('ENVIRONMENT') === 'production'
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''

        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
            global: { headers: { Authorization: authHeader } }
        })

        // Verify current user
        const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized user session' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            })
        }

        // Parse path or action from body
        const url = new URL(req.url)
        const pathAction = url.pathname.split('/').filter(Boolean).pop()
        const body: RequestBody = await req.json().catch(() => ({}))
        const action = body.action || pathAction || 'start'

        // ─────────────────────────────────────────────────────────────
        // 1. ACTION: START INTERVIEW
        // ─────────────────────────────────────────────────────────────
        if (action === 'start') {
            const track = body.track || 'Frontend Development'
            const questionCount = Number(body.questionCount) === 10 ? 10 : 5
            const courseContext = body.courseContext

            // Create session in database
            const { data: session, error: sessionErr } = await supabase
                .from('mock_interview_sessions')
                .insert({
                    student_id: user.id,
                    track,
                    question_count: questionCount,
                    status: 'in_progress',
                    started_at: new Date().toISOString()
                })
                .select()
                .single()

            if (sessionErr) {
                console.error('Failed to create session:', sessionErr)
                throw new Error('Database error creating interview session')
            }

            let initialQuestion = ''

            if (apiKey) {
                let contextPrompt = `You are a Senior Technical Interviewer conducting a realistic mock interview for Learnova.
Track: ${track}.
Total Questions in Session: ${questionCount}.
Current Question: 1 of ${questionCount}.`

                if (courseContext?.title) {
                    contextPrompt += `
Student is enrolled in: ${courseContext.title}
Course Overview: ${courseContext.description || 'N/A'}
Key Course Topics: ${courseContext.topics?.join(', ') || 'N/A'}
IMPORTANT: Prioritize asking questions directly related to this course material.`
                }

                contextPrompt += `

Generate the FIRST opening technical/conceptual question for this track.
Guidelines:
- Start with a solid fundamental or architectural question to assess their foundational knowledge.
- Keep the tone professional, friendly, and concise (1-3 sentences).
- Do NOT provide the answer or multiple choice options.
- Return ONLY the question text without any markdown or quotation wrappers.`

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: contextPrompt }] }],
                        generationConfig: { temperature: 0.7 }
                    })
                })

                if (res.ok) {
                    const data = await res.json()
                    initialQuestion = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
                } else if (isProduction) {
                    throw new Error('AI interview service unavailable: GEMINI_API_KEY error.')
                }
            } else if (isProduction) {
                throw new Error('AI interview service unavailable: Missing GEMINI_API_KEY.')
            }

            // Fallback for dev mode
            if (!initialQuestion) {
                if (track.toLowerCase().includes('frontend')) {
                    initialQuestion = "Welcome to your Frontend interview! Could you explain how the Virtual DOM works in React, and what advantages or trade-offs it introduces when updating UI components?"
                } else if (track.toLowerCase().includes('backend')) {
                    initialQuestion = "Welcome to your Backend interview! How do you approach designing a resilient REST API with database transactions, and how would you handle concurrent writes to the same resource?"
                } else if (track.toLowerCase().includes('dsa') || track.toLowerCase().includes('algorithm')) {
                    initialQuestion = "Welcome to your Algorithms interview! Could you explain the time and space complexity difference between Breadth-First Search (BFS) and Depth-First Search (DFS), and when you would choose one over the other?"
                } else {
                    initialQuestion = `Welcome to your ${track} interview! To start off, can you walk me through the core architectural concepts of ${track} and how you apply them in a production project?`
                }
            }

            // Insert Turn 1
            const { error: turnErr } = await supabase
                .from('mock_interview_turns')
                .insert({
                    session_id: session.id,
                    turn_number: 1,
                    question: initialQuestion
                })

            if (turnErr) {
                console.error('Failed to create turn 1:', turnErr)
                throw new Error('Database error recording turn 1')
            }

            return new Response(JSON.stringify({
                sessionId: session.id,
                track,
                turnNumber: 1,
                question: initialQuestion,
                totalQuestions: questionCount,
                status: 'in_progress'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // ─────────────────────────────────────────────────────────────
        // 2. ACTION: ANSWER CURRENT QUESTION
        // ─────────────────────────────────────────────────────────────
        if (action === 'answer') {
            const { sessionId, turnNumber, answer } = body
            if (!sessionId || !turnNumber || !answer?.trim()) {
                return new Response(JSON.stringify({ error: 'Missing sessionId, turnNumber, or answer' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                })
            }

            // Verify session belongs to user & is in progress
            const { data: session, error: sessErr } = await supabase
                .from('mock_interview_sessions')
                .select('*')
                .eq('id', sessionId)
                .eq('student_id', user.id)
                .single()

            if (sessErr || !session) {
                return new Response(JSON.stringify({ error: 'Session not found or access denied' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                })
            }

            // Fetch current turn
            const { data: currentTurn, error: currErr } = await supabase
                .from('mock_interview_turns')
                .select('*')
                .eq('session_id', sessionId)
                .eq('turn_number', turnNumber)
                .single()

            if (currErr || !currentTurn) {
                return new Response(JSON.stringify({ error: 'Current turn not found' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                })
            }

            const totalQuestions = session.question_count
            const isLastQuestion = turnNumber >= totalQuestions
            const nextTurnNumber = turnNumber + 1

            let aiFeedback = ''
            let nextQuestion = ''

            if (apiKey) {
                const prompt = `You are a Senior Technical Interviewer conducting a mock interview for Learnova.
Track: ${session.track}
Question ${turnNumber} of ${totalQuestions} that you asked: "${currentTurn.question}"
Candidate's response: "${answer.trim()}"

Tasks:
1. Provide a brief, natural interviewer reaction (1-2 sentences). Acknowledge strong aspects or briefly note what was missing in a supportive tone.
${isLastQuestion 
    ? '2. Conclude the interview warmly and state that their comprehensive performance report is being prepared.' 
    : `2. Generate Question ${nextTurnNumber} of ${totalQuestions}. Make it test a different key concept or progressively build on the candidate\'s depth.`
}

Return strictly a JSON object:
{
  "feedback": "Short 1-2 sentence transition commentary acknowledging their answer",
  "nextQuestion": "${isLastQuestion ? '' : 'Question text for next turn'}",
  "isCompleted": ${isLastQuestion}
}`

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { 
                            temperature: 0.6,
                            responseMimeType: "application/json"
                        }
                    })
                })

                if (res.ok) {
                    const data = await res.json()
                    const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}')
                    aiFeedback = parsed.feedback || ''
                    nextQuestion = parsed.nextQuestion || ''
                } else if (isProduction) {
                    throw new Error('AI interview service unavailable: GEMINI_API_KEY error.')
                }
            } else if (isProduction) {
                throw new Error('AI interview service unavailable: Missing GEMINI_API_KEY.')
            }

            // Fallback for dev mode
            if (!aiFeedback) {
                aiFeedback = "Thank you for explaining that clearly. You demonstrated a solid understanding of the principles involved."
                if (!isLastQuestion) {
                    nextQuestion = `Moving on to Question ${nextTurnNumber}: How do you approach error handling, logging, and state synchronization across complex distributed components in this domain?`
                }
            }

            // Update current turn with answer & feedback
            await supabase
                .from('mock_interview_turns')
                .update({
                    student_answer: answer.trim(),
                    ai_feedback: aiFeedback
                })
                .eq('id', currentTurn.id)

            // If not completed, create next turn row
            if (!isLastQuestion && nextQuestion) {
                await supabase
                    .from('mock_interview_turns')
                    .insert({
                        session_id: sessionId,
                        turn_number: nextTurnNumber,
                        question: nextQuestion
                    })
            }

            return new Response(JSON.stringify({
                sessionId,
                turnNumber,
                feedback: aiFeedback,
                nextQuestion: isLastQuestion ? null : nextQuestion,
                nextTurnNumber: isLastQuestion ? null : nextTurnNumber,
                isCompleted: isLastQuestion,
                totalQuestions
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // ─────────────────────────────────────────────────────────────
        // 3. ACTION: GENERATE REPORT
        // ─────────────────────────────────────────────────────────────
        if (action === 'report') {
            const { sessionId } = body
            if (!sessionId) {
                return new Response(JSON.stringify({ error: 'Missing sessionId' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                })
            }

            // Fetch session
            const { data: session, error: sessErr } = await supabase
                .from('mock_interview_sessions')
                .select('*')
                .eq('id', sessionId)
                .eq('student_id', user.id)
                .single()

            if (sessErr || !session) {
                return new Response(JSON.stringify({ error: 'Session not found' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 404,
                })
            }

            // Check if report already exists
            const { data: existingReport } = await supabase
                .from('mock_interview_reports')
                .select('*')
                .eq('session_id', sessionId)
                .maybeSingle()

            if (existingReport) {
                return new Response(JSON.stringify({
                    session,
                    report: existingReport
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                })
            }

            // Fetch all turns
            const { data: turns, error: turnsErr } = await supabase
                .from('mock_interview_turns')
                .select('*')
                .eq('session_id', sessionId)
                .order('turn_number', { ascending: true })

            if (turnsErr || !turns || turns.length === 0) {
                return new Response(JSON.stringify({ error: 'No interview turns found' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                })
            }

            // Compile interview transcript
            const transcript = turns.map(t => 
                `[Turn ${t.turn_number}]\nInterviewer Question: ${t.question}\nCandidate Answer: ${t.student_answer || '(No answer provided)'}\n`
            ).join('\n---\n')

            let reportData = null

            if (apiKey) {
                const prompt = `You are an expert Technical Interview Assessor for Learnova.
Analyze the following completed technical mock interview transcript and evaluate the candidate according to industry hiring rubrics.

Track: ${session.track}
Transcript:
${transcript}

Evaluation Rubric:
- Technical Accuracy (0-100): Correctness of algorithms, APIs, concepts, and technical terminology.
- Depth & Explanation (0-100): Ability to explain underlying mechanisms, trade-offs, and edge cases.
- Problem Solving (0-100): Structured reasoning, system thinking, and breakdown of complex challenges.
- Communication (0-100): Clarity, conciseness, articulation, and professional tone.
- Overall Score (0-100): Weighted average of performance.

Provide your response strictly in the following JSON format:
{
  "overall_score": 82,
  "category_scores": {
    "technical_accuracy": 85,
    "depth_explanation": 80,
    "problem_solving": 80,
    "communication": 85
  },
  "strengths": [
    "Clear understanding of component lifecycle and state management.",
    "Articulated time complexity trade-offs effectively."
  ],
  "gaps": [
    "Could have discussed concurrency edge cases and race conditions.",
    "Consider providing concrete production examples when explaining trade-offs."
  ],
  "model_answers": [
    {
      "question": "Question text from the weakest turn",
      "student_summary": "Brief summary of candidate's response",
      "ideal_answer": "Complete, exemplary model answer demonstrating ideal depth, edge case handling, and clarity.",
      "key_takeaway": "Crucial principle to remember for future real interviews."
    }
  ]
}

Guidelines:
- Return ONLY valid JSON, no markdown codeblocks or quotes.
- Provide 1 to 2 model answers for the questions where the candidate had the most room for improvement.`

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { 
                            temperature: 0.3,
                            responseMimeType: "application/json"
                        }
                    })
                })

                if (res.ok) {
                    const data = await res.json()
                    try {
                        reportData = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}')
                    } catch (e) {
                        console.error('Failed to parse Gemini report JSON:', e)
                    }
                } else if (isProduction) {
                    throw new Error('AI interview service unavailable: GEMINI_API_KEY error.')
                }
            } else if (isProduction) {
                throw new Error('AI interview service unavailable: Missing GEMINI_API_KEY.')
            }

            // Fallback for dev mode
            if (!reportData || typeof reportData.overall_score !== 'number') {
                reportData = {
                    overall_score: 80,
                    category_scores: {
                        technical_accuracy: 82,
                        depth_explanation: 78,
                        problem_solving: 80,
                        communication: 80
                    },
                    strengths: [
                        "Demonstrated solid conceptual foundation in core principles.",
                        "Clear articulation of common workflows and architectural patterns."
                    ],
                    gaps: [
                        "Deepen coverage of failure modes and asynchronous race conditions.",
                        "Mention concrete performance metrics and benchmarking strategies."
                    ],
                    model_answers: [
                        {
                            question: turns[0]?.question || "Core Architecture Question",
                            student_summary: turns[0]?.student_answer?.slice(0, 120) || "Overview provided.",
                            ideal_answer: "An exemplary answer starts with a concise definition, explains the underlying execution flow step-by-step, details the memory/computational trade-offs, and concludes with a real-world optimization example.",
                            key_takeaway: "Always structure your responses using the Pyramid Principle: high-level conclusion first, followed by supporting evidence and trade-offs."
                        }
                    ]
                }
            }

            // Save report to database
            const { data: createdReport, error: reportErr } = await supabase
                .from('mock_interview_reports')
                .insert({
                    session_id: sessionId,
                    category_scores: reportData.category_scores,
                    strengths: reportData.strengths || [],
                    gaps: reportData.gaps || [],
                    model_answers: reportData.model_answers || []
                })
                .select()
                .single()

            if (reportErr) {
                console.error('Failed to insert report:', reportErr)
                throw new Error('Database error saving interview report')
            }

            // Mark session as completed
            const { data: updatedSession, error: updateErr } = await supabase
                .from('mock_interview_sessions')
                .update({
                    status: 'completed',
                    overall_score: reportData.overall_score,
                    completed_at: new Date().toISOString()
                })
                .eq('id', sessionId)
                .select()
                .single()

            if (updateErr) {
                console.error('Failed to update session status:', updateErr)
            }

            return new Response(JSON.stringify({
                session: updatedSession || session,
                report: createdReport
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    } catch (error: any) {
        console.error('ai-mock-interview edge function error:', error)
        return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
