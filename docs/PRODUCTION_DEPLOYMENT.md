# Production Deployment & High-Availability Architecture Guide
**Application**: Orqland Direct Communication & Booking Platform

---

## 1. High-Availability & Load Balancing Architecture

```
                                      [ Internet ]
                                           │
                                    (Cloudflare CDN)
                           • DDoS Protection & WAF Rules
                           • Edge SSL/TLS Termination
                           • HTTP/3 & Gzip/Brotli Compression
                                           │
                                           ▼
                     [ Application Load Balancer / Nginx ]
             • Layer 7 Load Balancing (Round Robin / Least Connections)
             • SSL Offloading & Strict Security Headers
             • Health Check Routing (`/api/health`)
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     │                                           │
                     ▼                                           ▼
          [ App Node 1 (Docker) ]                     [ App Node 2 (Docker) ]
          Next.js Server Process                      Next.js Server Process
          • Node Clustering / PM2                     • Node Clustering / PM2
          • Server-Side Rendering                     • Server-Side Rendering
                     │                                           │
                     └─────────────────────┬─────────────────────┘
                                           │
                                           ▼
                            [ Shared State & Services ]
                                           │
                     ┌─────────────────────┼─────────────────────┐
                     │                     │                     │
                     ▼                     ▼                     ▼
          [ PostgreSQL Primary ]      [ Redis Cluster ]    [ Cloud Object Store ]
          • User accounts             • Cross-node pub/sub • High-volume media
          • Conversations & msgs      • Distributed locks  • S3 / Cloud Storage
          • Read replicas for scale   • Fast cache layer   • Auto-expiring links
```

---

## 2. Nginx Production Reverse Proxy & Load Balancer

Create `/etc/nginx/conf.d/orqland.conf`:

```nginx
upstream orqland_backend {
    least_conn; # Route incoming request to node with least active connections
    server 127.0.0.1:3000 max_fails=3 fail_timeout=10s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=10s;
    keepalive 64;
}

# Rate limit zone: 100 requests per second per IP
limit_req_zone $binary_remote_addr zone=api_limit:20m rate=100r/s;
limit_conn_zone $binary_remote_addr zone=addr_conn:10m;

server {
    listen 80;
    server_name chat.orqland.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name chat.orqland.com;

    # SSL hardening
    ssl_certificate /etc/letsencrypt/live/chat.orqland.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/chat.orqland.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:20m;
    ssl_session_timeout 1d;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Client upload limits (Images & PDFs)
    client_max_body_size 25M;
    client_body_buffer_size 128k;

    # Static assets caching
    location /_next/static/ {
        proxy_pass http://orqland_backend;
        proxy_cache_valid 200 365d;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        expires 365d;
        access_log off;
    }

    # API endpoints with rate limiting & health checks
    location /api/ {
        limit_req zone=api_limit burst=50 nodelay;
        limit_conn addr_conn 30;

        proxy_pass http://orqland_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Frontend web application
    location / {
        proxy_pass http://orqland_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 3. Docker Multi-Stage Production Container

A lightweight, optimized container setup for horizontal autoscaling (`Dockerfile`):

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/src/data ./src/data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "run", "start"]
```

---

## 4. Docker Compose Orchestration with Redis & Postgres

`docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app-1:
    build: .
    restart: always
    environment:
      - PORT=3000
      - NODE_ENV=production
      - DATABASE_URL=postgres://orqland_user:secret@postgres:5432/orqland_db
      - REDIS_URL=redis://redis:6379
    expose:
      - "3000"
    depends_on:
      - postgres
      - redis

  app-2:
    build: .
    restart: always
    environment:
      - PORT=3000
      - NODE_ENV=production
      - DATABASE_URL=postgres://orqland_user:secret@postgres:5432/orqland_db
      - REDIS_URL=redis://redis:6379
    expose:
      - "3000"
    depends_on:
      - postgres
      - redis

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - app-1
      - app-2

  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: orqland_db
      POSTGRES_USER: orqland_user
      POSTGRES_PASSWORD: secret_production_password
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./src/types/schema.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "127.0.0.1:5432:5432"

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --appendonly yes --requirepass redis_production_password
    volumes:
      - redisdata:/data
    ports:
      - "127.0.0.1:6379:6379"

volumes:
  pgdata:
  redisdata:
```
