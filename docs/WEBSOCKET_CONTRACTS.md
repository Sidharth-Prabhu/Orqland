# ORQLAND Chat System - WebSocket Realtime Protocol Specification

## 1. Connection & Handshake

- **Endpoint**: `ws://<host>:<port>/` (Default: `ws://localhost:3001/`)
- **Transport**: `websocket`, falling back to `polling`
- **Handshake Authentication**:
  ```json
  {
    "auth": {
      "token": "<Firebase_ID_Token>"
    }
  }
  ```
- **Connection Lifecycle**:
  - The server verifies the Firebase ID token and resolves the user UUID.
  - Sockets automatically join the user's private channel: `user:<user_id>`.
  - Redis presence heartbeat is registered.

---

## 2. Event Types & Contracts (`CHAT_EVENTS`)

### Client -> Server Events

#### `conversation:join`
Join a conversation room. Server verifies participant membership before granting room entry.
```typescript
interface JoinConversationPayload {
  conversationId: string;
}
```

#### `conversation:leave`
Leave a conversation room.
```typescript
interface LeaveConversationPayload {
  conversationId: string;
}
```

#### `message:send`
Send a new message with idempotency key and optional attachments.
```typescript
interface SendMessagePayload {
  conversationId: string;
  content: string;
  idempotencyKey: string;
  attachmentIds?: string[];
  attachments?: Array<{
    type: 'image' | 'pdf' | 'location';
    name: string;
    url: string;
    thumbnailUrl?: string;
    size?: number;
    mimeType?: string;
    locationData?: {
      latitude: number;
      longitude: number;
      label?: string;
      mapUrl: string;
    };
  }>;
}
```

#### `message:read`
Acknowledge messages read by the client.
```typescript
interface MarkReadPayload {
  conversationId: string;
  lastReadMessageId?: string;
}
```

#### `typing:start` & `typing:stop`
Transmit typing status indicators.
```typescript
interface TypingPayload {
  conversationId: string;
}
```

---

### Server -> Client Broadcast Events

#### `message:ack`
Direct acknowledgement sent back to the message author.
```typescript
interface MessageAckPayload {
  success: boolean;
  idempotencyKey: string;
  messageId?: string;
  conversationId: string;
  timestamp: number;
  error?: string;
  errorCode?: string;
}
```

#### `message:new`
Broadcast to all room members when a message is committed.
```typescript
interface MessageNewPayload {
  conversationId: string;
  message: ChatMessage;
}
```

#### `message:edited`
Broadcast to room when a message has been edited.
```typescript
interface MessageEditedPayload {
  conversationId: string;
  messageId: string;
  content: string;
  isEdited: boolean;
  editedAt: number;
}
```

#### `message:deleted`
Broadcast to room when a message has been deleted for everyone.
```typescript
interface MessageDeletedPayload {
  conversationId: string;
  messageId: string;
  deletedForEveryone: boolean;
  deletedAt: number;
}
```

#### `message:read:update`
Broadcast to room when messages are read by a recipient.
```typescript
interface MessageReadUpdatePayload {
  conversationId: string;
  userId: string;
  userEmail?: string;
  lastReadMessageId?: string;
  unreadCount?: number;
  timestamp: number;
}
```

#### `typing:update`
Broadcast to other room members when a participant types.
```typescript
interface TypingUpdatePayload {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}
```

#### `presence:update`
Broadcast globally or to contacts when a user changes online state.
```typescript
interface PresenceUpdatePayload {
  userId: string;
  userEmail: string;
  isOnline: boolean;
  lastSeenAt?: number;
  timestamp: number;
}
```
