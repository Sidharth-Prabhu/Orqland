# Stage 1: Build stage
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts ./packages/contracts
COPY frontend ./frontend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @orqland/contracts build
RUN pnpm --filter @orqland/web build

# Stage 2: Production runner stage (non-root)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Next.js telemetry disable
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output or build files
COPY --chown=nextjs:nodejs --from=builder /app/frontend/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/frontend/.next ./.next
COPY --chown=nextjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs --from=builder /app/packages ./packages
COPY --chown=nextjs:nodejs --from=builder /app/frontend/package.json ./package.json

USER nextjs

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
