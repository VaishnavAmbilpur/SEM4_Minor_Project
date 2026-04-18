'use client';

import Link from 'next/link';
import { Home, UserRound, LogOut } from 'lucide-react';
import type { CurrentUser } from '@/lib/userTypes';

interface Props {
  active: 'home' | 'account';
  currentUser: CurrentUser | null;
  onLogout?: () => void | Promise<void>;
}

function linkClass(isActive: boolean) {
  return `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
    isActive
      ? 'bg-white text-black'
      : 'bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white'
  }`;
}

export default function TopNav({ active, currentUser, onLogout }: Props) {
  return (
    <header className="w-full max-w-7xl mx-auto px-6 pt-8 relative z-10">
      <div className="rounded-[2rem] border border-white/10 bg-black/30 backdrop-blur-2xl px-6 py-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-neutral-500">Form Intelligence</p>
          <h1 className="text-xl font-semibold text-white tracking-tight">AutoFill AI</h1>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <nav className="flex flex-wrap gap-2">
            <Link href="/" className={linkClass(active === 'home')}>
              <Home className="w-4 h-4" />
              Home
            </Link>
            <Link href="/account" className={linkClass(active === 'account')}>
              <UserRound className="w-4 h-4" />
              Account
            </Link>
          </nav>

          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-white">{currentUser.name}</p>
                <p className="text-xs text-neutral-400">{currentUser.email}</p>
              </div>
              {onLogout ? (
                <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-200 hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Sign in to upload, map, and persist your form data.</p>
          )}
        </div>
      </div>
    </header>
  );
}
