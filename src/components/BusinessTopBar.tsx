'use client';

import React, { useState } from 'react';
import { Mail, ExternalLink, Copy, Check } from 'lucide-react';
import { UserProfile } from '@/types/chat';
import { UserMenu } from '@/components/auth/UserMenu';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface BusinessTopBarProps {
  business: UserProfile;
  unreadCount?: number;
  onMailClick?: () => void;
  onOpenAuthModal?: () => void;
}

export const BusinessTopBar: React.FC<BusinessTopBarProps> = ({
  business,
  unreadCount = 1,
  onMailClick,
  onOpenAuthModal,
}) => {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<'Closed' | 'Open'>(
    business.businessStatus || 'Closed'
  );

  const copyWsid = () => {
    if (business.wsid) {
      navigator.clipboard.writeText(business.wsid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const toggleStatus = () => {
    setStatus((prev) => (prev === 'Closed' ? 'Open' : 'Closed'));
  };

  return (
    <div className="w-full bg-white">
      {/* Top breadcrumb label as seen in Image 2 */}
      <div className="text-[13px] text-gray-400 font-normal px-8 pt-2.5 pb-1 select-none bg-white">
        Orders & Bookings
      </div>

      {/* Main Business Top Navigation Bar */}
      <header className="w-full bg-[#f6f7f9] border-b border-gray-200/80 px-8 py-3.5 flex items-center justify-between">
        {/* Left: Brand Logo */}
        <div className="flex items-center select-none cursor-pointer">
          <span className="text-[28px] font-extrabold tracking-tight text-black font-sans">
            Orqland
          </span>
        </div>

        {/* Right Section: Messages notification & Business profile */}
        <div className="flex items-center gap-5">
          {/* Mail Icon Button with Notification Dot */}
          <button
            onClick={onMailClick}
            className="relative p-2.5 rounded-xl bg-[#eceef1] hover:bg-gray-200 text-black transition-colors shadow-sm cursor-pointer"
            title="Messages"
          >
            <Mail size={19} strokeWidth={2.2} />
            {unreadCount > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] absolute -top-0.5 -right-0.5 ring-2 ring-[#f6f7f9]" />
            )}
          </button>

          {/* Vertical Divider */}
          <div className="h-9 w-[1px] bg-gray-300/80" />

          {/* Business Profile Info */}
          <div className="flex items-center gap-3.5">
            <div className="flex flex-col items-end">
              <span className="text-[17px] font-bold text-black leading-tight">
                {business.name}
              </span>

              {/* WSID Pill & Status row */}
              <div className="flex items-center gap-2 mt-1">
                {/* WSID Pill */}
                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-200 rounded text-[11px] font-semibold text-gray-700 shadow-sm">
                  <span>WSID: {business.wsid || 'ABC#12345678#'}</span>
                  <ExternalLink size={11} className="text-gray-500" />
                  <button
                    onClick={copyWsid}
                    className="ml-0.5 text-gray-400 hover:text-black transition-colors"
                    title={copied ? 'Copied!' : 'Copy WSID'}
                  >
                    {copied ? (
                      <Check size={11} className="text-green-600" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                </div>

                {/* Status Toggle Pill */}
                <button
                  onClick={toggleStatus}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-gray-200 rounded text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                  title="Click to toggle status"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status === 'Closed' ? 'bg-[#ef4444]' : 'bg-[#22c55e]'
                    }`}
                  />
                  <span>{status}</span>
                </button>
              </div>
            </div>

            {/* Business Avatar */}
            <div className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-white shadow-sm flex-shrink-0">
              <UserAvatar
                src={business.avatar}
                name={business.name}
                size={44}
              />
            </div>
          </div>

          {/* User Account / Auth Trigger */}
          <div className="h-7 w-[1px] bg-gray-300/80" />
          <UserMenu onOpenAuthModal={onOpenAuthModal || (() => {})} variant="business" />
        </div>
      </header>
    </div>
  );
};
