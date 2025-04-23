import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define drawing instruction interface
export interface DrawingInstruction {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  endX?: number;
  endY?: number;
  points?: {x: number, y: number}[];
  color?: string;
  lineWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  count?: number;
  value?: string;
  symbol?: string;
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

  // Wrap setDrawings to add logging
  const handleSetDrawings = (newDrawings: DrawingInstruction[]) => {
    console.log("Setting new drawings:", newDrawings);
    setDrawings(newDrawings);
  };

  const activateDrawing = (id: string) => {
    console.log(`Activating drawing: ${id}`);
    setActiveDrawingIds(prev => {
      const newIds = [...prev, id];
      console.log("Updated active drawing IDs:", newIds);
      return newIds;
    });
  };

  const resetActiveDrawings = () => {
    console.log('Resetting all active drawings');
    setActiveDrawingIds([]);
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
    setDrawings: handleSetDrawings,
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