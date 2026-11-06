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
    <header className="w-full bg-[#f6f7f9] border-b border-gray-200/80 px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
      {/* Left: Brand Logo */}
      <div className="flex items-center select-none cursor-pointer">
        <span className="text-[22px] sm:text-[24px] font-black tracking-tight text-black font-sans">
          Orqland
        </span>
      </div>

      {/* Right Section: Messages notification & User Menu */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Mail Icon Button with Notification Dropdown */}
        <MailNotificationMenu
          notifications={notifications}
          onSelectNotification={onSelectNotification}
          onClearAll={onClearNotifications}
        />

        {/* User Account / Auth Trigger */}
        <UserMenu onOpenAuthModal={onOpenAuthModal || (() => {})} variant="business" />
      </div>
    </header>
  );
};
