import React, { createContext, useState, useContext, ReactNode } from 'react';

interface TTSContextType {
  currentTTS: string;
  isPlaying: boolean;
  audioDuration: number;
  setCurrentTTS: (text: string) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setAudioDuration: (duration: number) => void;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

interface TTSProviderProps {
  children: ReactNode;
}

export const TTSProvider: React.FC<TTSProviderProps> = ({ children }) => {
  const [currentTTS, setCurrentTTS] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioDuration, setAudioDuration] = useState<number>(0);

  const value = {
    currentTTS,
    isPlaying,
    audioDuration,
    setCurrentTTS,
    setIsPlaying,
    setAudioDuration
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