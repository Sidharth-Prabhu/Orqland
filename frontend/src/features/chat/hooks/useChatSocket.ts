'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getChatSocket } from '@/lib/socket/client';
import { useAuth } from '@/context/AuthContext';
import {
  CHAT_EVENTS,
  ChatMessage,
  Conversation,
  PaginatedMessagesResponseDto,
} from '@orqland/contracts';
import { isPageInBackground, sendBrowserNotification } from '@/lib/browserNotifications';

export function useChatSocket(activeConversationId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  useEffect(() => {
    let token = '';
    let isSubscribed = true;

    async function initSocket() {
      if (user) {
        token = await user.getIdToken().catch(() => '');
      }

      const socket = getChatSocket(token, user?.email || undefined);

      socket.on('connect', () => {
        if (isSubscribed) setIsConnected(true);
      });

      socket.on('disconnect', () => {
        if (isSubscribed) setIsConnected(false);
      });

      // Handle incoming messages
      const handleMessageNew = (newMsg: ChatMessage) => {
        const isFromMe = newMsg.senderEmail === user?.email || newMsg.senderId === user?.uid;
        const msgWithMe: ChatMessage = {
          ...newMsg,
          isMe: isFromMe,
        };

        // Append to messages cache
        queryClient.setQueryData<PaginatedMessagesResponseDto>(
          ['messages', newMsg.conversationId],
          (old) => {
            if (!old) return { messages: [msgWithMe], hasMore: false };
            const exists = old.messages.some(
              (m) =>
                m.id === newMsg.id ||
                (m.idempotencyKey && m.idempotencyKey === newMsg.idempotencyKey)
            );
            if (exists) {
              return {
                ...old,
                messages: old.messages.map((m) =>
                  m.id === newMsg.id || (m.idempotencyKey && m.idempotencyKey === newMsg.idempotencyKey)
                    ? msgWithMe
                    : m
                ),
              };
            }
            return {
              ...old,
              messages: [...old.messages, msgWithMe],
            };
          }
        );

        // Update conversation last message in conversations list
        queryClient.setQueryData<Conversation[]>(['conversations', user?.email], (old) => {
          if (!old) return [];
          return old.map((c) =>
            c.id === newMsg.conversationId
              ? {
                  ...c,
                  lastMessage: newMsg.content,
                  lastMessageTime: newMsg.timestamp,
                  lastMessageTimestamp: newMsg.createdAt,
                  unreadCount:
                    c.id === activeConversationId || isFromMe ? 0 : (c.unreadCount || 0) + 1,
                }
              : c
          );
        });

        // Trigger system desktop push notification if tab/browser is minimized or in background
        if (!isFromMe && isPageInBackground()) {
          sendBrowserNotification({
            title: newMsg.senderName || 'New Message',
            body: newMsg.content || (newMsg.attachments?.length ? 'Sent an attachment' : 'Sent you a message'),
            icon: newMsg.senderAvatar || '/favicon.ico',
            tag: `chat-${newMsg.conversationId}`,
            conversationId: newMsg.conversationId,
          });
        }
      };

      // Handle typing events
      const handleTypingUpdate = (data: { conversationId: string; userId: string; userName: string; isTyping: boolean }) => {
        if (data.conversationId === activeConversationId && data.userName !== user?.displayName) {
          setTypingUser(data.isTyping ? data.userName : null);
        }
      };

      // Handle presence updates
      const handlePresenceUpdate = (data: { userId: string; userEmail: string; isOnline: boolean }) => {
        queryClient.setQueryData<Conversation[]>(['conversations', user?.email], (old) => {
          if (!old) return [];
          return old.map((c) => {
            if (
              c.participant.email?.toLowerCase() === data.userEmail?.toLowerCase() ||
              c.participant.id === data.userId
            ) {
              return {
                ...c,
                participant: {
                  ...c.participant,
                  isOnline: data.isOnline,
                },
              };
            }
            return c;
          });
        });
      };

      socket.on(CHAT_EVENTS.MESSAGE_NEW, handleMessageNew);
      socket.on(CHAT_EVENTS.TYPING_UPDATE, handleTypingUpdate);
      socket.on(CHAT_EVENTS.PRESENCE_UPDATE, handlePresenceUpdate);

      // Join the active conversation room
      if (activeConversationId) {
        socket.emit(CHAT_EVENTS.CONVERSATION_JOIN, { conversationId: activeConversationId });
      }

      setIsConnected(socket.connected);

      return () => {
        if (activeConversationId && socket.connected) {
          socket.emit(CHAT_EVENTS.CONVERSATION_LEAVE, { conversationId: activeConversationId });
        }
        socket.off(CHAT_EVENTS.MESSAGE_NEW, handleMessageNew);
        socket.off(CHAT_EVENTS.TYPING_UPDATE, handleTypingUpdate);
        socket.off(CHAT_EVENTS.PRESENCE_UPDATE, handlePresenceUpdate);
      };
    }

    let cleanupPromise: Promise<(() => void) | undefined> | undefined = initSocket();

    return () => {
      isSubscribed = false;
      cleanupPromise?.then((cleanup) => cleanup?.());
    };
  }, [activeConversationId, user, queryClient]);

  const emitTyping = (isTyping: boolean) => {
    if (!activeConversationId) return;
    const socket = getChatSocket();
    if (socket.connected) {
      socket.emit(isTyping ? CHAT_EVENTS.TYPING_START : CHAT_EVENTS.TYPING_STOP, {
        conversationId: activeConversationId,
      });
    }
  };

  return {
    isConnected,
    typingUser,
    emitTyping,
  };
}
