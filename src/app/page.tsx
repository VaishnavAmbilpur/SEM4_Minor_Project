'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadDropzone from '@/components/UploadDropzone';
import ProcessingLoader from '@/components/ProcessingLoader';
import MissingFieldsModal from '@/components/MissingFieldsModal';
import PreviewPanel from '@/components/PreviewPanel';
import DownloadButton from '@/components/DownloadButton';

interface ExtractedField {
  label: string;
  canonicalKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

interface AutoFilledField extends ExtractedField {
  value: string;
  source: 'profile' | 'user';
}

interface MissingField extends ExtractedField {
  reason: 'missing_value';
}

interface ProcessResponse {
  status: 'needs_input' | 'completed' | 'failed';
  requestId: string;
  error: string | null;
  extractedFields: ExtractedField[];
  autoFilledFields: AutoFilledField[];
  missingFields: MissingField[];
  filledImage: string | null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Failed to process form';
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [originalImageBase64, setOriginalImageBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [missingFields, setMissingFields] = useState<MissingField[]>([]);
  const [detectedFields, setDetectedFields] = useState<ExtractedField[]>([]);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => setOriginalImageBase64(reader.result as string);
    reader.readAsDataURL(uploadedFile);

    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('image', uploadedFile);

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as ProcessResponse;
      if (!res.ok || data.status === 'failed') {
        throw new Error(data.error || 'Failed to process form');
      }

      applyProcessResponse(data);
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMissingFieldsSubmit = async (manualData: Record<string, string>) => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('extractedFields', JSON.stringify(detectedFields));
      formData.append('missingValues', JSON.stringify(manualData));

      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });

      const data = (await res.json()) as ProcessResponse;
      if (!res.ok || data.status === 'failed') {
        throw new Error(data.error || 'Failed to complete form');
      }

      applyProcessResponse(data);
    } catch (error) {
      setError(toErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-brand-accent/30 flex flex-col items-center relative overflow-hidden font-sans">
      {/* Dynamic Architectural Background */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full" />
      </div>

      <main className="w-full max-w-7xl mx-auto px-6 py-16 md:py-24 relative z-10 flex flex-col gap-16">
        <header className="flex flex-col items-center text-center gap-8 animate-in fade-in slide-in-from-top-4 duration-1000">
          <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse"></span>
            V4.0 Production Engine
          </div>
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/40 leading-[1.1]">
              AutoFill AI
            </h1>
            <p className="text-neutral-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium">
              A high-precision system to extract, align, and synthesize your digital forms with instantaneous database matching.
            </p>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          {/* Left Column: Intelligence Panel */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            <div className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group/card transition-all duration-500 hover:border-white/20">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700" />
              
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold border border-indigo-500/20 shadow-[inset_0_0_15px_rgba(99,102,241,0.1)]">
                  01
                </div>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Input Source</h2>
                  <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest mt-0.5">Awaiting Document</p>
                </div>
              </div>

              <UploadDropzone onUpload={handleUpload} />
              
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-8 overflow-hidden"
                  >
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl flex gap-3 items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <p className="text-red-400 text-sm font-semibold tracking-tight">{error}</p>
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
                  className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2.5rem] p-4 shadow-2xl ring-1 ring-white/5"
                >
                  <ProcessingLoader />
                </motion.div>
              )}
              
              {finalImage && !isProcessing && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#121214]/80 backdrop-blur-3xl border border-white/[0.08] rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group/success"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.03] to-transparent pointer-events-none" />
                  <div className="relative z-10 flex flex-col items-center text-center gap-6">
                    <div className="w-20 h-20 rounded-[1.5rem] bg-green-500/10 flex items-center justify-center text-green-400 border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-3xl font-bold text-white tracking-tighter">Synthesized</h2>
                      <p className="text-neutral-400 font-medium">The extraction engine has perfectly aligned the data layers.</p>
                    </div>
                    <div className="w-full pt-4">
                      <DownloadButton imageSrc={finalImage} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Visualization Panel */}
          <div className="lg:col-span-7 h-[650px] lg:h-auto min-h-[600px]">
            {originalImageBase64 ? (
              <div className="h-full animate-in fade-in zoom-in-95 duration-1000">
                <PreviewPanel originalImage={originalImageBase64} processedImage={finalImage} />
              </div>
            ) : (
              <div className="h-full rounded-[2.5rem] border border-dashed border-white/10 bg-[#121214]/30 backdrop-blur-sm flex flex-col items-center justify-center text-neutral-500 transition-all duration-500 hover:bg-[#121214]/50 hover:border-white/20 hover:shadow-inner group/empty">
                <div className="w-16 h-16 rounded-3xl bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6 group-hover/empty:scale-110 transition-transform duration-500">
                  <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="font-bold tracking-[0.2em] text-[10px] uppercase opacity-40">Visualization Awaiting Input</p>
              </div>
            )}
          </div>
        </div>
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
