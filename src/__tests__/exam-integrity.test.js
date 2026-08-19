import { describe, it, expect } from 'vitest'

// Server-side grading simulation matching submit_assessment_with_token RPC
export function evaluateAssessmentSubmission(questions, studentAnswers) {
  let score = 0;
  const evaluated = [];

  for (const q of questions) {
    let isCorrect = false;
    const answerObj = studentAnswers.find(a => a.question_id === q.id);
    
    if (answerObj && answerObj.selected_option !== undefined && answerObj.selected_option !== '') {
      let correctArr = [];
      try {
        if (q.correct_answer?.startsWith('[') && q.correct_answer?.endsWith(']')) {
          correctArr = JSON.parse(q.correct_answer);
        } else {
          correctArr = [q.correct_answer];
        }
      } catch {
        correctArr = [q.correct_answer];
      }

      if (Array.isArray(answerObj.selected_option)) {
        isCorrect = correctArr.length === answerObj.selected_option.length &&
                    correctArr.every(opt => answerObj.selected_option.includes(opt));
      } else {
        isCorrect = correctArr.includes(answerObj.selected_option);
      }
    }

    if (isCorrect) score++;
    evaluated.push({
      question_id: q.id,
      selected_option: answerObj ? answerObj.selected_option : null,
      is_correct: isCorrect
    });
  }

  const total = questions.length || 1;
  return {
    score,
    total: questions.length,
    percentage: Math.round((score / total) * 100),
    answers: evaluated
  };
}

// Time-window check simulation matching is_assessment_time_open helper
export function isAssessmentTimeOpen(assessment, now = new Date()) {
  const fiveMinGrace = 5 * 60 * 1000;
  if (assessment.open_time) {
    const openTime = new Date(assessment.open_time).getTime();
    if (now.getTime() + fiveMinGrace < openTime) {
      return false; // Too early
    }
  }
  if (assessment.due_date) {
    const dueDate = new Date(assessment.due_date).getTime();
    if (now.getTime() > dueDate) {
      return false; // Closed / Expired
    }
  }
  return true;
}

describe('Exam Integrity & Server-Side Grading Engine', () => {
  const mockQuestions = [
    { id: 'q1', correct_answer: 'Option A' },
    { id: 'q2', correct_answer: JSON.stringify(['Opt 1', 'Opt 2']) },
    { id: 'q3', correct_answer: '42' }
  ];

  it('correctly calculates student score without trusting client calculations', () => {
    const studentAnswers = [
      { question_id: 'q1', selected_option: 'Option A' }, // Correct
      { question_id: 'q2', selected_option: ['Opt 1', 'Opt 2'] }, // Correct multi
      { question_id: 'q3', selected_option: 'Wrong Answer' } // Incorrect
    ];

    const result = evaluateAssessmentSubmission(mockQuestions, studentAnswers);
    expect(result.score).toBe(2);
    expect(result.total).toBe(3);
    expect(result.percentage).toBe(67);
  });

  it('enforces both start and closing boundaries for exam access', () => {
    const now = new Date('2026-08-20T10:00:00Z');

    // Future exam (should be blocked)
    expect(isAssessmentTimeOpen({ open_time: '2026-08-20T12:00:00Z', due_date: '2026-08-20T14:00:00Z' }, now)).toBe(false);

    // Active exam (within window)
    expect(isAssessmentTimeOpen({ open_time: '2026-08-20T09:00:00Z', due_date: '2026-08-20T11:00:00Z' }, now)).toBe(true);

    // Expired exam (should be blocked at closing boundary)
    expect(isAssessmentTimeOpen({ open_time: '2026-08-20T08:00:00Z', due_date: '2026-08-20T09:30:00Z' }, now)).toBe(false);
  });
});
