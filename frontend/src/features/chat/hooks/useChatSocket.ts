'use client';

import { useEffect, useState, useRef } from 'react';
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

interface UseChatSocketOptions {
  onNewMessage?: (msg: ChatMessage) => void;
  onMessageAck?: (ack: { messageId: string; clientGeneratedId?: string; status: string }) => void;
  onMessageEdited?: (data: { messageId: string; conversationId: string; content: string }) => void;
  onMessageDeleted?: (data: { messageId: string; conversationId: string }) => void;
  onMessageReadUpdate?: (data: { conversationId: string; readCount: number }) => void;
  onConversationUpdated?: (data: { conversationId: string; lastMessage: string; lastMessageTime: string }) => void;
}

export function useChatSocket(
  activeConversationId: string | null,
  options?: UseChatSocketOptions
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let token = '';
    let isSubscribed = true;

    async function initSocket() {
      if (user) {
        token = await user.getIdToken().catch(() => '');
      }
      if (!token && user?.email && process.env.NODE_ENV !== 'production') {
        token = `mock-token-${user.email}`;
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

        // Notify page state directly via latest ref
        optionsRef.current?.onNewMessage?.(msgWithMe);

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

      // Handle message acknowledgment (status -> delivered)
      const handleMessageAck = (ack: { clientGeneratedId?: string; messageId: string; status: string }) => {
        optionsRef.current?.onMessageAck?.(ack);

        queryClient.setQueryData<PaginatedMessagesResponseDto>(
          ['messages', activeConversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.map((m) =>
                (ack.clientGeneratedId && (m.id === ack.clientGeneratedId || m.idempotencyKey === ack.clientGeneratedId)) ||
                m.id === ack.messageId
                  ? { ...m, id: ack.messageId, status: 'delivered' as const }
                  : m
              ),
            };
          }
        );
      };

      // Handle message edited
      const handleMessageEdited = (data: { messageId: string; conversationId: string; content: string }) => {
        optionsRef.current?.onMessageEdited?.(data);

        queryClient.setQueryData<PaginatedMessagesResponseDto>(
          ['messages', data.conversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.map((m) =>
                m.id === data.messageId
                  ? { ...m, content: data.content, isEdited: true, editedAt: Date.now() }
                  : m
              ),
            };
          }
        );
      };

      // Handle message deleted
      const handleMessageDeleted = (data: { messageId: string; conversationId: string }) => {
        optionsRef.current?.onMessageDeleted?.(data);

        queryClient.setQueryData<PaginatedMessagesResponseDto>(
          ['messages', data.conversationId],
          (old) => {
            if (!old) return old;
            return {
              ...old,
              messages: old.messages.map((m) =>
                m.id === data.messageId
                  ? { ...m, content: 'This message was deleted.', deletedForEveryone: true }
                  : m
              ),
            };
          }
        );
      };

      // Handle message read update
      const handleMessageReadUpdate = (data: { conversationId: string; readCount: number }) => {
        optionsRef.current?.onMessageReadUpdate?.(data);

        queryClient.setQueryData<Conversation[]>(['conversations', user?.email], (old) => {
          if (!old) return [];
          return old.map((c) =>
            c.id === data.conversationId ? { ...c, unreadCount: 0 } : c
          );
        });
      };

      // Handle conversation summary update
      const handleConversationUpdated = (data: { conversationId: string; lastMessage: string; lastMessageTime: string; lastMessageTimestamp?: number }) => {
        optionsRef.current?.onConversationUpdated?.(data);

        queryClient.setQueryData<Conversation[]>(['conversations', user?.email], (old) => {
          if (!old) return [];
          return old.map((c) =>
            c.id === data.conversationId
              ? {
                  ...c,
                  lastMessage: data.lastMessage,
                  lastMessageTime: data.lastMessageTime,
                  lastMessageTimestamp: data.lastMessageTimestamp || Date.now(),
                }
              : c
          );
        });
      };

      socket.on(CHAT_EVENTS.MESSAGE_NEW, handleMessageNew);
      socket.on(CHAT_EVENTS.MESSAGE_ACK, handleMessageAck);
      socket.on(CHAT_EVENTS.MESSAGE_EDITED, handleMessageEdited);
      socket.on(CHAT_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
      socket.on(CHAT_EVENTS.MESSAGE_READ_UPDATE, handleMessageReadUpdate);
      socket.on(CHAT_EVENTS.CONVERSATION_UPDATED, handleConversationUpdated);
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
        socket.off(CHAT_EVENTS.MESSAGE_ACK, handleMessageAck);
        socket.off(CHAT_EVENTS.MESSAGE_EDITED, handleMessageEdited);
        socket.off(CHAT_EVENTS.MESSAGE_DELETED, handleMessageDeleted);
        socket.off(CHAT_EVENTS.MESSAGE_READ_UPDATE, handleMessageReadUpdate);
        socket.off(CHAT_EVENTS.CONVERSATION_UPDATED, handleConversationUpdated);
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
