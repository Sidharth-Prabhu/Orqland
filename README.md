# ORQLAND Chat System - Production Monorepo

Enterprise-grade, real-time business-to-client communication platform designed according to the **ORQLAND Chat System Production Architecture Specification**.

---

## 📁 Repository Structure

```
OpenPurpl/
├── backend/               # Independent NestJS 11 Core Backend & Realtime Gateway (Port 3001)
│   ├── src/
│   │   ├── modules/       # Auth, Conversations, Messages, Presence, Attachments, Notifications
│   │   ├── gateways/      # Socket.IO Realtime Gateway with Room Authorization
│   │   ├── infrastructure/# PostgreSQL (Drizzle ORM), Redis 7+ Adapter, S3/GCS Storage
│   │   └── common/        # Guards (Firebase Auth, WS Auth), Interceptors, Exception Filters
│   ├── test/              # 18 Automated Unit, Integration & Reconnect Recovery Tests
│   └── Dockerfile
│
├── frontend/              # Next.js 16 (Turbopack) / React 19 Frontend & BFF Gateway (Port 3000)
│   ├── src/
│   │   ├── app/           # App Router UI views & BFF Route Handlers (/api/chat/*)
│   │   ├── components/    # Reusable chat interface (ChatConversation, DirectMessagesList, etc.)
│   │   ├── features/chat/ # TanStack Query v5 Hooks & Realtime Socket synchronization
│   │   ├── stores/        # Zustand v5 UI & Media State Store (Zero duplicated server state)
│   │   └── lib/           # Socket.IO client manager, BFF proxy, encryption at rest
│   ├── public/            # Static assets & Service Worker for desktop push notifications
│   └── Dockerfile
│
├── packages/
│   └── contracts/         # Shared TypeScript DTOs, Event Contracts & Domain Models
│
├── docs/                  # Engineering & Operational Documentation
│   ├── ARCHITECTURE.md    # Multi-tier topology, security boundaries & Drizzle schema
│   ├── WEBSOCKET_CONTRACTS.md # CHAT_EVENTS protocol, payloads & acknowledgements
│   ├── API_SPECIFICATION.md   # REST endpoints, parameters & ChatErrorCode reference
│   └── OPERATIONS.md      # Scaling, PostgreSQL backups, Redis PubSub & health metrics
│
├── docker-compose.yml     # Multi-container stack (Postgres 16, Redis 7, Backend, Frontend)
├── pnpm-workspace.yaml    # Workspace definition (backend, frontend, packages/contracts)
└── .env.example           # Complete environment variable reference
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- `pnpm` 12+ (`npm install -g pnpm`)
- Docker & Docker Compose (optional for full containerized stack)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment
```bash
cp .env.example .env
cp .env.example backend/.env
cp .env.example frontend/.env.local
```

### 3. Run Development Servers
To run both backend and frontend concurrently from root:
```bash
pnpm dev
```

Or run either individually:
```bash
# Run only Backend (NestJS 11 on http://localhost:3001)
pnpm dev:backend
# or: cd backend && pnpm start:dev

# Run only Frontend (Next.js 16 on http://localhost:3000)
pnpm dev:frontend
# or: cd frontend && pnpm dev
```

### 4. Run Automated Tests
```bash
pnpm test
```

### 5. Build for Production
```bash
pnpm run build
```

---

## 🐳 Running with Docker Compose

To spin up the entire production stack (PostgreSQL 16, Redis 7, NestJS API, and Next.js Web):
```bash
docker compose up --build
```
- Frontend UI: `http://localhost:3000`
- Backend REST API: `http://localhost:3001/api/v1`
- Realtime Gateway: `ws://localhost:3001`
