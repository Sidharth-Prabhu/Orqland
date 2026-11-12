'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, MessageSquare, Plus, Lock, Trash2, X, ExternalLink, Copy, Check } from 'lucide-react';
import { Conversation, UserProfile } from '@/types/chat';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface DirectMessagesListProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  isBusiness: boolean;
  businessProfile?: UserProfile;
  onOpenStartChat?: () => void;
  onDeleteConversation?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const DirectMessagesList: React.FC<DirectMessagesListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  isBusiness,
  businessProfile,
  onOpenStartChat,
  onDeleteConversation,
  className = '',
  style,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [wsidCopied, setWsidCopied] = useState(false);
  const [businessStatus, setBusinessStatus] = useState<'Closed' | 'Open'>(
    businessProfile?.businessStatus || 'Open'
  );
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleCopyWsid = (e: React.MouseEvent) => {
    e.stopPropagation();
    const wsid = businessProfile?.wsid || 'WS#ENOJEXBC#';
    navigator.clipboard.writeText(wsid);
    setWsidCopied(true);
    setTimeout(() => setWsidCopied(false), 2000);
  };

  const handleToggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusinessStatus((prev) => (prev === 'Closed' ? 'Open' : 'Closed'));
  };

  // Global shortcut: ⌘ K / Ctrl+K focuses the search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter conversations by search query
  const filteredConversations = conversations.filter((conv) => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchName = conv.participant.name.toLowerCase().includes(query);
      const matchEmail = conv.participant.email?.toLowerCase().includes(query);
      const matchWorkspace = conv.workspaceInfo?.name?.toLowerCase().includes(query);
      const matchLastMsg = conv.lastMessage?.toLowerCase().includes(query);
      return matchName || matchEmail || matchWorkspace || matchLastMsg;
    }

    return true;
  });

  return (
    <aside
      style={style}
      className={`w-full flex-shrink-0 border-r border-gray-200/80 bg-[#fbfbfd] flex flex-col h-full select-none relative ${className}`}
    >
      {/* Decorative Wave Background on the Sidebar Bottom */}
      <div className="absolute inset-x-0 bottom-0 top-1/2 sidebar-wave-gradient pointer-events-none z-0 opacity-80" />

      {/* Top Header & Search Input */}
      <div className="p-3.5 sm:p-4 pb-3 border-b border-gray-100/90 space-y-3 relative z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-bold text-gray-800 tracking-wider uppercase">
            Direct Messages
          </h2>
          {onOpenStartChat && (
            <button
              onClick={onOpenStartChat}
              className="flex items-center gap-1 px-2.5 py-1 bg-black hover:bg-gray-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Start conversation with a business"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>New</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center">
          <div className="w-full flex items-center gap-2 bg-[#f0f1f5]/80 hover:bg-[#eaecee] focus-within:bg-white border border-gray-200/60 focus-within:border-indigo-400 rounded-lg px-3 py-1.5 transition-all shadow-2xs">
            <Search size={14} className="text-gray-400 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-gray-800 placeholder-gray-400 focus:outline-none min-w-0"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            ) : (
              <span className="flex-shrink-0 text-[10px] font-medium text-gray-400 select-none tracking-tight">
                ⌘ K
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 relative z-10">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-52 text-gray-400">
            <MessageSquare size={28} className="text-gray-300 mb-2 stroke-[1.5]" />
            <p className="text-xs font-bold text-gray-700">No conversations found</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[210px] leading-relaxed">
              {searchQuery
                ? 'No conversations match your search.'
                : !isBusiness
                ? 'Click "New" above to search for a business and start a conversation.'
                : 'Waiting for clients to initiate conversations with your business.'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEnded = conv.status === 'ended';

            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`group relative flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[#ebedf7]/90 shadow-2xs'
                    : 'hover:bg-white/70'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0 mt-0.5">
                  <UserAvatar
                    src={conv.participant.avatar}
                    name={conv.participant.name}
                    size={38}
                  />
                </div>

                {/* Contact Info and Message Preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="text-[13px] font-bold text-gray-900 truncate block">
                      {conv.participant.name}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] text-gray-400 font-normal">
                        {conv.lastMessageTime}
                      </span>
                      {/* Clear this chat separately button (Business & Client) */}
                      {onDeleteConversation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-amber-700 hover:bg-amber-100/70 rounded transition-all cursor-pointer"
                          title={`Clear chat with ${conv.participant.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[11px] line-clamp-1 leading-relaxed text-gray-400 font-normal min-w-0 flex-1">
                      {conv.workspaceInfo?.name || conv.bookingInfo?.serviceName || 'Technical Architecture'}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
                      {isEnded && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded border border-gray-200/60 leading-none">
                          <Lock size={8.5} />
                          <span>Ended</span>
                        </span>
                      )}
                      {!isActive && (conv.unreadCount || 0) > 0 && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50/90 border border-blue-200/60 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse-dot" />
                          <span className="text-[10px] font-bold text-blue-700 tracking-tight leading-none">
                            New Message
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Business Workspace Footer Bar (Bottom Left Sidebar for Business Users) */}
      {isBusiness && (
        <div className="border-t border-gray-200/70 bg-[#fafafc]/95 backdrop-blur-xs p-3 flex items-center justify-between gap-2 flex-shrink-0 relative z-10">
          <div className="flex-1 min-w-0">
            <h4 className="text-[12px] font-bold text-gray-900 truncate leading-tight">
              {businessProfile?.name || "Sidharth Prabhu's Workspace"}
            </h4>
            <div className="flex items-center gap-1.5 mt-1">
              {/* WSID Pill */}
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-200/90 rounded text-[10px] font-semibold text-gray-700 shadow-2xs">
                <span>WSID: {businessProfile?.wsid || 'WS#ENOJEXBC#'}</span>
                <ExternalLink size={9} className="text-gray-400" />
                <button
                  type="button"
                  onClick={handleCopyWsid}
                  className="ml-0.5 text-gray-400 hover:text-black transition-colors cursor-pointer"
                  title={wsidCopied ? 'Copied!' : 'Copy WSID'}
                >
                  {wsidCopied ? (
                    <Check size={10} className="text-green-600" />
                  ) : (
                    <Copy size={10} />
                  )}
                </button>
              </div>

              {/* Status Toggle Pill */}
              <button
                type="button"
                onClick={handleToggleStatus}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-200/90 rounded text-[10px] font-medium text-gray-700 shadow-2xs hover:bg-gray-50 transition-colors cursor-pointer"
                title="Click to toggle status"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    businessStatus === 'Closed' ? 'bg-[#ef4444]' : 'bg-[#22c55e]'
                  }`}
                />
                <span>{businessStatus}</span>
              </button>
            </div>
          </div>

          {/* Business Avatar Icon */}
          <div className="relative flex-shrink-0">
            <UserAvatar
              src={businessProfile?.avatar}
              name={businessProfile?.name || 'S'}
              size={32}
            />
          </div>
        </div>
      )}
    </aside>
  );
};
