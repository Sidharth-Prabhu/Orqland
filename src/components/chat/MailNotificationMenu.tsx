'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mail, Bell, Check, Trash2 } from 'lucide-react';

export interface NotificationItem {
  id: string;
  conversationId: string;
  senderName: string;
  count: number;
  timestamp: number;
  timeString: string;
}

interface MailNotificationMenuProps {
  notifications: NotificationItem[];
  onSelectNotification: (conversationId: string) => void;
  onClearAll: () => void;
}

export const MailNotificationMenu: React.FC<MailNotificationMenuProps> = ({
  notifications,
  onSelectNotification,
  onClearAll,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const totalUnreadCount = notifications.reduce((sum, n) => sum + n.count, 0);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Mail Button with Notification Dot */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 sm:p-2.5 rounded-xl bg-[#eceef1] hover:bg-gray-200 text-black transition-colors shadow-xs cursor-pointer flex items-center justify-center"
        title="Notifications"
        aria-label="Mail notifications"
      >
        <Mail size={18} strokeWidth={2.2} />
        {totalUnreadCount > 0 && (
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] absolute -top-0.5 -right-0.5 ring-2 ring-[#f6f7f9]" />
        )}
      </button>

      {/* Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="p-3.5 pb-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-gray-600" />
              <span className="text-xs font-bold text-gray-900">Notifications</span>
              {totalUnreadCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded-full">
                  {totalUnreadCount}
                </span>
              )}
            </div>

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setIsOpen(false);
                }}
                className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-red-600 transition-colors cursor-pointer"
                title="Clear all notifications"
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-10 h-10 rounded-2xl bg-gray-50 text-gray-400 mx-auto flex items-center justify-center mb-2">
                  <Check size={18} />
                </div>
                <p className="text-xs font-bold text-gray-700">All caught up!</p>
                <p className="text-[11px] text-gray-400 mt-0.5">No unread notifications.</p>
              </div>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectNotification(item.conversationId);
                    setIsOpen(false);
                  }}
                  className="w-full text-left p-3 sm:p-3.5 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-3 cursor-pointer group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {item.senderName}
                    </p>
                    <p className="text-[11px] font-semibold text-blue-600 mt-0.5">
                      {item.count > 1 ? `${item.count} New messages` : 'New message'}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">
                    {item.timeString}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
