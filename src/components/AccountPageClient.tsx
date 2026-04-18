'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Database } from 'lucide-react';
import AuthPanel from '@/components/AuthPanel';
import ProcessingLoader from '@/components/ProcessingLoader';
import TopNav from '@/components/TopNav';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface EditableField {
  id: string;
  key: string;
  value: string;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong';
}

function createEditableFields(data: Record<string, string>) {
  return Object.entries(data)
    .filter(([key]) => key !== 'email' && key !== 'name')
    .map(([key, value], index) => ({
      id: `${key}-${index}`,
      key,
      value,
    }));
}

export default function AccountPageClient() {
  const { currentUser, setCurrentUser, isAuthLoading, authError } = useCurrentUser();
  const [displayName, setDisplayName] = useState('');
  const [fields, setFields] = useState<EditableField[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    setDisplayName(currentUser.name);
    setFields(createEditableFields(currentUser.data));
  }, [currentUser]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setStatus(null);
    setError(null);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(null);
    setError(null);

    try {
      const data = fields.reduce<Record<string, string>>((accumulator, field) => {
        const key = field.key.trim();
        const value = field.value.trim();
        if (!key || !value) return accumulator;
        if (key.toLowerCase() === 'email' || key.toLowerCase() === 'name') return accumulator;

        accumulator[key] = value;
        return accumulator;
      }, {});

      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: displayName,
          data,
        }),
      });

      const payload = (await response.json()) as { user?: typeof currentUser; error?: string };
      if (!response.ok || !payload.user) {
        throw new Error(payload.error || 'Failed to save profile');
      }

      setCurrentUser(payload.user);
      setStatus('Account data saved');
    } catch (saveError) {
      setError(toErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-brand-accent/30 flex flex-col relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-8%] right-[-8%] w-[48%] h-[48%] bg-emerald-500/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-sky-500/5 blur-[120px] rounded-full" />
      </div>

      <TopNav active="account" currentUser={currentUser} onLogout={currentUser ? handleLogout : undefined} />

      <main className="w-full max-w-7xl mx-auto px-6 pb-16 pt-10 md:pb-24 relative z-10 flex flex-col gap-10">
        <header className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
            <Database className="w-3.5 h-3.5" />
            Account Workspace
          </div>
          <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 leading-[1.1]">
            MongoDB profile map
          </h2>
          <p className="text-neutral-400 text-lg max-w-3xl mx-auto leading-relaxed font-medium">
            This page shows the data stored for the signed-in user as editable key-value pairs, which the home-page workflow uses for field matching.
          </p>
        </header>

        {isAuthLoading ? (
          <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-10 shadow-2xl">
            <ProcessingLoader />
          </div>
        ) : !currentUser ? (
          <>
            {authError ? (
              <div className="rounded-[2rem] border border-red-500/20 bg-red-500/5 px-6 py-4 text-sm text-red-300">
                {authError}
              </div>
            ) : null}
            <AuthPanel onAuthSuccess={setCurrentUser} />
          </>
        ) : (
          <section className="grid lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
            <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">User identity</p>
              <h3 className="mt-3 text-3xl font-bold text-white">{currentUser.name}</h3>
              <p className="mt-2 text-neutral-400">{currentUser.email}</p>

              <div className="mt-8 grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Stored keys</p>
                  <p className="mt-2 text-3xl font-bold text-white">{Object.keys(currentUser.data).length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Workflow note</p>
                  <p className="mt-2 text-sm text-neutral-300 leading-relaxed">
                    User-entered values from unresolved form fields are now written back here for reuse in future uploads.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave} className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-white">Key-value data</h3>
                  <p className="text-sm text-neutral-400 mt-1">Every saved field is visible here instead of only a fixed profile subset.</p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setFields((prev) => [
                      ...prev,
                      {
                        id: `new-${Date.now()}`,
                        key: '',
                        value: '',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-neutral-200 hover:bg-white/10"
                >
                  <Plus className="w-4 h-4" />
                  Add field
                </button>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm text-neutral-300">Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                  />
                </div>

                <div className="grid gap-2">
                  <label className="text-sm text-neutral-300">Email</label>
                  <input
                    type="text"
                    value={currentUser.email}
                    readOnly
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-neutral-400 outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-1">
                {fields.map((field) => (
                  <div key={field.id} className="grid md:grid-cols-[0.9fr_1.1fr_auto] gap-3 items-center rounded-2xl border border-white/8 bg-black/30 p-4">
                    <input
                      type="text"
                      value={field.key}
                      onChange={(event) =>
                        setFields((prev) =>
                          prev.map((entry) =>
                            entry.id === field.id ? { ...entry, key: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Field key"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                    />
                    <input
                      type="text"
                      value={field.value}
                      onChange={(event) =>
                        setFields((prev) =>
                          prev.map((entry) =>
                            entry.id === field.id ? { ...entry, value: event.target.value } : entry,
                          ),
                        )
                      }
                      placeholder="Field value"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setFields((prev) => prev.filter((entry) => entry.id !== field.id))}
                      className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-3 text-neutral-300 hover:bg-white/10 hover:text-white"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {status ? (
                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 px-4 py-3 text-sm text-green-300">
                  {status}
                </div>
              ) : null}
              {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save account data'}
              </button>
            </form>
          </section>
        )}
      </main>
    </div>
  );
}
