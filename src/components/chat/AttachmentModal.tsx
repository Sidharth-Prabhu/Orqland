'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Paperclip, X, AlertTriangle, FileText, UploadCloud, AlertCircle } from 'lucide-react';
import { validateAttachmentFile } from '@/lib/security';
import { ChatAttachment } from '@/types/chat';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendAttachment: (attachment: ChatAttachment, optionalText?: string) => Promise<void>;
}

function buildFileAttachment(
  file: File,
  base64Data: string,
  fileType: 'image' | 'pdf'
): ChatAttachment {
  const now = Date.now();
  return {
    id: `att-${now}-${Math.random().toString(36).slice(2, 6)}`,
    type: fileType,
    name: file.name,
    url: base64Data,
    size: file.size,
    mimeType: file.type,
    uploadedAt: now,
    expiresAt: now + 48 * 60 * 60 * 1000,
  };
}

export const AttachmentModal: React.FC<AttachmentModalProps> = ({
  isOpen,
  onClose,
  onSendAttachment,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'image' | 'pdf' | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAttachmentFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file format.');
      return;
    }

    setSelectedFile(file);
    setFileType(validation.attachmentType === 'pdf' ? 'pdf' : 'image');

    if (validation.attachmentType === 'image') {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleSend = async () => {
    if (!selectedFile || !fileType) {
      setError('Please select a file to send.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Read file into Data URL for storage
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result as string;
        const attachment = buildFileAttachment(selectedFile, base64Data, fileType);
        await onSendAttachment(attachment, caption);
        handleClose();
      };

      reader.onerror = () => {
        setError('Failed to read file. Please try again.');
        setIsUploading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setFileType(null);
    setCaption('');
    setError(null);
    setIsUploading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Paperclip size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Share File Attachment
            </h3>
            <p className="text-xs text-gray-500">
              Supports Images (JPG, PNG, WebP) and PDF documents only.
            </p>
          </div>
        </div>

        {/* 48-Hour Auto-Deletion Warning Alert */}
        <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 leading-relaxed">
          <AlertTriangle size={17} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="block font-bold mb-0.5 text-amber-900">
              Automatic 48-Hour Permanent Deletion
            </strong>
            All shared images and PDF documents are automatically and permanently deleted after 48 hours from upload. Please do not share files that require permanent retention.
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* File Dropzone / Picker */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
        />

        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-gray-50/50 hover:bg-blue-50/20 mb-4"
          >
            <div className="w-12 h-12 rounded-full bg-blue-100/60 text-blue-600 flex items-center justify-center mb-2.5">
              <UploadCloud size={24} />
            </div>
            <p className="text-xs font-bold text-gray-800">
              Click to browse your device
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              JPG, JPEG, PNG, WebP, or PDF (Max 10 MB)
            </p>
          </div>
        ) : (
          <div className="mb-4 p-4 rounded-2xl bg-gray-50 border border-gray-200/80">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                {fileType === 'image' ? (
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 relative">
                    {previewUrl && (
                      <Image
                        src={previewUrl}
                        alt="Preview"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                    <FileText size={20} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate max-w-[240px]">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {fileType?.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                  setFileType(null);
                }}
                className="text-xs font-semibold text-gray-500 hover:text-red-600"
              >
                Change
              </button>
            </div>

            {/* Optional Caption */}
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add an optional message or note..."
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selectedFile || isUploading}
            className="px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-40"
          >
            {isUploading ? 'Sending...' : 'Send Attachment'}
          </button>
        </div>
      </div>
    </div>
  );
};
