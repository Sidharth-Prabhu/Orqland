import { Conversation, ChatMessage, ChatAttachment } from '@/types/chat';

const CHANNEL_NAME = 'orqland_chat_channel';
const STORAGE_PREFIX = 'orqland_cache_v4_';
const TAB_ID = typeof window !== 'undefined' ? Math.random().toString(36).slice(2, 10) : 'server';

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

// Purge any bloated legacy cache entries (>1MB) from localStorage to keep browser quota clean
function purgeBloatedLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('orqland_conversations_cache') ||
          k.startsWith('orqland_chat_cache'))
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

// Helper to broadcast events across other tabs via BroadcastChannel (never loops within the same tab)
function notifyCrossTab() {
  if (typeof window !== 'undefined') {
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel(CHANNEL_NAME);
        bc.postMessage({ type: 'CHAT_UPDATED', senderTabId: TAB_ID, timestamp: Date.now() });
        bc.close();
      }
    } catch {
      // Ignore broadcast errors
    }
  }
}

// Load cached conversations (instant 0ms response on page refresh)
function loadCachedConversations(email?: string | null): Conversation[] {
  const norm = (email || '').trim().toLowerCase() || 'default';
  if (inMemoryCache[norm] && inMemoryCache[norm].length > 0) {
    return inMemoryCache[norm];
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      inMemoryCache[norm] = parsed;
      return parsed;
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
      await fetch('/api/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, avatar }),
      });
    } catch {
      // Background sync, non-blocking
    }
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
      const res = await fetch(`/api/chat/list?email=${encodeURIComponent(email)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return loadCachedConversations(email);
      const data = await res.json();
      if (Array.isArray(data.conversations)) {
        saveCachedConversations(data.conversations, email);
        return data.conversations;
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
    const res = await fetch('/api/chat/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to initiate conversation.');
    }

    const createdConv: Conversation = data.conversation;

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
  }): Promise<{ message: ChatMessage; conversation: Conversation }> {
    const {
      conversationId,
      senderEmail,
      senderName,
      senderAvatar,
      content,
      attachment,
      attachments,
    } = params;

    // Optimistic UI update
    const now = Date.now();
    const optimisticMessage: ChatMessage = {
      id: `msg-${now}-${Math.random().toString(36).slice(2, 6)}`,
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
    const res = await fetch('/api/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const updatedConv: Conversation = data.conversation;
    const latest = loadCachedConversations(senderEmail).map((c) =>
      c.id === updatedConv.id ? updatedConv : c
    );
    saveCachedConversations(latest, senderEmail);

    return { message: data.message, conversation: updatedConv };
  },

  /**
   * Delete Chat (Business only - clears business view)
   */
  async deleteChat(conversationId: string, userEmail: string): Promise<Conversation> {
    const res = await fetch('/api/chat/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, userEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete chat.');
    }

    // Update local cache with cleared history conversation
    const updatedConv: Conversation = data.conversation;
    const latest = loadCachedConversations().map((c) =>
      c.id === updatedConv.id ? updatedConv : c
    );
    saveCachedConversations(latest);
    notifyCrossTab();

    return updatedConv;
  },

  /**
   * Delete an individual message from business view
   */
  async deleteMessage(
    conversationId: string,
    messageId: string,
    userEmail: string
  ): Promise<Conversation> {
    const res = await fetch('/api/chat/delete-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, messageId, userEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete message.');
    }

    const updatedConv: Conversation = data.conversation;
    const latest = loadCachedConversations().map((c) =>
      c.id === updatedConv.id ? updatedConv : c
    );
    saveCachedConversations(latest);
    notifyCrossTab();

    return updatedConv;
  },

  /**
   * End Chat (Client only - ends chat session)
   */
  async endChat(conversationId: string, userEmail: string): Promise<Conversation> {
    const res = await fetch('/api/chat/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, userEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to end chat.');
    }

    const updatedConv: Conversation = data.conversation;
    const latest = loadCachedConversations().map((c) =>
      c.id === updatedConv.id ? updatedConv : c
    );
    saveCachedConversations(latest);

    return updatedConv;
  },

  /**
   * Reopen an ended Chat session
   */
  async reopenChat(conversationId: string, userEmail: string): Promise<Conversation> {
    const res = await fetch('/api/chat/reopen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, userEmail }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to reopen chat.');
    }

    const updatedConv: Conversation = data.conversation;
    const latest = loadCachedConversations().map((c) =>
      c.id === updatedConv.id ? updatedConv : c
    );
    saveCachedConversations(latest);

    return updatedConv;
  },

  /**
   * Mark messages as read by reader
   */
  async markAsRead(conversationId: string, readerEmail: string) {
    if (!conversationId || !readerEmail) return;

    // Optimistically zero unread count
    const current = loadCachedConversations();
    const idx = current.findIndex((c) => c.id === conversationId);
    if (idx >= 0 && current[idx].unreadCount > 0) {
      current[idx].unreadCount = 0;
      saveCachedConversations(current);
    }

    try {
      await fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, readerEmail }),
      });
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
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (event) => {
        // Only react to updates originating from other tabs to prevent redundant local fetches
        if (event.data?.senderTabId && event.data.senderTabId === TAB_ID) return;
        chatService.fetchConversations(email).then((fresh) => {
          onUpdate(fresh);
        });
      };
    }

    // 4. Background polling loop (every 1.5s) to guarantee cross-device & cross-browser synchronization
    const interval = setInterval(() => {
      chatService.fetchConversations(email).then((fresh) => {
        onUpdate(fresh);
      });
    }, 1500);

    return () => {
      activeSubscribers.get(email)?.delete(onUpdate);
      clearInterval(interval);
      if (bc) {
        bc.close();
      }
    };
  },
};
