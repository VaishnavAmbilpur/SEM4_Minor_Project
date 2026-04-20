import { motion, AnimatePresence } from 'framer-motion';
import { Download } from 'lucide-react';

interface Props {
  originalImage: string;
  processedImage?: string | null;
}

export default function PreviewPanel({ originalImage, processedImage }: Props) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="bg-[#0c0c0e]/80 backdrop-blur-2xl border border-white/5 rounded-[2rem] overflow-hidden h-full flex flex-col shadow-[0_22px_70px_8px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
    >
      <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/30" />
          </div>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <h3 className="font-semibold text-neutral-300 tracking-tight text-xs uppercase letter-spacing-widest">
            {processedImage ? 'Output Render' : 'Input Analysis Preview'}
          </h3>
        </div>
        
        <AnimatePresence mode="wait">
          {processedImage ? (
            <div className="flex items-center gap-3">
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = processedImage;
                  a.download = 'filled-form.png';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white text-[10px] font-bold uppercase tracking-widest transition-colors shadow-lg shadow-indigo-500/20"
              >
                <Download className="w-3 h-3" />
                Download Result
              </motion.button>
              
              <motion.div 
                key="synthesized"
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Synthesized</span>
              </motion.div>
            </div>
          ) : (
            <motion.div 
              key="original"
              initial={{ opacity: 0, x: 10 }} 
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
            >
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Original Source</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-10 bg-[#080809] flex-1 flex items-center justify-center relative min-h-[450px] group/preview">
        {/* Subtle architectural grid */}
        <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(to_right,#ffffff12_1px,transparent_1px),linear-gradient(to_bottom,#ffffff12_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        
        <div className="relative z-10 w-full h-full flex items-center justify-center p-2">
          <motion.img 
            key={processedImage ? 'processed' : 'original'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "circOut" }}
            src={processedImage || originalImage} 
            alt="Document Analysis" 
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-white/10 ring-1 ring-white/5 transition-transform duration-700 group-hover/preview:scale-[1.01]"
          />
        </div>
      </div>
      
      <div className="px-8 py-4 bg-white/[0.01] border-t border-white/5 flex items-center justify-between">
        <p className="text-[10px] text-neutral-500 font-medium tracking-wide">SYSTEM-V4 ENGINE</p>
        <p className="text-[10px] text-neutral-500 font-medium tracking-wide uppercase">{new Date().toLocaleDateString()}</p>
      </div>
    </motion.div>
  );
}
