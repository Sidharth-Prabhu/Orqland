"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatErrorCode = void 0;
var ChatErrorCode;
(function (ChatErrorCode) {
    ChatErrorCode["UNAUTHORIZED"] = "UNAUTHORIZED";
    ChatErrorCode["FORBIDDEN"] = "FORBIDDEN";
    ChatErrorCode["CONVERSATION_NOT_FOUND"] = "CONVERSATION_NOT_FOUND";
    ChatErrorCode["CONVERSATION_ENDED"] = "CONVERSATION_ENDED";
    ChatErrorCode["MESSAGE_NOT_FOUND"] = "MESSAGE_NOT_FOUND";
    ChatErrorCode["MESSAGE_DELETE_EXPIRED"] = "MESSAGE_DELETE_EXPIRED";
    ChatErrorCode["MESSAGE_EDIT_EXPIRED"] = "MESSAGE_EDIT_EXPIRED";
    ChatErrorCode["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ChatErrorCode["INVALID_ATTACHMENT"] = "INVALID_ATTACHMENT";
    ChatErrorCode["SENSITIVE_CONTENT_BLOCKED"] = "SENSITIVE_CONTENT_BLOCKED";
    ChatErrorCode["DUPLICATE_IDEMPOTENCY_KEY"] = "DUPLICATE_IDEMPOTENCY_KEY";
    ChatErrorCode["ROOM_ACCESS_DENIED"] = "ROOM_ACCESS_DENIED";
    ChatErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(ChatErrorCode || (exports.ChatErrorCode = ChatErrorCode = {}));
//# sourceMappingURL=errors.js.map