'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { X, ExternalLink, Download, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export interface GalleryItem {
  url: string;
  name?: string;
}

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName?: string;
  images?: GalleryItem[];
  currentIndex?: number;
  onIndexChange?: (newIndex: number) => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  imageName = 'Image',
  images = [],
  currentIndex = 0,
  onIndexChange,
}) => {
  const hasMultiple = images.length > 1;
  const thumbnailsContainerRef = useRef<HTMLDivElement>(null);

  const handlePrev = useCallback(() => {
    if (!hasMultiple || !onIndexChange) return;
    const prev = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    onIndexChange(prev);
  }, [hasMultiple, onIndexChange, currentIndex, images.length]);

  const handleNext = useCallback(() => {
    if (!hasMultiple || !onIndexChange) return;
    const next = currentIndex === images.length - 1 ? 0 : currentIndex + 1;
    onIndexChange(next);
  }, [hasMultiple, onIndexChange, currentIndex, images.length]);

  // Auto-scroll selected thumbnail into view smoothly
  useEffect(() => {
    if (thumbnailsContainerRef.current) {
      const activeEl = thumbnailsContainerRef.current.children[currentIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }
  }, [currentIndex]);

  // Arrow key navigation (Left / Right) & Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, handlePrev, handleNext]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image Preview"
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-3 sm:p-5 bg-black/90 backdrop-blur-md animate-in fade-in duration-200 select-none cursor-zoom-out"
    >
      {/* Top Controls Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex items-center justify-between text-white py-2 px-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 z-10 cursor-default shadow-lg"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
            <ImageIcon size={18} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold truncate text-white">{imageName}</h4>
              {hasMultiple && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-blue-200 shrink-0">
                  {currentIndex + 1} / {images.length}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-300">Auto-deletes after 48 hours</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
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

      {/* Main Image Container with Next / Prev buttons */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex-1 w-full max-w-5xl flex items-center justify-center p-2 sm:p-4 my-auto overflow-hidden cursor-default group"
      >
        {/* Previous Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-2 sm:left-4 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Previous image (← Arrow key)"
            aria-label="Previous Image"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={imageUrl}
          src={imageUrl}
          alt={imageName}
          className="max-h-[66vh] sm:max-h-[70vh] max-w-[92vw] sm:max-w-full object-contain rounded-2xl shadow-2xl ring-1 ring-white/15 transition-all duration-200 animate-in fade-in zoom-in-95"
        />

        {/* Next Button */}
        {hasMultiple && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-2 sm:right-4 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title="Next image (→ Arrow key)"
            aria-label="Next Image"
          >
            <ChevronRight size={24} />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip (WhatsApp style) */}
      {hasMultiple ? (
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl z-10 flex flex-col items-center gap-1.5 cursor-default"
        >
          <div
            ref={thumbnailsContainerRef}
            className="flex items-center gap-2 p-1.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/15 overflow-x-auto max-w-full scrollbar-none shadow-xl"
          >
            {images.map((item, idx) => {
              const isSelected = idx === currentIndex;
              return (
                <button
                  key={item.url + idx}
                  type="button"
                  onClick={() => onIndexChange?.(idx)}
                  className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden flex-shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'ring-2 ring-blue-500 scale-105 shadow-md opacity-100'
                      : 'opacity-50 hover:opacity-85 hover:scale-100 ring-1 ring-white/20'
                  }`}
                  title={item.name || `Image ${idx + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.name || `Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {isSelected && (
                    <div className="absolute inset-0 border-2 border-white rounded-xl pointer-events-none" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="text-[10px] sm:text-[11px] text-gray-400 font-medium">
            Use <strong>←</strong> / <strong>→</strong> keys or click thumbnails to switch
          </div>
        </div>
      ) : (
        <div
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-gray-300 font-medium z-10 bg-black/40 px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-xs"
        >
          Click outside or press <strong>Esc</strong> to close
        </div>
      )}
    </div>
  );
};
