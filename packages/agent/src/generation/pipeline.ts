// The Quiz generation pipeline (PLAN §8, ADR 0001): generate, verify each Question separately,
// regenerate failures (at most two more rounds), validating in code throughout. Orchestrated in
// code, not by the model, so its behaviour is predictable. The model sits behind
// GenerationModel, so this file is tested without Bedrock.

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

/** A Question as the model proposes it. */
export interface Candidate {
  text: string;
  /** 2–4 Options. */
  options: string[];
  correctIndex: number;
}

export interface GenerateInput {
  topic: string;
  difficulty: Difficulty;
  count: number;
  /** Question texts to steer away from: the Host's earlier ones, and anything already seen. */
  avoid: string[];
}

export interface GenerationModel {
  generate(input: GenerateInput): Promise<Candidate[]>;
  /** An independent check: exactly one Option defensibly correct, and unambiguous. */
  verify(input: {
    topic: string;
    difficulty: Difficulty;
    question: Candidate;
  }): Promise<{ ok: boolean; reason: string }>;
}

/** Thrown by a GenerationModel when the model declines the Topic (FR-2.6). */
export class ModelRefusedError extends Error {
  constructor() {
    super('the model declined this Topic');
    this.name = 'ModelRefusedError';
  }
}

export interface GeneratedQuestion {
  text: string;
  options: { optionId: string; text: string }[];
  correctOptionId: string;
}

/** What happened to the Questions the model proposed, for traces and metrics. */
export interface GenerationStats {
  requested: number;
  /** generate calls made (1 to 3). */
  rounds: number;
  /** Questions proposed by the model, in every round. */
  proposed: number;
  /** Failed the shape rules (FR-2.3). */
  malformed: number;
  /** Repeated an earlier Question, or one in the avoid list. */
  duplicate: number;
  /** Failed the fact-checker. */
  failedCheck: number;
  returned: number;
}

/** One proposed Question that wasn't used, and why. */
export interface Rejection {
  text: string;
  kind: 'MALFORMED' | 'DUPLICATE' | 'FAILED_CHECK';
  /** The fact-checker's reason, for FAILED_CHECK. */
  reason?: string;
}

export type GenerationResult = { stats: GenerationStats; rejections: Rejection[] } & (
  | { ok: true; questions: GeneratedQuestion[] }
  | { ok: false; error: 'TOPIC_REFUSED' | 'GENERATION_FAILED' }
);

/** The first round plus two replacement rounds (PLAN §8). */
const ROUNDS = 3;

export async function generateQuiz(
  model: GenerationModel,
  input: GenerateInput,
): Promise<GenerationResult> {
  const kept: Candidate[] = [];
  const seen = [...input.avoid];
  const seenKeys = new Set(input.avoid.map(textKey));
  const rejections: Rejection[] = [];
  const stats: GenerationStats = {
    requested: input.count,
    rounds: 0,
    proposed: 0,
    malformed: 0,
    duplicate: 0,
    failedCheck: 0,
    returned: 0,
  };
  const reject = (rejection: Rejection) => {
    rejections.push(rejection);
    if (rejection.kind === 'MALFORMED') stats.malformed++;
    else if (rejection.kind === 'DUPLICATE') stats.duplicate++;
    else stats.failedCheck++;
  };
  try {
    for (let round = 0; round < ROUNDS && kept.length < input.count; round++) {
      stats.rounds++;
      const wanted = input.count - kept.length;
      // The model sometimes writes more than it was asked for. The extras are discarded unseen,
      // so they cost no verification calls and stay out of the avoid list.
      const batch = (
        await model.generate({
          topic: input.topic,
          difficulty: input.difficulty,
          count: wanted,
          avoid: [...seen],
        })
      ).slice(0, wanted);
      stats.proposed += batch.length;
      // Drop malformed Questions and repeats before spending a verification call on them.
      const fresh = batch.filter((question) => {
        const key = textKey(question.text);
        const repeat = seenKeys.has(key);
        seenKeys.add(key);
        seen.push(question.text);
        if (!isWellFormed(question)) reject({ text: question.text, kind: 'MALFORMED' });
        else if (repeat) reject({ text: question.text, kind: 'DUPLICATE' });
        else return true;
        return false;
      });
      const verdicts = await Promise.all(
        fresh.map((question) =>
          model.verify({ topic: input.topic, difficulty: input.difficulty, question }),
        ),
      );
      fresh.forEach((question, i) => {
        const verdict = verdicts[i];
        if (!verdict?.ok) {
          reject({ text: question.text, kind: 'FAILED_CHECK', reason: verdict?.reason ?? '' });
        } else if (kept.length < input.count) kept.push(question);
      });
    }
  } catch (err) {
    if (err instanceof ModelRefusedError) {
      return { ok: false, error: 'TOPIC_REFUSED', stats, rejections };
    }
    throw err;
  }
  stats.returned = kept.length;
  if (kept.length === 0) return { ok: false, error: 'GENERATION_FAILED', stats, rejections };
  return { ok: true, questions: kept.map(labelled), stats, rejections };
}

const MAX_TEXT = 300;
const MAX_OPTION = 120;

/** The shape rules from FR-2.3: 2–4 distinct, non-empty Options, exactly one correct. */
function isWellFormed(c: Candidate): boolean {
  const text = c.text.trim();
  const options = c.options.map((o) => o.trim());
  return (
    text.length > 0 &&
    text.length <= MAX_TEXT &&
    options.length >= 2 &&
    options.length <= 4 &&
    options.every((o) => o.length > 0 && o.length <= MAX_OPTION) &&
    new Set(options.map((o) => o.toLowerCase())).size === options.length &&
    Number.isInteger(c.correctIndex) &&
    c.correctIndex >= 0 &&
    c.correctIndex < options.length
  );
}

/** Compares Question texts ignoring case, spacing and punctuation. */
function textKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function labelled(c: Candidate): GeneratedQuestion {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    text: c.text.trim(),
    options: c.options.map((text, i) => ({ optionId: ids[i] as string, text: text.trim() })),
    correctOptionId: ids[c.correctIndex] as string,
  };
}
