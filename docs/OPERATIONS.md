# ORQLAND Chat System - Operational & Maintenance Guide

## 1. Structured Logging & Privacy
The backend employs NestJS logger and `LoggingInterceptor` to record HTTP requests, execution latencies, and WebSocket events.
- **Privacy Policy**: Message contents, passwords, Firebase tokens, encryption keys, and sensitive attachment binary data are never written to logs.
- **Log Levels**:
  - `LOG`: Normal operational flow (socket connection, room join, route completion).
  - `WARN`: Ephemeral service fallback (Redis/Postgres running in resilient development memory mode).
  - `ERROR`: Unhandled exceptions, failed token authentications, database constraint violations.

---

## 2. Health Checks & Metrics
- **NestJS Core Backend**: `GET http://localhost:3001/api/v1/health`
- **Next.js BFF**: `GET http://localhost:3000/api/health`

### Health Check Response Format
```json
{
  "status": "healthy",
  "service": "orqland-chat-backend",
  "timestamp": "2026-11-06T13:15:00.000Z",
  "uptimeSeconds": 86400,
  "system": {
    "platform": "linux",
    "nodeVersion": "v20.18.0",
    "cpuCount": 8,
    "loadAverage": [0.42, 0.35, 0.28],
    "freeMemoryMB": 4096,
    "totalMemoryMB": 8192
  },
  "database": {
    "status": "connected",
    "poolSize": 20
  },
  "redis": {
    "status": "connected"
  }
}
```

---

## 3. Database Backup & Restore (PostgreSQL)

### Daily Automated Backup
```bash
# Dump compressed PostgreSQL database with custom format
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -Fc -d orqland_db > /backups/orqland_db_$(date +%Y%m%d_%H%M%S).dump

# Verify backup integrity
pg_restore -l /backups/orqland_db_*.dump > /dev/null
```

### Point-in-Time Restore
```bash
# Restore clean dump to target database
pg_restore -h $DB_HOST -p $DB_PORT -U $DB_USER -d orqland_db --clean --if-exists /backups/orqland_db_20261106_120000.dump
```

---

## 4. Horizontal Scaling with Redis

When deploying multiple NestJS API instances behind a load balancer (AWS ALB, NGINX, Cloudflare):
1. **Socket.IO Redis Adapter**: All instances connect to the shared Redis cluster (`REDIS_URL`). When a message is sent to room `conversation:<id>`, the Redis adapter broadcasts the event across all instances so clients connected to any node receive the update immediately.
2. **Session Affinity (Sticky Sessions)**: Enable cookie-based sticky sessions on the load balancer if HTTP long-polling fallback is enabled. For pure WebSocket transport (`transports: ['websocket']`), sticky sessions are not required.
3. **Presence & Rate Limiting**: Presence heartbeats (45s TTL) and sliding-window rate limit counters are shared in Redis, preventing circumvention through round-robin requests.

---

## 5. Troubleshooting & FAQ

### Issue: Client WebSocket Disconnects Unexpectedly
- **Cause**: Firebase ID token expired (valid for 1 hour).
- **Resolution**: The client-side Firebase SDK automatically refreshes ID tokens. The Socket.IO manager reconnects with the fresh token and automatically recovers missed messages via cursor pagination:
  ```typescript
  messagesService.getMessages(conversationId, user, limit, lastKnownTimestamp);
  ```

### Issue: Duplicate Messages on Unstable Connections
- **Resolution**: Every message submitted by a client includes an `idempotencyKey`. If a network retry re-submits the same key, the backend returns the already-committed message without inserting a duplicate or re-triggering broadcasts.

### Issue: "Conversation session has ended"
- **Resolution**: A participant clicked "End Chat". No new messages can be added to the thread until a client or business triggers `/api/chat/conversations/:id/reopen`.
