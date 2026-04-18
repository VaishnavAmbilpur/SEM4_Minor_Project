'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadDropzone from '@/components/UploadDropzone';
import ProcessingLoader from '@/components/ProcessingLoader';
import MissingFieldsModal from '@/components/MissingFieldsModal';
import PreviewPanel from '@/components/PreviewPanel';
import DownloadButton from '@/components/DownloadButton';
import AuthPanel from '@/components/AuthPanel';
import TopNav from '@/components/TopNav';
import FormFieldStatusList from '@/components/FormFieldStatusList';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { FormFieldMapping } from '@/lib/formTypes';

interface ProcessResponse {
  status: 'needs_input' | 'completed' | 'failed';
  requestId: string;
  error: string | null;
  formFields: FormFieldMapping[];
  resolvedFields: FormFieldMapping[];
  missingFields: FormFieldMapping[];
  filledImage: string | null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Something went wrong';
}

export default function HomePageClient() {
  const { currentUser, setCurrentUser, isAuthLoading, authError } = useCurrentUser();
  const [file, setFile] = useState<File | null>(null);
  const [originalImageBase64, setOriginalImageBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formFields, setFormFields] = useState<FormFieldMapping[]>([]);
  const [missingFields, setMissingFields] = useState<FormFieldMapping[]>([]);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyProcessResponse(data: ProcessResponse) {
    setFormFields(data.formFields || []);
    setMissingFields(data.missingFields || []);

    if (data.status === 'completed' && data.filledImage) {
      setFinalImage(data.filledImage);
    }
  }

  async function handleUpload(uploadedFile: File) {
    setFile(uploadedFile);
    setError(null);
    setFinalImage(null);
    setMissingFields([]);
    setFormFields([]);

    const reader = new FileReader();
    reader.onloadend = () => setOriginalImageBase64(reader.result as string);
    reader.readAsDataURL(uploadedFile);

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as ProcessResponse & { error?: string };
      if (!response.ok || data.status === 'failed') {
        throw new Error(data.error || 'Failed to process form');
      }

      applyProcessResponse(data);
    } catch (uploadError) {
      setError(toErrorMessage(uploadError));
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleMissingFieldsSubmit(manualData: Record<string, string>) {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('formFields', JSON.stringify(formFields));
      formData.append('missingValues', JSON.stringify(manualData));

      const response = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      const data = (await response.json()) as ProcessResponse & { error?: string };
      if (!response.ok || data.status === 'failed') {
        throw new Error(data.error || 'Failed to complete form');
      }

      applyProcessResponse(data);
    } catch (submitError) {
      setError(toErrorMessage(submitError));
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    setFile(null);
    setOriginalImageBase64(null);
    setFormFields([]);
    setMissingFields([]);
    setFinalImage(null);
    setError(null);
  }

  const matchedCount = formFields.filter((field) => field.matchStatus === 'matched' && field.value).length;
  const unresolvedCount = formFields.length - matchedCount;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-brand-accent/30 flex flex-col relative overflow-hidden font-sans">
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" />
      </div>

      <TopNav active="home" currentUser={currentUser} onLogout={currentUser ? handleLogout : undefined} />

      <main className="w-full max-w-7xl mx-auto px-6 pb-16 pt-10 md:pb-24 relative z-10 flex flex-col gap-10">
        <header className="flex flex-col items-center text-center gap-6 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse" />
            Home Workflow
          </div>
          <div className="space-y-4">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 leading-[1.1]">
              Upload, resolve, fill, download
            </h2>
            <p className="text-neutral-400 text-lg max-w-3xl mx-auto leading-relaxed font-medium">
              This page now handles only the form workflow: upload a form, map against your stored profile, collect unresolved values, then download the filled result.
            </p>
          </div>
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
          <>
            <section className="grid lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-4 flex flex-col gap-8">
                <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold border border-indigo-500/20">
                      01
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold tracking-tight text-white">Form Upload</h3>
                      <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest mt-0.5">
                        Home Page
                      </p>
                    </div>
                  </div>

                  <UploadDropzone onUpload={handleUpload} />

                  <AnimatePresence>
                    {error ? (
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
                    ) : null}
                  </AnimatePresence>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[2rem] border border-white/10 bg-[#121214]/70 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Matched</p>
                    <p className="mt-3 text-3xl font-bold text-white">{matchedCount}</p>
                  </div>
                  <div className="rounded-[2rem] border border-white/10 bg-[#121214]/70 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Unresolved</p>
                    <p className="mt-3 text-3xl font-bold text-white">{Math.max(0, unresolvedCount)}</p>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {isProcessing ? (
                    <motion.div
                      key="loader"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-4 shadow-2xl ring-1 ring-white/5"
                    >
                      <ProcessingLoader />
                    </motion.div>
                  ) : null}

                  {finalImage && !isProcessing ? (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-8 shadow-2xl"
                    >
                      <div className="space-y-4 text-center">
                        <h3 className="text-3xl font-bold text-white tracking-tighter">Completed</h3>
                        <p className="text-neutral-400 font-medium">
                          The form object is fully resolved, placement points were generated, and the final image is ready.
                        </p>
                        <DownloadButton imageSrc={finalImage} />
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="lg:col-span-8 flex flex-col gap-8">
                <div className="h-[650px] lg:h-auto min-h-[600px]">
                  {originalImageBase64 ? (
                    <div className="h-full animate-in fade-in zoom-in-95 duration-1000">
                      <PreviewPanel originalImage={originalImageBase64} processedImage={finalImage} />
                    </div>
                  ) : (
                    <div className="h-full rounded-[2rem] border border-dashed border-white/10 bg-[#121214]/30 backdrop-blur-sm flex flex-col items-center justify-center text-neutral-500">
                      <p className="font-bold tracking-[0.2em] text-[10px] uppercase opacity-40">
                        Upload a form image to start building the field object
                      </p>
                    </div>
                  )}
                </div>

                <FormFieldStatusList formFields={formFields} />
              </div>
            </section>
          </>
        )}
      </main>

      {missingFields.length > 0 ? (
        <MissingFieldsModal
          missingFields={missingFields.map((field) => ({
            fieldId: field.fieldId,
            label: field.detectedLabel,
            canonicalKey: field.canonicalKey,
            isOptional: field.isOptional,
            matchStatus: field.matchStatus === 'needs_review' ? 'needs_review' : 'missing',
          }))}
          onSubmit={handleMissingFieldsSubmit}
          onCancel={() => setMissingFields([])}
        />
      ) : null}
    </div>
  );
}
