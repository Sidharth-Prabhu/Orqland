# Stage 1: Build stage
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@12.18.0 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts ./packages/contracts
COPY backend ./backend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @orqland/contracts build
RUN pnpm --filter @orqland/api build
RUN pnpm --filter @orqland/api --prod deploy /app/deploy

# Stage 2: Production runner stage (non-root)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Run as non-root node user
USER node

COPY --chown=node:node --from=builder /app/backend/dist ./dist
COPY --chown=node:node --from=builder /app/deploy/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages/contracts/dist ./packages/contracts/dist

EXPOSE 3001

CMD ["node", "dist/backend/src/main.js"]
