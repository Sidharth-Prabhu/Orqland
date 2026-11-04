'use client';

import React, { useState } from 'react';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { UserProfile } from '@/types/chat';
import { UserMenu } from '@/components/auth/UserMenu';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { MailNotificationMenu, NotificationItem } from '@/components/chat/MailNotificationMenu';

interface BusinessTopBarProps {
  business: UserProfile;
  unreadCount?: number;
  onMailClick?: () => void;
  onOpenAuthModal?: () => void;
  notifications?: NotificationItem[];
  onSelectNotification?: (conversationId: string) => void;
  onClearNotifications?: () => void;
}

export const BusinessTopBar: React.FC<BusinessTopBarProps> = ({
  business,
  onOpenAuthModal,
  notifications = [],
  onSelectNotification = () => {},
  onClearNotifications = () => {},
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
    <header className="w-full bg-[#f6f7f9] border-b border-gray-200/80 px-4 sm:px-8 py-2.5 sm:py-3.5 flex items-center justify-between">
      {/* Left: Brand Logo */}
      <div className="flex items-center select-none cursor-pointer">
        <span className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-black font-sans">
          Orqland
        </span>
      </div>

        {/* Right Section: Messages notification & Business profile */}
        <div className="flex items-center gap-2 sm:gap-5">
          {/* Mail Icon Button with Notification Dropdown */}
          <MailNotificationMenu
            notifications={notifications}
            onSelectNotification={onSelectNotification}
            onClearAll={onClearNotifications}
          />

          {/* Vertical Divider */}
          <div className="h-7 sm:h-9 w-[1px] bg-gray-300/80" />

          {/* Business Profile Info */}
          <div className="flex items-center gap-2 sm:gap-3.5">
            <div className="flex flex-col items-end">
              <span className="text-xs sm:text-[17px] font-bold text-black leading-tight truncate max-w-[110px] sm:max-w-[200px] md:max-w-none">
                {business.name}
              </span>

              {/* WSID Pill & Status row */}
              <div className="hidden sm:flex items-center gap-2 mt-1">
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
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-full overflow-hidden ring-2 ring-white shadow-sm flex-shrink-0">
              <UserAvatar
                src={business.avatar}
                name={business.name}
                size={40}
              />
            </div>
          </div>

          {/* User Account / Auth Trigger */}
          <div className="h-6 sm:h-7 w-[1px] bg-gray-300/80" />
          <UserMenu onOpenAuthModal={onOpenAuthModal || (() => {})} variant="business" />
        </div>
      </header>
  );
};
