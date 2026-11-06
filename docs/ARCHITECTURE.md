# ORQLAND Chat System - Production Architecture

## 1. System Topology Overview

The ORQLAND Chat System is structured as a high-throughput, horizontally scalable, multi-tier platform built with a modern monorepo layout using `pnpm` workspaces:

```
OpenPurpl/
├── apps/
│   ├── api/           # NestJS 11 Core Backend Domain & Gateway (Port 3001)
│   └── web/           # Next.js 16 / React 19 Frontend & BFF (Port 3000)
├── packages/
│   └── contracts/     # Strict Shared TypeScript DTOs, Events & Enums
├── docs/              # Architectural, WebSocket, and REST API documentation
└── docker-compose.yml # Containerized PostgreSQL 16, Redis 7, NestJS API, Next.js Web
```

### Core Responsibilities by Tier

1. **`apps/api` (NestJS 11 Core Backend)**:
   - Sole authority for chat business logic, permissions, session lifecycles, and data integrity.
   - Enforces idempotent message processing via client-generated keys.
   - Validates Firebase ID tokens server-side with Firebase Admin SDK and maps Firebase UIDs to internal ORQLAND UUIDs.
   - Direct PostgreSQL 16 persistence via Drizzle ORM (with in-memory dev resiliency).
   - Redis 7+ integration for distributed Socket.IO room broadcast scaling (`@socket.io/redis-adapter`), ephemeral presence tracking (45s TTL), and distributed sliding-window rate limiting.
   - Signed pre-signed URL generation for S3/GCS/R2 object storage with 48-hour retention enforcement.
   - Data Loss Prevention (DLP) filtering for sensitive data (SSN, credit card patterns).

2. **`apps/web` (Next.js 16 / React 19 Client & BFF Gateway)**:
   - Server state management via TanStack Query v5 (`@tanstack/react-query`): queries, mutations, cache invalidation, pagination, and optimistic updates.
   - Client / UI state management via Zustand v5 (`zustand`): active conversation ID, WhatsApp-style media viewer index/modals, drafts, search query, sidebar panel widths. Zero server data is duplicated in Zustand.
   - Realtime Socket.IO client (`socket.io-client`) establishing an authenticated WebSocket connection directly to the NestJS Gateway (`ws://localhost:3001`).
   - BFF API Gateway routes in `apps/web/src/app/api/chat/*` proxying client REST requests to the NestJS backend with bearer token propagation.

3. **`packages/contracts` (Shared Contract Layer)**:
   - Single source of truth for all data transfer objects (DTOs), WebSocket event signatures (`CHAT_EVENTS`), error codes (`ChatErrorCode`), and domain models (`ChatMessage`, `Conversation`, `UserProfile`).

---

## 2. State Management Bifurcation

| Layer | Technology | Managed State | Cache & Invalidation Strategy |
|---|---|---|---|
| **Server State** | TanStack Query v5 | Conversations list, paginated message threads, participant profiles, read receipts | `staleTime: 30s`. Realtime WebSocket events directly update Query cache via `queryClient.setQueryData`. |
| **Client / UI State** | Zustand v5 (`useChatUiStore`) | `activeConversationId`, `mediaViewerItems`, `mediaViewerIndex`, `isMediaViewerOpen`, `drafts`, `searchQuery` | Purely client-side, zero server data duplication. |

---

## 3. Database Schema Design (Drizzle ORM + PostgreSQL)

- **`users`**: UUID primary key, `firebase_uid`, `email`, `name`, `role` ('client' | 'business'), `avatar_url`, `is_online`, `last_seen_at`.
- **`conversations`**: UUID primary key, `client_id`, `business_id`, `status` ('active' | 'ended'), `ended_at`, `ended_by`, `deleted_by_business_at`, `deleted_for_client_at`, `workspace_name`, `unread_by_client`, `unread_by_business`.
- **`conversation_participants`**: Many-to-many relationship tracking room membership, role, and read cursors (`last_read_message_id`, `last_read_at`).
- **`messages`**: UUID primary key, `conversation_id`, `sender_id`, `content`, `idempotency_key`, `timestamp_display`, `is_edited`, `edited_at`, `deleted_for_everyone`, `created_at`.
- **`message_attachments`**: Object key, signed download URL, mime type, size, upload status, expiration timestamp (`expires_at` = 48 hours).
- **`message_receipts`**: Tracks delivery and read timestamps per participant.
- **`outbox_events`**: Transactional outbox table for reliable post-commit event publishing.

---

## 4. Security & Compliance Boundaries

1. **Authentication**: All endpoints require a cryptographically verified Firebase ID token passed in the `Authorization: Bearer <token>` header or WebSocket handshake auth payload.
2. **Authorization**: Only participants assigned to a conversation may access message history or join Socket.IO rooms (`conversation:<id>`).
3. **Session Lifecycles**: When a conversation is `ended`, sending new messages is rejected with `CONVERSATION_ENDED` until the session is explicitly reopened.
4. **Edit & Delete Constraints**:
   - Messages are editable only within **10 minutes** of sending.
   - Messages are deletable (for everyone) only within **15 minutes** of sending.
5. **DLP Enforcement**: Regular expressions screen message bodies for credit card numbers and Social Security Numbers, immediately rejecting violations with `SENSITIVE_CONTENT_BLOCKED`.
