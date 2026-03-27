import { Download } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  imageSrc: string;
}

export default function DownloadButton({ imageSrc }: Props) {
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageSrc;
    a.download = 'filled-form.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="mt-8 flex justify-center lg:justify-end w-full"
    >
      <motion.button 
        whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(34,197,94,0.4)" }}
        whileTap={{ scale: 0.98 }}
        onClick={handleDownload}
        className="px-8 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-semibold rounded-2xl shadow-lg shadow-green-500/25 flex items-center gap-3 transition-all w-full lg:w-auto justify-center group border border-green-400/20"
      >
        <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform duration-300" />
        Download Synthesized Form
      </motion.button>
    </motion.div>
  );
}
