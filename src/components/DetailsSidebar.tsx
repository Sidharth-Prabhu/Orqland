'use client';

import React from 'react';
import { Conversation } from '@/types/chat';
import { ShieldCheck, Clock, Lock, CheckCircle2 } from 'lucide-react';

interface DetailsSidebarProps {
  conversation: Conversation;
  isBusiness?: boolean;
}

export const DetailsSidebar: React.FC<DetailsSidebarProps> = ({
  conversation,
}) => {
  const { workspaceInfo, bookingInfo, status } = conversation;
  const isEnded = status === 'ended';

  return (
    <aside className="w-full md:w-[260px] xl:w-[280px] flex-shrink-0 border-l border-gray-200 bg-white p-5 flex flex-col gap-4 select-none overflow-y-auto">
      {/* Chat Lifecycle Status Card */}
      <div className="bg-white rounded-2xl border border-gray-200/90 p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Chat Connection Status
        </div>
        <div className="flex items-center gap-2">
          {isEnded ? (
            <div className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-xl text-xs font-bold">
              <Lock size={12} />
              <span>Permanently Ended</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-xl text-xs font-bold">
              <CheckCircle2 size={12} />
              <span>Active Connection</span>
            </div>
          )}
        </div>
        <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
          {isEnded
            ? 'Communication connection has been permanently closed by the business.'
            : 'Connection is active. Both parties can exchange messages and permitted attachments.'}
        </p>
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
      <div className="bg-gray-50 rounded-2xl border border-gray-200/70 p-4 space-y-2 text-[11px] text-gray-600 leading-relaxed">
        <div className="flex items-center gap-1.5 font-bold text-gray-900">
          <ShieldCheck size={14} className="text-blue-600" />
          <span>Security & Compliance</span>
        </div>
        <div className="flex items-start gap-1.5 text-gray-500">
          <Clock size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <span>48-Hour auto-deletion on all images & PDF files</span>
        </div>
        <div className="flex items-start gap-1.5 text-gray-500">
          <Lock size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
          <span>Voice & video calls disabled for privacy</span>
        </div>
      </div>
    </aside>
  );
};
