FROM node:20-alpine AS base
RUN npm install -g pnpm@12.18.0

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts ./packages/contracts
COPY backend ./backend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @orqland/contracts build
RUN pnpm --filter @orqland/api build

EXPOSE 3001
CMD ["pnpm", "--filter", "@orqland/api", "start:prod"]
