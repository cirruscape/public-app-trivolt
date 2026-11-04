// AgentCore Runtime HTTP contract: listen on 0.0.0.0:8080 (arm64 image),
// GET /ping for health, POST /invocations with a JSON AgentRequest (PLAN §8).
import { context, propagation, SpanStatusCode, trace } from '@opentelemetry/api';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { AgentRequest, type AgentResponse } from '@quizapp/contracts';
import { createBedrockGenerationModel } from './generation/bedrock-model.js';
import { createGenerationHandler } from './generation/handler.js';
import { modelConfigFromEnv } from './model.js';

const PORT = 8080;
const MAX_BODY_BYTES = 256 * 1024;
/** Set by AgentCore Runtime on every invocation (Node lower-cases header names). */
const SESSION_HEADER = 'x-amzn-bedrock-agentcore-runtime-session-id';

export function createRouter(handle: (request: AgentRequest) => Promise<AgentResponse>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method === 'GET' && req.url === '/ping') {
      send(res, 200, { status: 'Healthy' });
      return;
    }
    if (req.method === 'POST' && req.url === '/invocations') {
      const parsed = AgentRequest.safeParse(await readJson(req));
      if (!parsed.success) {
        send(res, 400, { status: 'error', error: 'INVALID_REQUEST' });
        return;
      }
      try {
        send(res, 200, await traced(req, () => handle(parsed.data)));
      } catch (err) {
        console.error('generation failed', err);
        send(res, 500, { status: 'error', error: 'GENERATION_FAILED' });
      }
      return;
    }
    send(res, 404, { error: 'NOT_FOUND' });
  };
}

/**
 * Runs `fn` in one `invocation` span, so the writer's and checker's agent spans share a trace,
 * with the AgentCore session ID as `session.id` baggage. ADOT copies that baggage onto every
 * span, which is how AgentCore Observability groups traces into sessions. Without a registered
 * OTel SDK (tests, local runs), this is a no-op wrapper.
 */
function traced<T>(req: IncomingMessage, fn: () => Promise<T>): Promise<T> {
  const sessionId = req.headers[SESSION_HEADER];
  let ctx = context.active();
  if (typeof sessionId === 'string' && sessionId) {
    const baggage = (propagation.getBaggage(ctx) ?? propagation.createBaggage()).setEntry(
      'session.id',
      { value: sessionId },
    );
    ctx = propagation.setBaggage(ctx, baggage);
  }
  return context.with(ctx, () =>
    trace.getTracer('quizapp-agent').startActiveSpan('invocation', async (span) => {
      try {
        return await fn();
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw err;
      } finally {
        span.end();
      }
    }),
  );
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return undefined;
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const handle = createGenerationHandler(createBedrockGenerationModel(modelConfigFromEnv()));
  createServer((req, res) => void createRouter(handle)(req, res)).listen(PORT, '0.0.0.0', () =>
    console.log(`agent listening on 0.0.0.0:${PORT}`),
  );
}
