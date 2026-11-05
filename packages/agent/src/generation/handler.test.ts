import type { Span } from '@opentelemetry/api';
import type { AgentRequest } from '@quizapp/contracts';
import { describe, expect, it, vi } from 'vitest';
import { recordOnSpan } from './handler.js';
import type { GenerationResult } from './pipeline.js';

const request: AgentRequest = {
  mode: 'generate',
  topic: '90s music',
  difficulty: 'MEDIUM',
  count: 3,
  avoid: [],
};

function fakeSpan() {
  return { setAttributes: vi.fn(), addEvent: vi.fn() };
}

describe('recordOnSpan', () => {
  it('records the counts, and each dropped Question with the reason', () => {
    const span = fakeSpan();
    const result: GenerationResult = {
      ok: true,
      questions: [],
      stats: {
        requested: 3,
        rounds: 2,
        proposed: 5,
        malformed: 1,
        duplicate: 0,
        failedCheck: 1,
        returned: 2,
      },
      rejections: [
        { text: 'Bad?', kind: 'MALFORMED' },
        { text: 'Wrong?', kind: 'FAILED_CHECK', reason: 'Plush is by Stone Temple Pilots' },
      ],
    };
    recordOnSpan(span as unknown as Span, request, result);

    expect(span.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'quiz.outcome': 'SUCCESS',
        'quiz.rounds': 2,
        'quiz.questions.malformed': 1,
        'quiz.questions.failed_check': 1,
        'quiz.questions.returned': 2,
        'quiz.short': true,
      }),
    );
    expect(span.addEvent.mock.calls).toEqual([
      ['question.rejected', { 'question.rejection': 'MALFORMED', 'question.text': 'Bad?' }],
      [
        'question.rejected',
        {
          'question.rejection': 'FAILED_CHECK',
          'question.text': 'Wrong?',
          'question.rejection_reason': 'Plush is by Stone Temple Pilots',
        },
      ],
    ]);
  });
});
