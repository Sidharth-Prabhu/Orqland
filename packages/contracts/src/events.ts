import { ChatMessage } from './models';

/**
 * Socket.IO Realtime Event Contract (Specification Section 6.3)
 */
export const CHAT_EVENTS = {
  // Client -> Server
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  MESSAGE_SEND: 'message:send',
  MESSAGE_READ: 'message:read',
  MESSAGE_EDIT: 'message:edit',
  MESSAGE_DELETE: 'message:delete',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',

  // Server -> Sender / Room / Users
  MESSAGE_ACK: 'message:ack',
  MESSAGE_NEW: 'message:new',
  MESSAGE_EDITED: 'message:edited',
  MESSAGE_DELETED: 'message:deleted',
  MESSAGE_READ_UPDATE: 'message:read:update',
  TYPING_UPDATE: 'typing:update',
  PRESENCE_UPDATE: 'presence:update',
  CONVERSATION_UPDATED: 'conversation:updated',
  ERROR: 'chat:error',
} as const;

export type ChatEventType = (typeof CHAT_EVENTS)[keyof typeof CHAT_EVENTS];

// Client -> Server Payloads
export interface JoinConversationPayload {
  conversationId: string;
}

export interface LeaveConversationPayload {
  conversationId: string;
}

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  idempotencyKey: string;
  attachmentIds?: string[];
  attachments?: Array<{
    id?: string;
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

export interface MarkReadPayload {
  conversationId: string;
  lastReadMessageId?: string;
}

export interface TypingPayload {
  conversationId: string;
}

export interface EditMessagePayload {
  conversationId: string;
  messageId: string;
  content: string;
}

export interface DeleteMessagePayload {
  conversationId: string;
  messageId: string;
}

export interface MessageEditedPayload {
  conversationId: string;
  messageId: string;
  content: string;
  isEdited: boolean;
  editedAt: number;
}

export interface MessageDeletedPayload {
  conversationId: string;
  messageId: string;
  deletedForEveryone: boolean;
  deletedAt: number;
}

export interface ConversationUpdatedPayload {
  conversationId: string;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageTimestamp?: number;
  status?: 'active' | 'ended';
  unreadByClient?: number;
  unreadByWorkspace?: number;
  endedBy?: string;
}

// Server -> Client Payloads
export interface MessageAckPayload {
  success: boolean;
  idempotencyKey: string;
  messageId?: string;
  conversationId: string;
  timestamp: number;
  error?: string;
  errorCode?: string;
}

export interface MessageNewPayload {
  conversationId: string;
  message: ChatMessage;
}

export interface MessageReadUpdatePayload {
  conversationId: string;
  userId: string;
  userEmail: string;
  lastReadMessageId?: string;
  unreadCount: number;
  timestamp: number;
}

export interface TypingUpdatePayload {
  conversationId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export interface PresenceUpdatePayload {
  userId: string;
  userEmail: string;
  isOnline: boolean;
  lastSeenAt: number;
}
