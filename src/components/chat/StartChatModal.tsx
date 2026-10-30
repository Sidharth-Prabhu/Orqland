'use client';

import React, { useState } from 'react';
import { MessageSquarePlus, X, Mail, User, Briefcase, Send, AlertCircle } from 'lucide-react';

interface StartChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInitiate: (data: {
    clientEmail: string;
    clientName: string;
    workspaceName: string;
    initialMessage: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const StartChatModal: React.FC<StartChatModalProps> = ({
  isOpen,
  onClose,
  onInitiate,
  isSubmitting = false,
}) => {
  const [clientEmail, setClientEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('General Consultation');
  const [initialMessage, setInitialMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clientEmail.trim() || !clientEmail.includes('@')) {
      setError('Please provide a valid client email address.');
      return;
    }

    try {
      await onInitiate({
        clientEmail: clientEmail.trim().toLowerCase(),
        clientName: clientName.trim() || clientEmail.split('@')[0],
        workspaceName: workspaceName.trim() || 'General Consultation',
        initialMessage: initialMessage.trim(),
      });
      // Reset form
      setClientEmail('');
      setClientName('');
      setWorkspaceName('General Consultation');
      setInitialMessage('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate conversation.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 flex-shrink-0">
            <MessageSquarePlus size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Initiate Client Conversation
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Only the Business can initiate communications with a Client.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Client Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
              />
            </div>
          </div>

          {/* Client Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Client Display Name (Optional)
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Sarah Miller"
                className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
              />
            </div>
          </div>

          {/* Workspace Topic */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Workspace / Inquiry Topic
            </label>
            <div className="relative">
              <Briefcase size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="e.g. Order #1043 Support"
                className="w-full pl-10 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all"
              />
            </div>
          </div>

          {/* Initial Message */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Initial Message
            </label>
            <textarea
              rows={3}
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Hello, I'm reaching out regarding your inquiry..."
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black transition-all resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Send size={14} />
              <span>{isSubmitting ? 'Starting...' : 'Start Conversation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

