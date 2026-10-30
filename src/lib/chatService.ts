import { Conversation, ChatMessage, ChatAttachment } from '@/types/chat';

const STORAGE_KEY = 'orqland_conversations_cache_v2';
const CHANNEL_NAME = 'orqland_chat_channel';

// In-memory fallback
let inMemoryConversations: Conversation[] = [];

// Helper to broadcast events across tabs
function notifyCrossTab() {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new Event('orqland_chat_updated'));
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel(CHANNEL_NAME);
        bc.postMessage({ type: 'CHAT_UPDATED', timestamp: Date.now() });
        bc.close();
      }
    } catch {
      // Ignore broadcast errors
    }
  }
}

// Load cached conversations
function loadCachedConversations(): Conversation[] {
  if (typeof window === 'undefined') return inMemoryConversations;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to load cached conversations:', err);
    return inMemoryConversations;
  }
}

// Save cached conversations
function saveCachedConversations(conversations: Conversation[]) {
  inMemoryConversations = conversations;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
      notifyCrossTab();
    } catch (err) {
      console.error('Failed to save cached conversations:', err);
    }
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
    try {
      const res = await fetch(`/api/chat/list?email=${encodeURIComponent(userEmail.trim())}`, {
        cache: 'no-store',
      });
      if (!res.ok) return loadCachedConversations();
      const data = await res.json();
      if (Array.isArray(data.conversations)) {
        saveCachedConversations(data.conversations);
        return data.conversations;
      }
      return loadCachedConversations();
    } catch (err) {
      console.error('Failed to fetch conversations from server:', err);
      return loadCachedConversations();
    }
  },

  /**
   * Only the Business can initiate a chat with a Client.
   * Calls /api/chat/initiate on server and updates local state.
   */
  async initiateChat(params: {
    businessEmail: string;
    businessName: string;
    businessAvatar: string;
    clientEmail: string;
    clientName: string;
    clientAvatar?: string;
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
    const current = loadCachedConversations().filter((c) => c.id !== createdConv.id);
    saveCachedConversations([createdConv, ...current]);

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
  }): Promise<{ message: ChatMessage; conversation: Conversation }> {
    const {
      conversationId,
      senderEmail,
      senderName,
      senderAvatar,
      content,
      attachment,
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
    };

    const currentConvs = loadCachedConversations();
    const targetIdx = currentConvs.findIndex((c) => c.id === conversationId);
    if (targetIdx >= 0) {
      const conv = currentConvs[targetIdx];
      const updatedMessages = [...conv.messages, optimisticMessage];
      currentConvs[targetIdx] = {
        ...conv,
        lastMessage: content || (attachment ? `[${attachment.type.toUpperCase()}]` : ''),
        lastMessageTime: optimisticMessage.timestamp,
        messages: updatedMessages,
      };
      saveCachedConversations(currentConvs);
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
      const latestConvs = loadCachedConversations();
      const idx = latestConvs.findIndex((c) => c.id === conversationId);
      if (idx >= 0) {
        latestConvs[idx].messages = latestConvs[idx].messages.map((m) =>
          m.id === optimisticMessage.id ? { ...m, status: 'failed' } : m
        );
        saveCachedConversations(latestConvs);
      }
      throw new Error(data.error || 'Failed to send message.');
    }

    // Replace with confirmed server conversation and message
    const updatedConv: Conversation = data.conversation;
    const latest = loadCachedConversations().map((c) =>
      c.id === updatedConv.id ? updatedConv : c
    );
    saveCachedConversations(latest);

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

    // Remove from local cache for business
    const filtered = loadCachedConversations().filter((c) => c.id !== conversationId);
    saveCachedConversations(filtered);

    return data.conversation;
  },

  /**
   * End Chat (Business only - closes connection and clears client history)
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

    // 1. Initial cached response
    const cached = loadCachedConversations();
    if (cached.length > 0) {
      onUpdate(cached);
    }

    // 2. Fetch fresh data from server immediately
    chatService.fetchConversations(email).then((fresh) => {
      onUpdate(fresh);
    });

    // 3. Local tab and cross-tab listener
    const localHandler = () => {
      onUpdate(loadCachedConversations());
    };

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined') {
      window.addEventListener('orqland_chat_updated', localHandler);
      window.addEventListener('storage', localHandler);
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel(CHANNEL_NAME);
        bc.onmessage = () => {
          chatService.fetchConversations(email).then((fresh) => {
            onUpdate(fresh);
          });
        };
      }
    }

    // 4. Background polling loop (every 1.5s) to guarantee cross-device & cross-browser synchronization
    const interval = setInterval(() => {
      chatService.fetchConversations(email).then((fresh) => {
        onUpdate(fresh);
      });
    }, 1500);

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('orqland_chat_updated', localHandler);
        window.removeEventListener('storage', localHandler);
        if (bc) {
          bc.close();
        }
      }
    };
  },
};
