'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClientTopBar } from '@/components/ClientTopBar';
import { BusinessTopBar } from '@/components/BusinessTopBar';
import { DirectMessagesList } from '@/components/DirectMessagesList';
import { ChatConversation } from '@/components/ChatConversation';
import { DetailsSidebar } from '@/components/DetailsSidebar';
import { StartChatModal } from '@/components/chat/StartChatModal';
import { useAuth } from '@/context/AuthContext';
import { chatService } from '@/lib/chatService';
import { BUSINESS_EMAIL } from '@/lib/constants';
import { isBusinessUser } from '@/lib/security';
import { Conversation, UserProfile, ChatAttachment } from '@/types/chat';
import { User, Building2, MessageSquarePlus, MessageSquare, ShieldCheck } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Role verification: only mailtosidharth.me@gmail.com is the business; all other emails are clients
  const isBusiness = isBusinessUser(user?.email);

  // Business can switch perspectives (defaulting to 'business'); clients are strictly restricted to 'client'
  const [businessViewMode, setBusinessViewMode] = useState<'client' | 'business'>('business');
  const activeViewMode: 'client' | 'business' = isBusiness ? businessViewMode : 'client';

  const [activeNavTab, setActiveNavTab] = useState('Inbox');

  // Real-time conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [isStartChatModalOpen, setIsStartChatModalOpen] = useState(false);

  // Redirect unauthenticated users to /login immediately
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Subscribe to real-time conversation store updates and sync user profile
  useEffect(() => {
    if (!user?.email) return;

    // Sync current logged-in user profile with real Google photo & display name
    chatService.syncUserProfile(user.email, user.displayName, user.photoURL);

    const unsubscribe = chatService.subscribe(user.email, (updatedList) => {
      setConversations(updatedList);

      // Auto-select conversation if none selected or if active one was removed
      setActiveConversationId((prevId) => {
        if (prevId && updatedList.some((c) => c.id === prevId)) {
          return prevId;
        }
        return updatedList[0]?.id || '';
      });
    });

    return () => unsubscribe();
  }, [user?.email, user?.displayName, user?.photoURL]);

  // Mark messages as read when active conversation changes
  useEffect(() => {
    if (activeConversationId && user?.email) {
      chatService.markAsRead(activeConversationId, user.email);
    }
  }, [activeConversationId, user?.email]);

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

  // Active conversation object
  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) ||
    conversations[0];

  // Send a message in active conversation
  const handleSendMessage = async (text: string, attachment?: ChatAttachment) => {
    if (!activeConversation || !user?.email) return;

    const isClient = activeViewMode === 'client';
    const sender = isClient ? currentClientUser : currentBusinessUser;

    try {
      await chatService.sendMessage({
        conversationId: activeConversation.id,
        senderEmail: user.email,
        senderName: sender.name,
        senderAvatar: sender.avatar,
        content: text,
        attachment,
      });
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
    }
  };

  const handleSelectConversation = (id: string) => {
    setActiveConversationId(id);
    if (user?.email) {
      chatService.markAsRead(id, user.email);
    }
  };

  // Delete Chat (Business only - clears business view only)
  const handleDeleteChat = async (conversationId: string) => {
    if (!user?.email || !isBusiness) return;
    try {
      await chatService.deleteChat(conversationId, user.email);
      setActiveConversationId((prev) => (prev === conversationId ? '' : prev));
    } catch (err) {
      console.error('Delete chat error:', err);
    }
  };

  // End Chat (Business only - closes connection and clears client history)
  const handleEndChat = async (conversationId: string) => {
    if (!user?.email || !isBusiness) return;
    try {
      await chatService.endChat(conversationId, user.email);
    } catch (err) {
      console.error('End chat error:', err);
    }
  };

  // Initiate Chat (Business only)
  const handleInitiateChat = async (data: {
    clientEmail: string;
    clientName: string;
    workspaceName: string;
    initialMessage: string;
  }) => {
    if (!user?.email || !isBusiness) return;

    const created = await chatService.initiateChat({
      businessEmail: user.email,
      businessName: currentBusinessUser.name,
      businessAvatar: currentBusinessUser.avatar,
      clientEmail: data.clientEmail.trim().toLowerCase(),
      clientName: data.clientName,
      workspaceName: data.workspaceName,
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
          />
        ) : (
          <BusinessTopBar
            business={currentBusinessUser}
            unreadCount={0}
          />
        )}
      </div>

      {/* 3-Column Chat Application Body (Edge to Edge Full Screen) */}
      <div className="flex-1 flex overflow-hidden w-full bg-white">
        {/* Left: Direct Messages List */}
        <DirectMessagesList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          isBusiness={isBusiness}
          onOpenStartChat={isBusiness ? () => setIsStartChatModalOpen(true) : undefined}
        />

        {/* Center: Active Chat Conversation or Clean Role-Specific Empty State */}
        {activeConversation ? (
          <ChatConversation
            conversation={activeConversation}
            currentUserEmail={user.email || ''}
            onSendMessage={handleSendMessage}
            onDeleteChat={isBusiness ? handleDeleteChat : undefined}
            onEndChat={isBusiness ? handleEndChat : undefined}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#fafafa]">
            <div className="w-16 h-16 rounded-3xl bg-white shadow-sm border border-gray-200/80 flex items-center justify-center mb-4 text-blue-600">
              <MessageSquare size={30} />
            </div>

            {isBusiness ? (
              <>
                <h3 className="text-base font-bold text-gray-900">
                  Business Workspace Ready
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mt-1.5 mb-6 leading-relaxed">
                  Only the Business account can initiate conversations with clients. Click below to start communicating with a client.
                </p>
                <button
                  onClick={() => setIsStartChatModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-2xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                >
                  <MessageSquarePlus size={15} />
                  <span>Initiate New Client Conversation</span>
                </button>
              </>
            ) : (
              <>
                <h3 className="text-base font-bold text-gray-900">
                  Waiting for Business Conversation
                </h3>
                <div className="max-w-md mt-2 mb-4 p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900 leading-relaxed text-left flex items-start gap-3">
                  <ShieldCheck size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold mb-0.5">Permission Policy:</strong>
                    Only the business can initiate a chat with a client. Clients must not initiate new conversations or send the first message. Once a conversation is initiated, you will be able to reply here.
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Right: Info & Bookings Sidebar (visible only when a conversation is active) */}
        {activeConversation && (
          <DetailsSidebar
            conversation={activeConversation}
            isBusiness={isBusiness}
          />
        )}
      </div>

      {/* Floating View Switcher: ONLY available to the Business Account. Clients CANNOT view or switch to Business View */}
      {isBusiness && (
        <aside
          aria-label="Perspective Switcher"
          className="fixed bottom-5 right-6 z-40 flex items-center gap-1.5 p-1 bg-white/95 backdrop-blur-md rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-gray-200"
        >
          <button
            onClick={() => setBusinessViewMode('client')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeViewMode === 'client'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <User size={13} strokeWidth={2.5} />
            <span>Client View</span>
          </button>
          <button
            onClick={() => setBusinessViewMode('business')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              activeViewMode === 'business'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-black hover:bg-gray-100'
            }`}
          >
            <Building2 size={13} strokeWidth={2.5} />
            <span>Business View</span>
          </button>
        </aside>
      )}

      {/* Start Chat Modal (Business Only) */}
      {isBusiness && (
        <StartChatModal
          isOpen={isStartChatModalOpen}
          onClose={() => setIsStartChatModalOpen(false)}
          onInitiate={handleInitiateChat}
        />
      )}
    </main>
  );
}
