"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHAT_EVENTS = void 0;
/**
 * Socket.IO Realtime Event Contract (Specification Section 6.3)
 */
exports.CHAT_EVENTS = {
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
};
//# sourceMappingURL=events.js.map