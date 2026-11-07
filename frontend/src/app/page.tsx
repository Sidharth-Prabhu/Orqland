'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClientTopBar } from '@/components/ClientTopBar';
import { BusinessTopBar } from '@/components/BusinessTopBar';
import { DirectMessagesList } from '@/components/DirectMessagesList';
import { ChatConversation } from '@/components/ChatConversation';
import { DetailsSidebar } from '@/components/DetailsSidebar';
import { StartChatModal } from '@/components/chat/StartChatModal';
import { EndChatModal } from '@/components/chat/EndChatModal';
import { DeleteChatModal } from '@/components/chat/DeleteChatModal';
import { ReopenPromptModal } from '@/components/chat/ReopenPromptModal';
import { useAuth } from '@/context/AuthContext';
import { chatService } from '@/lib/chatService';
import { BUSINESS_EMAIL } from '@/lib/constants';
import { isBusinessUser } from '@/lib/security';
import { Conversation, UserProfile, ChatAttachment, ChatMessage } from '@/types/chat';
import { MessageSquarePlus } from 'lucide-react';
import { NotificationItem } from '@/components/chat/MailNotificationMenu';
import { ToastNotification } from '@/components/chat/ToastNotification';
import { NotificationPermissionBanner } from '@/components/chat/NotificationPermissionBanner';
import {
  requestNotificationPermission,
  sendBrowserNotification,
  isPageInBackground,
} from '@/lib/browserNotifications';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Role verification: only mailtosidharth.me@gmail.com is the business; all other emails are clients
  const isBusiness = isBusinessUser(user?.email);

  // Active view perspective is derived strictly from user role
  const activeViewMode: 'client' | 'business' = isBusiness ? 'business' : 'client';

  const [activeNavTab, setActiveNavTab] = useState('Inbox');

  // Real-time conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [showDetailsSidebar, setShowDetailsSidebar] = useState(false);
  const [isStartChatModalOpen, setIsStartChatModalOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const [reopenPromptState, setReopenPromptState] = useState<{
    isOpen: boolean;
    conversationId: string;
    businessName: string;
    categoryName: string;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    conversationId: '',
    businessName: '',
    categoryName: '',
    isSubmitting: false,
  });

  // Panel widths
  const DEFAULT_DETAILS_WIDTH = 300;
  const MIN_DETAILS_WIDTH = 240;
  const MAX_DETAILS_WIDTH = 500;

  // Individual message action toast notification for errors/alerts
  const [actionAlert, setActionAlert] = useState<{
    id: string;
    type: 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // Auto-dismiss action alert
  useEffect(() => {
    if (!actionAlert) return;
    const t = setTimeout(() => setActionAlert(null), 4000);
    return () => clearTimeout(t);
  }, [actionAlert]);
  const [activeToast, setActiveToast] = useState<{
    id: string;
    conversationId: string;
    senderName: string;
    count: number;
  } | null>(null);

  // Cleared notifications tracking (user can manually clear notifications)
  const [clearedConversationIds, setClearedConversationIds] = useState<string[]>([]);

  // Previous unread count map to detect incoming new messages
  const prevUnreadMapRef = React.useRef<Record<string, number>>({});
  const initialLoadRef = React.useRef(true);

  const [detailsWidth, setDetailsWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('orqland_details_sidebar_width');
        if (saved) {
          const val = parseInt(saved, 10);
          if (!isNaN(val) && val >= MIN_DETAILS_WIDTH && val <= MAX_DETAILS_WIDTH) {
            return val;
          }
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_DETAILS_WIDTH;
  });

  const [isDraggingDetails, setIsDraggingDetails] = useState(false);

  // Handle Dragging for Details Sidebar Resizer
  const startDraggingDetails = (clientX: number) => {
    setIsDraggingDetails(true);
    const startX = clientX;
    const startWidth = detailsWidth;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    let currentWidth = startWidth;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX =
        'touches' in moveEvent
          ? moveEvent.touches[0].clientX
          : (moveEvent as MouseEvent).clientX;
      // Moving left increases width (since details panel is docked on the right)
      const delta = startX - currentX;
      const maxAllowed = Math.min(MAX_DETAILS_WIDTH, window.innerWidth - 640);
      currentWidth = Math.max(MIN_DETAILS_WIDTH, Math.min(maxAllowed, startWidth + delta));
      setDetailsWidth(currentWidth);
    };

    const onEnd = () => {
      setIsDraggingDetails(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem('orqland_details_sidebar_width', String(currentWidth));
      } catch {
        // ignore
      }
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
  };

  // Active conversation object (null by default if none explicitly selected)
  const activeConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId) || null
    : null;

  // Dynamic viewer email: When business switches to Client View, simulate the client's perspective
  const effectiveViewerEmail =
    isBusiness && activeViewMode === 'client' && (activeConversation?.clientEmail || conversations[0]?.clientEmail)
      ? (activeConversation?.clientEmail || conversations[0]?.clientEmail || '')
      : (user?.email || '');

  // Prompt browser notification permission & register service worker upon site entry
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // Automatically request notification permissions so user can get background updates
        requestNotificationPermission().catch(() => {});
      } else if (Notification.permission === 'granted') {
        import('@/lib/browserNotifications').then(({ registerNotificationServiceWorker }) => {
          registerNotificationServiceWorker().catch(() => {});
        });
      }
    }
  }, []);

  // Redirect unauthenticated users to /login immediately
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Subscribe to real-time conversation store updates and sync user profile
  useEffect(() => {
    if (!effectiveViewerEmail) return;

    if (user?.email) {
      // Sync current logged-in user profile with real Google photo & display name
      chatService.syncUserProfile(user.email, user.displayName, user.photoURL);
    }

    const unsubscribe = chatService.subscribe(effectiveViewerEmail, (updatedList) => {
      // If the user currently has an active conversation open and focused in the chat window,
      // zero out unreadCount on that active conversation so no badges or indications persist
      const sanitizedList = updatedList.map((c) => {
        if (c.id === activeConversationId) {
          return {
            ...c,
            unreadCount: 0,
            unreadByClient: 0,
            unreadByBusiness: 0,
          };
        }
        return c;
      });

      setConversations((prev) => {
        // Merge messages so ongoing local messages aren't prematurely replaced by an empty list
        return sanitizedList.map((incoming) => {
          const old = prev.find((p) => p.id === incoming.id);
          if (old && incoming.messages.length === 0 && old.messages.length > 0) {
            return {
              ...incoming,
              messages: old.messages,
            };
          }
          return incoming;
        });
      });

      // Detect newly arrived messages to fire the 2.8s top animated notification
      const currentMap: Record<string, number> = {};
      sanitizedList.forEach((c) => {
        currentMap[c.id] = c.unreadCount || 0;
      });

      if (!initialLoadRef.current) {
        // Find conversation with newly incremented unread count
        for (const c of sanitizedList) {
          const prevCount = prevUnreadMapRef.current[c.id] || 0;
          const currentCount = c.unreadCount || 0;

          // Never notify the user if they are currently inside this active conversation window
          if (c.id === activeConversationId && !isPageInBackground()) {
            continue;
          }

          // Check last message sender: do not notify if the current viewer sent the last message
          const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
          const lastSenderEmail = lastMsg?.senderEmail?.toLowerCase().trim();
          const viewerEmailNorm = (effectiveViewerEmail || '').toLowerCase().trim();
          if (lastSenderEmail && viewerEmailNorm && lastSenderEmail === viewerEmailNorm) {
            continue;
          }

          if (currentCount > prevCount) {
            // Also re-include in notifications if previously cleared
            setClearedConversationIds((prev) => prev.filter((id) => id !== c.id));

            setActiveToast({
              id: `${c.id}-${Date.now()}`,
              conversationId: c.id,
              senderName: c.participant.name,
              count: currentCount,
            });

            // Dispatch desktop browser notification if the tab/window is in background or unfocused
            if (isPageInBackground()) {
              sendBrowserNotification({
                title: `${c.participant.name}`,
                body: c.lastMessage || 'Sent you a new message',
                icon: c.participant.avatar || '/favicon.ico',
                tag: `chat-${c.id}`,
                conversationId: c.id,
                onClick: () => {
                  // Only focus the application window, do not force-select/open the chat screen
                },
              });
            }
            break;
          }
        }
      } else {
        initialLoadRef.current = false;
      }
      prevUnreadMapRef.current = currentMap;

      // Only maintain active conversation if it already exists in the list; do NOT auto-select
      setActiveConversationId((prevId) => {
        if (prevId && updatedList.some((c) => c.id === prevId)) {
          return prevId;
        }
        return '';
      });
    });

    return () => unsubscribe();
  }, [effectiveViewerEmail, user?.email, user?.displayName, user?.photoURL, activeConversationId]);

  // Auto-dismiss toast notification after 2.8 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [activeToast]);

  // Derived notification list for the mail icon dropdown card
  const notificationsList: NotificationItem[] = React.useMemo(() => {
    return conversations
      .filter((c) => (c.unreadCount || 0) > 0 && !clearedConversationIds.includes(c.id))
      .map((c) => ({
        id: c.id,
        conversationId: c.id,
        senderName: c.participant.name,
        count: c.unreadCount || 1,
        timestamp: c.lastMessageTimestamp || 0,
        timeString: c.lastMessageTime || '',
      }));
  }, [conversations, clearedConversationIds]);

  const handleClearAllNotifications = () => {
    const idsWithUnread = conversations
      .filter((c) => (c.unreadCount || 0) > 0)
      .map((c) => c.id);
    setClearedConversationIds(idsWithUnread);
    setActiveToast(null);
  };

  // Mark messages as read and send heartbeat when active conversation changes
  useEffect(() => {
    if (activeConversationId && effectiveViewerEmail) {
      // Immediately send heartbeat so the other participant sees "Active" instantly
      chatService.sendHeartbeat(effectiveViewerEmail);
      if (!isPageInBackground()) {
        chatService.markAsRead(activeConversationId, effectiveViewerEmail);
      }
    }
  }, [activeConversationId, effectiveViewerEmail]);

  // When returning to the tab or focusing, update heartbeat and mark active conversation as read
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleFocus = () => {
      if (effectiveViewerEmail) {
        chatService.sendHeartbeat(effectiveViewerEmail);
        if (activeConversationId) {
          chatService.markAsRead(activeConversationId, effectiveViewerEmail);
        }
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [activeConversationId, effectiveViewerEmail]);

  // Global Escape key listener: Close active chat conversation and return to Orqland empty state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // Don't close chat if any modal dialog or media viewer is currently open in the DOM
      if (
        isStartChatModalOpen ||
        isEndModalOpen ||
        isDeleteModalOpen ||
        document.querySelector('[role="dialog"]') !== null
      ) {
        return;
      }

      if (activeConversationId) {
        e.preventDefault();
        e.stopPropagation();
        setActiveConversationId('');
      }
    };

    // Use capture phase so Esc is caught reliably even when composer input or child element is focused
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    activeConversationId,
    isStartChatModalOpen,
    isEndModalOpen,
    isDeleteModalOpen,
  ]);

  // Derive authenticated user profiles dynamically
  const currentClientUser: UserProfile = user
    ? {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Client User',
        avatar: user.photoURL || '',
        handle: user.email ? `@${user.email.split('@')[0]}` : '@user',
        email: user.email || '',
        role: 'client',
        isOnline: true,
        location: 'Online',
        businessStatus: 'Open',
      }
    : {
        id: '',
        name: '',
        handle: '',
        avatar: '',
        role: 'client',
        isOnline: false,
      };

  const currentBusinessUser: UserProfile = user
    ? {
        id: `biz-${user.uid}`,
        name: user.displayName ? `${user.displayName}'s Workspace` : 'Orqland Business Workspace',
        handle: user.email ? `@${user.email.split('@')[0]}` : '@workspace',
        avatar: user.photoURL || '',
        email: user.email || BUSINESS_EMAIL,
        role: 'business',
        wsid: `WS#${user.uid.slice(0, 8).toUpperCase()}#`,
        businessStatus: 'Open',
        isOnline: true,
      }
    : {
        id: '',
        name: '',
        handle: '',
        avatar: '',
        role: 'business',
        isOnline: false,
      };

  // Send a message in active conversation
  const handleSendMessage = async (
    text: string,
    attachment?: ChatAttachment,
    attachments?: ChatAttachment[]
  ) => {
    if (!activeConversation || !user?.email) return;

    const isClient = activeViewMode === 'client';
    const sender = isClient ? currentClientUser : currentBusinessUser;
    const senderEmail =
      isClient && activeConversation.clientEmail
        ? activeConversation.clientEmail
        : (user.email || '');

    const now = Date.now();
    const timeString = new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Optimistic instant local state update
    const optimisticMessage: ChatMessage = {
      id: `msg-${now}-${Math.random().toString(36).slice(2, 6)}`,
      conversationId: activeConversation.id,
      senderId: senderEmail,
      senderEmail,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      content: text,
      timestamp: timeString,
      date: 'Today',
      createdAt: now,
      status: 'sending',
      attachment,
      attachments,
    };

    const lastMsgSummary = text || (attachments && attachments.length > 1 ? `[${attachments.length} Images]` : (attachment ? `[${attachment.type.toUpperCase()}]` : ''));

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConversation.id) {
          return {
            ...c,
            lastMessage: lastMsgSummary,
            lastMessageTime: timeString,
            lastMessageTimestamp: now,
            messages: [...c.messages, optimisticMessage],
          };
        }
        return c;
      })
    );

    try {
      const result = await chatService.sendMessage({
        conversationId: activeConversation.id,
        senderEmail,
        senderName: sender.name,
        senderAvatar: sender.avatar,
        content: text,
        attachment,
        attachments,
      });

      // 2. Confirmed server update immediately replaces optimistic message
      if (result?.conversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === result.conversation.id ? result.conversation : c))
        );
      }
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      // Mark as failed in UI if send failed
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeConversation.id) {
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === optimisticMessage.id ? { ...m, status: 'failed' } : m
              ),
            };
          }
          return c;
        })
      );
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    // Optimistically clear unread state in local conversations list immediately (0ms)
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, unreadCount: 0, unreadByClient: 0, unreadByBusiness: 0 }
          : c
      )
    );
    if (user?.email) {
      chatService.markAsRead(id, user.email);
    }
  };

  // Clear Chat (Clears conversation history on viewer's side for both Client and Business)
  const handleDeleteChat = async (conversationId: string) => {
    const viewerEmail = effectiveViewerEmail || user?.email;
    if (!viewerEmail) return;

    // Optimistically clear the conversation messages immediately in 0ms
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === conversationId) {
          return {
            ...c,
            messages: [],
            lastMessage: 'Conversation history cleared on your side',
          };
        }
        return c;
      })
    );

    try {
      await chatService.deleteChat(conversationId, viewerEmail);
    } catch (err) {
      console.error('Clear chat error:', err);
      if (effectiveViewerEmail) {
        chatService.fetchConversations(effectiveViewerEmail).then(setConversations);
      }
    }
  };

  // Delete individual message (Allowed within 15 mins for messages sent by the user)
  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConversation || !user?.email) return;
    const convId = activeConversation.id;
    // Optimistic UI update: instantly remove message from current view in 0ms
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          const updatedMsgs = c.messages.filter((m) => m.id !== messageId);
          const lastMsg = updatedMsgs[updatedMsgs.length - 1];
          return {
            ...c,
            messages: updatedMsgs,
            lastMessage: lastMsg ? (lastMsg.content || (lastMsg.attachment ? `[${lastMsg.attachment.type.toUpperCase()}]` : '')) : '',
            lastMessageTime: lastMsg ? lastMsg.timestamp : '',
          };
        }
        return c;
      })
    );
    try {
      await chatService.deleteMessage(convId, messageId, user.email);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete message.';
      console.warn('Delete message feedback:', errorMsg);
      setActionAlert({
        id: String(Date.now()),
        type: 'warning',
        message: errorMsg,
      });
      if (effectiveViewerEmail) {
        chatService.fetchConversations(effectiveViewerEmail).then(setConversations);
      }
    }
  };

  // Edit individual message (Allowed within 10 minutes for messages sent by the user)
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!activeConversation || !user?.email) return;
    const convId = activeConversation.id;
    // Optimistic UI update: instantly reflect edited content in 0ms
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === convId) {
          const updatedMsgs = c.messages.map((m) =>
            m.id === messageId
              ? { ...m, content: newContent, isEdited: true, editedAt: Date.now() }
              : m
          );
          const lastMsg = updatedMsgs[updatedMsgs.length - 1];
          return {
            ...c,
            messages: updatedMsgs,
            lastMessage: lastMsg ? (lastMsg.content || (lastMsg.attachment ? `[${lastMsg.attachment.type.toUpperCase()}]` : '')) : '',
          };
        }
        return c;
      })
    );
    try {
      await chatService.editMessage(convId, messageId, newContent, user.email);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to edit message.';
      console.warn('Edit message feedback:', errorMsg);
      setActionAlert({
        id: String(Date.now()),
        type: 'warning',
        message: errorMsg,
      });
      if (effectiveViewerEmail) {
        chatService.fetchConversations(effectiveViewerEmail).then(setConversations);
      }
      throw err;
    }
  };

  // End Chat (Client only - allows client to end an active session)
  const handleEndChat = async (conversationId: string) => {
    if (!user?.email || isBusiness) return;
    try {
      await chatService.endChat(conversationId, user.email);
    } catch (err) {
      console.error('End chat error:', err);
    }
  };

  // Re-open Chat (Clients only - allows clients to re-enable an ended session)
  const handleReopenChat = async (conversationId: string, workspaceName?: string) => {
    if (!user?.email || isBusiness) return;
    try {
      await chatService.reopenChat(conversationId, user.email, workspaceName);
    } catch (err) {
      console.error('Reopen chat error:', err);
    }
  };

  // Initiate Chat: Clients initiate conversations with a business
  const handleInitiateChat = async (data: {
    businessEmail: string;
    businessName: string;
    businessAvatar?: string;
    workspaceName?: string;
    initialMessage?: string;
  }) => {
    if (!user?.email) return;

    // Use current client info for initiating
    const clientEmail =
      isBusiness && activeViewMode === 'client' && (activeConversation?.clientEmail || conversations[0]?.clientEmail)
        ? (activeConversation?.clientEmail || conversations[0]?.clientEmail || user.email)
        : user.email;

    const normTargetEmail = data.businessEmail.trim().toLowerCase();

    // Check if an existing conversation already exists with this business
    const existingConv = conversations.find(
      (c) => (c.businessEmail || '').toLowerCase() === normTargetEmail
    );

    if (existingConv && !isBusiness) {
      if (existingConv.status === 'ended') {
        // Pop up the confirmation modal asking whether to reopen the chat session and update the category
        setReopenPromptState({
          isOpen: true,
          conversationId: existingConv.id,
          businessName: data.businessName || existingConv.businessName || 'Business',
          categoryName: data.workspaceName || 'General Consultation',
          isSubmitting: false,
        });
        return;
      }
      // If already active, select it directly and send initial message if provided
      setActiveConversationId(existingConv.id);
      if (data.initialMessage && data.initialMessage.trim()) {
        handleSendMessage(data.initialMessage.trim());
      }
      return;
    }

    const created = await chatService.initiateChat({
      clientEmail,
      clientName: currentClientUser.name,
      clientAvatar: currentClientUser.avatar,
      businessEmail: normTargetEmail,
      businessName: data.businessName,
      businessAvatar: data.businessAvatar || '',
      workspaceName: data.workspaceName || 'General Consultation',
      initialMessage: data.initialMessage,
    });

    setActiveConversationId(created.id);
  };

  // While checking authentication or if unauthenticated, show loading state and NEVER render mockup data
  if (loading || !user) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-extrabold tracking-tight text-black font-sans">
            Orqland
          </span>
          <div className="flex items-center gap-1.5 mt-2 mb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b22] animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffd026] animate-bounce [animation-delay:-0.2s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#10e588] animate-bounce [animation-delay:-0.1s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#1fd5f9] animate-bounce" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#9d5cf7] animate-bounce [animation-delay:0.1s]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff2d87] animate-bounce [animation-delay:0.2s]" />
          </div>
          <p className="text-xs font-semibold text-gray-400">
            {loading ? 'Verifying authentication...' : 'Redirecting to login...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden bg-white flex flex-col select-text">
      {/* Unobtrusive notification permission prompt bar if not yet allowed */}
      <NotificationPermissionBanner />

      {/* Dynamic Top Navigation Bar: Client vs Business (Edge to Edge) */}
      <div className="flex-shrink-0 w-full bg-white">
        {activeViewMode === 'client' ? (
          <ClientTopBar
            user={currentClientUser}
            activeNavTab={activeNavTab}
            onNavTabChange={setActiveNavTab}
            notifications={notificationsList}
            onSelectNotification={(conversationId) => {
              if (conversationId) {
                setActiveConversationId(conversationId);
              }
            }}
            onClearNotifications={handleClearAllNotifications}
          />
        ) : (
          <BusinessTopBar
            business={currentBusinessUser}
            unreadCount={notificationsList.length}
            notifications={notificationsList}
            onSelectNotification={(conversationId) => {
              if (conversationId) {
                setActiveConversationId(conversationId);
              }
            }}
            onClearNotifications={handleClearAllNotifications}
          />
        )}
      </div>

      {/* 3-Column Chat Application Body (Responsive & Resizable across Mobile, Tablet, Laptop, Desktop) */}
      <div className="flex-1 flex overflow-hidden w-full bg-white relative">
        {/* Left: Direct Messages List */}
        <DirectMessagesList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          isBusiness={isBusiness}
          businessProfile={isBusiness ? currentBusinessUser : undefined}
          onOpenStartChat={!isBusiness || activeViewMode === 'client' ? () => setIsStartChatModalOpen(true) : undefined}
          onDeleteConversation={(id) => {
            setDeletingConversationId(id);
            setIsDeleteModalOpen(true);
          }}
          className={`${activeConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[380px] xl:w-[420px] 2xl:w-[440px] flex-shrink-0`}
        />

        {/* Center: Active Chat Conversation or Clean Role-Specific Empty State */}
        {activeConversation ? (
          <ChatConversation
            conversation={activeConversation}
            currentUserEmail={effectiveViewerEmail}
            onSendMessage={handleSendMessage}
            onDeleteChat={handleDeleteChat}
            onEndChat={!isBusiness ? handleEndChat : undefined}
            onReopenChat={!isBusiness ? handleReopenChat : undefined}
            onDeleteMessage={handleDeleteMessage}
            onEditMessage={handleEditMessage}
            onBackToList={() => setActiveConversationId('')}
            onToggleDetails={() => setShowDetailsSidebar((prev) => !prev)}
            isDetailsOpen={showDetailsSidebar}
            className={`${!activeConversationId ? 'hidden md:flex' : 'flex'} flex-1 min-w-0`}
          />
        ) : (
          <div className={`${!activeConversationId ? 'hidden md:flex' : 'flex'} flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center bg-[#fafafa] select-none`}>
            {/* Orqland Brand Logo & Colorful Dot Strip */}
            <div className="flex flex-col items-center mb-4">
              <span className="text-[36px] font-extrabold tracking-tight text-gray-900 leading-none font-sans">
                Orqland
              </span>
              <div className="flex items-center gap-2 mt-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b22]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ffd026]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#10e588]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#1fd5f9]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#9d5cf7]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff2d87]" />
              </div>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 mt-1">
              Open a conversation to begin
            </h3>
            <p className="text-xs text-gray-400 max-w-sm mt-1 mb-5 leading-relaxed">
              Choose an existing chat from the sidebar or initiate a new inquiry.
            </p>

            {!isBusiness || activeViewMode === 'client' ? (
              <button
                onClick={() => setIsStartChatModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <MessageSquarePlus size={14} />
                <span>Start a Conversation</span>
              </button>
            ) : null}
          </div>
        )}

        {/* Right: Info & Bookings Sidebar */}
        {activeConversation && showDetailsSidebar && (
          <>
            {/* Resizer Divider between Chat History and Details Sidebar (Docked on xl screens) */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-valuenow={detailsWidth}
              aria-valuemin={MIN_DETAILS_WIDTH}
              aria-valuemax={MAX_DETAILS_WIDTH}
              title="Drag to resize details sidebar • Double-click to reset"
              onMouseDown={(e) => startDraggingDetails(e.clientX)}
              onTouchStart={(e) => startDraggingDetails(e.touches[0].clientX)}
              onDoubleClick={() => {
                setDetailsWidth(DEFAULT_DETAILS_WIDTH);
                try {
                  localStorage.removeItem('orqland_details_sidebar_width');
                } catch {
                  // ignore
                }
              }}
              className={`hidden xl:flex relative items-center justify-center w-2 -ml-1 -mr-1 z-30 cursor-col-resize select-none group flex-shrink-0 transition-opacity ${
                isDraggingDetails ? 'pointer-events-auto' : ''
              }`}
            >
              <div
                className={`w-[2px] h-full transition-colors duration-150 ${
                  isDraggingDetails
                    ? 'bg-blue-600'
                    : 'bg-transparent group-hover:bg-blue-400 group-active:bg-blue-600'
                }`}
              />
              <div
                className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-7 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all shadow-xs border border-gray-200/90 bg-white opacity-0 group-hover:opacity-100 ${
                  isDraggingDetails ? 'opacity-100 ring-2 ring-blue-500/30' : ''
                }`}
              >
                <span className="w-0.5 h-0.5 rounded-full bg-gray-400" />
                <span className="w-0.5 h-0.5 rounded-full bg-gray-400" />
                <span className="w-0.5 h-0.5 rounded-full bg-gray-400" />
              </div>
            </div>

            {/* Desktop Docked Sidebar (xl: >= 1280px) */}
            <div className="hidden xl:flex h-full flex-shrink-0">
              <DetailsSidebar
                conversation={activeConversation}
                isBusiness={isBusiness}
                onEndChat={!isBusiness ? () => setIsEndModalOpen(true) : undefined}
                onDeleteChat={() => setIsDeleteModalOpen(true)}
                onClose={() => setShowDetailsSidebar(false)}
                style={{ width: `${detailsWidth}px` }}
              />
            </div>

            {/* Mobile, Tablet & Split-Screen Slide-over Drawer (< xl) */}
            <div
              className="xl:hidden fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setShowDetailsSidebar(false)}
            >
              <div
                className="w-[300px] sm:w-[340px] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <DetailsSidebar
                  conversation={activeConversation}
                  isBusiness={isBusiness}
                  onEndChat={!isBusiness ? () => setIsEndModalOpen(true) : undefined}
                  onDeleteChat={() => setIsDeleteModalOpen(true)}
                  onClose={() => setShowDetailsSidebar(false)}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Top Animated Toast Notification (2.8s duration) */}
      {activeToast && (
        <ToastNotification
          senderName={activeToast.senderName}
          count={activeToast.count}
          onOpen={() => {
            setActiveConversationId(activeToast.conversationId);
            setActiveToast(null);
          }}
          onDismiss={() => setActiveToast(null)}
        />
      )}

      {/* Floating Action Alert / Error Notification Toast */}
      {actionAlert && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-900/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-gray-700/80 max-w-sm sm:max-w-md ring-1 ring-white/10">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <MessageSquarePlus size={16} />
            </div>
            <div className="flex-1 text-xs sm:text-[13px] font-medium leading-snug">
              {actionAlert.message}
            </div>
            <button
              type="button"
              onClick={() => setActionAlert(null)}
              className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Start Chat Modal (Client Initiates) */}
      <StartChatModal
        isOpen={isStartChatModalOpen}
        onClose={() => setIsStartChatModalOpen(false)}
        onInitiate={handleInitiateChat}
      />

      {/* End Chat Modal (Client Only - via Sidebar or Header) */}
      {!isBusiness && activeConversation && (
        <EndChatModal
          isOpen={isEndModalOpen}
          onClose={() => setIsEndModalOpen(false)}
          onConfirm={async () => {
            await handleEndChat(activeConversation.id);
            setIsEndModalOpen(false);
          }}
          clientName={activeConversation.participant.name}
        />
      )}

      {/* Re-open Prompt Modal when initiating with an already spoken business */}
      <ReopenPromptModal
        isOpen={reopenPromptState.isOpen}
        businessName={reopenPromptState.businessName}
        categoryName={reopenPromptState.categoryName}
        isSubmitting={reopenPromptState.isSubmitting}
        onConfirm={async () => {
          setReopenPromptState((prev) => ({ ...prev, isSubmitting: true }));
          try {
            await handleReopenChat(
              reopenPromptState.conversationId,
              reopenPromptState.categoryName
            );
            setActiveConversationId(reopenPromptState.conversationId);
            setReopenPromptState({
              isOpen: false,
              conversationId: '',
              businessName: '',
              categoryName: '',
              isSubmitting: false,
            });
          } catch (err) {
            console.error('Failed to reopen and update conversation category:', err);
            setReopenPromptState((prev) => ({ ...prev, isSubmitting: false }));
          }
        }}
        onCancel={() => {
          setReopenPromptState({
            isOpen: false,
            conversationId: '',
            businessName: '',
            categoryName: '',
            isSubmitting: false,
          });
        }}
      />

      {/* Clear Chat Modal (Available via List, Header or Sidebar) */}
      {(deletingConversationId || activeConversation) && (
        <DeleteChatModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeletingConversationId(null);
          }}
          onConfirm={async () => {
            const targetId = deletingConversationId || activeConversation?.id;
            if (targetId) {
              await handleDeleteChat(targetId);
            }
            setIsDeleteModalOpen(false);
            setDeletingConversationId(null);
          }}
          clientName={
            conversations.find((c) => c.id === deletingConversationId)?.participant.name ||
            activeConversation?.participant.name ||
            'Participant'
          }
        />
      )}
    </main>
  );
}
