import { ChatMessage } from './models';
/**
 * Socket.IO Realtime Event Contract (Specification Section 6.3)
 */
export declare const CHAT_EVENTS: {
    readonly CONVERSATION_JOIN: "conversation:join";
    readonly CONVERSATION_LEAVE: "conversation:leave";
    readonly MESSAGE_SEND: "message:send";
    readonly MESSAGE_READ: "message:read";
    readonly MESSAGE_EDIT: "message:edit";
    readonly MESSAGE_DELETE: "message:delete";
    readonly TYPING_START: "typing:start";
    readonly TYPING_STOP: "typing:stop";
    readonly MESSAGE_ACK: "message:ack";
    readonly MESSAGE_NEW: "message:new";
    readonly MESSAGE_EDITED: "message:edited";
    readonly MESSAGE_DELETED: "message:deleted";
    readonly MESSAGE_READ_UPDATE: "message:read:update";
    readonly TYPING_UPDATE: "typing:update";
    readonly PRESENCE_UPDATE: "presence:update";
    readonly CONVERSATION_UPDATED: "conversation:updated";
    readonly ERROR: "chat:error";
};
export type ChatEventType = (typeof CHAT_EVENTS)[keyof typeof CHAT_EVENTS];
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
//# sourceMappingURL=events.d.ts.map