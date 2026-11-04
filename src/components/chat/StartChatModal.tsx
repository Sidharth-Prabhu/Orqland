'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Building2,
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Mail,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { BUSINESS_DIRECTORY, BusinessDirectoryItem } from '@/data/businesses';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface StartChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInitiate: (data: {
    businessEmail: string;
    businessName: string;
    businessAvatar?: string;
    workspaceName?: string;
    initialMessage?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const StartChatModal: React.FC<StartChatModalProps> = ({
  isOpen,
  onClose,
  onInitiate,
  isSubmitting = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessDirectoryItem | null>(null);
  const [isCustomEmailMode, setIsCustomEmailMode] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [selectedService, setSelectedService] = useState('Code Review');
  const [otherServiceText, setOtherServiceText] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Available services list based on selected business (or default fallback)
  const availableServices = useMemo(() => {
    if (selectedBusiness?.services && selectedBusiness.services.length > 0) {
      return selectedBusiness.services;
    }
    return ['Code Review', 'General Consultation', 'Software Engineering', 'Technical Architecture'];
  }, [selectedBusiness]);

  // Derived effective workspace/service name
  const effectiveWorkspaceName = selectedService === 'Other' ? otherServiceText.trim() : selectedService;

  // Filter businesses in real time based on search query
  const filteredBusinesses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return BUSINESS_DIRECTORY;

    return BUSINESS_DIRECTORY.filter((biz) => {
      return (
        biz.name.toLowerCase().includes(q) ||
        biz.email.toLowerCase().includes(q) ||
        biz.category.toLowerCase().includes(q) ||
        biz.description.toLowerCase().includes(q) ||
        biz.services.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleSelectBusiness = (biz: BusinessDirectoryItem) => {
    setSelectedBusiness(biz);
    setIsCustomEmailMode(false);
    setError(null);
    if (biz.services && biz.services.length > 0) {
      setSelectedService(biz.services[0]);
    } else {
      setSelectedService('Code Review');
    }
    setOtherServiceText('');
  };

  const handleStartCustom = () => {
    setSelectedBusiness(null);
    setIsCustomEmailMode(true);
    setSelectedService('Code Review');
    setOtherServiceText('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let targetEmail = '';
    let targetName = '';
    let targetAvatar = '';

    if (isCustomEmailMode) {
      if (!customEmail.trim() || !customEmail.includes('@')) {
        setError('Please enter a valid business email address.');
        return;
      }
      targetEmail = customEmail.trim().toLowerCase();
      targetName = customName.trim() || customEmail.split('@')[0] + ' Workspace';
    } else if (selectedBusiness) {
      targetEmail = selectedBusiness.email.trim().toLowerCase();
      targetName = selectedBusiness.name;
      targetAvatar = selectedBusiness.avatar || '';
    } else {
      setError('Please select a business to start a conversation with.');
      return;
    }

    if (selectedService === 'Other' && !otherServiceText.trim()) {
      setError('Please specify the topic or service in the text field.');
      return;
    }

    const finalWorkspaceName = effectiveWorkspaceName || 'General Consultation';

    try {
      await onInitiate({
        businessEmail: targetEmail,
        businessName: targetName,
        businessAvatar: targetAvatar,
        workspaceName: finalWorkspaceName,
        initialMessage: initialMessage.trim(),
      });

      // Reset form
      setSearchQuery('');
      setSelectedBusiness(null);
      setIsCustomEmailMode(false);
      setCustomEmail('');
      setCustomName('');
      setSelectedService('Code Review');
      setOtherServiceText('');
      setInitialMessage('');
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation.');
    }
  };

  const handleBackToSearch = () => {
    setSelectedBusiness(null);
    setIsCustomEmailMode(false);
    setError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-gray-100 flex items-start justify-between bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-xs">
              <Building2 size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                {selectedBusiness || isCustomEmailMode
                  ? 'Start Conversation'
                  : 'Find & Select a Business'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedBusiness || isCustomEmailMode
                  ? 'Compose your first message to initiate the discussion.'
                  : 'Clients initiate direct conversations with verified businesses on Orqland.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {!selectedBusiness && !isCustomEmailMode ? (
            /* Step 1: Search and Select Business */
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search businesses by name, category, or service..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 hover:bg-gray-100/80 focus:bg-white border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-xl text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none transition-all"
                />
              </div>

              {/* Businesses Catalog List */}
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {filteredBusinesses.length === 0 ? (
                  <div className="text-center py-8 px-4 bg-gray-50/60 rounded-2xl border border-dashed border-gray-200">
                    <Building2 size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-xs font-bold text-gray-700">No businesses match &ldquo;{searchQuery}&rdquo;</p>
                    <p className="text-[11px] text-gray-400 mt-1 max-w-xs mx-auto">
                      You can still connect by typing their direct business email address below.
                    </p>
                    <button
                      type="button"
                      onClick={handleStartCustom}
                      className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-800 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                    >
                      <Mail size={13} />
                      <span>Enter Direct Business Email</span>
                    </button>
                  </div>
                ) : (
                  filteredBusinesses.map((biz) => {
                    return (
                      <div
                        key={biz.id}
                        onClick={() => handleSelectBusiness(biz)}
                        className="group relative flex items-start gap-3.5 p-3.5 rounded-2xl border border-gray-200/90 hover:border-blue-300 hover:bg-blue-50/30 transition-all cursor-pointer shadow-xs hover:shadow-sm"
                      >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0 mt-0.5">
                          <UserAvatar
                            src={biz.avatar}
                            name={biz.name}
                            size={44}
                          />
                          {biz.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <h4 className="text-xs sm:text-sm font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                              {biz.name}
                            </h4>
                            {biz.verified && (
                              <span title="Verified Business" className="flex-shrink-0">
                                <CheckCircle2 size={14} className="text-blue-500 fill-blue-50" />
                              </span>
                            )}
                            <span className="ml-auto text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md flex-shrink-0">
                              {biz.wsid}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100/80">
                              {biz.category}
                            </span>
                            <span className="text-[10px] font-medium text-gray-400 truncate">
                              {biz.email}
                            </span>
                          </div>

                          <p className="text-[11px] text-gray-500 line-clamp-2 leading-relaxed">
                            {biz.description}
                          </p>

                          {/* Quick Services pills */}
                          {biz.services && biz.services.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {biz.services.slice(0, 3).map((srv) => (
                                <span
                                  key={srv}
                                  className="text-[9px] font-medium text-gray-600 bg-gray-50 border border-gray-200/80 px-2 py-0.5 rounded-md"
                                >
                                  {srv}
                                </span>
                              ))}
                              {biz.services.length > 3 && (
                                <span className="text-[9px] text-gray-400">
                                  +{biz.services.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="self-center flex-shrink-0 text-gray-300 group-hover:text-blue-600 transition-colors">
                          <ChevronRight size={18} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Enter Custom Business Email Option */}
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Need to message another business?</span>
                <button
                  type="button"
                  onClick={handleStartCustom}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  <Mail size={13} />
                  <span>Enter Custom Business Email</span>
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Selected Business & Compose First Message */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Selected Business Preview Header */}
              {selectedBusiness ? (
                <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      src={selectedBusiness.avatar}
                      name={selectedBusiness.name}
                      size={40}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                          {selectedBusiness.name}
                        </span>
                        {selectedBusiness.verified && (
                          <CheckCircle2 size={13} className="text-blue-500 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 truncate block">
                        {selectedBusiness.email} • {selectedBusiness.category}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleBackToSearch}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex-shrink-0 cursor-pointer px-2 py-1"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Mail size={14} className="text-blue-600" />
                      <span>Custom Business Account</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleBackToSearch}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      Back to Directory
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Business Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="business@example.com"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                      Business Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Acme Tech Works"
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Service / Consultation Topic */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Inquiry Topic or Service <span className="text-red-500">*</span>
                </label>
                
                {/* Dropdown Select with Briefcase Icon */}
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <Briefcase size={16} />
                  </div>
                  <select
                    value={selectedService}
                    onChange={(e) => {
                      setSelectedService(e.target.value);
                      if (e.target.value !== 'Other') {
                        setOtherServiceText('');
                      }
                    }}
                    className="w-full pl-10 pr-9 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs text-gray-900 font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer"
                  >
                    {availableServices.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                    <option value="Other">Other (type your own)</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <ChevronDown size={15} />
                  </div>
                </div>

                {/* If "Other" is selected, show custom input field */}
                {selectedService === 'Other' && (
                  <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    <input
                      type="text"
                      autoFocus
                      required
                      value={otherServiceText}
                      onChange={(e) => setOtherServiceText(e.target.value)}
                      placeholder="Specify your inquiry topic or service..."
                      className="w-full px-3.5 py-2.5 bg-white border border-blue-300 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all shadow-xs"
                    />
                  </div>
                )}
              </div>

              {/* Initial Message */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Initial Message <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={initialMessage}
                  onChange={(e) => setInitialMessage(e.target.value)}
                  placeholder="Hello! I would like to inquire about your consultation and services..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all resize-none"
                />
              </div>

              {/* Actions Footer */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleBackToSearch}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send size={13} />
                  <span>{isSubmitting ? 'Starting Conversation...' : 'Start Conversation'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
