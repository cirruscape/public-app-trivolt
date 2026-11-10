import { describe, expect, it } from 'vitest';
import { deleteConfirmation } from './delete-quiz.js';

describe('deleteConfirmation', () => {
  it('names the Quiz by its Topic, falling back to a generic name', () => {
    expect(deleteConfirmation({ topic: '90s Britpop', status: 'DRAFT' }).title).toBe(
      'Delete “90s Britpop”?',
    );
    expect(deleteConfirmation({ topic: null, status: 'FAILED' }).title).toBe('Delete this quiz?');
  });

  it('warns that a Quiz still generating still counts towards the daily limit', () => {
    expect(deleteConfirmation({ topic: 'Capitals', status: 'GENERATING' }).body).toContain(
      'still counts towards today’s limit',
    );
  });

  it('reassures that Past games are kept when a Ready Quiz is deleted', () => {
    expect(deleteConfirmation({ topic: 'Capitals', status: 'READY' }).body).toContain(
      'Games you’ve already played with it stay in Past games',
    );
  });

  it('says it cannot be undone, except for a Failed Quiz, which has nothing to lose', () => {
    for (const status of ['GENERATING', 'DRAFT', 'READY'] as const) {
      expect(deleteConfirmation({ topic: 'Capitals', status }).body).toContain('can’t be undone');
    }
    expect(deleteConfirmation({ topic: 'Capitals', status: 'FAILED' }).body).not.toContain(
      'can’t be undone',
    );
  });
});
