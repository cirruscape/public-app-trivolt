import { describe, expect, it } from 'vitest';
import { jobMetrics, questionMetrics } from './job-metrics.js';

describe('jobMetrics', () => {
  it('counts one outcome as a CloudWatch embedded metric, per environment', () => {
    expect(jobMetrics('FAILED', 'prod', 1_800_000_000_000)).toEqual({
      _aws: {
        Timestamp: 1_800_000_000_000,
        CloudWatchMetrics: [
          {
            Namespace: 'QuizApp',
            Dimensions: [['Env']],
            Metrics: [
              { Name: 'GenerationSucceeded', Unit: 'Count' },
              { Name: 'GenerationFailed', Unit: 'Count' },
              { Name: 'GenerationRefused', Unit: 'Count' },
            ],
          },
        ],
      },
      Env: 'prod',
      GenerationSucceeded: 0,
      GenerationFailed: 1,
      GenerationRefused: 0,
    });
  });

  it('records nothing for a skipped job', () => {
    expect(jobMetrics('SKIPPED', 'prod', 0)).toBeNull();
  });
});

describe('questionMetrics', () => {
  it("publishes one agent reply's Question counts as an embedded metric", () => {
    const stats = {
      requested: 10,
      rounds: 2,
      proposed: 14,
      malformed: 1,
      duplicate: 2,
      failedCheck: 3,
      returned: 9,
    };
    expect(questionMetrics(stats, 'dev', 1_800_000_000_000)).toEqual({
      _aws: {
        Timestamp: 1_800_000_000_000,
        CloudWatchMetrics: [
          {
            Namespace: 'QuizApp',
            Dimensions: [['Env']],
            Metrics: [
              { Name: 'QuestionsRequested', Unit: 'Count' },
              { Name: 'QuestionsReturned', Unit: 'Count' },
              { Name: 'QuestionsMalformed', Unit: 'Count' },
              { Name: 'QuestionsFailedCheck', Unit: 'Count' },
            ],
          },
        ],
      },
      Env: 'dev',
      QuestionsRequested: 10,
      QuestionsReturned: 9,
      QuestionsMalformed: 1,
      QuestionsFailedCheck: 3,
    });
  });
});
