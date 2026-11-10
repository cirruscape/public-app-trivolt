// What the Host is asked before deleting a Quiz from their list. A Quiz can be deleted in any
// status; the API keeps a Quiz deleted mid-generation deleted, and Games already played keep
// their own copy of it (FR-3.4).
import type { QuizSummary } from '../types.js';

export interface Confirmation {
  title: string;
  body: string;
}

export function deleteConfirmation(quiz: Pick<QuizSummary, 'topic' | 'status'>): Confirmation {
  const title = `Delete ${quiz.topic ? `“${quiz.topic}”` : 'this quiz'}?`;
  switch (quiz.status) {
    case 'GENERATING':
      return {
        title,
        body: 'It’s still being generated, and still counts towards today’s limit. This can’t be undone.',
      };
    case 'DRAFT':
      return { title, body: 'Its questions will be lost. This can’t be undone.' };
    case 'READY':
      return {
        title,
        body: 'Games you’ve already played with it stay in Past games. This can’t be undone.',
      };
    case 'FAILED':
      return { title, body: 'It will be removed from your quizzes.' };
  }
}
