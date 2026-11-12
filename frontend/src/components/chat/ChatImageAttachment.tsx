'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Loader2, RefreshCw, Sparkles, Image as ImageIcon } from 'lucide-react';

interface ChatImageAttachmentProps {
  src: string;
  fallbackUrl?: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  isSending?: boolean;
  onClick?: () => void;
  aspectRatioClass?: string;
}

export const ChatImageAttachment: React.FC<ChatImageAttachmentProps> = ({
  src,
  fallbackUrl,
  alt,
  className = '',
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  isSending = false,
  onClick,
  aspectRatioClass = 'aspect-4/3',
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [attemptFallback, setAttemptFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Sync internal state when src or fallbackUrl changes
  useEffect(() => {
    // If src is a dead blob URL or missing, but fallbackUrl is available, prefer fallbackUrl
    if ((!src || (src.startsWith('blob:') && !isSending)) && fallbackUrl) {
      setCurrentSrc(fallbackUrl);
    } else {
      setCurrentSrc(src || fallbackUrl || '');
    }
    setIsLoaded(false);
    setHasError(false);
    setAttemptFallback(false);
  }, [src, fallbackUrl, isSending]);

  const handleError = () => {
    // If we haven't tried the fallbackUrl yet and one exists and is different, switch to it
    if (!attemptFallback && fallbackUrl && fallbackUrl !== currentSrc) {
      setAttemptFallback(true);
      setCurrentSrc(fallbackUrl);
      setIsLoaded(false);
      return;
    }

    // While sending or uploading, keep showing loading rather than failing abruptly
    if (isSending) {
      setIsLoaded(false);
      return;
    }

    setIsLoaded(true);
    setHasError(true);
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasError(false);
    setIsLoaded(false);
    setRetryCount((prev) => prev + 1);
    const targetUrl = fallbackUrl || src;
    if (targetUrl) {
      const sep = targetUrl.includes('?') ? '&' : '?';
      setCurrentSrc(`${targetUrl}${sep}_retry=${Date.now()}`);
    }
  };

  const showLoading = (!isLoaded && !hasError) || isSending || !currentSrc;

  return (
    <div
      onClick={onClick}
      className={`relative w-full overflow-hidden select-none bg-slate-50 ${fill ? 'h-full' : ''} ${className}`}
    >
      {/* Engaging Skeleton / Shimmer Loader while image is loading or uploading */}
      {showLoading && (
        <div
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-tr from-slate-100 via-indigo-50/70 to-purple-50/50 animate-pulse overflow-hidden rounded-inherit ${
            !fill ? aspectRatioClass : ''
          }`}
        >
          {/* Shimmer sweep effect */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />

          {/* Central Animated Badge */}
          <div className="relative flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 backdrop-blur-xs border border-white/90 shadow-xs pointer-events-none">
            <div className="relative flex items-center justify-center">
              <Loader2 size={18} className="text-indigo-600 animate-spin" />
              <Sparkles size={9} className="text-purple-500 absolute -top-1 -right-1 animate-ping" />
            </div>
            <span className="text-[10.5px] font-semibold text-slate-600 tracking-tight flex items-center gap-1">
              <span>{isSending ? 'Uploading...' : 'Loading media...'}</span>
            </span>
          </div>
        </div>
      )}

      {/* Error Fallback with Retry */}
      {hasError && !isSending ? (
        <div
          className={`w-full h-full min-h-[120px] flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100/90 text-gray-500 p-4 border border-gray-200/60 rounded-inherit select-none ${
            !fill ? aspectRatioClass : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-white shadow-2xs border border-gray-200 flex items-center justify-center mb-1.5 text-gray-400">
            <ImageIcon size={16} />
          </div>
          <span className="text-[11px] font-medium text-gray-600 mb-1.5 text-center px-2 line-clamp-1">
            {alt || 'Photo'}
          </span>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-white hover:bg-gray-50 text-indigo-600 border border-gray-200 shadow-2xs hover:border-indigo-300 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw size={10} className="text-indigo-500" />
            <span>Retry</span>
          </button>
        </div>
      ) : currentSrc ? (
        fill ? (
          <Image
            key={`img-fill-${currentSrc}-${retryCount}`}
            src={currentSrc}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
            unoptimized
            onLoad={() => {
              setIsLoaded(true);
              setHasError(false);
            }}
            onError={handleError}
            className={`object-cover transition-all duration-300 ${
              isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />
        ) : (
          <Image
            key={`img-dim-${currentSrc}-${retryCount}`}
            src={currentSrc}
            alt={alt}
            width={width || 320}
            height={height || 200}
            sizes={sizes}
            priority={priority}
            unoptimized
            onLoad={() => {
              setIsLoaded(true);
              setHasError(false);
            }}
            onError={handleError}
            className={`object-cover w-full h-auto transition-all duration-300 ${
              isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          />
        )
      ) : null}
    </div>
  );
};
