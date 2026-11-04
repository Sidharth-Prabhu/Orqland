'use client';

import React from 'react';
import { Conversation } from '@/types/chat';
import { ShieldCheck, Clock, Lock, CheckCircle2, Ban, Trash2, X } from 'lucide-react';

interface DetailsSidebarProps {
  conversation: Conversation;
  isBusiness?: boolean;
  onEndChat?: () => void;
  onDeleteChat?: () => void;
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
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

  return (
    <aside
      style={style}
      className={`w-full flex-shrink-0 border-l border-gray-200 bg-white flex flex-col h-full select-none ${className}`}
    >
      {/* Sidebar Header with Close Button */}
      <div className="h-[64px] sm:h-[70px] px-5 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
        <h3 className="text-sm font-bold text-gray-900 tracking-tight">
          Conversation Details
        </h3>
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
        {/* Chat Lifecycle Status Card */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
            Chat Session Status
          </div>
          <div className="flex items-center gap-2">
            {isEnded ? (
              <div className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl text-xs font-bold">
                <Lock size={12} />
                <span>Session Terminated</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-xl text-xs font-bold">
                <CheckCircle2 size={12} />
                <span>Active Session</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
            {isEnded
              ? 'This chat session has been terminated. Messages can no longer be sent or received.'
              : 'Session is active. Both parties can exchange messages, approved files, and location.'}
          </p>

          {/* Client End Chat Action Button */}
          {!isBusiness && !isEnded && onEndChat && (
            <button
              type="button"
              onClick={onEndChat}
              className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Terminate this chat session"
            >
              <Ban size={13} className="text-red-500" />
              <span>End Chat Session</span>
            </button>
          )}

          {/* Business Clear History Action Button */}
          {isBusiness && onDeleteChat && (
            <button
              type="button"
              onClick={onDeleteChat}
              className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Clear conversation history from your view only"
            >
              <Trash2 size={13} className="text-amber-600" />
              <span>Delete My History</span>
            </button>
          )}
        </div>

        {/* Orqspace Info Card */}
        <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
            {workspaceInfo?.type || 'Orqspace Info'}
          </div>
          <h3 className="text-[13px] font-extrabold text-black tracking-tight uppercase mb-2">
            {workspaceInfo?.name || 'Workspace'}
          </h3>
          <p className="text-[12px] text-gray-600 leading-relaxed font-normal">
            {workspaceInfo?.description ||
              'Direct communication thread for client and business consultation.'}
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

        {/* Security & Attachment Policy */}
        <div className="bg-gray-50 rounded-2xl border border-gray-200/70 p-4 space-y-2.5 text-[11px] text-gray-600 leading-relaxed">
          <div className="flex items-center gap-1.5 font-bold text-gray-900">
            <ShieldCheck size={14} className="text-blue-600 flex-shrink-0" />
            <span>Security & Compliance</span>
          </div>
          <div className="flex items-start gap-1.5 text-gray-600">
            <Lock size={13} className="text-emerald-600 mt-0.5 flex-shrink-0" />
            <span>
              <strong>AES-256-GCM Encrypted at Rest:</strong> Messages and file attachments are encrypted on disk.
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-gray-600">
            <ShieldCheck size={13} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <span>
              <strong>TLS Encrypted in Transit:</strong> HTTPS encrypted communication channel.
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-gray-600">
            <Clock size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <span>
              <strong>48-Hour Auto-Deletion:</strong> All image and PDF attachments are permanently purged after 48h.
            </span>
          </div>
          <div className="flex items-start gap-1.5 text-gray-500">
            <Lock size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span>Voice & video calls disabled for privacy & security</span>
          </div>
          <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-200/80 leading-normal">
            * Architecture note: Storage is encrypted at rest and in transit via TLS. The system is not end-to-end encrypted.
          </p>
        </div>
      </div>
    </aside>
  );
};
