// Maps an AgentRequest onto the pipeline: a whole Quiz, or one replacement Question. Records
// what the pipeline rejected on the active (invocation) span, for AgentCore Observability.
import { trace, type Span } from '@opentelemetry/api';
import type { AgentRequest, AgentResponse } from '@quizapp/contracts';
import { generateQuiz, type GenerationModel, type GenerationResult } from './pipeline.js';

export function createGenerationHandler(model: GenerationModel) {
  return async (request: AgentRequest): Promise<AgentResponse> => {
    const count = request.mode === 'generate' ? request.count : 1;
    const result = await generateQuiz(model, {
      topic: request.topic,
      difficulty: request.difficulty,
      count,
      avoid: request.avoid,
    });
    const span = trace.getActiveSpan();
    if (span) recordOnSpan(span, request, result);
    return result.ok
      ? { status: 'success', questions: result.questions, stats: result.stats }
      : { status: 'error', error: result.error, stats: result.stats };
  };
}

/** Counts as span attributes, and each rejected Question (with the checker's reason) as an event. */
export function recordOnSpan(span: Span, request: AgentRequest, result: GenerationResult): void {
  const { stats } = result;
  span.setAttributes({
    'quiz.mode': request.mode,
    'quiz.topic': request.topic,
    'quiz.difficulty': request.difficulty,
    'quiz.outcome': result.ok ? 'SUCCESS' : result.error,
    'quiz.rounds': stats.rounds,
    'quiz.questions.requested': stats.requested,
    'quiz.questions.proposed': stats.proposed,
    'quiz.questions.malformed': stats.malformed,
    'quiz.questions.duplicate': stats.duplicate,
    'quiz.questions.failed_check': stats.failedCheck,
    'quiz.questions.returned': stats.returned,
    'quiz.short': stats.returned < stats.requested,
  });
  for (const rejection of result.rejections) {
    span.addEvent('question.rejected', {
      'question.rejection': rejection.kind,
      'question.text': rejection.text,
      ...(rejection.reason !== undefined && { 'question.rejection_reason': rejection.reason }),
    });
  }
}
