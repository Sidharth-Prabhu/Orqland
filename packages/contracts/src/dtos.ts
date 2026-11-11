import { AttachmentType, Conversation, ChatMessage } from './models';

export interface InitiateConversationDto {
  businessEmail: string;
  businessName: string;
  businessAvatar?: string;
  workspaceName?: string;
  initialMessage?: string;
}

export interface SendMessageDto {
  conversationId: string;
  content: string;
  idempotencyKey?: string;
  attachmentIds?: string[];
  attachment?: {
    id?: string;
    type: AttachmentType;
    name: string;
    url: string;
    objectKey?: string;
    thumbnailUrl?: string;
    size?: number;
    mimeType?: string;
    locationData?: {
      latitude: number;
      longitude: number;
      label?: string;
      mapUrl: string;
    };
  };
  attachments?: Array<{
    id?: string;
    type: AttachmentType;
    name: string;
    url: string;
    objectKey?: string;
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

export interface EditMessageDto {
  conversationId: string;
  messageId: string;
  content: string;
}

export interface DeleteMessageDto {
  conversationId: string;
  messageId: string;
}

export interface EndConversationDto {
  conversationId: string;
}

export interface ReopenConversationDto {
  conversationId: string;
  workspaceName?: string;
}

export interface DeleteConversationDto {
  conversationId: string;
}

export interface SyncUserProfileDto {
  email: string;
  name?: string | null;
  avatar?: string | null;
}

export interface RequestUploadUrlDto {
  conversationId: string;
  fileName: string;
  mimeType: string;
  size: number;
}

export interface UploadUrlResponseDto {
  uploadUrl: string;
  downloadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
  attachmentId: string;
}

export interface PaginatedMessagesQueryDto {
  conversationId: string;
  cursor?: string; // messageId cursor for pagination
  limit?: number; // default 50
  direction?: 'before' | 'after';
}

export interface PaginatedMessagesResponseDto {
  messages: ChatMessage[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ConversationsListResponseDto {
  conversations: Conversation[];
}
