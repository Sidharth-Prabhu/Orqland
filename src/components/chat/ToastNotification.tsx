'use client';

import React, { useState, useEffect } from 'react';
import { Mail, X } from 'lucide-react';

interface ToastNotificationProps {
  senderName: string;
  count?: number;
  durationMs?: number;
  onOpen: () => void;
  onDismiss: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  senderName,
  count = 1,
  durationMs = 2800,
  onOpen,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger smooth entrance animation on mount
    const enterTimer = requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Schedule exit animation
    const exitTimer = setTimeout(() => {
      setIsVisible(false);
    }, durationMs);

    // Call onDismiss after exit animation finishes (300ms)
    const cleanupTimer = setTimeout(() => {
      onDismiss();
    }, durationMs + 320);

    return () => {
      cancelAnimationFrame(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(cleanupTimer);
    };
  }, [durationMs, onDismiss]);

  const handleManualDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      onDismiss();
    }, 250);
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto transition-all duration-300 ease-out transform ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
      }`}
    >
      <div
        onClick={onOpen}
        className="flex items-center gap-3 px-4 py-3 bg-white/95 backdrop-blur-md text-gray-900 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.12)] border border-gray-200/80 cursor-pointer hover:shadow-[0_16px_42px_rgba(0,0,0,0.16)] hover:border-gray-300 transition-all group max-w-sm sm:max-w-md ring-1 ring-black/5"
      >
        {/* Leading squircle icon in light theme */}
        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/70 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-2xs group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
          <Mail size={17} strokeWidth={2.2} />
        </div>

        {/* Content */}
        <div className="min-w-0 pr-1">
          <div className="text-[11px] text-gray-500 font-semibold truncate leading-tight">
            {senderName}
          </div>
          <div className="text-[13px] font-bold text-gray-900 leading-snug mt-0.5 flex items-center gap-1.5">
            <span>{count > 1 ? `${count} New messages` : 'New message'}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleManualDismiss();
          }}
          className="p-1 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors ml-1 cursor-pointer flex-shrink-0"
          aria-label="Dismiss notification"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
