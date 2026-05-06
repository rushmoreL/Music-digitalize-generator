import { Upload, Play, Pause, Music } from 'lucide-react';
import React, { useRef } from 'react';

interface ControlsProps {
  onFileSelect: (file: File) => void;
  onTogglePlay: () => void;
  isPlaying: boolean;
  fileName: string | null;
  isDragging?: boolean;
}

export default function Controls({ onFileSelect, onTogglePlay, isPlaying, fileName, isDragging }: ControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <>
      <div className="flex items-end gap-4">
        {!fileName ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`
              pointer-events-auto group relative flex items-center gap-4 px-6 py-3 
              border border-white/20 backdrop-blur-xl 
              transition-all duration-500
              ${isDragging ? 'bg-white/30 border-white/60' : 'bg-white/5 hover:bg-white/10 hover:border-white/40'}
            `}
          >
            <Upload className="w-4 h-4 text-white/60 group-hover:text-white transition-all duration-500" />
            <span className="text-xs font-black uppercase tracking-[0.4em] text-white/80 group-hover:text-white transition-colors">
              Inject_Signal
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </button>
        ) : (
          <div className="flex items-end gap-3 animate-in fade-in slide-in-from-left-4 duration-700">
            <button
              onClick={onTogglePlay}
              className="w-14 h-14 bg-white text-black flex items-center justify-center hover:bg-white/90 transition-all active:scale-95"
            >
              {isPlaying ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" size={20} className="ml-1" />}
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 border border-white/20 bg-black/40 backdrop-blur-md flex items-center justify-center hover:bg-white/10 transition-all text-white/40 hover:text-white"
              title="Reset Signal"
            >
              <Upload size={20} />
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
