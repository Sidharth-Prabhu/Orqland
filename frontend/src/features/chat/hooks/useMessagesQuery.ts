'use client';

import { useQuery } from '@tanstack/react-query';
import { ChatMessage, PaginatedMessagesResponseDto } from '@orqland/contracts';
import { useAuth } from '@/context/AuthContext';

export function useMessagesQuery(conversationId: string | null) {
  const { user } = useAuth();

  return useQuery<PaginatedMessagesResponseDto>({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) {
        return { messages: [], hasMore: false };
      }

      const token = user ? await user.getIdToken().catch(() => '') : '';
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (user?.email) {
        headers['X-User-Email'] = user.email;
      }

      const res = await fetch(`/api/chat/messages?conversationId=${conversationId}&limit=100`, {
        headers,
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch messages: ${res.statusText}`);
      }
      const json = await res.json();
      return {
        messages: json.messages || json.items || [],
        hasMore: Boolean(json.hasMore),
        nextCursor: json.nextCursor,
      };
    },
    enabled: !!conversationId && !!user,
  });
}
