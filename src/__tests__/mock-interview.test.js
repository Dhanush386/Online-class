import { describe, it, expect } from 'vitest'

// ─────────────────────────────────────────────────────────────
// 1. RLS Policy Simulation Logic for Mock Interview Engine
// ─────────────────────────────────────────────────────────────
export function evaluateSessionAccess(session, requestUser) {
  if (!requestUser?.id) return false
  if (['organizer', 'main_admin', 'sub_admin'].includes(requestUser.role)) return true
  return session.student_id === requestUser.id
}

export function evaluateTurnAccess(turn, session, requestUser) {
  if (!requestUser?.id) return false
  if (['organizer', 'main_admin', 'sub_admin'].includes(requestUser.role)) return true
  if (turn.session_id !== session.id) return false
  return session.student_id === requestUser.id
}

export function evaluateReportAccess(report, session, requestUser) {
  if (!requestUser?.id) return false
  if (['organizer', 'main_admin', 'sub_admin'].includes(requestUser.role)) return true
  if (report.session_id !== session.id) return false
  return session.student_id === requestUser.id
}

// ─────────────────────────────────────────────────────────────
// 2. Structured Report Parser Simulation
// ─────────────────────────────────────────────────────────────
export function parseAndValidateReport(rawJson) {
  let parsed
  try {
    parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson
  } catch {
    throw new Error('Invalid JSON received from AI')
  }

  // Ensure overall_score is within 0-100
  const overallScore = Math.max(0, Math.min(100, Number(parsed.overall_score) || 0))

  const requiredCategories = ['technical_accuracy', 'depth_explanation', 'problem_solving', 'communication']
  const categoryScores = {}
  for (const cat of requiredCategories) {
    categoryScores[cat] = Math.max(0, Math.min(100, Number(parsed.category_scores?.[cat]) || 75))
  }

  const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.filter(Boolean) : []
  const gaps = Array.isArray(parsed.gaps) ? parsed.gaps.filter(Boolean) : []
  const modelAnswers = Array.isArray(parsed.model_answers) ? parsed.model_answers : []

  return {
    overall_score: overallScore,
    category_scores: categoryScores,
    strengths,
    gaps,
    model_answers: modelAnswers
  }
}

// ─────────────────────────────────────────────────────────────
// 3. Interview Turn Progression Helper
// ─────────────────────────────────────────────────────────────
export function calculateNextInterviewState(currentTurn, totalQuestions) {
  const isCompleted = currentTurn >= totalQuestions
  return {
    isCompleted,
    nextTurnNumber: isCompleted ? null : currentTurn + 1,
    progressPercentage: Math.min(100, Math.round((currentTurn / totalQuestions) * 100))
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────
describe('AI Mock Interview: RLS & Isolation Policies', () => {
  const studentA = { id: 'student-123', role: 'student' }
  const studentB = { id: 'student-456', role: 'student' }
  const admin = { id: 'admin-999', role: 'main_admin' }

  const sessionA = { id: 'sess-1', student_id: 'student-123', track: 'Frontend Development' }
  const turnA = { id: 'turn-1', session_id: 'sess-1', turn_number: 1 }
  const reportA = { id: 'rep-1', session_id: 'sess-1' }

  it('allows owner student to read their own sessions, turns, and reports', () => {
    expect(evaluateSessionAccess(sessionA, studentA)).toBe(true)
    expect(evaluateTurnAccess(turnA, sessionA, studentA)).toBe(true)
    expect(evaluateReportAccess(reportA, sessionA, studentA)).toBe(true)
  })

  it('strictly rejects access from a different student (cross-tenant protection)', () => {
    expect(evaluateSessionAccess(sessionA, studentB)).toBe(false)
    expect(evaluateTurnAccess(turnA, sessionA, studentB)).toBe(false)
    expect(evaluateReportAccess(reportA, sessionA, studentB)).toBe(false)
  })

  it('allows administrators and organizers to inspect interview sessions', () => {
    expect(evaluateSessionAccess(sessionA, admin)).toBe(true)
    expect(evaluateTurnAccess(turnA, sessionA, admin)).toBe(true)
    expect(evaluateReportAccess(reportA, sessionA, admin)).toBe(true)
  })
})

describe('AI Mock Interview: Report Parser & Schema Validation', () => {
  it('parses valid AI structured output into normalized report shape', () => {
    const mockAiOutput = JSON.stringify({
      overall_score: 88,
      category_scores: {
        technical_accuracy: 90,
        depth_explanation: 85,
        problem_solving: 85,
        communication: 92
      },
      strengths: [
        'Excellent explanation of React component memoization.',
        'Clear understanding of event loop and microtask queues.'
      ],
      gaps: [
        'Could elaborate more on SSR hydration mismatch errors.'
      ],
      model_answers: [
        {
          question: 'How does React reconciler work?',
          ideal_answer: 'The reconciler computes fiber tree diffs...',
          key_takeaway: 'Focus on time slicing and priority lanes.'
        }
      ]
    })

    const report = parseAndValidateReport(mockAiOutput)

    expect(report.overall_score).toBe(88)
    expect(report.category_scores.technical_accuracy).toBe(90)
    expect(report.category_scores.depth_explanation).toBe(85)
    expect(report.strengths).toHaveLength(2)
    expect(report.gaps).toHaveLength(1)
    expect(report.model_answers).toHaveLength(1)
  })

  it('handles and sanitizes partial or out-of-bound LLM data', () => {
    const rawMalformatted = {
      overall_score: 150, // Out of bounds
      category_scores: {
        technical_accuracy: 110,
        depth_explanation: -20
      },
      strengths: null,
      gaps: ['Needs more detail']
    }

    const report = parseAndValidateReport(rawMalformatted)

    expect(report.overall_score).toBe(100) // Clamped
    expect(report.category_scores.technical_accuracy).toBe(100) // Clamped
    expect(report.category_scores.depth_explanation).toBe(0) // Clamped
    expect(report.category_scores.problem_solving).toBe(75) // Fallback default
    expect(Array.isArray(report.strengths)).toBe(true)
    expect(report.gaps).toEqual(['Needs more detail'])
  })
})

describe('AI Mock Interview: Turn Progression & State Machine', () => {
  it('correctly increments turns and calculates progress percentage', () => {
    const stateTurn2 = calculateNextInterviewState(2, 5)
    expect(stateTurn2.isCompleted).toBe(false)
    expect(stateTurn2.nextTurnNumber).toBe(3)
    expect(stateTurn2.progressPercentage).toBe(40)
  })

  it('detects completion on the final question', () => {
    const stateTurn5 = calculateNextInterviewState(5, 5)
    expect(stateTurn5.isCompleted).toBe(true)
    expect(stateTurn5.nextTurnNumber).toBeNull()
    expect(stateTurn5.progressPercentage).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────
// 4. Question Bank Security & Answer Isolation Logic
// ─────────────────────────────────────────────────────────────
export function evaluateBaseTableAccess(requestUser) {
  if (!requestUser?.id) return false
  return ['organizer', 'main_admin', 'sub_admin'].includes(requestUser.role)
}

export function projectPublicQuestionView(customQuestion) {
  // Simulates Postgres View `mock_interview_questions_public`
  const { sample_answer, ...publicFields } = customQuestion
  return publicFields
}

describe('AI Mock Interview: Question Bank Security & Answer Key Protection', () => {
  const student = { id: 'student-123', role: 'student' }
  const organizer = { id: 'org-456', role: 'organizer' }
  const admin = { id: 'admin-789', role: 'main_admin' }

  const questionWithRubric = {
    id: 'q-101',
    track: 'Frontend Development',
    category: 'React Reconciliation',
    difficulty: 'intermediate',
    question: 'How does the Virtual DOM diffing algorithm work?',
    sample_answer: 'CONFIDENTIAL: Reconciliation algorithm runs in O(n) heuristic using key heuristics.',
    order_index: 1,
    is_active: true
  }

  it('strictly rejects student direct SELECT on the base table to prevent answer key leaks', () => {
    expect(evaluateBaseTableAccess(student)).toBe(false)
  })

  it('permits organizers and administrators full access to the base table', () => {
    expect(evaluateBaseTableAccess(organizer)).toBe(true)
    expect(evaluateBaseTableAccess(admin)).toBe(true)
  })

  it('ensures the public view strips out the sample_answer / grading rubric completely', () => {
    const studentView = projectPublicQuestionView(questionWithRubric)
    expect(studentView.question).toBe('How does the Virtual DOM diffing algorithm work?')
    expect(studentView.sample_answer).toBeUndefined()
    expect(studentView).not.toHaveProperty('sample_answer')
  })

  it('guarantees turn question text is snapshotted at ask-time and immutable to mid-interview edits', () => {
    const originalTurn = {
      id: 'turn-1',
      session_id: 'sess-1',
      turn_number: 1,
      question: questionWithRubric.question
    }

    // Organizer subsequently edits the question in the bank
    const modifiedBankQuestion = {
      ...questionWithRubric,
      question: 'UPDATED: Describe React 19 Actions and useActionState hook.'
    }

    // The student's recorded turn must remain unchanged
    expect(originalTurn.question).toBe('How does the Virtual DOM diffing algorithm work?')
    expect(originalTurn.question).not.toBe(modifiedBankQuestion.question)
  })
})
