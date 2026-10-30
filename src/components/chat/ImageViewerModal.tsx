'use client';

import React, { useEffect } from 'react';
import { X, ExternalLink, Download, Image as ImageIcon } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName?: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageName = 'Image',
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image Preview"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none cursor-zoom-out"
    >
      {/* Top Controls Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex items-center justify-between text-white py-2 px-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 z-10 cursor-default"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ImageIcon size={18} className="text-blue-400 flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold truncate text-white">{imageName}</h4>
            <p className="text-[10px] text-gray-300">Auto-deletes after 48 hours</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Open full-res in new tab */}
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={imageName}
            className="p-2 text-gray-200 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            title="Download / Open original"
          >
            <Download size={18} />
          </a>

          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-200 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer"
            title="Open in new window"
          >
            <ExternalLink size={18} />
          </a>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-200 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer ml-1"
            title="Close viewer (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center p-2 sm:p-4 my-auto overflow-hidden cursor-default"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imageName}
          className="max-h-[78vh] max-w-[92vw] sm:max-w-full object-contain rounded-2xl shadow-2xl ring-1 ring-white/15 transition-transform duration-200"
        />
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-white/60 py-1 pointer-events-none">
        Click anywhere outside or press <kbd className="px-1.5 py-0.5 bg-white/15 rounded text-[10px] text-white font-mono">Esc</kbd> to close
      </div>
    </div>
  );
};

