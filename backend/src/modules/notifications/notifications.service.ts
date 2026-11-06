import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async sendPushNotification(params: {
    recipientToken?: string;
    senderName: string;
    conversationId: string;
    hasAttachment?: boolean;
  }) {
    if (!params.recipientToken) return;

    try {
      // Do not expose sensitive chat content in push notification payload
      await admin.messaging().send({
        token: params.recipientToken,
        notification: {
          title: `New message from ${params.senderName}`,
          body: params.hasAttachment ? 'Sent an attachment' : 'Sent you a new message',
        },
        data: {
          conversationId: params.conversationId,
          type: 'chat_message',
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`FCM push notification skipped/failed: ${msg}`);
    }
  }
}
