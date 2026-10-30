'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Search,
  MoreVertical,
  Paperclip,
  MapPin,
  Send as SendIcon,
  PhoneOff,
  VideoOff,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Check,
  CheckCheck,
  Clock,
  FileText,
  ExternalLink,
  Trash2,
  Ban,
  AlertCircle,
  RefreshCw,
  Maximize2,
} from 'lucide-react';
import { Conversation, ChatMessage, ChatAttachment } from '@/types/chat';
import { isBusinessUser, detectSensitiveContent } from '@/lib/security';
import { DeleteChatModal } from '@/components/chat/DeleteChatModal';
import { EndChatModal } from '@/components/chat/EndChatModal';
import { AttachmentModal } from '@/components/chat/AttachmentModal';
import { LocationModal } from '@/components/chat/LocationModal';
import { ImageViewerModal } from '@/components/chat/ImageViewerModal';
import { PdfViewerModal } from '@/components/chat/PdfViewerModal';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface ChatConversationProps {
  conversation: Conversation;
  currentUserEmail: string;
  onSendMessage: (text: string, attachment?: ChatAttachment) => void;
  onDeleteChat?: (conversationId: string) => Promise<void>;
  onEndChat?: (conversationId: string) => Promise<void>;
  onRetryMessage?: (message: ChatMessage) => void;
  onDeleteMessage?: (messageId: string) => Promise<void>;
}

export const ChatConversation: React.FC<ChatConversationProps> = ({
  conversation,
  currentUserEmail,
  onSendMessage,
  onDeleteChat,
  onEndChat,
  onRetryMessage,
  onDeleteMessage,
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const optionsDropdownRef = useRef<HTMLDivElement>(null);

  const isBusiness = isBusinessUser(currentUserEmail);
  const isChatEnded = conversation.status === 'ended';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation.messages]);

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

    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

  const handleSendAttachment = async (attachment: ChatAttachment, optionalText?: string) => {
    if (isChatEnded) return;
    onSendMessage(optionalText || '', attachment);
  };

  const handleSendLocation = async (attachment: ChatAttachment) => {
    if (isChatEnded) return;
    onSendMessage('Shared location coordinates', attachment);
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
    <div className="flex-1 flex flex-col h-full bg-white relative">
      {/* Safety Notice Banner */}
      <div className="bg-amber-50/90 border-b border-amber-200/70 px-4 py-2 flex items-center justify-between text-[11px] text-amber-900 z-10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-amber-600 flex-shrink-0" />
          <span>
            <strong>Orqland Safety Notice:</strong> Orqland will never ask for OTPs, passwords, PINs, or bank details. Do not share personal mobile numbers or confidential info.
          </span>
        </div>
      </div>

      {/* Top Header Bar */}
      <div className="h-[70px] border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-3.5">
          {/* Avatar with online badge */}
          <div className="relative">
            <UserAvatar
              src={conversation.participant.avatar}
              name={conversation.participant.name}
              size={40}
            />
            {conversation.participant.isOnline && !isChatEnded && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#22c55e] ring-2 ring-white" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-gray-900 leading-tight">
                {conversation.participant.name}
              </span>
              {isChatEnded ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  Ended
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                  Active
                </span>
              )}
            </div>
            <div className="text-[12px] font-medium text-gray-400 mt-0.5">
              {conversation.workspaceInfo?.name || 'Workspace'}
            </div>
          </div>
        </div>

        {/* Action icons & Prohibited Call notice */}
        <div className="flex items-center gap-3 text-gray-700">
          {/* Voice Calls disabled for privacy */}
          <div className="relative group">
            <button
              disabled
              className="p-2 rounded-xl text-gray-300 hover:text-gray-400 cursor-not-allowed"
              title="Voice calls are disabled for privacy and security"
            >
              <PhoneOff size={18} />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-black text-white text-[10px] px-2.5 py-1 rounded shadow-lg whitespace-nowrap z-30">
              Voice calls not supported
            </div>
          </div>

          {/* Video Calls disabled for privacy */}
          <div className="relative group">
            <button
              disabled
              className="p-2 rounded-xl text-gray-300 hover:text-gray-400 cursor-not-allowed"
              title="Video calls are disabled for privacy and security"
            >
              <VideoOff size={18} />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block bg-black text-white text-[10px] px-2.5 py-1 rounded shadow-lg whitespace-nowrap z-30">
              Video calls not supported
            </div>
          </div>

          <button
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
            title="Search conversation"
          >
            <Search size={18} />
          </button>

          {/* Business Session Control: Prominent End Chat Button */}
          {isBusiness && !isChatEnded && (
            <button
              type="button"
              onClick={() => setIsEndModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-all cursor-pointer shadow-xs hover:shadow-sm"
              title="Permanently End Chat Session"
            >
              <Ban size={14} className="text-red-500" />
              <span>End Chat</span>
            </button>
          )}

          {isChatEnded && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-red-700 bg-red-100/80 border border-red-200">
              <Lock size={13} />
              <span>Session Ended</span>
            </div>
          )}

          {/* Options Dropdown: Delete Chat vs End Chat (Business Only) */}
          {isBusiness && (
            <div className="relative" ref={optionsDropdownRef}>
              <button
                onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
                className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                title="Chat controls"
              >
                <MoreVertical size={18} />
              </button>

              {showOptionsDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-black/5 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                  {/* Delete Chat */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowOptionsDropdown(false);
                      setIsDeleteModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-amber-50 hover:text-amber-800 transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} className="text-amber-600" />
                    <div className="text-left">
                      <div>Delete Chat</div>
                      <div className="text-[10px] text-gray-400 font-normal">
                        Clears your view only
                      </div>
                    </div>
                  </button>

                  {/* End Chat */}
                  {!isChatEnded && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowOptionsDropdown(false);
                        setIsEndModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer border-t border-gray-100"
                    >
                      <Ban size={15} />
                      <div className="text-left">
                        <div>End Chat Session</div>
                        <div className="text-[10px] text-red-400 font-normal">
                          Terminate session permanently
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ended Chat Permanent Notice */}
      {isChatEnded && (
        <div className="bg-red-50 border-b border-red-200/80 px-6 py-2.5 flex items-center gap-2 text-xs text-red-800">
          <Lock size={15} className="text-red-600 flex-shrink-0" />
          <span>
            This chat session was terminated by the business. The communication connection is closed and neither party can send or receive messages in this session.
          </span>
        </div>
      )}

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {conversation.messages.length === 0 ? (
          conversation.businessDeletedAt && isBusiness ? (
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
            {conversation.businessDeletedAt && isBusiness && (
              <div className="flex items-center justify-center mb-2">
                <span className="text-[10px] font-semibold text-amber-800/80 bg-amber-50 border border-amber-200/60 px-3 py-1 rounded-full">
                  Earlier messages cleared from your view • Connection remains active
                </span>
              </div>
            )}
            {conversation.messages.map((msg) => {
            const isMe = msg.senderEmail?.toLowerCase() === currentUserEmail.toLowerCase();
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 group ${
                  isMe ? 'flex-row-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div className="mt-0.5 flex-shrink-0">
                  <UserAvatar
                    src={msg.senderAvatar}
                    name={msg.senderName}
                    size={32}
                  />
                </div>

                {/* Bubble Container */}
                <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender Header */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-900">
                      {isMe ? 'You' : msg.senderName}
                    </span>
                    <span className="text-[10px] text-gray-400 font-normal">
                      {msg.timestamp}
                    </span>
                    {isMe && renderDeliveryStatus(msg.status)}

                    {/* Delete individual chat message */}
                    {isBusiness && onDeleteMessage && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(msg.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-amber-700 hover:bg-amber-100/70 rounded transition-all cursor-pointer"
                        title="Delete this message from your view"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>

                  {/* Message Body */}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed space-y-2 ${
                      isMe
                        ? 'bg-[#0066ff] text-white shadow-sm'
                        : 'bg-[#f4f5f7] text-gray-800'
                    }`}
                  >
                    {/* Content text */}
                    {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}

                    {/* Attachment Display */}
                    {msg.attachment && (
                      <div className="mt-2 pt-2 border-t border-white/20">
                        {/* If Expired: */}
                        {msg.attachment.isExpired ? (
                          <div className="flex items-center gap-2 text-[11px] p-2 bg-black/10 rounded-xl text-white/80">
                            <AlertTriangle size={14} className="text-yellow-300 flex-shrink-0" />
                            <span>Attachment expired and permanently deleted (48-hour limit reached).</span>
                          </div>
                        ) : msg.attachment.type === 'image' ? (
                          /* Image Attachment with Click-to-Enlarge */
                          <div className="space-y-1">
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
                              className="rounded-xl overflow-hidden relative max-w-sm max-h-60 bg-black/10 cursor-pointer group/img transition-all hover:ring-2 hover:ring-blue-400"
                              title="Click to view larger image"
                            >
                              <Image
                                src={msg.attachment.url}
                                alt={msg.attachment.name}
                                width={320}
                                height={200}
                                className="object-cover rounded-xl transition-transform duration-200 group-hover/img:scale-[1.02]"
                                unoptimized
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover/img:opacity-100">
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/70 text-white text-[11px] font-bold backdrop-blur-xs shadow-lg transform translate-y-1 group-hover/img:translate-y-0 transition-all">
                                  <Maximize2 size={13} />
                                  <span>Click to enlarge</span>
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] opacity-75 flex items-center justify-between">
                              <span className="truncate max-w-[180px]">{msg.attachment.name}</span>
                              <span className="italic flex-shrink-0">Auto-deletes in 48h</span>
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
                            className="flex items-center justify-between gap-3 p-3 bg-black/10 hover:bg-black/15 rounded-xl cursor-pointer transition-all group/pdf border border-white/10"
                            title="Click to view PDF document"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0 group-hover/pdf:scale-105 transition-transform">
                                <FileText size={18} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold truncate text-[12px] group-hover/pdf:underline">{msg.attachment.name}</p>
                                <p className="text-[10px] opacity-75">
                                  {msg.attachment.size ? `${(msg.attachment.size / 1024).toFixed(1)} KB • ` : ''}PDF Document • Auto-deletes in 48h
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewPdf({
                                  url: msg.attachment!.url,
                                  name: msg.attachment!.name,
                                  size: msg.attachment!.size,
                                });
                              }}
                              className="px-3 py-1.5 bg-white text-black font-bold rounded-lg text-[11px] flex items-center gap-1.5 hover:bg-gray-100 shadow-sm transition-all flex-shrink-0 cursor-pointer"
                            >
                              <span>Open PDF</span>
                              <ExternalLink size={11} />
                            </button>
                          </div>
                        ) : msg.attachment.type === 'location' ? (
                          /* Location Sharing Preview */
                          <div className="p-2.5 bg-black/10 rounded-xl space-y-1.5">
                            <div className="flex items-center gap-1.5 font-bold text-[11px]">
                              <MapPin size={14} className="text-red-400" />
                              <span>{msg.attachment.locationData?.label || 'Shared Location'}</span>
                            </div>
                            <p className="text-[10px] opacity-80">
                              Coordinates: {msg.attachment.locationData?.latitude}, {msg.attachment.locationData?.longitude}
                            </p>
                            <a
                              href={msg.attachment.locationData?.mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] underline font-bold mt-0.5 hover:opacity-80"
                            >
                              <span>Open in Google Maps</span>
                              <ExternalLink size={10} />
                            </a>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

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
          })}
          </>
        )}

        {/* Ended Session Timeline Marker */}
        {isChatEnded && (
          <div className="flex items-center justify-center my-3">
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold">
              <Lock size={12} className="text-red-600" />
              <span>Chat session terminated by business • No further messages can be sent or received</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Area */}
      <div className="p-4 pt-2 bg-white flex-shrink-0">
        {/* Sensitive content warning prompt */}
        {sensitiveCheck.hasSensitiveData && (
          <div className="mb-2 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
            <AlertTriangle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 text-[11px] leading-tight">
              {sensitiveCheck.warning}
            </div>
          </div>
        )}

        {isChatEnded ? (
          <div className="flex flex-col items-center justify-center gap-1 p-3.5 bg-gray-50 border border-gray-200/80 rounded-2xl text-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
              <Lock size={14} className="text-gray-500" />
              <span>This chat session has been terminated</span>
            </div>
            <p className="text-[11px] text-gray-500">
              Messages can no longer be sent or received on this chat session.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border border-gray-300 rounded-2xl px-3 py-2 bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
          >
            {/* Attachment Button (Images & PDF only, 48h warning) */}
            <button
              type="button"
              onClick={() => setIsAttachmentModalOpen(true)}
              className="text-gray-500 hover:text-black p-1.5 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0 cursor-pointer"
              title="Attach Image or PDF (Auto-deletes in 48h)"
            >
              <Paperclip size={18} />
            </button>

            {/* Location Share Button */}
            <button
              type="button"
              onClick={() => setIsLocationModalOpen(true)}
              className="text-gray-500 hover:text-green-700 p-1.5 hover:bg-green-50 rounded-xl transition-colors flex-shrink-0 cursor-pointer"
              title="Share Location"
            >
              <MapPin size={18} />
            </button>

            {/* Text Input */}
            <input
              type="text"
              placeholder="Type your message here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-xs text-gray-800 placeholder-gray-400 focus:outline-none px-2"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                inputText.trim()
                  ? 'bg-[#0066ff] hover:bg-[#0052cc] cursor-pointer'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              <span>Send</span>
              <SendIcon size={13} />
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
    </div>
  );
};
