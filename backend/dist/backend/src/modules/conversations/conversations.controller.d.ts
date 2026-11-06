import { ConversationsService } from './conversations.service';
import { InternalUser } from '../auth/auth.service';
import { InitiateConversationDto, ReopenConversationDto } from "@orqland/contracts";
export declare class ConversationsController {
    private readonly conversationsService;
    constructor(conversationsService: ConversationsService);
    listConversations(user: InternalUser): Promise<{
        success: boolean;
        data: import("@orqland/contracts").Conversation[];
    }>;
    initiateConversation(user: InternalUser, dto: InitiateConversationDto): Promise<{
        success: boolean;
        data: import("@orqland/contracts").Conversation;
    }>;
    getConversation(id: string, user: InternalUser): Promise<{
        success: boolean;
        data: import("@orqland/contracts").Conversation;
    }>;
    endConversation(id: string, user: InternalUser): Promise<{
        success: boolean;
        data: import("@orqland/contracts").Conversation;
    }>;
    reopenConversation(id: string, user: InternalUser, dto: ReopenConversationDto): Promise<{
        success: boolean;
        data: import("@orqland/contracts").Conversation;
    }>;
    markAsRead(id: string, user: InternalUser): Promise<{
        success: boolean;
    }>;
    deleteChatView(id: string, user: InternalUser): Promise<{
        success: boolean;
        data: import("@orqland/contracts").Conversation;
    }>;
}
