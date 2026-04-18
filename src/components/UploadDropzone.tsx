import { useState, useRef } from 'react';
import { UploadCloud } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onUpload: (file: File) => void;
}

export default function UploadDropzone({ onUpload }: Props) {
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File is too large, maximum 10MB allowed');
      return;
    }
    onUpload(file);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`relative overflow-hidden rounded-3xl border p-12 lg:p-16 text-center cursor-pointer transition-all duration-500 group
        ${isDragActive 
          ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_40px_rgba(99,102,241,0.2)]' 
          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 hover:shadow-2xl'}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      {/* Background Glow Effect */}
      <div className={`absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-blue-500/20 transition-opacity duration-500 ${isDragActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp, image/gif"
        onChange={handleChange}
        className="hidden"
      />
      
      <div className="relative z-10 flex flex-col items-center justify-center space-y-6">
        <motion.div 
          animate={isDragActive ? { y: -10, scale: 1.1 } : { y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative inline-flex items-center justify-center p-5 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-500/30"
        >
          <div className="absolute inset-0 rounded-2xl bg-white/20 blur-xl mix-blend-overlay" />
          <UploadCloud className="w-10 h-10 relative z-10" />
        </motion.div>
        
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold tracking-tight text-white group-hover:text-indigo-200 transition-colors">
            {isDragActive ? 'Drop it here...' : 'Upload your document'}
          </h3>
          <p className="text-neutral-400 text-base">
            Drag and drop an image, or <span className="text-indigo-400 font-medium group-hover:underline">browse files</span>
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-neutral-500">JPG</span>
            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-neutral-500">PNG</span>
            <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-neutral-500">WEBP</span>
            <span className="px-2.5 py-1 rounded-md bg-transparent text-xs text-neutral-600 border-l border-white/10 pl-3">Max 10MB</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
