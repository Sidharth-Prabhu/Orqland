'use client';

import React, { useEffect, useMemo } from 'react';
import { X, ExternalLink, Download, FileText, AlertCircle } from 'lucide-react';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  pdfName?: string;
  pdfSize?: number;
}

function base64ToBlobUrl(dataUrl: string): string {
  try {
    const parts = dataUrl.split(';base64,');
    const contentType = parts[0].replace('data:', '') || 'application/pdf';
    const base64Data = parts[1] || parts[0];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Error creating PDF Blob URL:', err);
    return dataUrl;
  }
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  pdfName = 'Document.pdf',
  pdfSize,
}) => {
  // Generate a safe Blob URL from data URL via useMemo
  const blobUrl = useMemo(() => {
    if (!isOpen || !pdfUrl) return '';
    if (pdfUrl.startsWith('data:')) {
      return base64ToBlobUrl(pdfUrl);
    }
    return pdfUrl;
  }, [isOpen, pdfUrl]);

  // Clean up Blob URL when unmounted or changed
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

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

  const formattedSize = useMemo(() => {
    if (!pdfSize) return '';
    if (pdfSize > 1024 * 1024) {
      return `${(pdfSize / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(pdfSize / 1024).toFixed(1)} KB`;
  }, [pdfSize]);

  if (!isOpen || !pdfUrl) return null;

  const handleOpenInNewWindow = () => {
    if (!blobUrl) return;
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="PDF Viewer"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      {/* Top Header Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex items-center justify-between text-white py-2.5 px-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 z-10 cursor-default mb-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-400/30 flex items-center justify-center text-red-400 flex-shrink-0">
            <FileText size={18} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold truncate text-white">{pdfName}</h4>
            <p className="text-[10px] text-gray-300">
              {formattedSize ? `${formattedSize} • ` : ''}PDF Document • Auto-deletes in 48h
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Download button */}
          {blobUrl && (
            <a
              href={blobUrl}
              download={pdfName}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Download PDF"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Download</span>
            </a>
          )}

          {/* Open in new tab button */}
          {blobUrl && (
            <button
              type="button"
              onClick={handleOpenInNewWindow}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Open in new window"
            >
              <ExternalLink size={14} />
              <span className="hidden sm:inline">Open in New Tab</span>
            </button>
          )}

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-white hover:bg-white/15 rounded-xl transition-colors cursor-pointer ml-1"
            title="Close viewer (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Embedded PDF Viewer Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex-1 w-full max-w-5xl flex flex-col items-center justify-center my-auto overflow-hidden bg-gray-900 rounded-2xl shadow-2xl border border-white/10"
      >
        {blobUrl ? (
          <iframe
            src={`${blobUrl}#toolbar=1&navpanes=0`}
            title={pdfName}
            className="w-full h-full min-h-[60vh] sm:min-h-[75vh] border-0 rounded-2xl bg-white"
          />
        ) : (
          <div className="p-8 text-center text-gray-400">
            <AlertCircle size={32} className="mx-auto mb-2 text-gray-500 animate-spin" />
            <p className="text-xs">Preparing PDF document...</p>
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="text-center text-xs text-white/60 pt-2 pointer-events-none">
        Press <kbd className="px-1.5 py-0.5 bg-white/15 rounded text-[10px] text-white font-mono">Esc</kbd> or click outside to close
      </div>
    </div>
  );
};
