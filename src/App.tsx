import React, { useState, useRef, useEffect } from 'react';
import AudioVisualizer from './components/AudioVisualizer';
import Controls from './components/Controls';
import { AudioAnalyzer } from './lib/audio-api';

interface AudioAnalysis {
  data: Uint8Array;
  pitch: number;
  timbre: number;
  energy: number;
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [analysis, setAnalysis] = useState<AudioAnalysis | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [threshold, setThreshold] = useState(0.65);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    analyzerRef.current = new AudioAnalyzer();
    return () => {
      analyzerRef.current?.close();
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const updateData = () => {
    if (analyzerRef.current) {
      const result = analyzerRef.current.getAnalysis();
      if (result) {
        setAnalysis({
          data: new Uint8Array(result.data),
          pitch: result.pitch,
          timbre: result.timbre,
          energy: result.energy
        });
      }
    }
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateData);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateData);
    } else {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [isPlaying]);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('audio/')) return;
    
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const url = URL.createObjectURL(file);
    audioRef.current.src = url;
    setFileName(file.name);
    setIsPlaying(false);

    if (analyzerRef.current) {
      analyzerRef.current.init(audioRef.current);
    }

    audioRef.current.onended = () => {
      setIsPlaying(false);
    };
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  return (
    <main 
      className="min-h-screen bg-black overflow-hidden selection:bg-white selection:text-black font-mono transition-colors duration-500"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ backgroundColor: isDragging ? '#111' : '#000' }}
    >
      {/* Background Visualizer */}
      <AudioVisualizer 
        analysis={analysis} 
        isPlaying={isPlaying} 
        threshold={threshold}
      />

      {/* Flash Threshold Overlay - Bottom Right */}
      <div className="fixed bottom-8 right-8 z-20 flex flex-col items-end gap-2">
        <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Flash Threshold</span>
        <div className="flex items-center gap-3">
          <input 
            type="range"
            min="0.1"
            max="1.5"
            step="0.05"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="w-48 accent-white cursor-pointer h-1 bg-zinc-800 appearance-none rounded-full"
            id="threshold-slider"
          />
          <span className="text-white font-mono text-xs w-8">{threshold.toFixed(2)}</span>
        </div>
      </div>

      {/* UI Elements - Bottom Left */}
      <div className="fixed bottom-8 left-8 z-20">
        <Controls 
          onFileSelect={handleFileSelect}
          onTogglePlay={togglePlay}
          isPlaying={isPlaying}
          fileName={fileName}
          isDragging={isDragging}
        />
      </div>
    </main>
  );
}
