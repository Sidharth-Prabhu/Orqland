'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';

interface ChatImageAttachmentProps {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  onClick?: () => void;
  aspectRatioClass?: string;
}

export const ChatImageAttachment: React.FC<ChatImageAttachmentProps> = ({
  src,
  alt,
  className = '',
  fill = false,
  width,
  height,
  sizes,
  priority = false,
  onClick,
  aspectRatioClass = 'aspect-4/3',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div
      onClick={onClick}
      className={`relative w-full overflow-hidden select-none ${fill ? 'h-full' : ''} ${className}`}
    >
      {/* Engaging Skeleton / Shimmer Loader while image is loading */}
      {!isLoaded && !hasError && (
        <div
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center bg-gradient-to-tr from-slate-100 via-indigo-50/60 to-purple-50/40 animate-pulse overflow-hidden rounded-inherit ${
            !fill ? aspectRatioClass : ''
          }`}
        >
          {/* Shimmer sweep effect */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Central Animated Badge */}
          <div className="relative flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/70 backdrop-blur-xs border border-white/80 shadow-xs">
            <div className="relative">
              <Loader2 size={18} className="text-indigo-600 animate-spin" />
              <Sparkles size={9} className="text-purple-500 absolute -top-1 -right-1 animate-ping" />
            </div>
            <span className="text-[10px] font-semibold text-slate-600 tracking-tight flex items-center gap-1">
              <span>Loading media</span>
            </span>
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {hasError ? (
        <div className="w-full h-full min-h-[120px] flex flex-col items-center justify-center bg-gray-100 text-gray-400 p-4">
          <ImageIcon size={24} className="mb-1 text-gray-300" />
          <span className="text-[11px] font-medium">Unable to load image</span>
        </div>
      ) : fill ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setIsLoaded(true);
            setHasError(true);
          }}
          className={`object-cover transition-all duration-300 ${
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={width || 320}
          height={height || 200}
          sizes={sizes}
          priority={priority}
          unoptimized
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setIsLoaded(true);
            setHasError(true);
          }}
          className={`object-cover w-full h-auto transition-all duration-300 ${
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        />
      )}
    </div>
  );
};
