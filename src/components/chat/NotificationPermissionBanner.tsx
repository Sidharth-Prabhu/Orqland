'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { requestNotificationPermission } from '@/lib/browserNotifications';

export const NotificationPermissionBanner: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    
    // Check permission status
    if (Notification.permission === 'default') {
      const dismissed = sessionStorage.getItem('orqland_notif_banner_dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    }
  }, []);

  const handleEnable = async () => {
    try {
      const res = await requestNotificationPermission();
      if (res === 'granted' || res === 'denied') {
        setShowPrompt(false);
      }
      if (res === 'granted') {
        // Send a test notification to verify
        const { sendBrowserNotification } = await import('@/lib/browserNotifications');
        await sendBrowserNotification({
          title: 'Notifications Enabled 🎉',
          body: 'You will receive alerts here when new chat messages arrive!',
        });
      }
    } catch {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    try {
      sessionStorage.setItem('orqland_notif_banner_dismissed', '1');
    } catch {}
  };

  if (!showPrompt) return null;

  return (
    <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white px-4 py-2 text-xs sm:text-sm flex items-center justify-between shadow-sm border-b border-purple-800/50 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="flex items-center gap-2.5 max-w-2xl">
        <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center shrink-0">
          <Bell className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
        </div>
        <p className="text-purple-100 font-medium">
          Enable browser notifications to stay alerted to new messages when you are in other tabs or windows.
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <button
          onClick={handleEnable}
          className="px-3 py-1 bg-white hover:bg-purple-50 text-purple-900 font-semibold rounded-full text-xs shadow transition-all hover:scale-[1.02] active:scale-95"
        >
          Enable Notifications
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-purple-300 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          title="Dismiss"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
