'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Conversation, ChatMessage } from '@/types/chat';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ImageViewerModal } from '@/components/chat/ImageViewerModal';
import { PdfViewerModal } from '@/components/chat/PdfViewerModal';
import { isAttachmentExpired } from '@/lib/security';
import {
  Lock,
  CheckCircle2,
  Ban,
  Trash2,
  X,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Paperclip,
  Building2,
  ExternalLink,
  Calendar,
  FileText,
  Image as ImageIcon,
  Sparkles,
  ShieldCheck,
  Clock,
  StickyNote,
  Save,
  Check,
} from 'lucide-react';

interface DetailsSidebarProps {
  conversation: Conversation;
  isBusiness?: boolean;
  onEndChat?: () => void;
  onDeleteChat?: () => void;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

type SidebarSubView = 'overview' | 'history' | 'attachments' | 'business';

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DetailsSidebar: React.FC<DetailsSidebarProps> = ({
  conversation,
  isBusiness = false,
  onEndChat,
  onDeleteChat,
  onClose,
  className = '',
  style,
}) => {
  const { workspaceInfo, bookingInfo, status } = conversation;
  const isEnded = status === 'ended';

  const [subView, setSubView] = useState<SidebarSubView>('overview');
  const [attachmentFilter, setAttachmentFilter] = useState<'all' | 'images' | 'pdfs'>('all');

  // Preview modals for attachments
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const [previewPdf, setPreviewPdf] = useState<{ url: string; name: string; size?: number } | null>(null);

  // Calendar State for Conversation History
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateKey(new Date()));

  // Notes state for Business
  const [notesText, setNotesText] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`orqland_notes_${conversation.id}`);
        if (saved !== null) return saved;
      } catch {}
    }
    return conversation.businessNotes || '';
  });
  const [isNotesSaved, setIsNotesSaved] = useState<boolean>(false);
  const [notesLastUpdated, setNotesLastUpdated] = useState<string | null>(null);

  // Sync notes when conversation.id changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`orqland_notes_${conversation.id}`);
        setNotesText(saved !== null ? saved : conversation.businessNotes || '');
      } catch {
        setNotesText(conversation.businessNotes || '');
      }
    }
  }, [conversation.id, conversation.businessNotes]);

  const handleSaveNotes = (textToSave?: string) => {
    const text = textToSave !== undefined ? textToSave : notesText;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`orqland_notes_${conversation.id}`, text);
      } catch {}
    }
    setIsNotesSaved(true);
    setNotesLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    setTimeout(() => setIsNotesSaved(false), 2000);
  };

  // Extract all media and PDF attachments sent across the conversation
  // Exclude deleted, cleared, or expired attachments
  const allAttachments = useMemo(() => {
    const list: Array<{
      id: string;
      messageId: string;
      name: string;
      url: string;
      type: 'image' | 'pdf' | 'location' | 'file';
      size?: number;
      createdAt?: number;
      senderName: string;
      thumbnailUrl?: string;
    }> = [];

    const businessDeletedAt = conversation.businessDeletedAt || 0;
    const clientDeletedAt = conversation.clientDeletedAt || 0;

    (conversation.messages || []).forEach((msg) => {
      // 1. Skip if message is deleted for everyone
      if (msg.deletedForEveryone) return;

      // 2. Skip if message is deleted by viewer
      if (isBusiness && msg.deletedByBusiness) return;
      if (!isBusiness && msg.deletedByClient) return;

      // 3. Skip if cleared before deletedAt timestamp
      const msgTime = msg.createdAt || 0;
      if (isBusiness && businessDeletedAt > 0 && msgTime <= businessDeletedAt) return;
      if (!isBusiness && clientDeletedAt > 0 && msgTime <= clientDeletedAt) return;

      // Helper to check if an attachment is valid/not expired
      const isValidAttachment = (att: {
        isExpired?: boolean;
        uploadedAt?: number;
        expiresAt?: number;
        url?: string;
        thumbnailUrl?: string;
      }) => {
        if (att.isExpired) return false;
        if (att.uploadedAt && isAttachmentExpired(att.uploadedAt, att.expiresAt)) return false;
        if (!att.url && !att.thumbnailUrl) return false;
        return true;
      };

      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach((att, idx) => {
          if ((att.type === 'image' || att.type === 'pdf') && isValidAttachment(att)) {
            list.push({
              id: att.id || `${msg.id}-${idx}`,
              messageId: msg.id,
              name: att.name || (att.type === 'image' ? 'Image Attachment' : 'Document.pdf'),
              url: att.url || att.thumbnailUrl || '',
              type: att.type,
              size: att.size,
              createdAt: msg.createdAt,
              senderName: msg.senderName,
              thumbnailUrl: att.thumbnailUrl,
            });
          }
        });
      } else if (msg.attachment && (msg.attachment.type === 'image' || msg.attachment.type === 'pdf')) {
        if (isValidAttachment(msg.attachment)) {
          list.push({
            id: msg.attachment.id || `${msg.id}-0`,
            messageId: msg.id,
            name: msg.attachment.name || (msg.attachment.type === 'image' ? 'Image Attachment' : 'Document.pdf'),
            url: msg.attachment.url || msg.attachment.thumbnailUrl || '',
            type: msg.attachment.type,
            size: msg.attachment.size,
            createdAt: msg.createdAt,
            senderName: msg.senderName,
            thumbnailUrl: msg.attachment.thumbnailUrl,
          });
        }
      }
    });

    return list;
  }, [conversation.messages, conversation.businessDeletedAt, conversation.clientDeletedAt, isBusiness]);

  const filteredAttachments = useMemo(() => {
    if (attachmentFilter === 'images') return allAttachments.filter((a) => a.type === 'image');
    if (attachmentFilter === 'pdfs') return allAttachments.filter((a) => a.type === 'pdf');
    return allAttachments;
  }, [allAttachments, attachmentFilter]);

  // Group messages by date key (YYYY-MM-DD)
  const messagesByDate = useMemo(() => {
    const map: Record<string, ChatMessage[]> = {};
    (conversation.messages || []).forEach((msg) => {
      const msgDate = msg.createdAt ? new Date(msg.createdAt) : new Date();
      const key = formatDateKey(msgDate);
      if (!map[key]) map[key] = [];
      map[key].push(msg);
    });
    return map;
  }, [conversation.messages]);

  // Generate Calendar Matrix for calendarMonth
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const blanks = Array.from({ length: firstDayIndex });
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return { blanks, days, year, month };
  }, [calendarMonth]);

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-blue-400', 'bg-blue-50/50');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-50/50');
      }, 2000);
    }
  };

  const selectedDateMessages = messagesByDate[selectedDate] || [];

  return (
    <aside
      style={style}
      className={`w-full flex-shrink-0 border-l border-gray-200 bg-white flex flex-col h-full select-none ${className}`}
    >
      {/* Sidebar Header with Back or Close */}
      <div className="h-[64px] sm:h-[70px] px-4 sm:px-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          {subView !== 'overview' && (
            <button
              type="button"
              onClick={() => setSubView('overview')}
              className="p-1 -ml-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="Back to Details"
              aria-label="Back to Details"
            >
              <ArrowLeft size={17} />
            </button>
          )}
          <h3 className="text-sm font-bold text-gray-900 tracking-tight truncate">
            {subView === 'overview' && 'Conversation Details'}
            {subView === 'history' && 'Conversation History'}
            {subView === 'attachments' && `Attachments (${allAttachments.length})`}
            {subView === 'business' && 'View Business'}
          </h3>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Close details"
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
        {/* VIEW 1: OVERVIEW */}
        {subView === 'overview' && (
          <>
            {/* Navigation Card matching uploaded design */}
            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.02)] divide-y divide-gray-100 overflow-hidden">
              {/* Conversation History */}
              <button
                type="button"
                onClick={() => setSubView('history')}
                className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50/80 transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200/70 flex items-center justify-center text-gray-700 flex-shrink-0 group-hover:border-gray-300">
                    <Sparkles size={14} className="text-gray-700" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800">
                    Conversation History
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[11px] font-bold">
                    {conversation.messages.length}
                  </span>
                  <ChevronRight size={15} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
              </button>

              {/* Attachments */}
              <button
                type="button"
                onClick={() => setSubView('attachments')}
                className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50/80 transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200/70 flex items-center justify-center text-gray-700 flex-shrink-0 group-hover:border-gray-300">
                    <Paperclip size={14} className="text-gray-700" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800">
                    Attachments
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[11px] font-bold">
                    {allAttachments.length}
                  </span>
                  <ChevronRight size={15} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
              </button>

              {/* View business */}
              <button
                type="button"
                onClick={() => setSubView('business')}
                className="w-full flex items-center justify-between p-3.5 hover:bg-gray-50/80 transition-colors cursor-pointer group text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200/70 flex items-center justify-center text-gray-700 flex-shrink-0 group-hover:border-gray-300">
                    <Building2 size={14} className="text-gray-700" />
                  </div>
                  <span className="text-xs font-semibold text-gray-800">
                    View business
                  </span>
                </div>
                <ExternalLink size={15} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
              </button>
            </div>

            {/* Always visible interactive Notes Card (Business Only) */}
            {isBusiness && (
              <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-900 uppercase tracking-wide">
                    <StickyNote size={13} className="text-amber-500" />
                    <span>Business Notes</span>
                  </div>
                  {notesLastUpdated && (
                    <span className="text-[10px] text-gray-400">
                      Saved {notesLastUpdated}
                    </span>
                  )}
                </div>

                <textarea
                  value={notesText}
                  onChange={(e) => {
                    setNotesText(e.target.value);
                    handleSaveNotes(e.target.value);
                  }}
                  placeholder="Type private notes about this client here (pricing, preferences, milestones)..."
                  rows={4}
                  className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-[#fdfdfd] focus:bg-white focus:outline-hidden focus:border-amber-400 focus:ring-2 focus:ring-amber-100 text-gray-900 leading-relaxed resize-y transition-all placeholder-gray-400"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-gray-400">
                    Private to your business
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSaveNotes()}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5b52f9] hover:bg-[#4a41e8] text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
                  >
                    {isNotesSaved ? (
                      <>
                        <Check size={12} />
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        <Save size={12} />
                        <span>Save</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Chat Lifecycle Status Card (Concise) */}
            <div className="bg-white rounded-2xl border border-gray-200/90 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Chat Session Status
                </span>
                {isEnded ? (
                  <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    <Lock size={10} />
                    <span>Closed</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    <CheckCircle2 size={10} />
                    <span>Active</span>
                  </span>
                )}
              </div>

              {/* Actions row: concise buttons */}
              <div className="flex items-center gap-2 pt-0.5">
                {/* Client End Chat Action Button */}
                {!isBusiness && !isEnded && onEndChat && (
                  <button
                    type="button"
                    onClick={onEndChat}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                    title="Terminate this chat session"
                  >
                    <Ban size={12} className="text-red-500" />
                    <span>End Chat</span>
                  </button>
                )}

                {/* Clear Chat Action Button (Business & Client) */}
                {onDeleteChat && (
                  <button
                    type="button"
                    onClick={onDeleteChat}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-800 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                    title="Clear conversation history from your view only"
                  >
                    <Trash2 size={12} className="text-amber-600" />
                    <span>Clear Chat</span>
                  </button>
                )}
              </div>
            </div>

            {/* Orqspace Info Card (Concise) */}
            <div className="bg-white rounded-2xl border border-gray-200/90 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  {workspaceInfo?.type || 'Orqspace'}
                </span>
                <span className="text-[11px] font-bold text-gray-900 tracking-tight uppercase truncate max-w-[170px]">
                  {workspaceInfo?.name || 'Technical Architecture'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                {workspaceInfo?.description ||
                  'Direct communication channel between business and client.'}
              </p>
            </div>

            {/* My Bookings Card */}
            <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Service Order
              </div>
              <h4 className="text-[13px] font-bold text-gray-900 leading-snug">
                {bookingInfo?.serviceName || 'Direct Consultation Service'}
              </h4>

              {/* Status Pill Badge */}
              <div className="mt-3">
                <span className="inline-block bg-black text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-sm">
                  {bookingInfo?.status || 'Processing'}
                </span>
              </div>
            </div>
          </>
        )}

        {/* VIEW 2: CONVERSATION HISTORY (CALENDAR DATE PICKER) */}
        {subView === 'history' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Calendar Container */}
            <div className="bg-white rounded-2xl border border-gray-200/90 p-3.5 shadow-xs">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-gray-900">
                  {MONTH_NAMES[calendarDays.month]} {calendarDays.year}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors cursor-pointer"
                    title="Previous month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors cursor-pointer"
                    title="Next month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Days of Week Row */}
              <div className="grid grid-cols-7 gap-1 text-center mb-1">
                {DAYS_OF_WEEK.map((d) => (
                  <span key={d} className="text-[10px] font-bold text-gray-400 py-1">
                    {d}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {calendarDays.blanks.map((_, i) => (
                  <div key={`blank-${i}`} className="h-7 w-7" />
                ))}

                {calendarDays.days.map((day) => {
                  const dayDate = new Date(calendarDays.year, calendarDays.month, day);
                  const dateKey = formatDateKey(dayDate);
                  const hasMessages = Boolean(messagesByDate[dateKey]);
                  const isSelected = dateKey === selectedDate;
                  const isToday = dateKey === formatDateKey(new Date());

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setSelectedDate(dateKey)}
                      className={`relative h-7 w-7 mx-auto rounded-full text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#5b52f9] text-white font-bold shadow-xs'
                          : hasMessages
                          ? 'font-bold text-gray-900 hover:bg-indigo-50 hover:text-indigo-600'
                          : 'text-gray-500 hover:bg-gray-100'
                      } ${isToday && !isSelected ? 'ring-1 ring-indigo-400' : ''}`}
                    >
                      <span>{day}</span>
                      {hasMessages && !isSelected && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#5b52f9]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Summary & Messages */}
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-gray-900 uppercase tracking-wide">
                  {selectedDate === formatDateKey(new Date())
                    ? 'Today’s Conversation'
                    : `Messages on ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}`}
                </span>
                <span className="text-[10px] text-gray-400 font-semibold">
                  {selectedDateMessages.length} message{selectedDateMessages.length !== 1 ? 's' : ''}
                </span>
              </div>

              {selectedDateMessages.length === 0 ? (
                <div className="bg-gray-50/80 rounded-2xl border border-gray-200/70 p-6 text-center text-gray-400">
                  <Calendar size={22} className="mx-auto mb-2 text-gray-300 stroke-[1.5]" />
                  <p className="text-xs font-semibold text-gray-600">No conversation on this date</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Dates with message activity are marked with purple dots in the calendar above.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-0.5">
                  {selectedDateMessages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => handleJumpToMessage(msg.id)}
                      className="bg-white hover:bg-blue-50/40 p-3 rounded-xl border border-gray-200/90 shadow-2xs transition-all cursor-pointer group"
                      title="Click to jump to this message in chat"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] font-bold text-gray-900 truncate">
                          {msg.senderName}
                        </span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {msg.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 leading-snug line-clamp-2">
                        {msg.content || (msg.attachment ? `[${msg.attachment.type.toUpperCase()} Attachment]` : 'Media attachment')}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-blue-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Jump to in chat</span>
                        <ChevronRight size={12} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 3: ATTACHMENTS (IMAGES & PDFS) */}
        {subView === 'attachments' && (
          <div className="space-y-3.5 animate-in fade-in duration-150">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => setAttachmentFilter('all')}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  attachmentFilter === 'all'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                All ({allAttachments.length})
              </button>
              <button
                type="button"
                onClick={() => setAttachmentFilter('images')}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  attachmentFilter === 'images'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Images ({allAttachments.filter((a) => a.type === 'image').length})
              </button>
              <button
                type="button"
                onClick={() => setAttachmentFilter('pdfs')}
                className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  attachmentFilter === 'pdfs'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                PDFs ({allAttachments.filter((a) => a.type === 'pdf').length})
              </button>
            </div>

            {/* Attachments List / Grid */}
            {filteredAttachments.length === 0 ? (
              <div className="bg-gray-50/80 rounded-2xl border border-gray-200/70 p-8 text-center text-gray-400">
                <Paperclip size={24} className="mx-auto mb-2 text-gray-300 stroke-[1.5]" />
                <p className="text-xs font-semibold text-gray-600">No attachments found</p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Images and PDFs sent in this conversation will be cataloged here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Images Grid */}
                {filteredAttachments.some((a) => a.type === 'image') && (
                  <div className="space-y-1.5">
                    {attachmentFilter === 'all' && (
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                        Images
                      </span>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {filteredAttachments
                        .filter((a) => a.type === 'image')
                        .map((att) => (
                          <div
                            key={att.id}
                            onClick={() => setPreviewImage({ url: att.url, name: att.name })}
                            className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 cursor-pointer shadow-2xs hover:border-blue-500 transition-all"
                            title={att.name}
                          >
                            <Image
                              src={att.url}
                              alt={att.name}
                              fill
                              sizes="150px"
                              className="object-cover group-hover:scale-105 transition-transform duration-200"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <span className="text-[10px] font-bold text-white bg-black/60 px-2 py-1 rounded-md backdrop-blur-xs">
                                View
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* PDFs List */}
                {filteredAttachments.some((a) => a.type === 'pdf') && (
                  <div className="space-y-1.5 pt-1">
                    {attachmentFilter === 'all' && (
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                        Documents
                      </span>
                    )}
                    <div className="space-y-1.5">
                      {filteredAttachments
                        .filter((a) => a.type === 'pdf')
                        .map((att) => (
                          <div
                            key={att.id}
                            onClick={() =>
                              setPreviewPdf({
                                url: att.url,
                                name: att.name,
                                size: att.size,
                              })
                            }
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-gray-200/90 bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-all cursor-pointer shadow-2xs group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 flex-shrink-0">
                              <FileText size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-blue-700">
                                {att.name}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                <span>PDF Document</span>
                                {att.size ? <span>• {formatBytes(att.size)}</span> : null}
                              </div>
                            </div>
                            <ChevronRight size={14} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: VIEW BUSINESS */}
        {subView === 'business' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-xs text-center">
              <div className="relative mx-auto w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 mb-2.5">
                <UserAvatar
                  src={conversation.businessAvatar}
                  name={conversation.businessName || 'Business Workspace'}
                  size={64}
                />
              </div>
              <h4 className="text-sm font-bold text-gray-900">
                {conversation.businessName || 'Orqland Business Workspace'}
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {conversation.businessEmail || 'business@orqland.com'}
              </p>
              <div className="mt-2 inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                <ShieldCheck size={11} />
                <span>Verified Orqland Business</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-xs space-y-2 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Workspace
                </span>
                <p className="font-semibold text-gray-900 mt-0.5">
                  {workspaceInfo?.name || 'Technical Architecture'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Description
                </span>
                <p className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                  {workspaceInfo?.description ||
                    'Direct communication channel between business and client.'}
                </p>
              </div>

              {bookingInfo?.serviceName && (
                <div>
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    Service Booking
                  </span>
                  <p className="font-semibold text-gray-900 mt-0.5">
                    {bookingInfo.serviceName}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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
    </aside>
  );
};
