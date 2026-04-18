import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MissingFieldItem {
  fieldId: string;
  label: string;
  canonicalKey: string;
  isOptional: boolean;
  matchStatus?: 'missing' | 'needs_review';
}

interface Props {
  missingFields: MissingFieldItem[];
  onSubmit: (data: Record<string, string>) => void;
  onCancel: () => void;
}

export default function MissingFieldsModal({ missingFields, onSubmit, onCancel }: Props) {
  const [formData, setFormData] = useState<Record<string, string>>({});

  const uniqueFields = Array.from(
    missingFields.reduce<Map<string, MissingFieldItem>>((accumulator, field) => {
      const existing = accumulator.get(field.canonicalKey);
      if (!existing || (existing.isOptional && !field.isOptional)) {
        accumulator.set(field.canonicalKey, field);
      }
      return accumulator;
    }, new Map()),
  ).map(([, field]) => field);

  const handleChange = (key: string, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-[#121214]/95 backdrop-blur-xl border border-white/10 w-full max-w-lg rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative"
        >
          {/* Header Glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
          
          <div className="flex items-center justify-between px-8 py-6 border-b border-white/5">
            <div>
              <h3 className="font-semibold text-xl text-white tracking-tight">Missing Information</h3>
              <p className="text-xs text-neutral-400 mt-1">Please provide the missing data to continue.</p>
            </div>
            <button type="button" onClick={onCancel} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-neutral-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div className="space-y-5">
              {uniqueFields.map((field, index) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: index * 0.05 }}
                  key={`${field.canonicalKey}-${index}`} 
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-neutral-300 ml-1">{field.label}</label>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
                        field.isOptional
                          ? 'bg-white/5 text-neutral-400 border border-white/10'
                          : 'bg-red-500/10 text-red-200 border border-red-500/20'
                      }`}
                    >
                      {field.isOptional ? 'Optional' : 'Required'}
                    </span>
                  </div>
                  <div className="relative group">
                    <input
                      type="text"
                      required={!field.isOptional}
                      value={formData[field.canonicalKey] || ''}
                      onChange={(e) => handleChange(field.canonicalKey, e.target.value)}
                      className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-neutral-600"
                      placeholder={`Enter ${field.label}...`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-white/5 mt-4">
              <button 
                type="button" 
                onClick={onCancel}
                className="px-5 py-2.5 text-sm font-medium text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all"
              >
                <Check className="w-4 h-4" />
                Synthesize Form
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
