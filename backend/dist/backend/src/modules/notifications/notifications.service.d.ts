export declare class NotificationsService {
    private readonly logger;
    sendPushNotification(params: {
        recipientToken?: string;
        senderName: string;
        conversationId: string;
        hasAttachment?: boolean;
    }): Promise<void>;
}
