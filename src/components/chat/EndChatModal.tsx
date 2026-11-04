'use client';

import React from 'react';
import { Ban, X } from 'lucide-react';

interface EndChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
  isSubmitting?: boolean;
}

export const EndChatModal: React.FC<EndChatModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  clientName,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-600 flex-shrink-0">
            <Ban size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              End Chat Session?
            </h3>
            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-full inline-block mt-0.5">
              Close Current Session
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-6 text-xs text-gray-600 leading-relaxed bg-amber-50/50 p-4 rounded-2xl border border-amber-100/80">
          <p className="font-bold text-amber-950">
            What happens when you end this session:
          </p>
          <ul className="space-y-2 list-disc list-inside text-gray-700">
            <li>
              <strong className="text-gray-900">Closes the active conversation</strong> with {clientName}.
            </li>
            <li>
              <strong className="text-gray-900">Locks the composer</strong> until the chat session is re-opened.
            </li>
            <li>
              Your message history and shared files <strong className="text-gray-900">remain safe</strong> and accessible.
            </li>
            <li>
              <strong className="text-emerald-700">Re-openable anytime:</strong> As the client, you can re-open this session whenever you wish to continue chatting.
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Ban size={14} />
            <span>{isSubmitting ? 'Ending...' : 'End Chat Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

