'use client';

import { useQuery } from '@tanstack/react-query';
import { PaginatedMessagesResponseDto } from '@orqland/contracts';
import { useAuth } from '@/context/AuthContext';
import { graphqlRequest, CHAT_MESSAGES_QUERY } from '@/lib/graphql/client';

export function useMessagesQuery(conversationId: string | null, cursor?: string) {
  const { user } = useAuth();

  return useQuery<PaginatedMessagesResponseDto>({
    queryKey: cursor ? ['messages', conversationId, cursor] : ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) {
        return { messages: [], hasMore: false };
      }

      const data = await graphqlRequest<{ chatMessages: PaginatedMessagesResponseDto }>(
        CHAT_MESSAGES_QUERY,
        { conversationId, limit: 100, ...(cursor ? { cursor } : {}) }
      );
      const res = data.chatMessages;
      return {
        messages: res?.messages || [],
        hasMore: Boolean(res?.hasMore),
        nextCursor: res?.nextCursor,
      };
    },
    enabled: !!conversationId && !!user,
  });
}
