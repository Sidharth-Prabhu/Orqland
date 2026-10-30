'use client';

import React, { useState } from 'react';
import Image from 'next/image';

interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  priority?: boolean;
}

// Deterministic pleasing gradient backgrounds based on user name
const GRADIENTS = [
  'from-blue-600 to-indigo-600',
  'from-purple-600 to-pink-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-red-600',
  'from-cyan-500 to-blue-600',
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  size = 40,
  className = '',
  priority = false,
}) => {
  const [hasError, setHasError] = useState(false);

  const displayName = name?.trim() || 'User';
  const initial = displayName.charAt(0).toUpperCase() || 'U';
  const gradient = getGradient(displayName);

  // Clean and validate src URL
  const validSrc =
    src &&
    typeof src === 'string' &&
    src.trim() !== '' &&
    !src.includes('images.unsplash.com') && // Do not show generic unsplash woman placeholder
    !hasError
      ? src.trim()
      : null;

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold select-none shadow-sm ${
        validSrc ? 'bg-gray-100' : `bg-gradient-to-tr ${gradient} text-white`
      } ${className}`}
    >
      {validSrc ? (
        <Image
          src={validSrc}
          alt={displayName}
          width={size}
          height={size}
          priority={priority}
          unoptimized
          onError={() => setHasError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span
          style={{ fontSize: Math.max(11, Math.round(size * 0.4)) }}
          className="font-bold leading-none uppercase"
        >
          {initial}
        </span>
      )}
    </div>
  );
};

