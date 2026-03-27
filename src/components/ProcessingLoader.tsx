import { motion } from 'framer-motion';
import { Loader2, ScanSearch } from 'lucide-react';

export default function ProcessingLoader() {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col items-center justify-center space-y-8 py-16 w-full"
    >
      <div className="relative flex items-center justify-center">
        {/* Outer Pulsing Rings */}
        <motion.div
          animate={{ scale: [1, 1.5, 2], opacity: [0.5, 0.2, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
          className="absolute w-24 h-24 rounded-full border border-indigo-500/50"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1.6], opacity: [0.3, 0.1, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.4 }}
          className="absolute w-24 h-24 rounded-full border border-blue-500/40"
        />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
          className="absolute w-28 h-28 rounded-full border-t-2 border-r-2 border-indigo-400 opacity-60"
        />
        
        {/* Core Element */}
        <div className="w-20 h-20 bg-[#121214] border border-white/10 rounded-full shadow-[0_0_30px_rgba(99,102,241,0.3)] flex items-center justify-center relative z-10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-blue-500/20 animate-pulse" />
          <ScanSearch className="w-8 h-8 text-indigo-400 relative z-10" />
        </div>
      </div>
      
      <div className="text-center space-y-3">
        <h3 className="text-xl font-semibold text-white tracking-tight flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          Executing Extraction Engine
        </h3>
        <p className="text-sm text-neutral-400 max-w-[280px] mx-auto leading-relaxed">
          Running intelligent OCR scanning and aligning with your database schema...
        </p>
      </div>
    </motion.div>
  );
}
