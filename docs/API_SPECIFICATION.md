# ORQLAND Chat System - REST API Specification

## Base URL
- Internal Core API: `http://localhost:3001/api/v1`
- Frontend BFF Gateway: `http://localhost:3000/api/chat`

All requests require Bearer token authentication:
```
Authorization: Bearer <Firebase_ID_Token>
```

---

## 1. Conversations API

### `GET /conversations`
Retrieve all active conversations for the authenticated user.
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "c0000000-0000-0000-0000-000000000001",
        "clientId": "u0000000-0000-0000-0000-000000000002",
        "clientEmail": "ycssidharth@gmail.com",
        "clientName": "Sidharth Prabhu",
        "businessId": "a0000000-0000-0000-0000-000000000001",
        "businessEmail": "mailtosidharth.me@gmail.com",
        "status": "active",
        "lastMessage": "Project discussion",
        "unreadCount": 0
      }
    ]
  }
  ```

### `POST /conversations`
Initiate a conversation with a business.
- **Body**:
  ```json
  {
    "businessEmail": "mailtosidharth.me@gmail.com",
    "businessName": "Sidharth Prabhu's Workspace",
    "initialMessage": "Hello, I would like to consult."
  }
  ```

### `POST /conversations/:id/end`
End an active conversation session.
- **Response `200 OK`**: Updated conversation object with `status: "ended"`.

### `POST /conversations/:id/reopen`
Reopen an ended conversation session.
- **Body**: `{ "workspaceName": "Project Consultation" }`

### `POST /conversations/:id/read`
Mark conversation messages as read.
- **Response `200 OK`**: `{ "success": true }`

### `DELETE /conversations/:id`
Clear conversation history view on caller's side.
- **Response `200 OK`**: Updated conversation object with caller's `deletedAt` set.

---

## 2. Messages API

### `GET /messages`
Retrieve paginated messages for a conversation.
- **Query Parameters**:
  - `conversationId` (string, required)
  - `limit` (integer, default: 50)
  - `beforeTimestamp` (integer, optional)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "messages": [
      {
        "id": "m0000000-0000-0000-0000-000000000001",
        "conversationId": "c0000000-0000-0000-0000-000000000001",
        "senderId": "u0000000-0000-0000-0000-000000000002",
        "content": "Hello team",
        "timestamp": "02:45 PM",
        "status": "delivered",
        "isEdited": false,
        "deletedForEveryone": false
      }
    ],
    "hasMore": false,
    "nextCursor": null
  }
  ```

### `POST /messages`
Send a new message with idempotency key.
- **Body**:
  ```json
  {
    "conversationId": "c0000000-0000-0000-0000-000000000001",
    "content": "Hello!",
    "idempotencyKey": "uuid-v4-key",
    "attachments": []
  }
  ```

### `PATCH /messages/:id`
Edit a message (allowed within 10 minutes of creation).
- **Body**:
  ```json
  {
    "conversationId": "c0000000-0000-0000-0000-000000000001",
    "content": "Updated message text"
  }
  ```

### `DELETE /messages/:id`
Delete a message for everyone (allowed within 15 minutes of creation).
- **Body**:
  ```json
  {
    "conversationId": "c0000000-0000-0000-0000-000000000001"
  }
  ```

---

## 3. Attachments & Storage API

### `POST /attachments/upload-url`
Request pre-signed upload URL for object storage (media will be automatically purged after 48 hours).
- **Body**:
  ```json
  {
    "conversationId": "c0000000-0000-0000-0000-000000000001",
    "fileName": "photo.jpg",
    "mimeType": "image/jpeg",
    "size": 1048576
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "uploadUrl": "https://storage.orqland.com/upload?...",
      "downloadUrl": "https://storage.orqland.com/download?...",
      "objectKey": "chat-media/...",
      "expiresInSeconds": 900,
      "attachmentId": "uuid-v4-att"
    }
  }
  ```

---

## 4. Error Codes (`ChatErrorCode`)

| Error Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid Firebase ID token |
| `FORBIDDEN` | 403 | User is not a participant in the conversation |
| `CONVERSATION_ENDED` | 403 | Session has ended; messages cannot be sent until reopened |
| `MESSAGE_EDIT_EXPIRED` | 400 | Edit window of 10 minutes has expired |
| `MESSAGE_DELETE_EXPIRED` | 400 | Delete window of 15 minutes has expired |
| `SENSITIVE_CONTENT_BLOCKED` | 400 | DLP detected credit card or SSN pattern |
| `RATE_LIMIT_EXCEEDED` | 429 | Sliding window rate limit exceeded |
