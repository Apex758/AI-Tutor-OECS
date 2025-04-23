import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define drawing instruction interface
export interface DrawingInstruction {
  id?: string;
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
  value?: string | number;
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

  // Function to clean text that might contain JSON
  const cleanTextForTTS = (text: string): string => {
    try {
      // Check if text is a JSON string with explanation field
      if (text.trim().startsWith('{') && text.trim().endsWith('}')) {
        const parsed = JSON.parse(text);
        if (parsed.explanation) {
          console.log("Extracted explanation from JSON for TTS");
          return parsed.explanation;
        }
      }
      
      // Check for code blocks with JSON
      if (text.includes('```json')) {
        const jsonStart = text.indexOf('```json') + 7;
        const jsonEnd = text.lastIndexOf('```');
        
        if (jsonStart > 0 && jsonEnd > jsonStart) {
          const jsonStr = text.substring(jsonStart, jsonEnd).trim();
          const parsed = JSON.parse(jsonStr);
          
          if (parsed.explanation) {
            console.log("Extracted explanation from code block JSON for TTS");
            return parsed.explanation;
          }
        }
      }
      
      return text;
    } catch (e) {
      console.error("Error parsing JSON in TTS text:", e);
      return text;
    }
  };

  // Custom setCurrentTTS that cleans JSON
  const handleSetCurrentTTS = (text: string) => {
    const cleanedText = cleanTextForTTS(text);
    setCurrentTTS(cleanedText);
  };

  // Wrap setDrawings to add logging and ensure IDs
  const handleSetDrawings = (newDrawings: DrawingInstruction[]) => {
    console.log("Setting new drawings:", newDrawings);
    
    // Ensure all drawings have IDs before setting them
    const processedDrawings = newDrawings.map((drawing, index) => {
      if (!drawing.id) {
        console.log(`Adding ID to drawing at index ${index} in TTSContext`);
        return { ...drawing, id: `ctx-auto-id-${index}` };
      }
      return drawing;
    });
    
    console.log("Processed drawings with IDs:", processedDrawings);
    setDrawings(processedDrawings);
    
    // Automatically activate all drawings that don't have active IDs yet
    setTimeout(() => {
      processedDrawings.forEach(drawing => {
        if (drawing.id && !activeDrawingIds.includes(drawing.id)) {
          console.log(`Auto-activating drawing with ID: ${drawing.id}`);
          activateDrawing(drawing.id);
        }
      });
    }, 0);
  };

  const activateDrawing = (id: string) => {
    console.log(`Attempting to activate drawing: ${id}`);
    
    // Check if the ID exists in the drawings array
    const drawingExists = drawings.some(d => d.id === id);
    
    if (!drawingExists) {
      console.warn(`Drawing with ID ${id} not found in drawings array. Current drawings:`, drawings);
      // Try to find a drawing with a similar ID or at a specific index
      if (id.startsWith('auto-id-') || id.startsWith('ctx-auto-id-')) {
        const index = parseInt(id.split('-').pop() || '-1', 10);
        if (index >= 0 && index < drawings.length) {
          const drawingAtIndex = drawings[index];
          console.log(`Using drawing at index ${index} instead:`, drawingAtIndex);
          if (drawingAtIndex.id) {
            console.log(`Activating drawing by index with ID: ${drawingAtIndex.id}`);
            setActiveDrawingIds(prev => {
              if (prev.includes(drawingAtIndex.id!)) {
                return prev;
              }
              return [...prev, drawingAtIndex.id!];
            });
            return;
          }
        }
      }
    }
    
    // Normal activation path
    setActiveDrawingIds(prev => {
      if (prev.includes(id)) {
        console.log(`Drawing ${id} already active`);
        return prev;
      }
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
    setCurrentTTS: handleSetCurrentTTS,
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