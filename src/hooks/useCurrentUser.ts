'use client';

import { useEffect, useState } from 'react';
import type { CurrentUser } from '@/lib/userTypes';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong';
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function loadCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch('/api/auth/me', { cache: 'no-store' });
  if (response.status === 401) {
    return null;
  }

  const data = await parseJsonResponse<{ user: CurrentUser; error?: string }>(response);
  if (!response.ok) {
    throw new Error(data.error || 'Failed to load session');
  }

  return data.user;
}

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  async function refreshCurrentUser() {
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      setCurrentUser(await loadCurrentUser());
    } catch (error) {
      setAuthError(toErrorMessage(error));
    } finally {
      setIsAuthLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      setIsAuthLoading(true);
      setAuthError(null);

      try {
        setCurrentUser(await loadCurrentUser());
      } catch (error) {
        setAuthError(toErrorMessage(error));
      } finally {
        setIsAuthLoading(false);
      }
    })();
  }, []);

  return {
    currentUser,
    setCurrentUser,
    isAuthLoading,
    authError,
    setAuthError,
    refreshCurrentUser,
    clearCurrentUser() {
      setCurrentUser(null);
    },
  };
}
