'use client';

import { useState } from 'react';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import type { CurrentUser } from '@/lib/userTypes';

interface AuthFormState {
  name: string;
  email: string;
  password: string;
}

interface Props {
  onAuthSuccess: (user: CurrentUser) => void;
}

const emptyAuthForm: AuthFormState = {
  name: '',
  email: '',
  password: '',
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Authentication failed';
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export default function AuthPanel({ onAuthSuccess }: Props) {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState<AuthFormState>(emptyAuthForm);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        authMode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : authForm;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await parseJsonResponse<{ user?: CurrentUser; error?: string }>(response);
      if (!response.ok || !data.user) {
        throw new Error(data.error || 'Authentication failed');
      }

      setAuthForm(emptyAuthForm);
      onAuthSuccess(data.user);
    } catch (error) {
      setAuthError(toErrorMessage(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  return (
    <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8">
      <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure Access
            </div>
            <h2 className="mt-4 text-3xl font-bold text-white tracking-tight">
              {authMode === 'login' ? 'Sign in to continue' : 'Create your account'}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              Your MongoDB profile becomes the source of truth for future form matching.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setAuthError(null);
            }}
            className="text-sm text-indigo-300 hover:text-white"
          >
            {authMode === 'login' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {authMode === 'register' ? (
            <input
              type="text"
              placeholder="Full name"
              value={authForm.name}
              onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
              required
            />
          ) : null}
          <input
            type="email"
            placeholder="Email"
            value={authForm.email}
            onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={authForm.password}
            onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
            required
          />

          {authError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
              {authError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isAuthSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {isAuthSubmitting ? 'Submitting...' : authMode === 'login' ? 'Sign in' : 'Create account'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div className="bg-[#121214]/60 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl">
        <h3 className="text-xl font-semibold text-white tracking-tight">How the new flow works</h3>
        <div className="mt-5 space-y-4 text-sm text-neutral-300 leading-relaxed">
          <p>1. Sign in to load your MongoDB-backed profile.</p>
          <p>2. Upload a form on the home page to build a per-form field object.</p>
          <p>3. Only unresolved values come back for manual input, and those entries are persisted for later reuse.</p>
          <p>4. The final filled form is rendered on the home page once every field has a resolved placement point.</p>
        </div>
      </div>
    </section>
  );
}
