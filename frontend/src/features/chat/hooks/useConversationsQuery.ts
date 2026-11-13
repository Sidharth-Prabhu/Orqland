'use client';

import { useQuery } from '@tanstack/react-query';
import { Conversation } from '@orqland/contracts';
import { useAuth } from '@/context/AuthContext';
import { graphqlRequest, MY_CHAT_CONVERSATIONS_QUERY } from '@/lib/graphql/client';

export function useConversationsQuery(orqspaceId?: string) {
  const { user } = useAuth();

  return useQuery<Conversation[]>({
    queryKey: orqspaceId ? ['conversations', user?.email, orqspaceId] : ['conversations', user?.email],
    queryFn: async () => {
      const data = await graphqlRequest<{ myChatConversations: Conversation[] }>(
        MY_CHAT_CONVERSATIONS_QUERY,
        orqspaceId ? { orqspaceId } : undefined
      );
      return data.myChatConversations || [];
    },
    enabled: !!user,
  });
}
