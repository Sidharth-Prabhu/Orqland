'use client';

import { useQuery } from '@tanstack/react-query';
import { Conversation } from '@orqland/contracts';
import { useAuth } from '@/context/AuthContext';

export function useConversationsQuery() {
  const { user } = useAuth();

  return useQuery<Conversation[]>({
    queryKey: ['conversations', user?.email],
    queryFn: async () => {
      const token = user ? await user.getIdToken().catch(() => '') : '';
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (user?.email) {
        headers['X-User-Email'] = user.email;
      }

      const res = await fetch('/api/chat/conversations', { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch conversations: ${res.statusText}`);
      }
      const json = await res.json();
      return json.data || json.conversations || [];
    },
    enabled: !!user,
  });
}
