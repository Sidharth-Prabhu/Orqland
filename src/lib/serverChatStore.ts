import fs from 'fs';
import path from 'path';
import { Conversation, ChatMessage, ChatAttachment } from '@/types/chat';
import { isBusinessUser, isAttachmentExpired } from './security';
import { ATTACHMENT_RETENTION_MS } from './constants';
import { encryptConversationAtRest, decryptConversationAtRest } from './encryption';

const DB_PATH = path.join(process.cwd(), 'src/data/conversations_db.json');
const USERS_PATH = path.join(process.cwd(), 'src/data/users_db.json');

export interface StoredUserProfile {
  email: string;
  name: string;
  avatar: string;
  updatedAt: number;
}

// Ensure directory and database files exist
function ensureFiles() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(USERS_PATH)) {
    fs.writeFileSync(USERS_PATH, JSON.stringify({}, null, 2), 'utf-8');
  }
}

// Users DB helpers
function readUsers(): Record<string, StoredUserProfile> {
  ensureFiles();
  try {
    const raw = fs.readFileSync(USERS_PATH, 'utf-8');
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading users_db.json:', err);
    return {};
  }
}

function writeUsers(users: Record<string, StoredUserProfile>) {
  ensureFiles();
  try {
    const tempFile = `${USERS_PATH}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), 'utf-8');
    fs.renameSync(tempFile, USERS_PATH);
  } catch (err) {
    console.error('Error writing users_db.json:', err);
  }
}

// In-memory cache to reduce disk reads
let cachedConversations: Conversation[] | null = null;

function readAll(): Conversation[] {
  ensureFiles();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    if (!data.trim()) return [];
    const parsed = JSON.parse(data);
    // Decrypt messages, attachments and sensitive data at rest
    cachedConversations = decryptConversationAtRest(parsed);
    return cachedConversations || [];
  } catch (err) {
    console.error('Error reading conversations_db.json:', err);
    return cachedConversations || [];
  }
}

function writeAll(conversations: Conversation[]) {
  ensureFiles();
  try {
    cachedConversations = conversations;
    // Encrypt messages, attachments and sensitive data at rest with AES-256-GCM
    const encryptedForDisk = encryptConversationAtRest(conversations);
    const tempFile = `${DB_PATH}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(encryptedForDisk, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_PATH);
  } catch (err) {
    console.error('Error writing conversations_db.json:', err);
  }
}

// Automatically purge attachments older than 48 hours
function purgeExpired(convs: Conversation[]): Conversation[] {
  let modified = false;

  const cleaned = convs.map((conv) => {
    let convModified = false;
    const messages = conv.messages.map((msg) => {
      if (
        msg.attachment &&
        msg.attachment.type !== 'location' &&
        !msg.attachment.isExpired &&
        isAttachmentExpired(msg.attachment.uploadedAt, msg.attachment.expiresAt)
      ) {
        convModified = true;
        modified = true;
        return {
          ...msg,
          attachment: {
            ...msg.attachment,
            isExpired: true,
            url: '', // purge the data/URL
          },
        };
      }
      return msg;
    });

    if (convModified) {
      return { ...conv, messages };
    }
    return conv;
  });

  if (modified) {
    writeAll(cleaned);
  }
  return cleaned;
}

// Clean avatar: filter out any leftover placeholder unsplash stock images
function sanitizeAvatar(avatar?: string | null): string {
  if (!avatar || typeof avatar !== 'string') return '';
  const trimmed = avatar.trim();
  if (trimmed.includes('images.unsplash.com')) return '';
  return trimmed;
}

// Helper to resolve the correct participant perspective for the viewer
export function formatConversationForViewer(conv: Conversation, viewerEmail: string): Conversation {
  const normViewer = viewerEmail.trim().toLowerCase();
  const isBusiness = isBusinessUser(normViewer);
  const users = readUsers();

  const clientUser = users[(conv.clientEmail || '').toLowerCase()];
  const businessUser = users[(conv.businessEmail || '').toLowerCase()];

  const effectiveClientAvatar =
    sanitizeAvatar(clientUser?.avatar) ||
    sanitizeAvatar(conv.clientAvatar) ||
    '';

  const effectiveClientName =
    clientUser?.name ||
    conv.clientName ||
    conv.clientEmail?.split('@')[0] ||
    'Client';

  const effectiveBusinessAvatar =
    sanitizeAvatar(businessUser?.avatar) ||
    sanitizeAvatar(conv.businessAvatar) ||
    '';

  const effectiveBusinessName =
    businessUser?.name ||
    conv.businessName ||
    'Orqland Business Workspace';

  if (isBusiness) {
    const businessDeletedAt = conv.businessDeletedAt || 0;
    const baseMessages = businessDeletedAt > 0
      ? conv.messages.filter((m) => (m.createdAt || 0) > businessDeletedAt)
      : conv.messages;
    const visibleMessages = baseMessages.filter((m) => !m.deletedByBusiness);

    const lastMsg = visibleMessages.length > 0
      ? (visibleMessages[visibleMessages.length - 1].content ||
          (visibleMessages[visibleMessages.length - 1].attachment
            ? `[${visibleMessages[visibleMessages.length - 1].attachment?.type.toUpperCase()}]`
            : ''))
      : (businessDeletedAt > 0 ? 'Conversation history cleared on your side' : conv.lastMessage);

    const lastMsgTime = visibleMessages.length > 0
      ? visibleMessages[visibleMessages.length - 1].timestamp
      : conv.lastMessageTime;

    return {
      ...conv,
      messages: visibleMessages,
      lastMessage: lastMsg,
      lastMessageTime: lastMsgTime,
      clientName: effectiveClientName,
      clientAvatar: effectiveClientAvatar,
      unreadCount: conv.unreadByBusiness || 0,
      participant: {
        id: conv.clientEmail || '',
        name: effectiveClientName,
        email: conv.clientEmail,
        handle: `@${conv.clientEmail?.split('@')[0] || 'client'}`,
        avatar: effectiveClientAvatar,
        isOnline: true,
        role: 'client',
      },
    };
  } else {
    return {
      ...conv,
      businessName: effectiveBusinessName,
      businessAvatar: effectiveBusinessAvatar,
      unreadCount: conv.unreadByClient || 0,
      participant: {
        id: conv.businessEmail || '',
        name: effectiveBusinessName,
        email: conv.businessEmail,
        handle: '@orqland',
        avatar: effectiveBusinessAvatar,
        isOnline: true,
        role: 'business',
      },
    };
  }
}

export const serverChatStore = {
  /**
   * Sync a user profile into the database and update all conversations/messages
   */
  syncUserProfile(params: {
    email: string;
    name?: string | null;
    avatar?: string | null;
  }): StoredUserProfile {
    if (!params.email) throw new Error('Email is required');
    const normEmail = params.email.trim().toLowerCase();
    const cleanAvatar = sanitizeAvatar(params.avatar);
    const cleanName = params.name?.trim() || normEmail.split('@')[0];

    const users = readUsers();
    const existing = users[normEmail];

    const updatedUser: StoredUserProfile = {
      email: normEmail,
      name: cleanName || existing?.name || normEmail.split('@')[0],
      avatar: cleanAvatar || existing?.avatar || '',
      updatedAt: Date.now(),
    };

    users[normEmail] = updatedUser;
    writeUsers(users);

    // Update all existing conversations and messages involving this user
    const all = readAll();
    let modified = false;

    for (let i = 0; i < all.length; i++) {
      const c = all[i];
      let convChanged = false;

      // If this user is the client
      if ((c.clientEmail || '').toLowerCase() === normEmail) {
        if (updatedUser.avatar && c.clientAvatar !== updatedUser.avatar) {
          c.clientAvatar = updatedUser.avatar;
          convChanged = true;
        }
        if (updatedUser.name && c.clientName !== updatedUser.name) {
          c.clientName = updatedUser.name;
          convChanged = true;
        }
      }

      // If this user is the business
      if ((c.businessEmail || '').toLowerCase() === normEmail) {
        if (updatedUser.avatar && c.businessAvatar !== updatedUser.avatar) {
          c.businessAvatar = updatedUser.avatar;
          convChanged = true;
        }
        if (updatedUser.name && c.businessName !== updatedUser.name) {
          c.businessName = updatedUser.name;
          convChanged = true;
        }
      }

      // Update sender avatar across messages
      if (updatedUser.avatar) {
        c.messages = c.messages.map((m) => {
          if ((m.senderEmail || '').toLowerCase() === normEmail && m.senderAvatar !== updatedUser.avatar) {
            convChanged = true;
            return {
              ...m,
              senderAvatar: updatedUser.avatar,
              senderName: updatedUser.name || m.senderName,
            };
          }
          return m;
        });
      }

      if (convChanged) {
        modified = true;
        all[i] = c;
      }
    }

    if (modified) {
      writeAll(all);
    }

    return updatedUser;
  },

  getConversations(viewerEmail: string): Conversation[] {
    if (!viewerEmail) return [];
    const normViewer = viewerEmail.trim().toLowerCase();
    const isBusiness = isBusinessUser(normViewer);
    const all = purgeExpired(readAll());

    if (isBusiness) {
      return all
        .filter((c) => !c.deletedByBusiness)
        .map((c) => formatConversationForViewer(c, normViewer));
    } else {
      return all
        .filter((c) => {
          const clientMatches = (c.clientEmail || '').toLowerCase() === normViewer;
          const notDeleted = !c.deletedForClient;
          return clientMatches && notDeleted;
        })
        .map((c) => formatConversationForViewer(c, normViewer));
    }
  },

  initiateChat(params: {
    clientEmail: string;
    clientName?: string;
    clientAvatar?: string;
    businessEmail: string;
    businessName?: string;
    businessAvatar?: string;
    workspaceName?: string;
    initialMessage?: string;
    viewerEmail?: string;
  }): Conversation {
    const {
      clientEmail,
      clientName,
      clientAvatar,
      businessEmail,
      businessName,
      businessAvatar,
      workspaceName = 'General Consultation',
      initialMessage,
      viewerEmail,
    } = params;

    if (!clientEmail || !clientEmail.trim() || !clientEmail.includes('@')) {
      throw new Error('A valid client email address is required.');
    }

    if (!businessEmail || !businessEmail.trim() || !businessEmail.includes('@')) {
      throw new Error('A valid business email address is required.');
    }

    const normClientEmail = clientEmail.trim().toLowerCase();
    const normBusinessEmail = businessEmail.trim().toLowerCase();

    if (normClientEmail === normBusinessEmail) {
      throw new Error('Cannot start a conversation with yourself.');
    }

    // Check registered user profile for client & business
    const users = readUsers();
    const registeredClient = users[normClientEmail];
    const registeredBusiness = users[normBusinessEmail];

    const effectiveClientAvatar =
      sanitizeAvatar(clientAvatar) ||
      sanitizeAvatar(registeredClient?.avatar) ||
      '';

    const effectiveClientName =
      clientName?.trim() ||
      registeredClient?.name ||
      normClientEmail.split('@')[0];

    const effectiveBusinessAvatar =
      sanitizeAvatar(businessAvatar) ||
      sanitizeAvatar(registeredBusiness?.avatar) ||
      '';

    const effectiveBusinessName =
      businessName?.trim() ||
      registeredBusiness?.name ||
      'Orqland Business Workspace';

    const all = readAll();

    const activeExistingIndex = all.findIndex(
      (c) =>
        (c.clientEmail || '').toLowerCase() === normClientEmail &&
        (c.businessEmail || '').toLowerCase() === normBusinessEmail &&
        c.status === 'active'
    );

    const now = Date.now();
    const timeString = new Date(now).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const activeViewerEmail = (viewerEmail || normClientEmail).toLowerCase();

    if (activeExistingIndex >= 0) {
      const existing = all[activeExistingIndex];

      // If active session exists, restore visibility for both parties and append message if present
      const updatedMessages = [...existing.messages];
      if (initialMessage && initialMessage.trim()) {
        updatedMessages.push({
          id: `msg-${now}`,
          conversationId: existing.id,
          senderId: normClientEmail,
          senderEmail: normClientEmail,
          senderName: effectiveClientName,
          senderAvatar: effectiveClientAvatar,
          content: initialMessage.trim(),
          timestamp: timeString,
          date: 'Today',
          createdAt: now,
          status: 'delivered',
        });
      }

      const updated: Conversation = {
        ...existing,
        clientName: effectiveClientName || existing.clientName,
        clientAvatar: effectiveClientAvatar || existing.clientAvatar,
        businessName: effectiveBusinessName || existing.businessName,
        businessAvatar: effectiveBusinessAvatar || existing.businessAvatar,
        deletedByBusiness: false,
        deletedForClient: false,
        unreadByBusiness: initialMessage?.trim()
          ? (existing.unreadByBusiness || 0) + 1
          : existing.unreadByBusiness || 0,
        lastMessage: initialMessage?.trim() || existing.lastMessage,
        lastMessageTime: timeString,
        lastMessageTimestamp: now,
        messages: updatedMessages,
      };

      all[activeExistingIndex] = updated;
      writeAll(all);
      return formatConversationForViewer(updated, activeViewerEmail);
    }

    // Otherwise, create a brand new session-based conversation initiated by client
    const convId = `conv-${now}`;
    const initialMessages: ChatMessage[] = [];

    if (initialMessage && initialMessage.trim()) {
      initialMessages.push({
        id: `msg-${now}`,
        conversationId: convId,
        senderId: normClientEmail,
        senderEmail: normClientEmail,
        senderName: effectiveClientName,
        senderAvatar: effectiveClientAvatar,
        content: initialMessage.trim(),
        timestamp: timeString,
        date: 'Today',
        createdAt: now,
        status: 'delivered',
      });
    }

    const newConversation: Conversation = {
      id: convId,
      clientId: normClientEmail,
      clientEmail: normClientEmail,
      clientName: effectiveClientName,
      clientAvatar: effectiveClientAvatar,
      businessId: normBusinessEmail,
      businessEmail: normBusinessEmail,
      businessName: effectiveBusinessName,
      businessAvatar: effectiveBusinessAvatar,
      participant: {
        id: normBusinessEmail,
        name: effectiveBusinessName,
        email: normBusinessEmail,
        handle: '@orqland',
        avatar: effectiveBusinessAvatar,
        isOnline: true,
        role: 'business',
      },
      status: 'active',
      deletedByBusiness: false,
      deletedForClient: false,
      lastMessage: initialMessage?.trim() || 'Conversation started by client',
      lastMessageTime: timeString,
      lastMessageTimestamp: now,
      unreadCount: 0,
      unreadByClient: 0,
      unreadByBusiness: initialMessage?.trim() ? 1 : 0,
      workspaceInfo: {
        name: workspaceName,
        type: 'Orqspace',
        description: 'Direct communication channel between business and client.',
      },
      messages: initialMessages,
    };

    all.unshift(newConversation);
    writeAll(all);

    return formatConversationForViewer(newConversation, activeViewerEmail);
  },

  sendMessage(params: {
    conversationId: string;
    senderEmail: string;
    senderName: string;
    senderAvatar: string;
    content: string;
    attachment?: ChatAttachment;
    attachments?: ChatAttachment[];
  }): { message: ChatMessage; conversation: Conversation } {
    const {
      conversationId,
      senderEmail,
      senderName,
      senderAvatar,
      content,
      attachment,
      attachments,
    } = params;

    const all = readAll();
    const index = all.findIndex((c) => c.id === conversationId);

    if (index === -1) {
      throw new Error('Conversation not found.');
    }

    const conv = all[index];

    if (conv.status === 'ended') {
      throw new Error('This chat session has been terminated. No further messages can be sent or received.');
    }

    const normSender = senderEmail.trim().toLowerCase();
    const isSenderBusiness = normSender === (conv.businessEmail || '').toLowerCase();
    const isSenderClient = normSender === (conv.clientEmail || '').toLowerCase();

    if (!isSenderBusiness && !isSenderClient) {
      throw new Error('Unauthorized: You are not a participant in this conversation.');
    }

    // Auto-sync sender avatar if real avatar provided
    const cleanSenderAvatar = sanitizeAvatar(senderAvatar);
    if (cleanSenderAvatar) {
      serverChatStore.syncUserProfile({
        email: normSender,
        name: senderName,
        avatar: cleanSenderAvatar,
      });
    }

    const now = Date.now();
    const timeString = new Date(now).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newMessage: ChatMessage = {
      id: `msg-${now}-${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      senderId: normSender,
      senderEmail: normSender,
      senderName,
      senderAvatar: cleanSenderAvatar || senderAvatar,
      content: content.trim(),
      timestamp: timeString,
      date: 'Today',
      createdAt: now,
      status: 'delivered',
      attachment: attachment
        ? {
            ...attachment,
            locationData:
              attachment.locationData ||
              (attachment.type === 'location'
                ? {
                    latitude: 0,
                    longitude: 0,
                    label: attachment.name || 'Shared Location',
                    mapUrl: attachment.url,
                  }
                : undefined),
            uploadedAt: now,
            expiresAt: now + ATTACHMENT_RETENTION_MS,
            isExpired: false,
          }
        : undefined,
      attachments: attachments && attachments.length > 0
        ? attachments.map((att) => ({
            ...att,
            uploadedAt: now,
            expiresAt: now + ATTACHMENT_RETENTION_MS,
            isExpired: false,
          }))
        : undefined,
    };

    const updatedMessages = [...conv.messages, newMessage];

    const attachmentSummary = attachments && attachments.length > 1
      ? `[${attachments.length} Images]`
      : (attachment ? `[${attachment.type.toUpperCase()} Attachment]` : (attachments?.[0] ? `[${attachments[0].type.toUpperCase()} Attachment]` : ''));

    const updatedConv: Conversation = {
      ...conv,
      clientAvatar: isSenderClient && cleanSenderAvatar ? cleanSenderAvatar : conv.clientAvatar,
      businessAvatar: isSenderBusiness && cleanSenderAvatar ? cleanSenderAvatar : conv.businessAvatar,
      deletedByBusiness: isSenderBusiness ? false : conv.deletedByBusiness,
      lastMessage: content.trim() || attachmentSummary,
      lastMessageTime: timeString,
      lastMessageTimestamp: now,
      messages: updatedMessages,
      unreadByClient: isSenderBusiness ? (conv.unreadByClient || 0) + 1 : conv.unreadByClient || 0,
      unreadByBusiness: isSenderClient ? (conv.unreadByBusiness || 0) + 1 : conv.unreadByBusiness || 0,
    };

    all[index] = updatedConv;
    writeAll(all);

    return {
      message: newMessage,
      conversation: formatConversationForViewer(updatedConv, normSender),
    };
  },

  deleteChat(conversationId: string, userEmail: string): Conversation {
    if (!isBusinessUser(userEmail)) {
      throw new Error('Permission Denied: Only the Business can delete a chat from their perspective.');
    }

    const all = readAll();
    const index = all.findIndex((c) => c.id === conversationId);

    if (index === -1) {
      throw new Error('Conversation not found.');
    }

    const updated: Conversation = {
      ...all[index],
      deletedByBusiness: false,
      businessDeletedAt: Date.now(),
    };

    all[index] = updated;
    writeAll(all);

    return formatConversationForViewer(updated, userEmail);
  },

  deleteMessage(params: {
    conversationId: string;
    messageId: string;
    userEmail: string;
  }): Conversation {
    const { conversationId, messageId, userEmail } = params;
    if (!isBusinessUser(userEmail)) {
      throw new Error('Permission Denied: Only the Business account can delete messages from their view.');
    }

    const all = readAll();
    const index = all.findIndex((c) => c.id === conversationId);

    if (index === -1) {
      throw new Error('Conversation not found.');
    }

    const conv = all[index];
    conv.messages = conv.messages.map((m) =>
      m.id === messageId ? { ...m, deletedByBusiness: true } : m
    );

    all[index] = conv;
    writeAll(all);

    return formatConversationForViewer(conv, userEmail);
  },

  endChat(conversationId: string, userEmail: string): Conversation {
    const all = readAll();
    const index = all.findIndex((c) => c.id === conversationId);

    if (index === -1) {
      throw new Error('Conversation not found.');
    }

    const conv = all[index];
    const normUser = userEmail.trim().toLowerCase();
    const isClient = normUser === (conv.clientEmail || '').toLowerCase();

    // Permission: Only clients can end the chat session (not businesses)
    if (!isClient) {
      throw new Error('Permission Denied: Only clients can end a chat session.');
    }

    const now = Date.now();
    const updated: Conversation = {
      ...conv,
      status: 'ended',
      endedAt: now,
      endedBy: normUser,
      deletedForClient: false,
      lastMessage: 'This chat session was ended by the client.',
      lastMessageTime: new Date(now).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      lastMessageTimestamp: now,
    };

    all[index] = updated;
    writeAll(all);

    return formatConversationForViewer(updated, userEmail);
  },

  reopenChat(conversationId: string, userEmail: string): Conversation {
    const all = readAll();
    const index = all.findIndex((c) => c.id === conversationId);

    if (index === -1) {
      throw new Error('Conversation not found.');
    }

    const conv = all[index];
    const normUser = userEmail.trim().toLowerCase();
    const isClient = normUser === (conv.clientEmail || '').toLowerCase();
    const isBusiness = normUser === (conv.businessEmail || '').toLowerCase();

    if (!isClient && !isBusiness) {
      throw new Error('Unauthorized: You are not a participant in this conversation.');
    }

    const now = Date.now();
    const updated: Conversation = {
      ...conv,
      status: 'active',
      endedAt: undefined,
      endedBy: undefined,
      lastMessage: 'Chat session re-opened',
      lastMessageTime: new Date(now).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      lastMessageTimestamp: now,
    };

    all[index] = updated;
    writeAll(all);

    return formatConversationForViewer(updated, userEmail);
  },

  markAsRead(conversationId: string, readerEmail: string) {
    if (!readerEmail) return;
    const all = readAll();
    const index = all.findIndex((c) => c.id === conversationId);

    if (index === -1) return;

    const conv = all[index];
    const normReader = readerEmail.trim().toLowerCase();
    const isClient = normReader === (conv.clientEmail || '').toLowerCase();
    const isBusiness = normReader === (conv.businessEmail || '').toLowerCase();

    if (!isClient && !isBusiness) {
      return; // Reject unauthorized manipulation
    }

    let hasUnread = false;
    const updatedMessages = conv.messages.map((m) => {
      if (m.senderEmail?.toLowerCase() !== normReader && m.status !== 'read') {
        hasUnread = true;
        return { ...m, status: 'read' as const };
      }
      return m;
    });

    const updated: Conversation = {
      ...conv,
      unreadByBusiness: isBusiness ? 0 : conv.unreadByBusiness || 0,
      unreadByClient: !isBusiness ? 0 : conv.unreadByClient || 0,
      messages: updatedMessages,
    };

    if (hasUnread || (isBusiness ? conv.unreadByBusiness : conv.unreadByClient)) {
      all[index] = updated;
      writeAll(all);
    }
  },
};
