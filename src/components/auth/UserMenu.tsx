'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogOut, LogIn, ShieldCheck, Mail, Building2, User as UserIcon } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface UserMenuProps {
  onOpenAuthModal: () => void;
  variant?: 'client' | 'business';
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenAuthModal }) => {
  const { user, signOutUser, isAuthenticating } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setIsOpen(false);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // If unauthenticated, show a clean "Sign In" CTA button
  if (!user) {
    return (
      <button
        onClick={onOpenAuthModal}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black text-white hover:bg-gray-800 transition-all text-xs font-bold shadow-sm cursor-pointer"
      >
        <LogIn size={13} strokeWidth={2.4} />
        <span>Sign In</span>
      </button>
    );
  }

  // Determine display values
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const displayEmail = user.email || 'No email';
  const isGoogle = user.providerData.some((p) => p.providerId === 'google.com');

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Profile Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer group focus:outline-none"
        aria-expanded={isOpen}
      >
        <div className="text-right hidden sm:block">
          <div className="text-[14px] font-bold text-black leading-tight group-hover:text-blue-600 transition-colors">
            {displayName}
          </div>
          <div className="text-[11px] text-gray-400 font-medium truncate max-w-[140px]">
            {displayEmail}
          </div>
        </div>

        {/* Avatar or Monogram */}
        <div className="relative">
          <UserAvatar
            src={user.photoURL}
            name={displayName}
            size={36}
          />
          {/* Active online dot */}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10e588] ring-2 ring-white" />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-white shadow-xl ring-1 ring-black/5 divide-y divide-gray-100 z-50 animate-in fade-in zoom-in-95 duration-100">
          {/* Header Info */}
          <div className="p-4">
            <div className="flex items-center gap-3">
              <UserAvatar
                src={user.photoURL}
                name={displayName}
                size={40}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
                <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
              </div>
            </div>

            {/* Role Badge */}
            <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/80 border border-blue-100 rounded-lg text-[11px] font-semibold text-blue-700">
              {user.email?.toLowerCase() === 'mailtosidharth.me@gmail.com' ? (
                <>
                  <Building2 size={13} className="text-blue-600 flex-shrink-0" />
                  <span>Business Workspace Account</span>
                </>
              ) : (
                <>
                  <UserIcon size={13} className="text-blue-600 flex-shrink-0" />
                  <span>Client Account</span>
                </>
              )}
            </div>

            <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-lg text-[11px] text-gray-600 font-medium">
              {isGoogle ? (
                <>
                  <ShieldCheck size={13} className="text-blue-600 flex-shrink-0" />
                  <span>Google Account Verified</span>
                </>
              ) : (
                <>
                  <Mail size={13} className="text-gray-500 flex-shrink-0" />
                  <span>Email Account</span>
                </>
              )}
            </div>
          </div>

          {/* Action List */}
          <div className="p-1.5">
            <button
              onClick={handleSignOut}
              disabled={isAuthenticating}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut size={14} />
              <span>{isAuthenticating ? 'Signing out...' : 'Sign out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
