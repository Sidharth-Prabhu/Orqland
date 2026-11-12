export * from './schema/host-refs.schema';
export * from './schema/chat.schema';

// Backward compatibility re-exports & aliases
import { orqUsers, orqspaces } from './schema/host-refs.schema';
import {
  chatConversations,
  chatMessages,
  chatMessageAttachments,
  chatMessageReceipts,
  chatPushTokens,
} from './schema/chat.schema';

export const users = orqUsers;
export const conversations = chatConversations;
export const messages = chatMessages;
export const messageAttachments = chatMessageAttachments;
export const messageReceipts = chatMessageReceipts;
export const userPushTokens = chatPushTokens;
