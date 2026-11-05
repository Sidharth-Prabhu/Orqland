'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Search,
  MoreVertical,
  Paperclip,
  MapPin,
  Send as SendIcon,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Trash2,
  Ban,
  AlertCircle,
  RefreshCw,
  Maximize2,
  ChevronLeft,
  PanelRight,
  X,
  Pencil,
  Copy,
} from 'lucide-react';
import { Conversation, ChatMessage, ChatAttachment } from '@/types/chat';
import { isBusinessUser, detectSensitiveContent } from '@/lib/security';
import { DeleteChatModal } from '@/components/chat/DeleteChatModal';
import { EndChatModal } from '@/components/chat/EndChatModal';
import { AttachmentModal } from '@/components/chat/AttachmentModal';
import { LocationModal } from '@/components/chat/LocationModal';
import { ImageViewerModal } from '@/components/chat/ImageViewerModal';
import { PdfViewerModal } from '@/components/chat/PdfViewerModal';
import { PdfThumbnail } from '@/components/chat/PdfThumbnail';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface ChatConversationProps {
  conversation: Conversation;
  currentUserEmail: string;
  onSendMessage: (
    text: string,
    attachment?: ChatAttachment,
    attachments?: ChatAttachment[]
  ) => void;
  onDeleteChat?: (conversationId: string) => Promise<void>;
  onEndChat?: (conversationId: string) => Promise<void>;
  onReopenChat?: (conversationId: string) => Promise<void>;
  onRetryMessage?: (message: ChatMessage) => void;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onEditMessage?: (messageId: string, newContent: string) => Promise<void>;
  onBackToList?: () => void;
  onToggleDetails?: () => void;
  isDetailsOpen?: boolean;
  className?: string;
}

function parseLocationAttachment(attachment?: ChatAttachment) {
  if (!attachment) return null;
  const label = attachment.locationData?.label || attachment.name || 'Shared Location';
  let lat = attachment.locationData?.latitude;
  let lng = attachment.locationData?.longitude;
  let mapUrl = attachment.locationData?.mapUrl || attachment.url || '';

  // Extract coordinates from URL query parameter (e.g. ?q=lat,lng) if missing from locationData
  if ((lat === undefined || lng === undefined || (lat === 0 && lng === 0)) && mapUrl) {
    const match = mapUrl.match(/[?&]q=([0-9.-]+),([0-9.-]+)/);
    if (match) {
      const parsedLat = parseFloat(match[1]);
      const parsedLng = parseFloat(match[2]);
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        lat = parsedLat;
        lng = parsedLng;
      }
    }
  }

  if (!mapUrl && lat !== undefined && lng !== undefined) {
    mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  }

  return { label, lat, lng, mapUrl };
}

const getTodayDateKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const ChatConversation: React.FC<ChatConversationProps> = ({
  conversation,
  currentUserEmail,
  onSendMessage,
  onDeleteChat,
  onEndChat,
  onReopenChat,
  onRetryMessage,
  onDeleteMessage,
  onEditMessage,
  onBackToList,
  onToggleDetails,
  isDetailsOpen = false,
  className = '',
}) => {
  const [inputText, setInputText] = useState('');
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{ url: string; name: string; size?: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSafetyNoticeDismissed, setIsSafetyNoticeDismissed] = useState(true);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: ChatMessage;
    canEdit: boolean;
    canDelete: boolean;
  } | null>(null);
  const [chatAreaContextMenu, setChatAreaContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Close context menus on outside click, window scroll or Escape
  useEffect(() => {
    const handleClose = () => {
      setContextMenu(null);
      setChatAreaContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setChatAreaContextMenu(null);
      }
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleChatAreaContextMenu = (e: React.MouseEvent) => {
    // Only trigger when right-clicking on empty background or non-interactive parts of the chat area
    // (Individual message right-click handles its own context menu)
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('[data-message-item]')
    ) {
      return;
    }

    e.preventDefault();
    setContextMenu(null);

    const menuWidth = 200;
    const menuHeight = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    setChatAreaContextMenu({
      x: Math.max(10, x),
      y: Math.max(10, y),
    });
  };

  const handleMessageContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault();
    e.stopPropagation();

    const isSender = msg.senderEmail?.toLowerCase() === currentUserEmail.toLowerCase();
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const msgTime = msg.createdAt || 0;
    const isWithin10Mins = msgTime > 0 ? (currentTime - msgTime) <= TEN_MINUTES_MS : true;
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const isWithin15Mins = msgTime > 0 ? (currentTime - msgTime) <= FIFTEEN_MINUTES_MS : true;

    const canEdit = isSender && isWithin10Mins && Boolean(onEditMessage) && !isChatEnded;
    const canDelete = isSender && isWithin15Mins && Boolean(onDeleteMessage) && !isChatEnded;

    // Constrain position within viewport
    const menuWidth = 180;
    const menuHeight = 120;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

    setContextMenu({
      x: Math.max(10, x),
      y: Math.max(10, y),
      message: msg,
      canEdit,
      canDelete,
    });
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!onEditMessage || !editingText.trim()) return;
    try {
      setIsSavingEdit(true);
      await onEditMessage(messageId, editingText.trim());
      setEditingMessageId(null);
    } catch (err) {
      console.error('Failed to edit message:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Safety notice should only appear once per day per user
  useEffect(() => {
    try {
      const userKey = currentUserEmail ? currentUserEmail.trim().toLowerCase() : 'user';
      const storageKey = `orqland_safety_notice_date_${userKey}`;
      const today = getTodayDateKey();
      const lastShownDate = localStorage.getItem(storageKey);

      if (lastShownDate === today) {
        setIsSafetyNoticeDismissed(true);
      } else {
        // First time viewing a chat today: show the notice and save today's date
        setIsSafetyNoticeDismissed(false);
        localStorage.setItem(storageKey, today);
      }
    } catch {
      setIsSafetyNoticeDismissed(false);
    }
  }, [currentUserEmail]);

  const handleDismissSafetyNotice = () => {
    setIsSafetyNoticeDismissed(true);
    try {
      const userKey = currentUserEmail ? currentUserEmail.trim().toLowerCase() : 'user';
      const storageKey = `orqland_safety_notice_date_${userKey}`;
      localStorage.setItem(storageKey, getTodayDateKey());
    } catch {}
  };

  // Periodically refresh current time to update 15-minute deletion window
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const optionsDropdownRef = useRef<HTMLDivElement>(null);
  const prevConversationIdRef = useRef<string>(conversation.id);
  const prevMessagesCountRef = useRef<number>(conversation.messages.length);
  const isNearBottomRef = useRef<boolean>(true);

  const isBusiness = isBusinessUser(currentUserEmail);
  const isChatEnded = conversation.status === 'ended';

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Track if user is scrolled near bottom
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    // Consider "near bottom" if within 120px from bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
  };

  useEffect(() => {
    const convChanged = prevConversationIdRef.current !== conversation.id;
    const newMessagesAdded = conversation.messages.length > prevMessagesCountRef.current;

    prevConversationIdRef.current = conversation.id;
    prevMessagesCountRef.current = conversation.messages.length;

    if (convChanged) {
      // Switched to a new conversation: jump directly to bottom
      isNearBottomRef.current = true;
      scrollToBottom('auto');

      // Ensure safety notice does not re-appear if already shown or dismissed today
      try {
        const userKey = currentUserEmail ? currentUserEmail.trim().toLowerCase() : 'user';
        const storageKey = `orqland_safety_notice_date_${userKey}`;
        if (localStorage.getItem(storageKey) === getTodayDateKey()) {
          setIsSafetyNoticeDismissed(true);
        }
      } catch {}
    } else if (newMessagesAdded && isNearBottomRef.current) {
      // Only auto-scroll on new messages if user was already at or near bottom
      scrollToBottom('smooth');
    }
    // If the message count hasn't grown (e.g. background polling refresh), NEVER auto-scroll!
  }, [conversation.id, conversation.messages, currentUserEmail]);

  // Close options dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        optionsDropdownRef.current &&
        !optionsDropdownRef.current.contains(event.target as Node)
      ) {
        setShowOptionsDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sensitiveCheck = detectSensitiveContent(inputText);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isChatEnded) return;
    if (!inputText.trim()) return;

    if (sensitiveCheck.isBlocked) {
      alert(
        sensitiveCheck.error ||
          'Security Policy Violation: Sharing credit/debit card numbers, OTPs, passwords, PINs, or bank account details through chat is strictly prohibited.'
      );
      return;
    }

    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Escape') {
      if (onBackToList) {
        e.preventDefault();
        onBackToList();
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDeleteChat) return;
    setIsActionSubmitting(true);
    try {
      await onDeleteChat(conversation.id);
      setIsDeleteModalOpen(false);
    } catch (err) {
      console.error('Delete chat error:', err);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleConfirmEnd = async () => {
    if (!onEndChat) return;
    setIsActionSubmitting(true);
    try {
      await onEndChat(conversation.id);
      setIsEndModalOpen(false);
    } catch (err) {
      console.error('End chat error:', err);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleSendAttachment = async (
    attachment: ChatAttachment,
    optionalText?: string,
    attachments?: ChatAttachment[]
  ) => {
    if (isChatEnded) return;
    onSendMessage(optionalText || '', attachment, attachments);
  };

  const handleSendLocation = async (attachment: ChatAttachment) => {
    if (isChatEnded) return;
    onSendMessage('', attachment);
  };

  // Render delivery status icon
  const renderDeliveryStatus = (status?: ChatMessage['status']) => {
    switch (status) {
      case 'sending':
        return <Clock size={11} className="text-gray-400 animate-pulse" />;
      case 'sent':
        return (
          <span title="Sent to server">
            <Check size={12} className="text-gray-400" />
          </span>
        );
      case 'delivered':
        return (
          <span title="Delivered to recipient">
            <CheckCheck size={12} className="text-gray-500" />
          </span>
        );
      case 'read':
        return (
          <span title="Read by recipient">
            <CheckCheck size={12} className="text-blue-600" />
          </span>
        );
      case 'failed':
        return (
          <span title="Failed to send">
            <AlertCircle size={12} className="text-red-500" />
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full bg-white relative min-w-0 ${className}`}>
      {/* Safety Notice & Disclaimer Banner */}
      {!isSafetyNoticeDismissed && (
        <div className="bg-amber-50/90 border-b border-amber-200/70 px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-3 text-[10px] sm:text-[11px] text-amber-900 z-10 flex-shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldAlert size={14} className="text-amber-600 flex-shrink-0" />
            <span className="leading-snug">
              <strong>Orqland Safety Notice:</strong> Orqland will never ask for OTPs, passwords, PINs, or bank account numbers through chat. Never share personal mobile numbers or confidential credentials.
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismissSafetyNotice}
            className="p-1 -mr-1 text-amber-700/70 hover:text-amber-900 hover:bg-amber-100/80 rounded-md transition-colors cursor-pointer flex-shrink-0"
            title="Dismiss notice"
            aria-label="Dismiss notice"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="h-[64px] sm:h-[70px] border-b border-gray-100/90 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
          {/* Mobile Back Button: return to DM list on mobile/narrow screens */}
          {onBackToList && (
            <button
              type="button"
              onClick={onBackToList}
              className="md:hidden p-1.5 -ml-1 text-gray-600 hover:text-black hover:bg-gray-100 rounded-xl transition-colors cursor-pointer flex-shrink-0"
              title="Back to conversations"
              aria-label="Back to conversations"
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <UserAvatar
              src={conversation.participant.avatar}
              name={conversation.participant.name}
              size={36}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-[13px] sm:text-[14px] font-bold text-gray-900 leading-tight truncate">
                {conversation.participant.name}
              </span>
              {isChatEnded ? (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 flex-shrink-0">
                  Ended
                </span>
              ) : (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex-shrink-0">
                  Active
                </span>
              )}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-gray-400 mt-0.5 truncate">
              {conversation.workspaceInfo?.name || 'Technical Architecture'}
            </div>
          </div>
        </div>

        {/* Right Header Section: Search Bar & Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 text-gray-700 flex-shrink-0">
          {/* Concise Search Bar */}
          <div className="relative flex items-center">
            <Search
              size={13}
              className="absolute left-2.5 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chat..."
              className="w-28 sm:w-44 md:w-48 pl-7 pr-6 py-1.5 bg-[#f0f1f5]/80 hover:bg-[#eaecee] focus:bg-white border border-gray-200/60 focus:border-indigo-400 rounded-lg text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-gray-400 hover:text-gray-700 cursor-pointer"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Details Sidebar Toggle Button */}
          {onToggleDetails && (
            <button
              type="button"
              onClick={onToggleDetails}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                isDetailsOpen
                  ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
              title={isDetailsOpen ? 'Hide conversation details' : 'Show conversation details'}
              aria-label="Toggle Details"
            >
              <PanelRight size={17} />
            </button>
          )}

          {/* Options Dropdown: Clear Chat controls (Business & Client) */}
          {onDeleteChat && (
            <div className="relative" ref={optionsDropdownRef}>
              <button
                onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
                className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
                title="Chat controls"
              >
                <MoreVertical size={17} />
              </button>

              {showOptionsDropdown && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 p-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                  {/* Clear Chat */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsDropdown(false);
                      setIsDeleteModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-amber-50 hover:text-amber-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} className="text-amber-600 flex-shrink-0" />
                    <div className="text-left leading-tight">
                      <div className="font-semibold text-gray-800">Clear Chat</div>
                      <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                        Clears your view only
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages Timeline (Centered readable column) */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        onContextMenu={handleChatAreaContextMenu}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-3 flex flex-col items-center"
      >
        <div className="w-full max-w-3xl flex-1 flex flex-col space-y-1">
        {conversation.messages.length === 0 ? (
          isChatEnded && !isBusiness && onReopenChat ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none animate-in fade-in duration-200">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/90 flex items-center justify-center text-amber-600 mb-3.5 shadow-sm">
                <RefreshCw size={24} />
              </div>
              <h4 className="text-sm font-bold text-gray-900">
                Reopen Conversation with {conversation.participant.name}?
              </h4>
              <p className="text-xs text-gray-500 max-w-sm mt-1.5 mb-5 leading-relaxed">
                You previously had a chat with this business regarding <strong className="text-gray-800 font-semibold">{conversation.workspaceInfo?.name || 'Inquiry'}</strong>. Reopening will restore this chat session and allow both of you to continue messaging.
              </p>
              <div className="flex items-center gap-2.5">
                {onBackToList && (
                  <button
                    type="button"
                    onClick={onBackToList}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                  >
                    Not now
                  </button>
                )}
                <button
                  type="button"
                  disabled={isActionSubmitting}
                  onClick={async () => {
                    setIsActionSubmitting(true);
                    try {
                      await onReopenChat(conversation.id);
                    } finally {
                      setIsActionSubmitting(false);
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black hover:bg-gray-800 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isActionSubmitting ? 'animate-spin' : ''} />
                  <span>Re-open Chat</span>
                </button>
              </div>
            </div>
          ) : (conversation.businessDeletedAt && isBusiness) || (conversation.clientDeletedAt && !isBusiness) ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 mb-3 shadow-xs">
                <Trash2 size={20} />
              </div>
              <h4 className="text-xs font-bold text-gray-800">
                Conversation History Cleared on Your Side
              </h4>
              <p className="text-[11px] text-gray-500 max-w-sm mt-1.5 leading-relaxed">
                Existing messages remain visible to {conversation.participant.name}. Your communication connection remains active and you can send a message below anytime.
              </p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
              <p className="text-xs font-semibold text-gray-600">No messages yet in this conversation</p>
              <p className="text-[11px] text-gray-400 mt-1">
                Say hello or share an inquiry to start exchanging messages.
              </p>
            </div>
          )
        ) : (
          <>
            {((conversation.businessDeletedAt && isBusiness) || (conversation.clientDeletedAt && !isBusiness)) && (
              <div className="flex items-center justify-center mb-2">
                <span className="text-[10px] font-semibold text-amber-800/80 bg-amber-50 border border-amber-200/60 px-3 py-1 rounded-full">
                  Earlier messages cleared from your view • Connection remains active
                </span>
              </div>
            )}
            {(() => {
              const filteredMessages = conversation.messages.filter((msg) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return (
                  msg.content?.toLowerCase().includes(q) ||
                  msg.senderName?.toLowerCase().includes(q) ||
                  msg.attachment?.name?.toLowerCase().includes(q)
                );
              });

              return filteredMessages.map((msg, index) => {
                const isMe = msg.senderEmail?.toLowerCase() === currentUserEmail.toLowerCase();
                const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
                const prevIsMe = prevMsg ? prevMsg.senderEmail?.toLowerCase() === currentUserEmail.toLowerCase() : null;

                // Group consecutive messages by same sender
                const isSameSenderAsPrev =
                  prevMsg !== null &&
                  prevIsMe === isMe &&
                  (prevMsg.senderEmail || prevMsg.senderName) === (msg.senderEmail || msg.senderName);

                // Show header (sender name, timestamp) only on the top message of a consecutive stack
                const showHeader = !isSameSenderAsPrev;

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`flex items-start gap-2.5 group ${
                      isMe ? 'flex-row-reverse' : ''
                    } ${isSameSenderAsPrev ? 'mt-0.5' : 'mt-2'}`}
                  >
                    {/* Avatar - display for first message of stack, reserve invisible slot for continuous messages */}
                    <div className="mt-0.5 flex-shrink-0">
                      {showHeader ? (
                        <UserAvatar
                          src={msg.senderAvatar}
                          name={msg.senderName}
                          size={28}
                        />
                      ) : (
                        <div className="w-7 h-7" />
                      )}
                    </div>

                    {/* Bubble Container */}
                    <div className={`max-w-[85%] sm:max-w-[78%] md:max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {/* Sender Header - only at the top of the stack */}
                      {showHeader && (
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-bold text-gray-900">
                            {isMe ? 'You' : msg.senderName}
                          </span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            {msg.timestamp}
                          </span>
                          {msg.isEdited && (
                            <span
                              className="text-[9px] text-gray-400 italic font-normal"
                              title={
                                msg.editedAt
                                  ? `Edited at ${new Date(msg.editedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                  : 'Edited'
                              }
                            >
                              (edited)
                            </span>
                          )}
                          {isMe && renderDeliveryStatus(msg.status)}

                          {/* Delete individual chat message (Allowed only within 15 mins of sending, sender only) */}
                          {onDeleteMessage && isMe && (() => {
                            const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
                            const msgTime = msg.createdAt || 0;
                            const isWithin15Mins = msgTime > 0 ? (currentTime - msgTime) <= FIFTEEN_MINUTES_MS : true;

                            if (!isWithin15Mins) return null;

                            return (
                              <button
                                type="button"
                                onClick={() => onDeleteMessage(msg.id)}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-amber-700 hover:bg-amber-100/70 rounded transition-all cursor-pointer"
                                title="Delete this message (available for 15 mins)"
                              >
                                <Trash2 size={11} />
                              </button>
                            );
                          })()}
                        </div>
                      )}

                      {/* Message Body */}
                      {(() => {
                        const isLocation = msg.attachment?.type === 'location';
                        const isAutoLocationText = msg.content === 'Shared location coordinates';
                        const displayContent = isAutoLocationText ? null : msg.content;
                        const hasMediaOnly = !displayContent && ((msg.attachments && msg.attachments.length > 0) || msg.attachment);
                        const isEditingThis = editingMessageId === msg.id;

                        return (
                          <div
                            data-message-item="true"
                            onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                            className={
                              hasMediaOnly
                                ? 'p-0 bg-transparent border-0 shadow-none'
                                : `rounded-lg px-3 py-1.5 text-xs leading-snug space-y-1 transition-all ${
                                    isMe
                                      ? 'bg-[#ebedf7] text-gray-900 border border-indigo-100/60 shadow-2xs'
                                      : 'bg-[#f4f5f8] text-gray-800 border border-gray-200/60 shadow-2xs'
                                  }`
                            }
                          >
                            {/* Content text or inline editor */}
                            {isEditingThis ? (
                              <div className="w-full min-w-[220px] max-w-[340px] space-y-2 py-1 select-text">
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveEdit(msg.id);
                                    } else if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setEditingMessageId(null);
                                    }
                                  }}
                                  rows={Math.min(5, Math.max(2, editingText.split('\n').length))}
                                  className="w-full text-xs p-2 rounded-md border border-blue-400 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-100 text-gray-900 resize-none leading-snug"
                                  autoFocus
                                />
                                <div className="flex items-center justify-between gap-2 text-[10px] text-gray-400">
                                  <span>Esc to cancel • Enter to save</span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setEditingMessageId(null)}
                                      disabled={isSavingEdit}
                                      className="px-2 py-0.5 rounded text-gray-500 hover:bg-gray-200/80 hover:text-gray-700 transition-colors font-medium cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSaveEdit(msg.id)}
                                      disabled={isSavingEdit || !editingText.trim()}
                                      className="px-2.5 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                    >
                                      {isSavingEdit ? (
                                        <RefreshCw size={10} className="animate-spin" />
                                      ) : (
                                        <Check size={10} />
                                      )}
                                      Save
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              displayContent && <p className="whitespace-pre-wrap">{displayContent}</p>
                            )}

                            {/* Attachments Display */}
                            {msg.attachments && msg.attachments.length > 0 ? (
                              /* Dynamic Grid: 2x2 for 4 items, 3x3 for 5+ items, 2-col for 2 items, 3-col for 3 */
                              (() => {
                                const count = msg.attachments.length;
                                const isFour = count === 4;
                                const isThreeOrMore = count >= 3 && !isFour;
                                
                                const gridClass = isFour
                                  ? 'grid grid-cols-2 gap-1.5 p-0.5 w-[280px] sm:w-[320px]'
                                  : isThreeOrMore
                                  ? 'grid grid-cols-3 gap-1.5 p-0.5 w-[300px] sm:w-[360px]'
                                  : 'grid grid-cols-2 gap-1.5 p-0.5 w-[280px] sm:w-[320px]';

                                const itemHeightClass = isThreeOrMore
                                  ? 'h-24 sm:h-28'
                                  : 'h-28 sm:h-32';

                                return (
                                  <div className={displayContent ? 'mt-1.5 pt-1.5 border-t border-gray-200/80' : ''}>
                                    <div className={gridClass}>
                                      {msg.attachments.map((att, idx) => (
                                        att.type === 'pdf' ? (
                                          <div
                                            key={att.id || idx}
                                            onClick={() =>
                                              setPreviewPdf({
                                                url: att.url,
                                                name: att.name,
                                                size: att.size,
                                              })
                                            }
                                            className={`relative w-full ${isThreeOrMore ? 'h-28 sm:h-32' : 'h-32 sm:h-36'} rounded-md overflow-hidden bg-white text-gray-900 border border-gray-200 shadow-xs cursor-pointer group/pdf hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all flex flex-col`}
                                            title="Click to view PDF document"
                                          >
                                            {/* PDF visual preview area with first-page render */}
                                            <div className="flex-1 relative overflow-hidden bg-gray-50">
                                              <PdfThumbnail
                                                url={att.url}
                                                name={att.name}
                                                thumbnailUrl={att.thumbnailUrl}
                                              />
                                            </div>
                                            {/* PDF filename footer */}
                                            <div className="px-1.5 py-1 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-1 text-gray-900">
                                              <span className="text-[10px] font-semibold truncate group-hover/pdf:underline leading-tight">
                                                {att.name}
                                              </span>
                                              <span className="flex items-center gap-0.5 text-[9px] font-semibold text-blue-600 flex-shrink-0 group-hover/pdf:translate-x-0.5 transition-transform">
                                                <ExternalLink size={9} />
                                              </span>
                                            </div>
                                          </div>
                                        ) : (att.url || att.thumbnailUrl) ? (
                                          <div
                                            key={att.id || idx}
                                            onClick={() =>
                                              setPreviewImage({
                                                url: att.url || att.thumbnailUrl || '',
                                                name: att.name,
                                              })
                                            }
                                            className={`relative w-full ${itemHeightClass} rounded-md overflow-hidden bg-gray-100 border border-gray-200 shadow-xs cursor-pointer group/item hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all`}
                                            title="Click to view image"
                                          >
                                            <Image
                                              src={att.url || att.thumbnailUrl || ''}
                                              alt={att.name || 'Image'}
                                              fill
                                              sizes="(max-width: 640px) 100px, 120px"
                                              className="object-cover transition-transform duration-200 group-hover/item:scale-105"
                                              unoptimized
                                            />
                                            <div className="absolute inset-0 bg-black/0 group-hover/item:bg-black/20 transition-all flex items-center justify-center opacity-0 group-hover/item:opacity-100">
                                              <Maximize2 size={14} className="text-white drop-shadow-md" />
                                            </div>
                                          </div>
                                        ) : null
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()
                            ) : msg.attachment ? (
                              <div className={displayContent ? 'mt-1.5 pt-1.5 border-t border-gray-200/80' : ''}>
                                {/* If Expired: */}
                                {msg.attachment.isExpired ? (
                                  <div className="flex items-center gap-2 text-[11px] p-2 bg-amber-50 border border-amber-200/60 rounded-md text-amber-800">
                                    <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                                    <span>Attachment expired and permanently deleted.</span>
                                  </div>
                                ) : msg.attachment.type === 'image' && msg.attachment.url ? (
                                  /* Single Image Attachment with Click-to-Enlarge */
                                  <div>
                                    <div
                                      onClick={() =>
                                        setPreviewImage({
                                          url: msg.attachment!.url,
                                          name: msg.attachment!.name,
                                        })
                                      }
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                          e.preventDefault();
                                          setPreviewImage({
                                            url: msg.attachment!.url,
                                            name: msg.attachment!.name,
                                          });
                                        }
                                      }}
                                      className="rounded-md overflow-hidden relative max-w-sm max-h-60 bg-white border border-gray-200 shadow-xs cursor-pointer group/img transition-all hover:border-blue-500 hover:ring-2 hover:ring-blue-100"
                                      title="Click to view larger image"
                                    >
                                      <Image
                                        src={msg.attachment.url}
                                        alt={msg.attachment.name || 'Image'}
                                        width={320}
                                        height={200}
                                        className="object-cover w-full h-auto transition-transform duration-200 group-hover/img:scale-[1.02]"
                                        unoptimized
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-[11px] font-bold backdrop-blur-xs shadow-lg transform translate-y-1 group-hover/img:translate-y-0 transition-all">
                                          <Maximize2 size={13} />
                                          <span>Click to enlarge</span>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ) : msg.attachment.type === 'pdf' ? (
                                  /* PDF Document Attachment - Opens in Built-in PDF Viewer */
                                  <div
                                    onClick={() =>
                                      setPreviewPdf({
                                        url: msg.attachment!.url,
                                        name: msg.attachment!.name,
                                        size: msg.attachment!.size,
                                      })
                                    }
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setPreviewPdf({
                                          url: msg.attachment!.url,
                                          name: msg.attachment!.name,
                                          size: msg.attachment!.size,
                                        });
                                      }
                                    }}
                                    className="w-56 sm:w-64 rounded-md overflow-hidden bg-white text-gray-900 border border-gray-200 shadow-xs cursor-pointer group/pdf hover:border-blue-500 hover:ring-2 hover:ring-blue-100 transition-all flex flex-col"
                                    title="Click to view PDF document"
                                  >
                                    {/* PDF first-page preview thumbnail */}
                                    <div className="relative w-full h-40 sm:h-44 bg-gray-50 overflow-hidden">
                                      <PdfThumbnail
                                        url={msg.attachment.url}
                                        name={msg.attachment.name}
                                        thumbnailUrl={msg.attachment.thumbnailUrl}
                                      />
                                    </div>

                                    {/* Card Footer with Filename, Size & Open Link */}
                                    <div className="p-2.5 bg-gray-50 flex items-center justify-between gap-2 border-t border-gray-100">
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold truncate text-[12px] text-gray-900 group-hover/pdf:underline leading-tight">
                                          {msg.attachment.name}
                                        </p>
                                        <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                          {msg.attachment.size ? `${(msg.attachment.size / 1024).toFixed(1)} KB • ` : ''}PDF Document
                                        </p>
                                      </div>

                                      <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 flex-shrink-0 group-hover/pdf:translate-x-0.5 transition-transform">
                                        <span>Open</span>
                                        <ExternalLink size={11} />
                                      </span>
                                    </div>
                                  </div>
                                ) : msg.attachment.type === 'location' ? (
                                  /* Location Sharing Attachment - WhatsApp-style map snippet & info card */
                                  (() => {
                                    const loc = parseLocationAttachment(msg.attachment);
                                    if (!loc) return null;

                                    // Bounding box for Static OSM map tile snippet (~1km around coords)
                                    const lat = loc.lat ?? 0;
                                    const lng = loc.lng ?? 0;
                                    const delta = 0.006;
                                    const bbox = `${lng - delta}%2C${lat - delta / 1.5}%2C${lng + delta}%2C${lat + delta / 1.5}`;
                                    const staticMapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;

                                    return (
                                      <div
                                        onClick={() => window.open(loc.mapUrl, '_blank', 'noopener,noreferrer')}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            window.open(loc.mapUrl, '_blank', 'noopener,noreferrer');
                                          }
                                        }}
                                        className="w-56 sm:w-64 rounded-md overflow-hidden bg-white text-gray-900 border border-gray-200 shadow-xs cursor-pointer group/map transition-all hover:border-blue-500 hover:ring-2 hover:ring-blue-100 flex flex-col"
                                        title="Click to open location in Google Maps"
                                      >
                                        {/* WhatsApp-style Map Canvas Snippet */}
                                        <div className="relative w-full h-32 sm:h-36 bg-[#e5e3df] overflow-hidden">
                                          {loc.lat !== undefined && loc.lng !== undefined ? (
                                            /* Sized larger with negative bottom margin to cleanly clip out the OSM attribution footer */
                                            <div className="absolute inset-0 overflow-hidden">
                                              <iframe
                                                title="Location Map Snippet"
                                                src={staticMapSrc}
                                                className="w-full h-[calc(100%+65px)] -mt-1 -mb-16 border-0 pointer-events-none filter saturate-125 select-none"
                                                loading="lazy"
                                              />
                                            </div>
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600">
                                              <MapPin size={32} />
                                            </div>
                                          )}

                                          {/* Live Location Pill Badge */}
                                          <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/75 backdrop-blur-xs text-white rounded-md text-[9px] font-semibold flex items-center gap-1 shadow-xs pointer-events-none">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                            <span>Location</span>
                                          </div>
                                        </div>

                                        {/* Card Footer with Label, Coordinates & Open Map Link */}
                                        <div className="p-2.5 bg-gray-50 flex items-center justify-between gap-2 border-t border-gray-100">
                                          <div className="min-w-0 flex-1">
                                            <p className="font-semibold truncate text-[12px] text-gray-900 group-hover/map:underline leading-tight">
                                              {loc.label}
                                            </p>
                                            <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                              {loc.lat !== undefined && loc.lng !== undefined
                                                ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
                                                : 'View on map'}
                                            </p>
                                          </div>

                                          <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 flex-shrink-0 group-hover/map:translate-x-0.5 transition-transform">
                                            <span>Open</span>
                                            <ExternalLink size={11} />
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}

                  {/* Failed status retry button */}
                  {isMe && msg.status === 'failed' && onRetryMessage && (
                    <button
                      onClick={() => onRetryMessage(msg)}
                      className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 cursor-pointer"
                    >
                      <RefreshCw size={10} />
                      <span>Retry sending</span>
                    </button>
                  )}
                </div>
              </div>
            );
          });
        })()}
          </>
        )}

        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer Area (Floating Pill Style in Center) */}
      <div className="p-3 sm:p-4 pt-2 bg-transparent flex flex-col items-center flex-shrink-0 w-full">
        {/* Sensitive content warning prompt */}
        {sensitiveCheck.hasSensitiveData && (
          <div
            className={`w-full max-w-3xl mb-2 p-2 sm:p-2.5 rounded-2xl flex items-start gap-2 text-xs border ${
              sensitiveCheck.isBlocked
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <AlertTriangle
              size={15}
              className={`${
                sensitiveCheck.isBlocked ? 'text-red-600' : 'text-amber-600'
              } flex-shrink-0 mt-0.5`}
            />
            <div className="flex-1 text-[11px] leading-tight">
              <strong>{sensitiveCheck.isBlocked ? 'Security Policy Block: ' : 'Privacy Reminder: '}</strong>
              {sensitiveCheck.warning}
            </div>
          </div>
        )}

        {isChatEnded ? (
          <div className="flex flex-col items-center justify-center gap-2 py-1">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold">
              <Lock size={12} className="text-red-600" />
              <span>
                {!isBusiness && onReopenChat
                  ? 'Chat session closed • You can re-open the chat session to continue the conversation'
                  : 'Chat session ended by client • Communication connection closed'}
              </span>
            </div>
            {!isBusiness && onReopenChat && (
              <button
                type="button"
                disabled={isActionSubmitting}
                onClick={async () => {
                  setIsActionSubmitting(true);
                  try {
                    await onReopenChat(conversation.id);
                  } finally {
                    setIsActionSubmitting(false);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black hover:bg-gray-800 text-white text-[11px] font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={11} className={isActionSubmitting ? 'animate-spin' : ''} />
                <span>Re-open Chat</span>
              </button>
            )}
          </div>
        ) : (
          <form
            onSubmit={handleSend}
            className="w-full max-w-3xl flex items-center gap-1.5 sm:gap-2.5 border border-gray-200/90 rounded-xl px-3 sm:px-4 py-1.5 sm:py-2 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
          >
            {/* Attachment Button (Images & PDF only, 48h warning) */}
            <button
              type="button"
              onClick={() => setIsAttachmentModalOpen(true)}
              className="text-gray-400 hover:text-gray-700 p-1 sm:p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
              title="Attach Image or PDF (Auto-deletes in 48h)"
            >
              <Paperclip size={16} />
            </button>

            {/* Location Share Button */}
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="text-gray-400 hover:text-indigo-600 p-1 sm:p-1.5 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
              title="Share Location"
            >
              <MapPin size={16} />
            </button>

            {/* Text Input */}
            <input
              type="text"
              placeholder="Type your message here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-xs sm:text-[13px] text-gray-800 placeholder-gray-400 focus:outline-none px-1.5 sm:px-2 min-w-0"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim() || !!sensitiveCheck.isBlocked}
              title={
                sensitiveCheck.isBlocked
                  ? 'Sharing prohibited sensitive credentials or financial details is not allowed'
                  : undefined
              }
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all shadow-xs flex-shrink-0 ${
                sensitiveCheck.isBlocked
                  ? 'bg-red-400 cursor-not-allowed opacity-75'
                  : inputText.trim()
                  ? 'bg-[#5b52f9] hover:bg-[#4a41e8] cursor-pointer'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <span>Send</span>
              <SendIcon size={12} />
            </button>
          </form>
        )}
      </div>

      {/* Modals */}
      <DeleteChatModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleConfirmDelete}
        clientName={conversation.participant.name}
        isSubmitting={isActionSubmitting}
      />

      <EndChatModal
        isOpen={isEndModalOpen}
        onClose={() => setIsEndModalOpen(false)}
        onConfirm={handleConfirmEnd}
        clientName={conversation.participant.name}
        isSubmitting={isActionSubmitting}
      />

      <AttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        onSendAttachment={handleSendAttachment}
      />

      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onSendLocation={handleSendLocation}
      />

      {/* Lightbox Modal for Bigger Image View */}
      {previewImage && (
        <ImageViewerModal
          isOpen={!!previewImage}
          onClose={() => setPreviewImage(null)}
          imageUrl={previewImage.url}
          imageName={previewImage.name}
        />
      )}

      {/* Embedded PDF Document Viewer Modal */}
      {previewPdf && (
        <PdfViewerModal
          isOpen={!!previewPdf}
          onClose={() => setPreviewPdf(null)}
          pdfUrl={previewPdf.url}
          pdfName={previewPdf.name}
          pdfSize={previewPdf.size}
        />
      )}

      {/* Right-Click Context Menu for Chat Area */}
      {chatAreaContextMenu && (
        <div
          style={{ top: `${chatAreaContextMenu.y}px`, left: `${chatAreaContextMenu.x}px` }}
          className="fixed z-50 min-w-[200px] bg-white rounded-2xl shadow-2xl border border-gray-200/90 py-1.5 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header indicator */}
          <div className="px-3.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
            Chat Controls
          </div>

          {/* End Chat Session (Client action, or Business if available) */}
          {!isChatEnded && onEndChat && (
            <button
              type="button"
              onClick={() => {
                setChatAreaContextMenu(null);
                setIsEndModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors cursor-pointer group"
            >
              <Ban size={14} className="text-red-500 group-hover:text-red-600" />
              <div className="flex flex-col">
                <span className="font-semibold text-red-700">End Chat Session</span>
                <span className="text-[10px] text-red-400">Permanently terminate</span>
              </div>
            </button>
          )}

          {/* Clear Chat (Business & Client) */}
          {onDeleteChat && (
            <button
              type="button"
              onClick={() => {
                setChatAreaContextMenu(null);
                setIsDeleteModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-colors cursor-pointer group"
            >
              <Trash2 size={14} className="text-amber-600 group-hover:text-amber-700" />
              <div className="flex flex-col">
                <span className="font-semibold text-gray-800 group-hover:text-amber-800">Clear Chat</span>
                <span className="text-[10px] text-gray-400">Clears your view only</span>
              </div>
            </button>
          )}

          {/* Re-open Chat (when session is ended) */}
          {isChatEnded && !isBusiness && onReopenChat && (
            <button
              type="button"
              onClick={async () => {
                setChatAreaContextMenu(null);
                setIsActionSubmitting(true);
                try {
                  await onReopenChat(conversation.id);
                } finally {
                  setIsActionSubmitting(false);
                }
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer group"
            >
              <RefreshCw size={14} className="text-blue-500" />
              <div className="flex flex-col">
                <span className="font-semibold text-blue-700">Reopen Chat</span>
                <span className="text-[10px] text-blue-400">Restore communication</span>
              </div>
            </button>
          )}

          {/* Close / Toggle Details Sidebar */}
          {onToggleDetails && (
            <button
              type="button"
              onClick={() => {
                setChatAreaContextMenu(null);
                onToggleDetails();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer group"
            >
              <PanelRight size={14} className="text-gray-500" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-800">
                  {isDetailsOpen ? 'Close Details Sidebar' : 'View Conversation Details'}
                </span>
                <span className="text-[10px] text-gray-400">Toggle info panel</span>
              </div>
            </button>
          )}

          {/* Back to Chats (Mobile / Close active chat view) */}
          {onBackToList && (
            <div className="border-t border-gray-100 mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setChatAreaContextMenu(null);
                  onBackToList();
                }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <ChevronLeft size={14} className="text-gray-400" />
                <span className="font-medium text-gray-700">Close Chat View</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Right-Click Context Menu for Individual Message */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 min-w-[170px] bg-white rounded-xl shadow-xl border border-gray-200/90 py-1 text-xs select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.canEdit && (
            <button
              type="button"
              onClick={() => {
                const target = contextMenu.message;
                setContextMenu(null);
                setEditingMessageId(target.id);
                setEditingText(target.content);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer group"
            >
              <Pencil size={13} className="text-gray-500 group-hover:text-blue-600" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-900 group-hover:text-blue-700">Edit message</span>
                <span className="text-[10px] text-gray-400">Available within 10m</span>
              </div>
            </button>
          )}

          {contextMenu.canDelete && (
            <button
              type="button"
              onClick={() => {
                const msgId = contextMenu.message.id;
                setContextMenu(null);
                onDeleteMessage?.(msgId);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-colors cursor-pointer group"
            >
              <Trash2 size={13} className="text-gray-500 group-hover:text-amber-600" />
              <div className="flex flex-col">
                <span className="font-medium text-gray-900 group-hover:text-amber-800">Delete message</span>
                <span className="text-[10px] text-gray-400">Clears your view</span>
              </div>
            </button>
          )}

          {contextMenu.message.content && (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(contextMenu.message.content);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <Copy size={13} className="text-gray-500" />
              <span>Copy text</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
