import { DatabaseService } from '../../infrastructure/database/database.service';
import { InternalUser } from '../auth/auth.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatMessage, SendMessageDto, EditMessageDto, DeleteMessageDto, PaginatedMessagesResponseDto } from "@orqland/contracts";
export declare class MessagesService {
    private readonly dbService;
    private readonly conversationsService;
    private readonly logger;
    private inMemoryMessages;
    private idempotencyCache;
    constructor(dbService: DatabaseService, conversationsService: ConversationsService);
    private seedDevMessages;
    private checkDlp;
    getMessages(conversationId: string, user: InternalUser, limit?: number, beforeTimestamp?: number): Promise<PaginatedMessagesResponseDto>;
    sendMessage(user: InternalUser, dto: SendMessageDto): Promise<ChatMessage>;
    editMessage(user: InternalUser, dto: EditMessageDto): Promise<ChatMessage>;
    deleteMessage(user: InternalUser, dto: DeleteMessageDto): Promise<ChatMessage>;
}
