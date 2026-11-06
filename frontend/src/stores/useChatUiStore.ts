import { create } from 'zustand';

export interface MediaViewerItem {
  url: string;
  name?: string;
  type?: string;
}

interface ChatUiState {
  // Active conversation selection
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;

  // Search query
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Media Viewer modal state (Whatsapp-style arrow navigation & Esc dismissal)
  isMediaViewerOpen: boolean;
  mediaViewerItems: MediaViewerItem[];
  mediaViewerIndex: number;
  openMediaViewer: (items: MediaViewerItem[], index?: number) => void;
  closeMediaViewer: () => void;
  nextMedia: () => void;
  prevMedia: () => void;

  // Drafts per conversation
  drafts: Record<string, string>;
  setDraft: (conversationId: string, text: string) => void;
  clearDraft: (conversationId: string) => void;

  // Transient modals
  isBusinessModalOpen: boolean;
  setIsBusinessModalOpen: (open: boolean) => void;
  isAttachMenuOpen: boolean;
  setIsAttachMenuOpen: (open: boolean) => void;
}

export const useChatUiStore = create<ChatUiState>((set) => ({
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id }),

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  isMediaViewerOpen: false,
  mediaViewerItems: [],
  mediaViewerIndex: 0,
  openMediaViewer: (items, index = 0) =>
    set({
      isMediaViewerOpen: true,
      mediaViewerItems: items,
      mediaViewerIndex: Math.max(0, Math.min(index, items.length - 1)),
    }),
  closeMediaViewer: () =>
    set({
      isMediaViewerOpen: false,
      mediaViewerItems: [],
      mediaViewerIndex: 0,
    }),
  nextMedia: () =>
    set((state) => ({
      mediaViewerIndex:
        state.mediaViewerIndex < state.mediaViewerItems.length - 1
          ? state.mediaViewerIndex + 1
          : state.mediaViewerIndex,
    })),
  prevMedia: () =>
    set((state) => ({
      mediaViewerIndex:
        state.mediaViewerIndex > 0 ? state.mediaViewerIndex - 1 : 0,
    })),

  drafts: {},
  setDraft: (convId, text) =>
    set((state) => ({
      drafts: { ...state.drafts, [convId]: text },
    })),
  clearDraft: (convId) =>
    set((state) => {
      const next = { ...state.drafts };
      delete next[convId];
      return { drafts: next };
    }),

  isBusinessModalOpen: false,
  setIsBusinessModalOpen: (open) => set({ isBusinessModalOpen: open }),
  isAttachMenuOpen: false,
  setIsAttachMenuOpen: (open) => set({ isAttachMenuOpen: open }),
}));
