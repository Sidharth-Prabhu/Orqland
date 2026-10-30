'use client';

import React, { useState } from 'react';
import { Search, MessageSquare, Plus, Lock, Trash2 } from 'lucide-react';
import { Conversation } from '@/types/chat';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface DirectMessagesListProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  isBusiness: boolean;
  onOpenStartChat?: () => void;
  onDeleteConversation?: (id: string) => void;
}

export const DirectMessagesList: React.FC<DirectMessagesListProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  isBusiness,
  onOpenStartChat,
  onDeleteConversation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = conversations.filter((c) =>
    c.participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-full md:w-[310px] xl:w-[330px] flex-shrink-0 border-r border-gray-200 bg-white flex flex-col h-full select-none">
      {/* Top Header & Search Input */}
      <div className="p-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-extrabold text-[#222222] tracking-wider uppercase">
            Direct Messages
          </h2>
          {isBusiness && onOpenStartChat && (
            <button
              onClick={onOpenStartChat}
              className="flex items-center gap-1 px-2.5 py-1 bg-black hover:bg-gray-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Initiate chat with client"
            >
              <Plus size={13} strokeWidth={2.5} />
              <span>New</span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="relative flex items-center">
          <Search
            size={16}
            className="absolute left-3.5 text-gray-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f1f3f5] hover:bg-[#eaecee] focus:bg-white text-[13px] text-gray-800 placeholder-gray-400 rounded-lg pl-9 pr-4 py-2 border border-transparent focus:border-blue-400 focus:outline-none transition-all shadow-inner"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center h-52 text-gray-400">
            <MessageSquare size={28} className="text-gray-300 mb-2 stroke-[1.5]" />
            <p className="text-xs font-bold text-gray-700">No conversations yet</p>
            <p className="text-[11px] text-gray-400 mt-1 max-w-[210px] leading-relaxed">
              {searchQuery
                ? 'No conversations match your search.'
                : isBusiness
                ? 'Click "New" to initiate a conversation with a client.'
                : 'Waiting for the business to initiate communication. Clients cannot initiate conversations.'}
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
                className={`group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-[#f4f6f8]'
                    : 'hover:bg-gray-50/80 bg-white'
                }`}
              >
                {/* Active Left Indicator Bar */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#0066ff]" />
                )}

                {/* Avatar with Status Badge */}
                <div className="relative flex-shrink-0 mt-0.5">
                  <UserAvatar
                    src={conv.participant.avatar}
                    name={conv.participant.name}
                    size={40}
                  />
                  {/* Status Indicator */}
                  {!isEnded && (
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                        conv.participant.isOnline ? 'bg-[#22c55e]' : 'bg-gray-400'
                      }`}
                    />
                  )}
                </div>

                {/* Contact Info and Message Preview */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[14px] font-bold text-gray-900 truncate">
                        {conv.participant.name}
                      </span>
                      {isEnded && (
                        <span className="flex-shrink-0 flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 bg-gray-100 text-gray-500 rounded">
                          <Lock size={9} />
                          <span>Ended</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-gray-400 flex-shrink-0 font-normal">
                        {conv.lastMessageTime}
                      </span>
                      {/* Delete this chat separately button (Business only) */}
                      {isBusiness && onDeleteConversation && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conv.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-amber-700 hover:bg-amber-100/70 rounded transition-all cursor-pointer"
                          title={`Delete chat with ${conv.participant.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12px] text-gray-500 line-clamp-2 leading-relaxed">
                      {conv.lastMessage}
                    </p>

                    {/* Unread Counter Badge */}
                    {conv.unreadCount > 0 && (
                      <span className="flex-shrink-0 w-4 h-4 bg-[#ef4444] text-white text-[10px] font-bold rounded-full flex items-center justify-center mt-0.5 shadow-sm">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
