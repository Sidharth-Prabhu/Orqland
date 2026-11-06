import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JoinConversationPayload, LeaveConversationPayload, SendMessagePayload, MarkReadPayload, TypingPayload } from "@orqland/contracts";
import { MessagesService } from '../modules/messages/messages.service';
import { ConversationsService } from '../modules/conversations/conversations.service';
import { PresenceService } from '../modules/presence/presence.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { AuthService } from '../modules/auth/auth.service';
import { FirebaseAdminService } from '../modules/auth/firebase-admin.service';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly messagesService;
    private readonly conversationsService;
    private readonly presenceService;
    private readonly notificationsService;
    private readonly authService;
    private readonly firebaseAdmin;
    server: Server;
    private readonly logger;
    constructor(messagesService: MessagesService, conversationsService: ConversationsService, presenceService: PresenceService, notificationsService: NotificationsService, authService: AuthService, firebaseAdmin: FirebaseAdminService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    handleJoinConversation(client: Socket, payload: JoinConversationPayload): Promise<void>;
    handleLeaveConversation(client: Socket, payload: LeaveConversationPayload): Promise<void>;
    handleSendMessage(client: Socket, payload: SendMessagePayload): Promise<void>;
    handleMarkRead(client: Socket, payload: MarkReadPayload): Promise<void>;
    handleTypingStart(client: Socket, payload: TypingPayload): Promise<void>;
    handleTypingStop(client: Socket, payload: TypingPayload): Promise<void>;
}
