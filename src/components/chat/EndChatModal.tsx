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
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200/80 flex items-center justify-center text-red-600 flex-shrink-0">
            <Ban size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              End Chat Session?
            </h3>
            <span className="text-[11px] font-semibold text-red-700 bg-red-100/70 px-2 py-0.5 rounded-full inline-block mt-0.5">
              Permanent Session Termination
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-6 text-xs text-gray-600 leading-relaxed bg-red-50/50 p-4 rounded-2xl border border-red-100/80">
          <p className="font-bold text-red-900">
            Warning: This action terminates the chat session with {clientName}:
          </p>
          <ul className="space-y-2 list-disc list-inside text-gray-700">
            <li>
              <strong className="text-gray-900">Permanently terminates</strong> this active chat session.
            </li>
            <li>
              <strong className="text-gray-900">Prevents both parties</strong> from sending or receiving any further messages in this session.
            </li>
            <li>
              The chat composer will be permanently <strong className="text-gray-900">locked</strong> for both the business and the client.
            </li>
            <li>
              The client <strong className="text-gray-900">cannot restart</strong> this session. To talk to this client again, you can initiate a fresh session at any time.
            </li>
            <li>
              This action <strong className="text-red-700">cannot be undone</strong>.
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
            <span>{isSubmitting ? 'Terminating...' : 'End Chat Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

