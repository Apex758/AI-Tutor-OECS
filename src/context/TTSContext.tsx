import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define drawing instruction interface
export interface DrawingInstruction {
  id: string;
  type: string;
  startX?: number;
  startY?: number;
  width?: number;
  height?: number;
  radius?: number;
  endX?: number;
  endY?: number;
  points?: {x: number, y: number}[];
  color: string;
  lineWidth: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
}

interface TTSContextType {
  currentTTS: string;
  isPlaying: boolean;
  audioDuration: number;
  drawings: DrawingInstruction[];
  activeDrawingIds: string[];
  setCurrentTTS: (text: string) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setAudioDuration: (duration: number) => void;
  setDrawings: (drawings: DrawingInstruction[]) => void;
  activateDrawing: (id: string) => void;
  resetActiveDrawings: () => void;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

interface TTSProviderProps {
  children: ReactNode;
}

export const TTSProvider: React.FC<TTSProviderProps> = ({ children }) => {
  const [currentTTS, setCurrentTTS] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [drawings, setDrawings] = useState<DrawingInstruction[]>([]);
  const [activeDrawingIds, setActiveDrawingIds] = useState<string[]>([]);

  const activateDrawing = (id: string) => {
    setActiveDrawingIds(prev => [...prev, id]);
    console.log(`Activated drawing: ${id}`);
  };

  const resetActiveDrawings = () => {
    setActiveDrawingIds([]);
    console.log('Reset all active drawings');
  };

  const value = {
    currentTTS,
    isPlaying,
    audioDuration,
    drawings,
    activeDrawingIds,
    setCurrentTTS,
    setIsPlaying,
    setAudioDuration,
    setDrawings,
    activateDrawing,
    resetActiveDrawings
  };

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
};

export const useTTS = (): TTSContextType => {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
};