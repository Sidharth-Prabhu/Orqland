FROM node:20-alpine AS base
RUN npm install -g pnpm@12.18.0

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts ./packages/contracts
COPY frontend ./frontend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @orqland/contracts build
RUN pnpm --filter @orqland/web build

EXPOSE 3000
CMD ["pnpm", "--filter", "@orqland/web", "start"]
