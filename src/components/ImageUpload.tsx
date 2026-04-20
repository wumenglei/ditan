import React, { useState, useCallback } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ImageUploadProps {
  label: string;
  onImageSelect: (base64: string | null) => void;
  id: string;
  description?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ label, onImageSelect, id, description }) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setPreview(reader.result as string);
        onImageSelect(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const removeImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreview(null);
    onImageSelect(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        id={id}
        onDragOver={(e) => { e.preventDefault(); setIsHovering(true); }}
        onDragLeave={() => setIsHovering(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById(`input-${id}`)?.click()}
        className={`relative aspect-square md:aspect-[4/3] rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-500 overflow-hidden
          ${preview ? 'border-transparent shadow-xl' : 
            isHovering ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 bg-white hover:border-zinc-300 hover:bg-zinc-50'}`}
      >
        <input
          id={`input-${id}`}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onChange}
        />

        <AnimatePresence mode="wait">
          {preview ? (
            <motion.div
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 group"
            >
              <img
                src={preview}
                alt="预览"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
                <button
                  onClick={removeImage}
                  className="p-3 bg-white rounded-full text-zinc-900 hover:scale-110 active:scale-90 transition-all shadow-2xl"
                >
                  <X size={20} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 text-zinc-300 p-8 text-center"
            >
              <div className="p-5 rounded-3xl bg-zinc-50 border border-zinc-100/50 transition-all duration-500 group-hover:bg-white group-hover:shadow-lg">
                <ImageIcon size={32} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-900">{label}</p>
                <p className="text-[9px] font-bold text-zinc-300 mt-2 uppercase tracking-widest">DRAG & DROP</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
