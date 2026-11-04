// The worker Lambda (PLAN §8): runs Quiz generation jobs in the background, invoked
// asynchronously by the API Lambda with retries off, so a job never runs (or charges) twice.
import { randomUUID } from 'node:crypto';
import type { AgentRequest, AgentResponse } from '@quizapp/contracts';
import { createAgentClient } from '../aws/quiz-jobs.js';
import { DynamoRepository } from '../repository/dynamo-repository.js';
import { createQuizService, type QuizJob } from '../service/quiz-service.js';
import { jobMetrics, questionMetrics } from './job-metrics.js';

const quizzes = createQuizService({
  repo: new DynamoRepository(required('TABLE_NAME')),
  now: () => Date.now(),
  newId: randomUUID,
  startJob: async () => {
    throw new Error('the worker does not start jobs');
  },
  agent: withQuestionMetrics(createAgentClient(required('AGENT_RUNTIME_ARN'))),
  generationLimit: 20,
});

export const handler = async (job: QuizJob): Promise<void> => {
  const metrics = jobMetrics(await quizzes.runJob(job), required('APP_ENV'), Date.now());
  if (metrics) console.log(JSON.stringify(metrics));
};

/** Publishes each agent reply's Question counts, so dropped Questions can be graphed. */
function withQuestionMetrics(agent: (request: AgentRequest) => Promise<AgentResponse>) {
  return async (request: AgentRequest): Promise<AgentResponse> => {
    const reply = await agent(request);
    if (reply.stats) {
      console.log(JSON.stringify(questionMetrics(reply.stats, required('APP_ENV'), Date.now())));
    }
    return reply;
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}
