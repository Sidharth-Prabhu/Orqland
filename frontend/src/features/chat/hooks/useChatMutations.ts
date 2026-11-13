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
import { upsertMessage } from '@/lib/messageState';
import {
  graphqlRequest,
  sanitizeAttachmentForGql,
  SEND_MESSAGE_MUTATION,
  EDIT_CHAT_MESSAGE_MUTATION,
  DELETE_CHAT_MESSAGE_MUTATION,
  END_CONVERSATION_MUTATION,
  REOPEN_CONVERSATION_MUTATION,
  DELETE_CONVERSATION_VIEW_MUTATION,
  MARK_CONVERSATION_READ_MUTATION,
} from '@/lib/graphql/client';

export function useChatMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const sendMessageMutation = useMutation({
    mutationFn: async (dto: SendMessageDto) => {
      const input: Record<string, any> = {
        conversationId: dto.conversationId,
        content: dto.content || '',
      };
      if (dto.idempotencyKey) input.idempotencyKey = dto.idempotencyKey;
      if (dto.attachment) input.attachment = sanitizeAttachmentForGql(dto.attachment);
      if (dto.attachments?.length) {
        input.attachments = dto.attachments.map(sanitizeAttachmentForGql);
      }
      const data = await graphqlRequest<{ sendMessage: ChatMessage }>(
        SEND_MESSAGE_MUTATION,
        { input }
      );
      return data.sendMessage;
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
        content: dto.content || '',
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
          messages: upsertMessage(previousMessages.messages, optimisticMessage),
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
            messages: upsertMessage(old.messages, savedMessage, context?.tempId),
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
      const data = await graphqlRequest<{ editChatMessage: ChatMessage }>(
        EDIT_CHAT_MESSAGE_MUTATION,
        {
          input: {
            conversationId: dto.conversationId,
            messageId: dto.messageId,
            content: dto.content,
          },
        }
      );
      return data.editChatMessage;
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
      const data = await graphqlRequest<{ deleteChatMessage: ChatMessage }>(
        DELETE_CHAT_MESSAGE_MUTATION,
        {
          input: {
            conversationId: dto.conversationId,
            messageId: dto.messageId,
          },
        }
      );
      return data.deleteChatMessage;
    },
    onSuccess: (deleted) => {
      queryClient.setQueryData<PaginatedMessagesResponseDto>(
        ['messages', deleted.conversationId],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: old.messages.filter((m) => m.id !== deleted.id),
          };
        }
      );
    },
  });

  const endConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const data = await graphqlRequest<{ endConversation: Conversation }>(
        END_CONVERSATION_MUTATION,
        { id: conversationId }
      );
      return data.endConversation;
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
      const data = await graphqlRequest<{ reopenConversation: Conversation }>(
        REOPEN_CONVERSATION_MUTATION,
        {
          id: conversationId,
          ...(dto?.workspaceName ? { input: { workspaceName: dto.workspaceName } } : {}),
        }
      );
      return data.reopenConversation;
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
      const data = await graphqlRequest<{ deleteConversationView: Conversation }>(
        DELETE_CONVERSATION_VIEW_MUTATION,
        { id: conversationId }
      );
      return data.deleteConversationView;
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
      await graphqlRequest<{ markConversationRead: boolean }>(
        MARK_CONVERSATION_READ_MUTATION,
        { id: conversationId }
      );
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
