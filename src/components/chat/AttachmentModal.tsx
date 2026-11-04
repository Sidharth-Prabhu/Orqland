'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Paperclip, X, AlertTriangle, FileText, UploadCloud, AlertCircle, Plus } from 'lucide-react';
import { validateAttachmentFile } from '@/lib/security';
import { generatePdfThumbnail } from '@/lib/pdfThumbnail';
import { ChatAttachment } from '@/types/chat';

interface AttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendAttachment: (
    attachment: ChatAttachment,
    optionalText?: string,
    attachments?: ChatAttachment[]
  ) => Promise<void>;
}

interface SelectedItem {
  file: File;
  previewUrl: string;
  type: 'image' | 'pdf';
}

function buildFileAttachment(
  file: File,
  base64Data: string,
  fileType: 'image' | 'pdf',
  thumbnailUrl?: string
): ChatAttachment {
  const now = Date.now();
  return {
    id: `att-${now}-${Math.random().toString(36).slice(2, 6)}`,
    type: fileType,
    name: file.name,
    url: base64Data,
    thumbnailUrl: thumbnailUrl || undefined,
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
  const [items, setItems] = useState<SelectedItem[]>([]);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);

    const newFiles = Array.from(fileList);
    const existingCount = items.length;

    if (existingCount + newFiles.length > 6) {
      setError('You can select a maximum of 6 pictures at once.');
      return;
    }

    const validatedItems: SelectedItem[] = [];

    for (const file of newFiles) {
      const validation = validateAttachmentFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Invalid file format. Please upload JPG, PNG, WebP or PDF.');
        return;
      }
      const type = validation.attachmentType === 'pdf' ? 'pdf' : 'image';
      let previewUrl = '';
      if (type === 'image') {
        previewUrl = URL.createObjectURL(file);
      } else {
        // Generate PDF first page thumbnail
        try {
          previewUrl = await generatePdfThumbnail(file);
        } catch {
          previewUrl = '';
        }
      }
      validatedItems.push({ file, previewUrl, type });
    }

    setItems((prev) => [...prev, ...validatedItems]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset input value so same files can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => {
      const itemToRemove = prev[index];
      if (itemToRemove && itemToRemove.previewUrl) {
        URL.revokeObjectURL(itemToRemove.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
    setError(null);
  };

  const handleSend = async () => {
    if (items.length === 0) {
      setError('Please select at least one picture or file.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Read all files as Base64 asynchronously and attach first-page thumbnails
      const readPromises = items.map(
        (item) =>
          new Promise<ChatAttachment>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async () => {
              const base64Data = reader.result as string;
              let thumb = item.previewUrl;
              if (item.type === 'pdf' && (!thumb || thumb.startsWith('blob:'))) {
                try {
                  thumb = await generatePdfThumbnail(item.file);
                } catch {
                  thumb = '';
                }
              }
              resolve(buildFileAttachment(item.file, base64Data, item.type, thumb));
            };
            reader.onerror = () => reject(new Error(`Failed to read file ${item.file.name}`));
            reader.readAsDataURL(item.file);
          })
      );

      const attachments = await Promise.all(readPromises);

      // Primary attachment is the first item, full list is in attachments batch
      await onSendAttachment(attachments[0], caption, attachments);
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    // Revoke any created object URLs
    items.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setItems([]);
    setCaption('');
    setError(null);
    setIsUploading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
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
              Share Pictures & Files
            </h3>
            <p className="text-xs text-gray-500">
              Select up to 6 pictures at once. Supports Images (JPG, PNG, WebP) and PDF documents.
            </p>
          </div>
        </div>

        {/* 48-Hour Auto-Deletion Compact Warning Alert */}
        <div className="mb-4 px-3 py-2 bg-amber-50/90 border border-amber-200/80 rounded-xl flex items-center gap-2 text-[11px] text-amber-900">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
          <span className="leading-tight">
            <strong>48-Hour Retention:</strong> Shared files are automatically deleted after 48 hours.
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Hidden Multiple File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
        />

        {items.length === 0 ? (
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
              Select up to 6 pictures at once (Max 10 MB per file)
            </p>
          </div>
        ) : (
          <div className="mb-4 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
            {/* Header / Counter */}
            <div className="flex items-center justify-between mb-2.5 px-0.5">
              <span className="text-xs font-bold text-gray-700">
                Selected ({items.length}/6)
              </span>
              <button
                type="button"
                onClick={() => setItems([])}
                className="text-[11px] font-semibold text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            </div>

            {/* Horizontal Grid in Single Line with Horizontal Scroll */}
            <div className="flex items-center gap-2.5 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-gray-200">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="relative flex-shrink-0 w-20 h-20 sm:w-22 sm:h-22 rounded-xl overflow-hidden bg-white border border-gray-200 shadow-2xs group"
                >
                  {item.type === 'image' || (item.type === 'pdf' && item.previewUrl) ? (
                    <Image
                      src={item.previewUrl}
                      alt={item.file.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 text-red-600 p-2">
                      <FileText size={24} />
                      <span className="text-[9px] font-bold mt-1 text-red-700 truncate max-w-full">
                        PDF
                      </span>
                    </div>
                  )}

                  {/* Remove Button on Top Right */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer"
                    title="Remove picture"
                  >
                    <X size={11} strokeWidth={2.5} />
                  </button>
                </div>
              ))}

              {/* Plus (+) Button to Add More Pictures up to 6 */}
              {items.length < 6 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-shrink-0 w-20 h-20 sm:w-22 sm:h-22 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/40 text-gray-400 hover:text-blue-600 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group"
                  title="Add more pictures"
                >
                  <Plus size={20} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-semibold">Add more</span>
                </button>
              )}
            </div>

            {/* Optional Caption */}
            <div className="mt-3 pt-2.5 border-t border-gray-200/70">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Add an optional message or note..."
                className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition-all"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
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
            disabled={items.length === 0 || isUploading}
            className="px-5 py-2.5 bg-black hover:bg-gray-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-40"
          >
            {isUploading ? 'Sending...' : items.length > 1 ? `Send ${items.length} Pictures` : 'Send Picture'}
          </button>
        </div>
      </div>
    </div>
  );
};
