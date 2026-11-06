'use client';

import React from 'react';
import { RefreshCw, X, MessageSquare } from 'lucide-react';

interface ReopenPromptModalProps {
  isOpen: boolean;
  businessName: string;
  categoryName: string;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ReopenPromptModal: React.FC<ReopenPromptModalProps> = ({
  isOpen,
  businessName,
  categoryName,
  isSubmitting = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden p-6 sm:p-7 select-none animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 flex-shrink-0 shadow-xs">
            <RefreshCw size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 leading-tight">
              Re-open Chat Session?
            </h3>
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full inline-block mt-1">
              Existing Business Connection
            </span>
          </div>
        </div>

        <div className="space-y-2.5 mb-6 text-xs text-gray-600 leading-relaxed bg-amber-50/50 p-4 rounded-2xl border border-amber-200/60">
          <p className="text-gray-800 font-medium">
            You previously had a chat session with <strong className="font-bold text-gray-950">{businessName}</strong> that has ended.
          </p>
          <p className="text-gray-700">
            Would you like to re-open this chat session and update the inquiry topic to{' '}
            <strong className="font-bold text-gray-950 bg-amber-100/80 px-1.5 py-0.5 rounded-md">
              {categoryName}
            </strong>
            ?
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
            <MessageSquare size={12} className="text-amber-600 flex-shrink-0" />
            <span>Re-opening will reactivate the chat composer and preserve your history.</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isSubmitting ? 'animate-spin' : ''} />
            <span>{isSubmitting ? 'Re-opening...' : 'Yes, Re-open Chat'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
