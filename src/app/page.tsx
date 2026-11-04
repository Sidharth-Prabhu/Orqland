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
import { useAuth } from '@/context/AuthContext';
import { chatService } from '@/lib/chatService';
import { BUSINESS_EMAIL } from '@/lib/constants';
import { isBusinessUser } from '@/lib/security';
import { Conversation, UserProfile, ChatAttachment, ChatMessage } from '@/types/chat';
import { MessageSquarePlus } from 'lucide-react';
import { NotificationItem } from '@/components/chat/MailNotificationMenu';
import { ToastNotification } from '@/components/chat/ToastNotification';

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

  // Panel widths
  const DEFAULT_DETAILS_WIDTH = 300;
  const MIN_DETAILS_WIDTH = 240;
  const MAX_DETAILS_WIDTH = 500;

  // Transient Animated Toast Notification
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

  // Active conversation object
  const activeConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId) || conversations[0]
    : conversations[0];

  // Dynamic viewer email: When business switches to Client View, simulate the client's perspective
  const effectiveViewerEmail =
    isBusiness && activeViewMode === 'client' && (activeConversation?.clientEmail || conversations[0]?.clientEmail)
      ? (activeConversation?.clientEmail || conversations[0]?.clientEmail || '')
      : (user?.email || '');

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
      setConversations(updatedList);

      // Detect newly arrived messages to fire the 2.5s top animated notification
      const currentMap: Record<string, number> = {};
      updatedList.forEach((c) => {
        currentMap[c.id] = c.unreadCount || 0;
      });

      if (!initialLoadRef.current) {
        // Find conversation with newly incremented unread count
        for (const c of updatedList) {
          const prevCount = prevUnreadMapRef.current[c.id] || 0;
          const currentCount = c.unreadCount || 0;
          if (currentCount > prevCount) {
            // Also re-include in notifications if previously cleared
            setClearedConversationIds((prev) => prev.filter((id) => id !== c.id));

            setActiveToast({
              id: `${c.id}-${Date.now()}`,
              conversationId: c.id,
              senderName: c.participant.name,
              count: currentCount,
            });
            break;
          }
        }
      } else {
        initialLoadRef.current = false;
      }
      prevUnreadMapRef.current = currentMap;

      // Auto-select conversation if none selected or if active one was removed
      setActiveConversationId((prevId) => {
        if (prevId && updatedList.some((c) => c.id === prevId)) {
          return prevId;
        }
        // If on small screen / mobile and user hasn't selected a chat, keep list view
        if (typeof window !== 'undefined' && window.innerWidth < 768 && prevId === '') {
          return '';
        }
        return updatedList[0]?.id || '';
      });
    });

    return () => unsubscribe();
  }, [effectiveViewerEmail, user?.email, user?.displayName, user?.photoURL]);

  // Auto-dismiss toast notification after 2.5 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 2500);
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

  // Mark messages as read when active conversation changes
  useEffect(() => {
    if (activeConversationId && effectiveViewerEmail) {
      chatService.markAsRead(activeConversationId, effectiveViewerEmail);
    }
  }, [activeConversationId, effectiveViewerEmail]);

  // Global Escape key listener: Close active chat conversation and return to Orqland empty state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // Don't close chat if a modal dialog is currently open
      if (
        isStartChatModalOpen ||
        isEndModalOpen ||
        isDeleteModalOpen
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
    if (user?.email) {
      chatService.markAsRead(id, user.email);
    }
  };

  // Delete Chat (Business only - clears business conversation history; connection and client view remain active)
  const handleDeleteChat = async (conversationId: string) => {
    if (!user?.email || !isBusiness) return;
    try {
      await chatService.deleteChat(conversationId, user.email);
    } catch (err) {
      console.error('Delete chat error:', err);
    }
  };

  // Delete individual message (Business only - clears message from business view)
  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConversation || !user?.email || !isBusiness) return;
    try {
      await chatService.deleteMessage(activeConversation.id, messageId, user.email);
    } catch (err) {
      console.error('Delete message error:', err);
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
  const handleReopenChat = async (conversationId: string) => {
    if (!user?.email || isBusiness) return;
    try {
      await chatService.reopenChat(conversationId, user.email);
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

    const created = await chatService.initiateChat({
      clientEmail,
      clientName: currentClientUser.name,
      clientAvatar: currentClientUser.avatar,
      businessEmail: data.businessEmail.trim().toLowerCase(),
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
      {/* Dynamic Top Navigation Bar: Client vs Business (Edge to Edge) */}
      <div className="flex-shrink-0 w-full bg-white">
        {activeViewMode === 'client' ? (
          <ClientTopBar
            user={currentClientUser}
            activeNavTab={activeNavTab}
            onNavTabChange={setActiveNavTab}
            notifications={notificationsList}
            onSelectNotification={handleSelectConversation}
            onClearNotifications={handleClearAllNotifications}
          />
        ) : (
          <BusinessTopBar
            business={currentBusinessUser}
            unreadCount={notificationsList.length}
            notifications={notificationsList}
            onSelectNotification={handleSelectConversation}
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
          onOpenStartChat={!isBusiness || activeViewMode === 'client' ? () => setIsStartChatModalOpen(true) : undefined}
          onDeleteConversation={
            isBusiness
              ? (id) => {
                  setDeletingConversationId(id);
                  setIsDeleteModalOpen(true);
                }
              : undefined
          }
          className={`${activeConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] lg:w-[380px] xl:w-[420px] 2xl:w-[440px] flex-shrink-0`}
        />

        {/* Center: Active Chat Conversation or Clean Role-Specific Empty State */}
        {activeConversation ? (
          <ChatConversation
            conversation={activeConversation}
            currentUserEmail={effectiveViewerEmail}
            onSendMessage={handleSendMessage}
            onDeleteChat={isBusiness ? handleDeleteChat : undefined}
            onEndChat={!isBusiness ? handleEndChat : undefined}
            onReopenChat={!isBusiness ? handleReopenChat : undefined}
            onDeleteMessage={isBusiness ? handleDeleteMessage : undefined}
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
              Select a conversation to begin
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
                onDeleteChat={isBusiness ? () => setIsDeleteModalOpen(true) : undefined}
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
                  onDeleteChat={isBusiness ? () => setIsDeleteModalOpen(true) : undefined}
                  onClose={() => setShowDetailsSidebar(false)}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Top Animated Toast Notification (2.5s duration) */}
      {activeToast && (
        <ToastNotification
          senderName={activeToast.senderName}
          count={activeToast.count}
          onOpen={() => {
            handleSelectConversation(activeToast.conversationId);
            setActiveToast(null);
          }}
          onDismiss={() => setActiveToast(null)}
        />
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

      {/* Delete Chat Modal (Business Only - via List, Header or Sidebar) */}
      {isBusiness && (deletingConversationId || activeConversation) && (
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
            'Client'
          }
        />
      )}
    </main>
  );
}
