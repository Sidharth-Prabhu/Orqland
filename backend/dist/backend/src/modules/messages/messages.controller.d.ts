import { MessagesService } from './messages.service';
import { InternalUser } from '../auth/auth.service';
import { SendMessageDto } from "@orqland/contracts";
export declare class MessagesController {
    private readonly messagesService;
    constructor(messagesService: MessagesService);
    getMessages(user: InternalUser, conversationId: string, limit?: string, beforeTimestamp?: string): Promise<{
        messages: import("@orqland/contracts").ChatMessage[];
        nextCursor?: string;
        hasMore: boolean;
        success: boolean;
    }>;
    sendMessage(user: InternalUser, dto: SendMessageDto): Promise<{
        success: boolean;
        data: import("@orqland/contracts").ChatMessage;
    }>;
    editMessage(id: string, user: InternalUser, body: {
        conversationId: string;
        content: string;
    }): Promise<{
        success: boolean;
        data: import("@orqland/contracts").ChatMessage;
    }>;
    deleteMessage(id: string, user: InternalUser, body: {
        conversationId: string;
    }): Promise<{
        success: boolean;
        data: import("@orqland/contracts").ChatMessage;
    }>;
}
