import { Conversation, ChatMessage, ChatAttachment } from '@/types/chat';
import { auth } from './firebase';
import { isAttachmentExpired } from './security';
import { deleteFileFromFirebaseStorage } from './firebaseStorage';
import { getChatSocket } from './socket/client';
import { CHAT_EVENTS } from '@orqland/contracts';
import { checkMessageRateLimit, checkGeneralRateLimit } from './rateLimiter';

const CHANNEL_NAME = 'orqland_chat_channel';
const STORAGE_PREFIX = 'orqland_user_chats_v1_';
const TAB_ID = typeof window !== 'undefined' ? Math.random().toString(36).slice(2, 10) : 'server';

async function getAuthHeaders(userEmail?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken().catch(() => '');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (currentUser.email) {
        headers['X-User-Email'] = currentUser.email;
      }
    } else if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
  } catch {
    if (userEmail) {
      headers['X-User-Email'] = userEmail;
    }
  }
  return headers;
}

// In-memory cache per user email for instantaneous 0ms access
const inMemoryCache: Record<string, Conversation[]> = {};
const activeSubscribers = new Map<string, Set<(conversations: Conversation[]) => void>>();

function notifyLocalSubscribers(email: string, conversations: Conversation[]) {
  const norm = (email || '').trim().toLowerCase();
  const set = activeSubscribers.get(norm);
  if (set) {
    set.forEach((cb) => {
      try {
        cb(conversations);
      } catch {
        // Ignore subscriber error
      }
    });
  }
}

function getStorageKey(email?: string | null): string {
  const norm = (email || '').trim().toLowerCase();
  return `${STORAGE_PREFIX}${norm || 'default'}`;
}

// Purge legacy cache entries from older versions
function purgeBloatedLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('orqland_conversations_cache') ||
          k.startsWith('orqland_chat_cache') ||
          k.startsWith('orqland_cache_v4_') ||
          k.startsWith('orqland_cache_v3_') ||
          k.startsWith('orqland_cache_v2_') ||
          k.startsWith('orqland_cache_v1_'))
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        // Ignore
      }
    });
  } catch {
    // Ignore
  }
}

if (typeof window !== 'undefined') {
  purgeBloatedLocalStorage();
}

// Strip massive base64 payloads (>1KB) for localStorage to stay safely within browser quota (~12KB total)
function sanitizeForLocalStorage(convs: Conversation[]): Conversation[] {
  return convs.map((c) => ({
    ...c,
    messages: c.messages.map((m) => {
      if (m.attachment && m.attachment.url && m.attachment.type !== 'location') {
        if (m.attachment.url.length > 1024) {
          return {
            ...m,
            attachment: {
              ...m.attachment,
              url: '', // strip giant base64 payload in localStorage; memory cache & server API retain full URL
            },
          };
        }
      }
      return m;
    }),
  }));
}

// Shared singleton BroadcastChannel across the tab
let sharedBroadcastChannel: BroadcastChannel | null = null;
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!('BroadcastChannel' in window)) return null;
  if (!sharedBroadcastChannel) {
    try {
      sharedBroadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    } catch {
      sharedBroadcastChannel = null;
    }
  }
  return sharedBroadcastChannel;
}

// Helper to broadcast events across other tabs via BroadcastChannel & Storage events
function notifyCrossTab() {
  if (typeof window !== 'undefined') {
    try {
      const bc = getBroadcastChannel();
      if (bc) {
        bc.postMessage({ type: 'CHAT_UPDATED', senderTabId: TAB_ID, timestamp: Date.now() });
      }
    } catch {
      // Ignore broadcast channel errors
    }
    try {
      // Storage event fallback: triggers 'storage' event in all other browser tabs
      localStorage.setItem('orqland_cross_tab_ping', String(Date.now()));
    } catch {
      // Ignore localStorage errors
    }
  }
}

// Automatically purge attachments older than 48 hours across memory, local cache, and Cloud Storage
function enforceAttachmentRetention(convs: Conversation[]): Conversation[] {
  let hasExpired = false;
  const expiredUrlsToDelete: string[] = [];

  const cleaned = convs.map((conv) => {
    let convModified = false;
    const messages = conv.messages.map((msg) => {
      let msgModified = false;
      let singleAtt = msg.attachment;
      let atts = msg.attachments;

      if (
        singleAtt &&
        singleAtt.type !== 'location' &&
        (!singleAtt.isExpired && isAttachmentExpired(singleAtt.uploadedAt, singleAtt.expiresAt))
      ) {
        msgModified = true;
        if (singleAtt.url) expiredUrlsToDelete.push(singleAtt.url);
        singleAtt = {
          ...singleAtt,
          isExpired: true,
          url: '',
          thumbnailUrl: '',
        };
      }

      if (atts && atts.length > 0) {
        const cleanedAtts = atts.map((a) => {
          if (
            a.type !== 'location' &&
            (!a.isExpired && isAttachmentExpired(a.uploadedAt, a.expiresAt))
          ) {
            msgModified = true;
            if (a.url) expiredUrlsToDelete.push(a.url);
            return {
              ...a,
              isExpired: true,
              url: '',
              thumbnailUrl: '',
            };
          }
          return a;
        });
        if (msgModified) {
          atts = cleanedAtts;
        }
      }

      if (msgModified) {
        convModified = true;
        hasExpired = true;
        return {
          ...msg,
          attachment: singleAtt,
          attachments: atts,
        };
      }
      return msg;
    });

    if (convModified) {
      return { ...conv, messages };
    }
    return conv;
  });

  // Permanently delete expired files from Firebase Cloud Storage in the background
  if (expiredUrlsToDelete.length > 0 && typeof window !== 'undefined') {
    expiredUrlsToDelete.forEach((url) => {
      deleteFileFromFirebaseStorage(url).catch((err) =>
        console.warn('Could not delete expired file from Firebase:', err)
      );
    });
  }

  return cleaned;
}

// Load cached conversations (instant 0ms response on page refresh)
function loadCachedConversations(email?: string | null): Conversation[] {
  const norm = (email || '').trim().toLowerCase() || 'default';
  if (inMemoryCache[norm] && inMemoryCache[norm].length > 0) {
    return enforceAttachmentRetention(inMemoryCache[norm]);
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const sanitized = enforceAttachmentRetention(parsed);
      inMemoryCache[norm] = sanitized;
      return sanitized;
    }
    return [];
  } catch {
    return [];
  }
}

// Save cached conversations (updates inMemoryCache and persists lightweight compact version to localStorage)
function saveCachedConversations(conversations: Conversation[], email?: string | null) {
  const norm = (email || '').trim().toLowerCase() || 'default';
  inMemoryCache[norm] = conversations;
  if (typeof window !== 'undefined') {
    try {
      const compact = sanitizeForLocalStorage(conversations);
      localStorage.setItem(getStorageKey(email), JSON.stringify(compact));
    } catch {
      // If localStorage is disabled or full, in-memory cache handles it
    }
  }
  if (email) {
    notifyLocalSubscribers(email, conversations);
  }
}

export const chatService = {
  /**
   * Sync the current user profile (photoURL, displayName) to backend
   */
  async syncUserProfile(email: string, name?: string | null, avatar?: string | null) {
    if (!email) return;
    try {
      const headers = await getAuthHeaders(email);
      await fetch('/api/user/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email, name, avatar }),
      });
    } catch {
      // Background sync, non-blocking
    }
  },

  /**
   * Send heartbeat to maintain online presence
   */
  async sendHeartbeat(email: string) {
    if (!email) return;
    try {
      const headers = await getAuthHeaders(email);
      await fetch('/api/user/heartbeat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ email }),
      });
    } catch {}
  },

  /**
   * Get cached conversations immediately (0ms)
   */
  getCachedConversations(): Conversation[] {
    return loadCachedConversations();
  },

  /**
   * Fetch conversations from backend server
   */
  async fetchConversations(userEmail: string): Promise<Conversation[]> {
    if (!userEmail) return [];
    const email = userEmail.trim().toLowerCase();
    try {
      const authHeaders = await getAuthHeaders(email);
      const res = await fetch(`/api/chat/list?email=${encodeURIComponent(email)}`, {
        headers: authHeaders,
        cache: 'no-store',
      });
      if (!res.ok) return loadCachedConversations(email);
      const data = await res.json();
      const list = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.conversations)
        ? data.conversations
        : null;

      if (list) {
        const purged = enforceAttachmentRetention(list);
        saveCachedConversations(purged, email);
        return purged;
      }
      return loadCachedConversations(email);
    } catch (err) {
      console.error('Failed to fetch conversations from server:', err);
      return loadCachedConversations(email);
    }
  },

  /**
   * Clients initiate a chat with a Business.
   * Calls /api/chat/initiate on server and updates local state.
   */
  async initiateChat(params: {
    clientEmail: string;
    clientName?: string;
    clientAvatar?: string;
    businessEmail: string;
    businessName: string;
    businessAvatar?: string;
    workspaceName?: string;
    initialMessage?: string;
  }): Promise<Conversation> {
    const authHeaders = await getAuthHeaders(params.clientEmail);
    const res = await fetch('/api/chat/initiate', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to initiate conversation.');
    }

    const createdConv: Conversation = data.conversation || data.data;

    // Optimistically update cache
    const current = loadCachedConversations(params.clientEmail).filter((c) => c.id !== createdConv.id);
    saveCachedConversations([createdConv, ...current], params.clientEmail);

    return createdConv;
  },

  /**
   * Send a message in an existing conversation
   */
  async sendMessage(params: {
    conversationId: string;
    senderEmail: string;
    senderName: string;
    senderAvatar: string;
    content: string;
    attachment?: ChatAttachment;
    attachments?: ChatAttachment[];
    optimisticId?: string;
  }): Promise<{ message: ChatMessage; conversation: Conversation }> {
    const {
      conversationId,
      senderEmail,
      senderName,
      senderAvatar,
      content,
      attachment,
      attachments,
      optimisticId,
    } = params;

    // Client-side rate limiting enforcement
    const rateLimitCheck = checkMessageRateLimit(senderEmail);
    if (!rateLimitCheck.allowed) {
      throw new Error(rateLimitCheck.reason || 'Message rate limit exceeded. Please wait a moment.');
    }

    // Optimistic UI update
    const now = Date.now();
    const optimisticMessage: ChatMessage = {
      id: optimisticId || `msg-${now}-${Math.random().toString(36).slice(2, 6)}`,
      conversationId,
      senderId: senderEmail,
      senderEmail,
      senderName,
      senderAvatar,
      content,
      timestamp: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: 'Today',
      createdAt: now,
      status: 'sending',
      attachment,
      attachments,
    };

    const currentConvs = loadCachedConversations(senderEmail);
    const targetIdx = currentConvs.findIndex((c) => c.id === conversationId);
    if (targetIdx >= 0) {
      const conv = currentConvs[targetIdx];
      const updatedMessages = [...conv.messages, optimisticMessage];
      const lastMsgSummary = content || (attachments && attachments.length > 1 ? `[${attachments.length} Images]` : (attachment ? `[${attachment.type.toUpperCase()}]` : ''));
      currentConvs[targetIdx] = {
        ...conv,
        lastMessage: lastMsgSummary,
        lastMessageTime: optimisticMessage.timestamp,
        messages: updatedMessages,
      };
      saveCachedConversations(currentConvs, senderEmail);
    }

    // Call server API
    const authHeaders = await getAuthHeaders(senderEmail);
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      // Mark as failed in cache
      const latestConvs = loadCachedConversations(senderEmail);
      const idx = latestConvs.findIndex((c) => c.id === conversationId);
      if (idx >= 0) {
        latestConvs[idx].messages = latestConvs[idx].messages.map((m) =>
          m.id === optimisticMessage.id ? { ...m, status: 'failed' } : m
        );
        saveCachedConversations(latestConvs, senderEmail);
      }
      throw new Error(data.error || 'Failed to send message.');
    }

    // Replace with confirmed server conversation and message
    const confirmedMsg: ChatMessage = (data.data?.id ? data.data : data.message) || optimisticMessage;
    const latestConvs = loadCachedConversations(senderEmail);
    const convIdx = latestConvs.findIndex((c) => c.id === conversationId);
    let targetConv: Conversation | null = null;

    if (convIdx >= 0) {
      latestConvs[convIdx] = {
        ...latestConvs[convIdx],
        messages: latestConvs[convIdx].messages.map((m) =>
          m.id === optimisticMessage.id || (m.status === 'sending' && m.content === content)
            ? { ...confirmedMsg, status: 'delivered', isMe: true }
            : m
        ),
      };
      targetConv = latestConvs[convIdx];
      saveCachedConversations(latestConvs, senderEmail);
    }

    // Cross-tab broadcast so other open tabs/windows update their view immediately
    notifyCrossTab();

    return { message: confirmedMsg, conversation: targetConv || (data.conversation as Conversation) };
  },

  /**
   * Delete Chat (Business only - clears business view)
   */
  async deleteChat(conversationId: string, userEmail: string): Promise<Conversation> {
    const authHeaders = await getAuthHeaders(userEmail);
    const res = await fetch('/api/chat/delete', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ conversationId, userEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete chat.');
    }

    // Update local cache with cleared history conversation
    const updatedConv: Conversation = data.conversation || data.data;
    if (updatedConv && updatedConv.id) {
      const latest = loadCachedConversations(userEmail).map((c) =>
        c.id === updatedConv.id ? updatedConv : c
      );
      saveCachedConversations(latest, userEmail);
    }
    notifyCrossTab();

    return updatedConv;
  },

  /**
   * Delete an individual message (sender only, within 15 minutes)
   */
  async deleteMessage(
    conversationId: string,
    messageId: string,
    userEmail: string
  ): Promise<Conversation> {
    // If message contains media attachments, delete them from Firebase Cloud Storage
    const existingConvs = loadCachedConversations(userEmail);
    const existingConv = existingConvs.find((c) => c.id === conversationId);
    const targetMsg = existingConv?.messages.find((m) => m.id === messageId);
    if (targetMsg) {
      const urlsToDelete: string[] = [];
      if (targetMsg.attachment?.url) urlsToDelete.push(targetMsg.attachment.url);
      if (targetMsg.attachments && targetMsg.attachments.length > 0) {
        targetMsg.attachments.forEach((a) => {
          if (a.url) urlsToDelete.push(a.url);
        });
      }
      urlsToDelete.forEach((url) => {
        deleteFileFromFirebaseStorage(url).catch((err) =>
          console.warn('Could not delete attachment file from Firebase Storage:', err)
        );
      });
    }

    const authHeaders = await getAuthHeaders(userEmail);
    const res = await fetch('/api/chat/delete-message', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ conversationId, messageId, userEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete message.');
    }

    const updatedConv: Conversation = data.conversation || data.data;
    if (updatedConv && updatedConv.id) {
      const latest = loadCachedConversations(userEmail).map((c) =>
        c.id === updatedConv.id ? updatedConv : c
      );
      saveCachedConversations(latest, userEmail);
    }
    notifyCrossTab();

    return updatedConv;
  },

  /**
   * Edit an individual message (sender only, within 10 minutes)
   */
  async editMessage(
    conversationId: string,
    messageId: string,
    newContent: string,
    userEmail: string
  ): Promise<Conversation> {
    const authHeaders = await getAuthHeaders(userEmail);
    const res = await fetch('/api/chat/edit-message', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ conversationId, messageId, newContent, userEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to edit message.');
    }

    const updatedConv: Conversation = data.conversation || data.data;
    if (updatedConv && updatedConv.id) {
      const latest = loadCachedConversations(userEmail).map((c) =>
        c.id === updatedConv.id ? updatedConv : c
      );
      saveCachedConversations(latest, userEmail);
    }
    notifyCrossTab();

    return updatedConv;
  },

  /**
   * End Chat (Client only - ends chat session)
   */
  async endChat(conversationId: string, userEmail: string): Promise<Conversation> {
    const authHeaders = await getAuthHeaders(userEmail);
    const res = await fetch('/api/chat/end', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ conversationId, userEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to end chat.');
    }

    const updatedConv: Conversation = data.conversation || data.data;
    if (updatedConv && updatedConv.id) {
      const latest = loadCachedConversations(userEmail).map((c) =>
        c.id === updatedConv.id ? updatedConv : c
      );
      saveCachedConversations(latest, userEmail);
    }
    notifyCrossTab();

    return updatedConv;
  },

  /**
   * Reopen an ended Chat session
   */
  async reopenChat(conversationId: string, userEmail: string, workspaceName?: string): Promise<Conversation> {
    const authHeaders = await getAuthHeaders(userEmail);
    const res = await fetch('/api/chat/reopen', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ conversationId, userEmail, workspaceName }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reopen chat.');
    }

    const updatedConv: Conversation = data.conversation || data.data;
    if (updatedConv && updatedConv.id) {
      const latest = loadCachedConversations(userEmail).map((c) =>
        c.id === updatedConv.id ? updatedConv : c
      );
      saveCachedConversations(latest, userEmail);
    }
    notifyCrossTab();

    return updatedConv;
  },

  /**
   * Mark messages as read by reader
   */
  async markAsRead(conversationId: string, readerEmail: string) {
    if (!conversationId || !readerEmail) return;

    // Optimistically zero unread count
    const current = loadCachedConversations(readerEmail);
    const idx = current.findIndex((c) => c.id === conversationId);
    if (idx >= 0) {
      const conv = current[idx];
      if ((conv.unreadCount || 0) > 0 || (conv.unreadByClient || 0) > 0 || (conv.unreadByBusiness || 0) > 0) {
        conv.unreadCount = 0;
        conv.unreadByClient = 0;
        conv.unreadByBusiness = 0;
        saveCachedConversations(current, readerEmail);
        notifyCrossTab();
      }
    }

    try {
      const authHeaders = await getAuthHeaders(readerEmail);
      await fetch('/api/chat/read', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ conversationId, readerEmail }),
      });

      // Also emit via WebSocket so all open tabs and active rooms receive immediate read receipt
      try {
        const socket = getChatSocket(undefined, readerEmail);
        if (socket && socket.connected) {
          socket.emit(CHAT_EVENTS.MESSAGE_READ, { conversationId });
        }
      } catch {}
    } catch {
      // Background sync, suppress network errors
    }
  },

  /**
   * Subscribe to real-time conversation updates
   * Combines instant cache delivery, BroadcastChannel, and 1.5s background polling
   */
  subscribe(
    userEmail: string | null | undefined,
    onUpdate: (conversations: Conversation[]) => void
  ): () => void {
    if (!userEmail) return () => {};

    const email = userEmail.trim().toLowerCase();

    // Register local subscriber for synchronous in-tab updates
    if (!activeSubscribers.has(email)) {
      activeSubscribers.set(email, new Set());
    }
    activeSubscribers.get(email)!.add(onUpdate);

    // 1. Initial cached response
    const cached = loadCachedConversations(email);
    if (cached.length > 0) {
      onUpdate(cached);
    }

    // 2. Fetch fresh data from server immediately
    chatService.fetchConversations(email).then((fresh) => {
      onUpdate(fresh);
    });

    // 3. Cross-tab real-time listener (responds to updates from other open tabs/windows)
    const handleRemoteUpdate = () => {
      chatService.fetchConversations(email).then((fresh) => {
        onUpdate(fresh);
      });
    };

    const bc = getBroadcastChannel();
    const handleBcMessage = (event: MessageEvent) => {
      // Only react to updates originating from other tabs to prevent redundant local fetches
      if (event.data?.senderTabId && event.data.senderTabId === TAB_ID) return;
      handleRemoteUpdate();
    };

    if (bc) {
      bc.addEventListener('message', handleBcMessage);
    }

    // Storage event listener: fires in all other tabs on the same origin when localStorage changes
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'orqland_cross_tab_ping') {
        handleRemoteUpdate();
      }
    };

    // Instant sync when tab regains focus or visibility
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        handleRemoteUpdate();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
      window.addEventListener('focus', handleRemoteUpdate);
      document.addEventListener('visibilitychange', handleVisibility);
    }

    // 4. Real-time WebSocket synchronization (replaces aggressive 1s HTTP polling)
    let socketCleanup: (() => void) | null = null;
    if (typeof window !== 'undefined') {
      try {
        const socket = getChatSocket(undefined, email);

        const onSocketMessage = (payload: any) => {
          handleRemoteUpdate();
        };

        const onPresenceUpdate = (payload: any) => {
          handleRemoteUpdate();
        };

        const onConversationUpdate = (payload: any) => {
          handleRemoteUpdate();
        };

        const onReadUpdate = (payload: any) => {
          handleRemoteUpdate();
        };

        socket.on(CHAT_EVENTS.MESSAGE_NEW, onSocketMessage);
        socket.on(CHAT_EVENTS.PRESENCE_UPDATE, onPresenceUpdate);
        socket.on(CHAT_EVENTS.CONVERSATION_UPDATED, onConversationUpdate);
        socket.on(CHAT_EVENTS.MESSAGE_READ_UPDATE, onReadUpdate);

        socketCleanup = () => {
          socket.off(CHAT_EVENTS.MESSAGE_NEW, onSocketMessage);
          socket.off(CHAT_EVENTS.PRESENCE_UPDATE, onPresenceUpdate);
          socket.off(CHAT_EVENTS.CONVERSATION_UPDATED, onConversationUpdate);
          socket.off(CHAT_EVENTS.MESSAGE_READ_UPDATE, onReadUpdate);
        };
      } catch (e) {
        console.warn('[chatService] WebSocket setup deferred:', e);
      }
    }

    // 5. Periodic heartbeat ping (every 30s) instead of 1000ms polling
    chatService.sendHeartbeat(email);
    const interval = setInterval(() => {
      chatService.sendHeartbeat(email);
    }, 30000);

    return () => {
      activeSubscribers.get(email)?.delete(onUpdate);
      clearInterval(interval);
      if (socketCleanup) {
        socketCleanup();
      }
      if (bc) {
        bc.removeEventListener('message', handleBcMessage);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener('focus', handleRemoteUpdate);
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  },
};
