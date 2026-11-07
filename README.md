# ORQLAND Real-Time Chat Platform

Enterprise-grade, real-time business-to-client communication platform designed according to the **ORQLAND Chat System Production Architecture Specification**.

---

## 📑 Generated PDF Documentation

The repository includes complete, publication-grade PDF documentation generated for the architecture and database:
- **[ORQLAND Complete Software Documentation (PDF)](./ORQLAND_Complete_Software_Documentation.pdf)**: Complete system design, tech stack breakdown, workflow diagrams, configurations, API specifications, and operational runbook.
- **[ORQLAND Database Design Specification (PDF)](./ORQLAND_Database_Design.pdf)**: Relational schema, DDL definitions, data types, indexes, and high-frequency production queries.

---

## 🏗️ System Architecture & Multi-Tier Topology

The platform follows a modern **BFF (Backend-For-Frontend) proxy pattern** decoupled from a high-throughput **NestJS 11 Core Service**, backed by **PostgreSQL 16** for transactional ACID guarantees and **Redis 7** for ephemeral presence and horizontal WebSocket clustering.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT BROWSER                                    |
|  [Next.js App Router] <---> [React Query / Zustand Cache] <---> [BroadcastChannel] |
+------------------------+-------------------------------------+--------------------+
                         | HTTPS / REST                        | WSS / Socket.IO
                         v                                     v
+------------------------+-------------+       +---------------+--------------------+
|       NEXT.JS BFF PROXY ROUTE       |       |       NESTJS WEBSOCKET GATEWAY     |
|   /api/chat/* -> http://localhost:3001|       |   ws://localhost:3001/socket.io    |
+------------------------+-------------+       +---------------+--------------------+
                         |                                     |
                         +------------------+------------------+
                                            v
                      +---------------------+---------------------+
                      |             NESTJS 11 API CORE            |
                      |  - FirebaseAuthGuard (Bearer Verification)|
                      |  - ConversationsService & MessagesService |
                      |  - 50MB BodyParser for Attachments        |
                      +---------------------+---------------------+
                                            |
                         +------------------+------------------+
                         |                                     |
                         v                                     v
              +----------+-----------+              +----------+-----------+
              |     POSTGRESQL 16    |              |       REDIS 7+       |
              |  ACID Chat Ledger    |              |  PubSub Mesh & Adap. |
              |  Drizzle ORM Engine  |              |  Ephemeral Presence  |
              +----------------------+              +----------------------+
```

---

## 🧰 Technology Stack & Frameworks

| Tier / Component | Technology & Version | Key Purpose & Architectural Fit |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16.4.3**, React 19.3, TailwindCSS v4 | Server-rendered React components, Discord-style in-chat staged attachment composer, responsive mobile drawer. |
| **Client State & Cache**| **TanStack Query v5**, **Zustand v5**, `BroadcastChannel` | Zero-latency optimistic UI updates, multi-tab sync without redundant refetches, automatic active window notification suppression. |
| **Backend Core** | **NestJS 11**, Express 5, Node.js 22 LTS | Micro-monolith architecture with dependency injection, validation pipes, global exception filters, and modular services. |
| **Real-Time Mesh** | **Socket.IO v4**, `@socket.io/redis-adapter` | Multiplexed full-duplex messaging, room partitioning (`conversation:{id}`), sub-5ms heartbeat presence, and typing indicators. |
| **Database & ORM** | **PostgreSQL 16**, **Drizzle ORM v0.38**, Drizzle Kit | Type-safe schema definitions, ACID transactions for read cursors, monotonic sequence numbering, and JSONB aggregation. |
| **Cache & PubSub** | **Redis 7+**, `ioredis v5.4` | Cluster socket adapter, distributed pub/sub fanout, active session tracking, and idempotency key locks. |
| **Authentication** | **Firebase Auth**, Firebase Admin v13 | Cryptographically validated JWT bearer tokens mapped to internal non-enumerable UUID identifiers. |
| **Shared Contracts** | `@orqland/contracts` (TypeScript workspace) | Shared DTOs, domain models, and validation schemas ensuring end-to-end type safety between frontend and backend. |

---

## 🔄 Core Workflows & Lifecycles

### 1. Message Dispatch & Delivery Lifecycle
1. **Optimistic Rendering (0ms):** The client assigns a temporary UUID (`temp-timestamp-rand`) with status `sending` and immediately displays the bubble in the thread.
2. **REST Ingestion:** The client dispatches a POST request to `/api/chat/send` including an `idempotencyKey`. The backend verifies authorization and writes to PostgreSQL.
3. **Receipt Confirmation:** The server returns the confirmed `ChatMessage` entity; the client updates status to `sent`.
4. **WebSocket Fan-Out:** NestJS broadcasts `message:created` to the Socket.IO room `conversation:{id}`.
5. **Delivery & Read Acknowledgements:** The recipient client acknowledges receipt via `message:delivered`. Upon focusing the chat window, `/api/chat/read` marks messages as `read` and clears unread counters.

### 2. Single-Session Conversation Rule
Clients are restricted to **one active conversation session** per business pairing:
- Calling `/api/chat/initiate` retrieves the existing session and updates the workspace/service topic without creating redundant duplicate rows.
- If a prior session was terminated (`status = 'ended'`), the client UI presents a reopen confirmation modal before reactivating the channel.

### 3. 48-Hour Media Lifecycle (Auto-Purge)
- Attachments (images and PDFs) are assigned `expires_at = uploaded_at + 48 hours`.
- A scheduled background routine sweeps `expires_at <= NOW()`, deletes binary assets from storage, and sets `is_expired = true`.
- Expired attachments render a graceful expiration notice in the UI.

---

## 📁 Repository Structure

```
OpenPurpl/
├── backend/               # Independent NestJS 11 Core Backend & Realtime Gateway (Port 3001)
│   ├── src/
│   │   ├── modules/       # Auth, Conversations, Messages, Presence, Attachments, Notifications
│   │   ├── gateways/      # Socket.IO Realtime Gateway with Room Authorization
│   │   ├── infrastructure/# PostgreSQL (Drizzle ORM), Redis 7+ Adapter, Storage Service
│   │   └── common/        # Guards (Firebase Auth, WS Auth), Interceptors, Exception Filters
│   ├── test/              # Automated Unit, Integration & Reconnect Recovery Tests
│   └── Dockerfile
│
├── frontend/              # Next.js 16 (Turbopack) / React 19 Frontend & BFF Gateway (Port 3000)
│   ├── src/
│   │   ├── app/           # App Router UI views & BFF Route Handlers (/api/chat/*)
│   │   ├── components/    # ChatConversation, DirectMessagesList, Attachment previews, Modals
│   │   ├── features/chat/ # TanStack Query v5 Hooks & Realtime Socket synchronization
│   │   ├── stores/        # Zustand v5 UI & Media State Store (Zero duplicated server state)
│   │   └── lib/           # Socket.IO client manager, BFF proxy, encryption helpers
│   ├── public/            # Static assets & Service Worker for notifications
│   └── Dockerfile
│
├── packages/
│   └── contracts/         # Shared TypeScript DTOs, Event Contracts & Domain Models
│
├── docker-compose.yml     # Multi-container stack (Postgres 16, Redis 7, Backend, Frontend)
├── pnpm-workspace.yaml    # Workspace definition (backend, frontend, packages/contracts)
├── .env.example           # Complete environment variable reference
├── ORQLAND_Complete_Software_Documentation.pdf # Complete system architecture documentation
└── ORQLAND_Database_Design.pdf                 # Complete database design & DDL queries
```

---

## ⚙️ Configuration Reference (`.env`)

```env
# --- Ports & Environment ---
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://chat.orqland.com
NEST_API_URL=http://backend:3001/api/v1
NEXT_PUBLIC_SOCKET_URL=https://chat.orqland.com

# --- Relational Database: PostgreSQL 16 ---
DATABASE_URL=postgres://orqland_user:SecretSecurePass123@postgres-host:5432/orqland_prod
POSTGRES_DB=orqland_prod
POSTGRES_USER=orqland_user
POSTGRES_PASSWORD=SecretSecurePass123

# --- Distributed Cache & PubSub: Redis 7 ---
REDIS_URL=redis://:RedisSecurePass@redis-host:6379/0

# --- Object Storage (AWS S3 / Cloudflare R2 / GCS) ---
STORAGE_BUCKET=orqland-chat-attachments-prod
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
STORAGE_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# --- Firebase Admin Service Account (JWT Verification) ---
FIREBASE_PROJECT_ID=openpurpl-f8dd3
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@openpurpl-f8dd3.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# --- Client-Side Firebase Public Credentials ---
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyA_ExamplePublicWebKey
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=openpurpl-f8dd3.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=openpurpl-f8dd3
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=openpurpl-f8dd3.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1029384756
NEXT_PUBLIC_FIREBASE_APP_ID=1:1029384756:web:abcdef123456

# --- Business Account Identification ---
BUSINESS_EMAIL=mailtosidharth.me@gmail.com
```

---

## 📡 REST & BFF API Directory

| Method | Endpoint | Auth | Purpose |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/chat/list?email=:email` | Bearer Token | Fetches all active dialogues sorted by `lastMessageTimestamp`. |
| `POST` | `/api/chat/initiate` | Bearer Token | Creates or resumes a unique conversation pair. |
| `POST` | `/api/chat/send` | Bearer Token | Sends message with optional attachments (up to 50MB payload). |
| `POST` | `/api/chat/read` | Bearer Token | Resets conversation unread counters and flags messages `read`. |
| `POST` | `/api/chat/reopen` | Bearer Token | Reactivates a closed (`ended`) conversation session. |
| `POST` | `/api/chat/end` | Bearer Token | Gracefully concludes a conversation session. |
| `POST` | `/api/chat/edit-message` | Sender (&le; 15 min) | Updates content of a sent message within the grace period. |
| `POST` | `/api/chat/delete-message` | Sender (&le; 15 min) | Soft-deletes a message for the user or everyone. |
| `GET` | `/api/health` | Public | Returns server health, CPU load, memory usage, and uptime. |

---

## 🚀 Quick Start & Operations

### Prerequisites
- Node.js 20+ LTS
- `pnpm` 12+ (`npm install -g pnpm`)
- PostgreSQL 16 & Redis 7 (or run in resilient in-memory development fallback)

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Run In Development Mode
```bash
# Starts both frontend (port 3000) and backend (port 3001) concurrently
pnpm dev

# Or run services individually:
pnpm dev:backend   # NestJS on http://localhost:3001
pnpm dev:frontend  # Next.js on http://localhost:3000
```

### 3. Database Migration & Seeding
```bash
pnpm db:generate   # Generate Drizzle migrations
pnpm db:migrate    # Apply migrations to PostgreSQL
pnpm db:seed       # Seed default user and conversation data
```

### 4. Automated Testing
```bash
pnpm test          # Runs 18 unit & integration test suites
```

### 5. Production Build & Execution
```bash
# Build all workspaces
pnpm build

# Start services in production
pnpm --filter @orqland/api start:prod   # NestJS backend
pnpm --filter @orqland/web start        # Next.js frontend
```

### 6. Multi-Container Docker Deployment
```bash
docker compose up --build
```
- Web Application: `http://localhost:3000`
- REST / Socket API: `http://localhost:3001`
- PostgreSQL 16: `localhost:5432`
- Redis 7: `localhost:6379`
