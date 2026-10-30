'use client';

import React from 'react';
import { Home, Send, Bookmark, TrendingUp, Activity, ExternalLink } from 'lucide-react';
import { UserProfile } from '@/types/chat';
import { UserMenu } from '@/components/auth/UserMenu';

interface ClientTopBarProps {
  user?: UserProfile;
  activeNavTab?: string;
  onNavTabChange?: (tab: string) => void;
  onOpenAuthModal?: () => void;
}

export const ClientTopBar: React.FC<ClientTopBarProps> = ({
  activeNavTab = 'Inbox',
  onNavTabChange,
  onOpenAuthModal,
}) => {
  const navItems = [
    { id: 'Explore', label: 'Explore', icon: Home },
    { id: 'Inbox', label: 'Inbox', icon: Send, hasBadge: true },
    { id: 'Wishlist', label: 'Wishlist', icon: Bookmark },
    { id: 'My Activity', label: 'My Activity', icon: TrendingUp },
    { id: 'Orqland Run', label: 'Orqland Run', icon: Activity },
  ];

  return (
    <div className="w-full bg-white">
      {/* Top breadcrumb label as seen in Image 3 */}
      <div className="text-[13px] text-gray-400 font-normal px-8 pt-2.5 pb-1 select-none bg-white">
        Homepage
      </div>

      {/* Main Client Top Navigation Bar */}
      <header className="w-full bg-[#f6f7f9] border-b border-gray-200/80 px-8 py-3.5 flex items-center justify-between">
        {/* Left: Brand Logo & 6 Colorful Dots */}
        <div className="flex flex-col items-start select-none cursor-pointer">
          <span className="text-[28px] font-extrabold tracking-tight text-black leading-none font-sans">
            Orqland
          </span>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff6b22]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffd026]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#10e588]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#1fd5f9]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#9d5cf7]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff2d87]" />
          </div>
        </div>

        {/* Center: Rounded Pill Navigation Menu */}
        <nav className="hidden lg:flex items-center bg-[#f1f3f5] rounded-full p-1 border border-gray-200/60 shadow-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavTabChange?.(item.id)}
                className={`relative flex items-center gap-2 px-5 py-2 rounded-full text-[14px] font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-white text-black shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                    : 'text-gray-700 hover:text-black hover:bg-white/50'
                }`}
              >
                <Icon size={16} strokeWidth={isActive ? 2.3 : 2} className="text-black" />
                <span>{item.label}</span>
                {item.hasBadge && (
                  <span className="w-2 h-2 rounded-full bg-[#2563eb] absolute -top-0.5 right-2 ring-2 ring-white" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Workspace Link & Client Profile */}
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-1 text-[14px] font-semibold text-black hover:text-blue-600 transition-colors">
            <span>Create workspace</span>
            <ExternalLink size={14} strokeWidth={2.2} />
          </button>

          {/* Vertical Divider */}
          <div className="h-9 w-[1px] bg-gray-300/80" />

          {/* User Menu / Profile */}
          <UserMenu onOpenAuthModal={onOpenAuthModal || (() => {})} />
        </div>
      </header>
    </div>
  );
};
