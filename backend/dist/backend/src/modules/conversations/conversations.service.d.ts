import { DatabaseService } from '../../infrastructure/database/database.service';
import { InternalUser, AuthService } from '../auth/auth.service';
import { PresenceService } from '../presence/presence.service';
import { Conversation, InitiateConversationDto, ReopenConversationDto } from "@orqland/contracts";
export declare class ConversationsService {
    private readonly dbService;
    private readonly authService;
    private readonly presenceService;
    private readonly logger;
    private inMemoryConversations;
    constructor(dbService: DatabaseService, authService: AuthService, presenceService: PresenceService);
    private seedDevConversations;
    listUserConversations(user: InternalUser): Promise<Conversation[]>;
    getConversation(conversationId: string, user: InternalUser): Promise<Conversation>;
    initiateConversation(clientUser: InternalUser, dto: InitiateConversationDto): Promise<Conversation>;
    endConversation(conversationId: string, user: InternalUser): Promise<Conversation>;
    reopenConversation(conversationId: string, user: InternalUser, dto: ReopenConversationDto): Promise<Conversation>;
    deleteChatView(conversationId: string, user: InternalUser): Promise<Conversation>;
    markAsRead(conversationId: string, user: InternalUser): Promise<void>;
}
