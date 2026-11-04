# AgentCore Runtime image: arm64, listening on 0.0.0.0:8080 (HTTP protocol contract).
# The agent is pre-bundled by `pnpm --filter @quizapp/agent bundle`. Beside the bundle, the image
# installs AWS Distro for OpenTelemetry (ADOT) from image/package-lock.json, which exports
# Strands' spans to CloudWatch (AgentCore Observability). Those packages are pure JavaScript, so
# they're installed on the build machine's own platform and only copied into the arm64 image;
# nothing runs under emulation when CI builds it on x86.
# Build from packages/agent:
#   docker buildx build --platform linux/arm64 -t quizapp-agent .

FROM --platform=$BUILDPLATFORM node:22-slim AS deps
WORKDIR /app
COPY image/package.json image/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund

FROM --platform=linux/arm64 node:22-slim
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY dist-bundle/ ./
ENV NODE_ENV=production \
    NODE_OPTIONS=--enable-source-maps
EXPOSE 8080
USER node
# ADOT must load before the app so it can register the global tracer provider Strands uses.
CMD ["node", "--require", "@aws/aws-distro-opentelemetry-node-autoinstrumentation/register", "index.mjs"]
