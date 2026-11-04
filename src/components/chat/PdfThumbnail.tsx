'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { FileText, Loader2 } from 'lucide-react';
import { generatePdfThumbnail } from '@/lib/pdfThumbnail';

interface PdfThumbnailProps {
  url: string;
  name: string;
  thumbnailUrl?: string;
  className?: string;
  badgeText?: string;
}

export const PdfThumbnail: React.FC<PdfThumbnailProps> = ({
  url,
  name,
  thumbnailUrl: initialThumbnail,
  className = '',
  badgeText = 'PDF Document',
}) => {
  const [asyncThumbnail, setAsyncThumbnail] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(!initialThumbnail && !!url);

  const displayThumbnail = initialThumbnail || asyncThumbnail;

  useEffect(() => {
    let isCancelled = false;

    if (initialThumbnail || !url) {
      return;
    }

    generatePdfThumbnail(url)
      .then((thumb) => {
        if (!isCancelled) {
          setAsyncThumbnail(thumb);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to generate thumbnail for', name, err);
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [url, initialThumbnail, name]);

  if (displayThumbnail) {
    return (
      <div className={`relative w-full h-full bg-white overflow-hidden ${className}`}>
        <Image
          src={displayThumbnail}
          alt={name}
          fill
          className="object-cover object-top transition-transform duration-200 group-hover/pdf:scale-105"
          unoptimized
        />
        {/* Subtle PDF tag in top corner */}
        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-600/90 backdrop-blur-xs text-white text-[9px] font-extrabold shadow-xs pointer-events-none">
          PDF
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full bg-red-50/70 flex flex-col items-center justify-center p-2 text-center relative overflow-hidden ${className}`}>
      {isLoading ? (
        <div className="flex flex-col items-center justify-center text-red-500">
          <Loader2 size={20} className="animate-spin mb-1 text-red-500" />
          <span className="text-[9px] font-semibold text-red-600">Rendering preview...</span>
        </div>
      ) : (
        <>
          <div className="w-10 h-10 rounded-xl bg-white text-red-600 flex items-center justify-center shadow-2xs group-hover/pdf:scale-110 transition-transform">
            <FileText size={22} />
          </div>
          {badgeText && (
            <span className="text-[9px] font-bold text-red-700 bg-red-100/90 px-1.5 py-0.5 rounded-md mt-1">
              {badgeText}
            </span>
          )}
        </>
      )}
    </div>
  );
};
