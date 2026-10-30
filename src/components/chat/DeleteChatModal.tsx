'use client';

import React from 'react';
import { Trash2, X } from 'lucide-react';

interface DeleteChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName: string;
  isSubmitting?: boolean;
}

export const DeleteChatModal: React.FC<DeleteChatModalProps> = ({
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
            <Trash2 size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Delete Chat with {clientName}?
            </h3>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full inline-block mt-0.5">
              Affects Business View Only
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-6 text-xs text-gray-600 leading-relaxed bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
          <p className="font-semibold text-gray-800">
            Please understand how this action works before proceeding:
          </p>
          <ul className="space-y-2 list-disc list-inside text-gray-600">
            <li>
              This action <strong className="text-gray-900">only clears the chat history from your view</strong>.
            </li>
            <li>
              The conversation and all existing messages <strong className="text-gray-900">remain visible to the client</strong>.
            </li>
            <li>
              The communication connection remains <strong className="text-gray-900">active</strong>.
            </li>
            <li>
              You can start messaging again at any time without creating a new connection.
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
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>{isSubmitting ? 'Deleting...' : 'Delete for Me'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
