'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChatMessage,
  SendMessageDto,
  EditMessageDto,
  DeleteMessageDto,
  ReopenConversationDto,
  Conversation,
  PaginatedMessagesResponseDto,
} from '@orqland/contracts';
import { useAuth } from '@/context/AuthContext';

export function useChatMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const getHeaders = async () => {
    const token = user ? await user.getIdToken().catch(() => '') : '';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (user?.email) {
      headers['X-User-Email'] = user.email;
    }
    return headers;
  };

  const sendMessageMutation = useMutation({
    mutationFn: async (dto: SendMessageDto) => {
      const headers = await getHeaders();
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to send message');
      }

      const json = await res.json();
      return json.data as ChatMessage;
    },
    onMutate: async (dto) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['messages', dto.conversationId] });
      const previousMessages = queryClient.getQueryData<PaginatedMessagesResponseDto>([
        'messages',
        dto.conversationId,
      ]);

      const now = Date.now();
      const tempId = dto.idempotencyKey || `temp-${now}`;
      const optimisticMessage: ChatMessage = {
        id: tempId,
        conversationId: dto.conversationId,
        senderId: user?.uid || 'temp-sender',
        senderEmail: user?.email || '',
        senderName: user?.displayName || user?.email?.split('@')[0] || 'User',
        senderAvatar: user?.photoURL || '',
        content: dto.content || (dto.attachments?.length ? 'Sent an attachment' : ''),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: 'Today',
        createdAt: now,
        idempotencyKey: dto.idempotencyKey,
        isMe: true,
        status: 'sending',
        attachment: dto.attachment as any,
        attachments: dto.attachments as any,
      };

      if (previousMessages) {
        queryClient.setQueryData<PaginatedMessagesResponseDto>(['messages', dto.conversationId], {
          ...previousMessages,
          messages: [...previousMessages.messages, optimisticMessage],
        });
      }

      return { previousMessages, tempId };
    },
    onError: (err, dto, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', dto.conversationId], context.previousMessages);
      }
    },
    onSuccess: (savedMessage, dto, context) => {
      queryClient.setQueryData<PaginatedMessagesResponseDto>(
        ['messages', dto.conversationId],
        (old) => {
          if (!old) return { messages: [savedMessage], hasMore: false };
          return {
            ...old,
            messages: old.messages.map((m) =>
              m.id === context?.tempId || m.idempotencyKey === savedMessage.idempotencyKey
                ? savedMessage
                : m
            ),
          };
        }
      );

      // Update conversation summary
      queryClient.setQueryData<Conversation[]>(['conversations', user?.email], (old) => {
        if (!old) return [];
        return old.map((c) =>
          c.id === dto.conversationId
            ? {
                ...c,
                lastMessage: savedMessage.content,
                lastMessageTime: savedMessage.timestamp,
                lastMessageTimestamp: savedMessage.createdAt,
              }
            : c
        );
      });
    },
  });

  const editMessageMutation = useMutation({
    mutationFn: async (dto: EditMessageDto) => {
      const headers = await getHeaders();
      const res = await fetch(`/api/chat/messages/${dto.messageId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(dto),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to edit message');
      }

      const json = await res.json();
      return json.data as ChatMessage;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<PaginatedMessagesResponseDto>(
        ['messages', updated.conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((m) => (m.id === updated.id ? updated : m)),
          };
        }
      );
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (dto: DeleteMessageDto) => {
      const headers = await getHeaders();
      const res = await fetch(`/api/chat/messages/${dto.messageId}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify(dto),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete message');
      }

      const json = await res.json();
      return json.data as ChatMessage;
    },
    onSuccess: (deleted) => {
      queryClient.setQueryData<PaginatedMessagesResponseDto>(
        ['messages', deleted.conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.map((m) =>
              m.id === deleted.id
                ? { ...m, content: 'This message was deleted', deletedForEveryone: true }
                : m
            ),
          };
        }
      );
    },
  });

  const endConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const headers = await getHeaders();
      const res = await fetch(`/api/chat/conversations/${conversationId}/end`, {
        method: 'POST',
        headers,
      });

      if (!res.ok) {
        throw new Error('Failed to end conversation');
      }
      const json = await res.json();
      return json.data as Conversation;
    },
    onSuccess: (updatedConv) => {
      queryClient.setQueryData<Conversation[]>(['conversations', user?.email], (old) => {
        if (!old) return [updatedConv];
        return old.map((c) => (c.id === updatedConv.id ? updatedConv : c));
      });
    },
  });

  const reopenConversationMutation = useMutation({
    mutationFn: async ({
      conversationId,
      dto,
    }: {
      conversationId: string;
      dto: ReopenConversationDto;
    }) => {
      const headers = await getHeaders();
      const res = await fetch(`/api/chat/conversations/${conversationId}/reopen`, {
        method: 'POST',
        headers,
        body: JSON.stringify(dto),
      });

      if (!res.ok) {
        throw new Error('Failed to reopen conversation');
      }
      const json = await res.json();
      return json.data as Conversation;
    },
    onSuccess: (updatedConv) => {
      queryClient.setQueryData<Conversation[]>(['conversations', user?.email], (old) => {
        if (!old) return [updatedConv];
        return old.map((c) => (c.id === updatedConv.id ? updatedConv : c));
      });
    },
  });

  const deleteChatViewMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const headers = await getHeaders();
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        throw new Error('Failed to delete chat view');
      }
      const json = await res.json();
      return json.data as Conversation;
    },
    onSuccess: (updatedConv, conversationId) => {
      queryClient.setQueryData<PaginatedMessagesResponseDto>(
        ['messages', conversationId],
        { messages: [], hasMore: false }
      );
      queryClient.invalidateQueries({ queryKey: ['conversations', user?.email] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const headers = await getHeaders();
      await fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: 'POST',
        headers,
      });
    },
    onSuccess: (_, conversationId) => {
      queryClient.setQueryData<Conversation[]>(['conversations', user?.email], (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c));
      });
    },
  });

  return {
    sendMessage: sendMessageMutation.mutateAsync,
    isSending: sendMessageMutation.isPending,
    editMessage: editMessageMutation.mutateAsync,
    deleteMessage: deleteMessageMutation.mutateAsync,
    endConversation: endConversationMutation.mutateAsync,
    reopenConversation: reopenConversationMutation.mutateAsync,
    deleteChatView: deleteChatViewMutation.mutateAsync,
    markAsRead: markReadMutation.mutateAsync,
  };
}
