'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadDropzone from '@/components/UploadDropzone';
import ProcessingLoader from '@/components/ProcessingLoader';
import MissingFieldsModal from '@/components/MissingFieldsModal';
import PreviewPanel from '@/components/PreviewPanel';
import DownloadButton from '@/components/DownloadButton';

const isDev = process.env.NODE_ENV === 'development';

interface ExtractedField {
  label: string;
  canonicalKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface MissingField extends ExtractedField {
  reason: 'missing_value';
}

interface ProcessResponse {
  status: 'needs_input' | 'completed' | 'failed';
  requestId: string;
  error: string | null;
  extractedFields: ExtractedField[];
  missingFields: MissingField[];
  filledImage: string | null;
}

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  data: Record<string, string>;
}

interface AuthFormState {
  name: string;
  email: string;
  password: string;
}

const emptyAuthForm: AuthFormState = {
  name: '',
  email: '',
  password: '',
};

const profileFieldOrder = [
  ['name', 'Name'],
  ['dob', 'Date of Birth'],
  ['address', 'Address'],
  ['email', 'Email'],
  ['phone', 'Phone'],
] as const;

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong';
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function devLog(scope: string, message: string, payload?: unknown) {
  if (!isDev) return;

  if (payload === undefined) {
    console.log(`[dev][${scope}] ${message}`);
    return;
  }

  console.log(`[dev][${scope}] ${message}`, payload);
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [originalImageBase64, setOriginalImageBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [detectedFields, setDetectedFields] = useState<ExtractedField[]>([]);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState<AuthFormState>(emptyAuthForm);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, string>>({
    name: '',
    dob: '',
    address: '',
    email: '',
    phone: '',
  });
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const syncProfileState = (user: CurrentUser | null) => {
    setCurrentUser(user);
    setProfileData({
      name: user?.data.name || user?.name || '',
      dob: user?.data.dob || '',
      address: user?.data.address || '',
      email: user?.data.email || user?.email || '',
      phone: user?.data.phone || '',
    });
  };

  useEffect(() => {
    void (async () => {
      setIsAuthLoading(true);

      try {
        devLog('ui.auth', 'Loading current session');
        const response = await fetch('/api/auth/me', { cache: 'no-store' });
        if (response.status === 401) {
          devLog('ui.auth', 'No active session');
          syncProfileState(null);
          return;
        }

        const data = await parseJsonResponse<{ user: CurrentUser; error?: string }>(response);
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load session');
        }

        syncProfileState(data.user);
        devLog('ui.auth', 'Session loaded', data.user);
      } catch (loadError) {
        setAuthError(toErrorMessage(loadError));
      } finally {
        setIsAuthLoading(false);
      }
    })();
  }, []);

  const applyProcessResponse = (data: ProcessResponse) => {
    setDetectedFields(data.extractedFields || []);
    setMissingFields(data.missingFields || []);

    if (data.status === 'completed' && data.filledImage) {
      setFinalImage(data.filledImage);
    }
  };

  const handleUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setError(null);
    setFinalImage(null);
    setMissingFields([]);
    setDetectedFields([]);

    const reader = new FileReader();
    reader.onloadend = () => setOriginalImageBase64(reader.result as string);
    reader.readAsDataURL(uploadedFile);

    setIsProcessing(true);

    try {
      devLog('ui.process', 'Uploading image to /api/process', {
        name: uploadedFile.name,
        type: uploadedFile.type,
        size: uploadedFile.size,
      });
      const formData = new FormData();
      formData.append('image', uploadedFile);

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as ProcessResponse & { error?: string };
      if (!res.ok || data.status === 'failed') {
        throw new Error(data.error || 'Failed to process form');
      }

      devLog('ui.process', 'Received /api/process response', data);
      applyProcessResponse(data);
    } catch (uploadError) {
      setError(toErrorMessage(uploadError));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMissingFieldsSubmit = async (manualData: Record<string, string>) => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      devLog('ui.process', 'Submitting missing field values', {
        manualData,
        detectedFieldCount: detectedFields.length,
      });
      const formData = new FormData();
      formData.append('image', file);
      formData.append('extractedFields', JSON.stringify(detectedFields));
      formData.append('missingValues', JSON.stringify(manualData));

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as ProcessResponse & { error?: string };
      if (!res.ok || data.status === 'failed') {
        throw new Error(data.error || 'Failed to complete form');
      }

      devLog('ui.process', 'Received completion response', data);
      applyProcessResponse(data);
    } catch (submitError) {
      setError(toErrorMessage(submitError));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        authMode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : authForm;

      devLog('ui.auth', 'Submitting auth form', {
        endpoint,
        payload: {
          ...payload,
          password: '[redacted]',
        },
      });

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

      devLog('ui.auth', 'Authentication succeeded', data.user);
      setAuthForm(emptyAuthForm);
      syncProfileState(data.user);
    } catch (submitError) {
      setAuthError(toErrorMessage(submitError));
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    devLog('ui.auth', 'Logging out current user', {
      userId: currentUser?.id ?? null,
      email: currentUser?.email ?? null,
    });
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setFile(null);
    setOriginalImageBase64(null);
    setDetectedFields([]);
    setMissingFields([]);
    setFinalImage(null);
    setProfileStatus(null);
    setError(null);
  };

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileStatus(null);
    setError(null);

    try {
      devLog('ui.profile', 'Saving profile', {
        name: profileData.name || currentUser?.name || '',
        data: profileData,
      });
      const response = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: profileData.name || currentUser?.name || '',
          data: profileData,
        }),
      });

      const data = await parseJsonResponse<{ user?: CurrentUser; error?: string }>(response);
      if (!response.ok || !data.user) {
        throw new Error(data.error || 'Failed to save profile');
      }

      devLog('ui.profile', 'Profile save response', data.user);
      syncProfileState(data.user);
      setProfileStatus('Profile saved');
    } catch (saveError) {
      setError(toErrorMessage(saveError));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSeedProfile = async () => {
    setIsSavingProfile(true);
    setProfileStatus(null);
    setError(null);

    try {
      devLog('ui.profile', 'Seeding demo profile');
      const response = await fetch('/api/seed', { method: 'POST' });
      const data = await parseJsonResponse<{ user?: CurrentUser; error?: string; message?: string }>(response);
      if (!response.ok || !data.user) {
        throw new Error(data.error || 'Failed to seed demo profile');
      }

      devLog('ui.profile', 'Seed profile response', data);
      syncProfileState(data.user);
      setProfileStatus(data.message || 'Demo profile loaded');
    } catch (seedError) {
      setError(toErrorMessage(seedError));
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-brand-accent/30 flex flex-col items-center relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" />
      </div>

      <main className="w-full max-w-7xl mx-auto px-6 py-16 md:py-24 relative z-10 flex flex-col gap-10">
        <header className="flex flex-col items-center text-center gap-6 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
            Secure Autofill Pipeline
          </div>
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 leading-[1.1]">
              AutoFill AI
            </h1>
            <p className="text-neutral-400 text-lg max-w-3xl mx-auto leading-relaxed font-medium">
              Sign in, manage your profile data, then run the OpenRouter extraction pipeline against your own stored form values.
            </p>
          </div>
        </header>

        {isAuthLoading ? (
          <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-10 shadow-2xl">
            <ProcessingLoader />
          </div>
        ) : !currentUser ? (
          <section className="grid lg:grid-cols-2 gap-8">
            <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {authMode === 'login' ? 'Login' : 'Create account'}
                  </h2>
                  <p className="text-sm text-neutral-400 mt-1">
                    JWT auth now protects the form-processing pipeline.
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
                {authMode === 'register' && (
                  <input
                    type="text"
                    placeholder="Full name"
                    value={authForm.name}
                    onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none"
                    required
                  />
                )}
                <input
                  type="email"
                  placeholder="Email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none"
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none"
                  required
                />
                {authError && (
                  <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-300 text-sm">
                    {authError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isAuthSubmitting}
                  className="w-full px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-60"
                >
                  {isAuthSubmitting ? 'Submitting...' : authMode === 'login' ? 'Login' : 'Create account'}
                </button>
              </form>
            </div>

            <div className="bg-[#121214]/60 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-white tracking-tight mb-4">What changed</h2>
              <div className="space-y-3 text-sm text-neutral-300">
                <p>Only authenticated users can reach the live `/api/process` form pipeline now.</p>
                <p>Each account owns its own autofill profile data in MongoDB.</p>
                <p>JWT is stored in an HTTP-only cookie, so the browser sends it automatically to protected routes.</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 flex flex-col gap-8">
              <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Account</h2>
                    <p className="text-sm text-neutral-400 mt-1">{currentUser.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-neutral-200"
                  >
                    Logout
                  </button>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-4">
                  {profileFieldOrder.map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <label className="text-sm text-neutral-300">{label}</label>
                      <input
                        type="text"
                        value={profileData[key] || ''}
                        onChange={(event) =>
                          setProfileData((prev) => ({ ...prev, [key]: event.target.value }))
                        }
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white outline-none"
                        placeholder={`Enter ${label.toLowerCase()}`}
                      />
                    </div>
                  ))}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-60"
                    >
                      {isSavingProfile ? 'Saving...' : 'Save profile'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSeedProfile}
                      disabled={isSavingProfile}
                      className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-100 disabled:opacity-60"
                    >
                      Seed demo
                    </button>
                  </div>
                </form>

                {profileStatus && (
                  <div className="mt-4 p-3 rounded-xl border border-green-500/20 bg-green-500/5 text-green-300 text-sm">
                    {profileStatus}
                  </div>
                )}
              </div>

              <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold border border-indigo-500/20">
                    01
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Input Source</h2>
                    <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest mt-0.5">
                      Protected Route
                    </p>
                  </div>
                </div>

                <UploadDropzone onUpload={handleUpload} />

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-6 overflow-hidden"
                    >
                      <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-300 text-sm">
                        {error}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait">
                {isProcessing && (
                  <motion.div
                    key="loader"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-4 shadow-2xl ring-1 ring-white/5"
                  >
                    <ProcessingLoader />
                  </motion.div>
                )}

                {finalImage && !isProcessing && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl"
                  >
                    <div className="space-y-4 text-center">
                      <h2 className="text-3xl font-bold text-white tracking-tighter">Completed</h2>
                      <p className="text-neutral-400 font-medium">
                        The authenticated pipeline extracted, matched, and rendered your filled form.
                      </p>
                      <DownloadButton imageSrc={finalImage} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="lg:col-span-8 h-[650px] lg:h-auto min-h-[600px]">
              {originalImageBase64 ? (
                <div className="h-full animate-in fade-in zoom-in-95 duration-1000">
                  <PreviewPanel originalImage={originalImageBase64} processedImage={finalImage} />
                </div>
              ) : (
                <div className="h-full rounded-[2rem] border border-dashed border-white/10 bg-[#121214]/30 backdrop-blur-sm flex flex-col items-center justify-center text-neutral-500">
                  <p className="font-bold tracking-[0.2em] text-[10px] uppercase opacity-40">
                    Upload a form image after signing in
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {missingFields.length > 0 && (
        <MissingFieldsModal
          missingFields={missingFields.map((field) => ({
            label: field.label,
            canonicalKey: field.canonicalKey,
          }))}
          onSubmit={handleMissingFieldsSubmit}
          onCancel={() => setMissingFields([])}
        />
      )}
    </div>
  );
}
