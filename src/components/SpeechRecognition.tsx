import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { estimateSpeechDuration } from '../utils/speechTimingUtils';
import { useTTS, DrawingInstruction } from '../context/TTSContext';

interface SpeechRecognitionProps {
  onTranscriptUpdate?: (transcript: string) => void;
}

interface AIResponse {
  question: string;
  answer: {
    explanation: string;
    scene: DrawingInstruction[];
    final_answer?: {
      correct_value: string | number;
      explanation: string;
      feedback_correct: string;
      feedback_incorrect: string;
    };
  };
  audio: string;
  source_documents?: string[];
}

const SpeechRecognition: React.FC<SpeechRecognitionProps> = ({ onTranscriptUpdate }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoMic, setAutoMic] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const autoMicRef = useRef<boolean>(autoMic);
  
  useEffect(() => {
    autoMicRef.current = autoMic;
    if (!autoMic && audioEndTimeoutRef.current) {
      clearTimeout(audioEndTimeoutRef.current);
      audioEndTimeoutRef.current = null;
    }
  }, [autoMic]);
  
  const {
    setCurrentTTS,
    setIsPlaying,
    setAudioDuration,
    setDrawings,
    activateDrawing,
    resetActiveDrawings
  } = useTTS();
  
  const handleAudioEnded = () => {
    setIsPlaying(false);
    if (autoMicRef.current) {
      startRecordingInternal();
    }
  };

  useEffect(() => {
    // Initialize audio player for playing response audio
    audioPlayerRef.current = new Audio();
    
    // Use a function that reads from ref, not from closure
    const handleEndedEvent = () => handleAudioEnded();
    
    // Set up audio player end event for automatic conversation flow
    audioPlayerRef.current.addEventListener('ended', handleEndedEvent);
    
    // Set up audio player start event for subtitle synchronization
    audioPlayerRef.current.addEventListener('play', () => {
      setIsPlaying(true);
    });
    
    // Set up audio player pause/end event for subtitle synchronization
    audioPlayerRef.current.addEventListener('pause', () => {
      setIsPlaying(false);
    });
    
    // Handle audio metadata loaded to get actual duration
    audioPlayerRef.current.addEventListener('loadedmetadata', () => {
      if (audioPlayerRef.current && audioPlayerRef.current.duration) {
        // Convert to milliseconds
        const durationMs = audioPlayerRef.current.duration * 1000;
        setAudioDuration(durationMs);
        console.log(`Actual audio duration: ${durationMs}ms`);
      }
    });
    
    // Cleanup function
    return () => {
      // Clear any pending timeouts
      if (audioEndTimeoutRef.current) {
        clearTimeout(audioEndTimeoutRef.current);
        audioEndTimeoutRef.current = null;
      }
      
      // Remove event listeners
      if (audioPlayerRef.current) {
        audioPlayerRef.current.removeEventListener('ended', handleEndedEvent);
        audioPlayerRef.current.removeEventListener('play', () => setIsPlaying(true));
        audioPlayerRef.current.removeEventListener('pause', () => setIsPlaying(false));
        audioPlayerRef.current.removeEventListener('loadedmetadata', () => {
          if (audioPlayerRef.current) setAudioDuration(audioPlayerRef.current.duration * 1000);
        });
      }
      
      // Stop any active streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [setIsPlaying, setAudioDuration]); // Don't include autoMic in dependencies to avoid recreating listeners

  const playGreeting = async () => {
    setIsProcessing(true);
    try {
      const timestamp = new Date().getTime();
      const response = await axios.get(`http://localhost:8000/greeting?t=${timestamp}`);
      
      if (response.data?.greeting && response.data?.audio) {
        const estimatedDuration = estimateSpeechDuration(response.data.greeting);
        setCurrentTTS(response.data.greeting);
        setAudioDuration(estimatedDuration);
        resetActiveDrawings();
        setDrawings([]);
        
        if (audioPlayerRef.current) {
          audioPlayerRef.current.src = response.data.audio;
          audioPlayerRef.current.onloadedmetadata = () => {
            if (audioPlayerRef.current) {
              const actualDuration = audioPlayerRef.current.duration * 1000;
              setAudioDuration(actualDuration);
            }
            
            audioPlayerRef.current?.play().catch(err => {
              console.error("Error playing audio:", err);
              setError('Failed to play audio.');
              setIsPlaying(false);
            });
            
            if (audioEndTimeoutRef.current) {
              clearTimeout(audioEndTimeoutRef.current);
              audioEndTimeoutRef.current = null;
            }
            
            if (autoMicRef.current) {
              audioEndTimeoutRef.current = setTimeout(() => {
                setIsPlaying(false);
                if (autoMicRef.current) {
                  startRecordingInternal();
                }
              }, estimatedDuration + 500);
            }
          };
          
          if (onTranscriptUpdate) {
            onTranscriptUpdate("PEARL: " + response.data.greeting);
          }
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error getting greeting:', error);
      setError('Failed to connect to PEARL. Please check if the server is running.');
      if (onTranscriptUpdate) {
        onTranscriptUpdate("System: Connection error - Please check if the PEARL server is running.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecordingInternal = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      chunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
  
      mediaRecorderRef.current.onstop = async () => {
        if (chunksRef.current.length === 0) return;
        
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Could not access microphone.');
      setIsRecording(false);
    }
  };

  const startRecording = async () => {
    if (!document.getElementById('transcript-container')?.textContent?.includes('PEARL:')) {
      await playGreeting();
    } else {
      await startRecordingInternal();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    
    // Clear any pending timeouts when manually stopping
    if (audioEndTimeoutRef.current) {
      clearTimeout(audioEndTimeoutRef.current);
      audioEndTimeoutRef.current = null;
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      
      const timestamp = new Date().getTime();
      const response = await axios.post<AIResponse>(`http://localhost:8000/tutor/speak?t=${timestamp}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data?.question) {
        const answerData = response.data.answer;
        resetActiveDrawings();
        
        let explanation = '';
        if (typeof answerData.explanation === 'string') {
          if (answerData.explanation.trim().startsWith('{') && answerData.explanation.trim().endsWith('}')) {
            try {
              const parsedExplanation = JSON.parse(answerData.explanation);
              explanation = parsedExplanation.explanation || answerData.explanation;
            } catch (error) {
              console.error("Error parsing explanation:", error);
              explanation = answerData.explanation;
            }
          } else {
            explanation = answerData.explanation;
          }
        }
        
        let drawings = answerData.scene || [];
        drawings = drawings.map((drawing, index) => {
          if (!drawing.id) {
            return { ...drawing, id: `auto-id-${index}` };
          }
          return drawing;
        });
  
        const finalAnswer = answerData.final_answer;
        
        if (finalAnswer) {
          localStorage.setItem('currentProblemAnswer', JSON.stringify(finalAnswer));
        } else {
          localStorage.removeItem('currentProblemAnswer');
        }
        
        setDrawings(drawings);
        drawings.forEach((drawing) => {
          if (drawing.id) {
            activateDrawing(drawing.id);
          }
        });
        
        const estimatedDuration = estimateSpeechDuration(explanation);
        const cleanExplanation = explanation.replace(/\[DRAW:[^\]]+\]/g, '');
        
        setCurrentTTS(cleanExplanation);
        setAudioDuration(estimatedDuration);
        
        if (onTranscriptUpdate) {
          onTranscriptUpdate("You: " + response.data.question);
          let transcriptText = "PEARL: " + cleanExplanation;
          if (finalAnswer && finalAnswer.correct_value) {
            transcriptText += `\n(The system is expecting an answer: ${finalAnswer.correct_value})`;
          }
          if (response.data.source_documents && response.data.source_documents.length > 0) {
            transcriptText += `\n\nReference: ${response.data.source_documents.join(', ')}`;
          }
          onTranscriptUpdate(transcriptText);
        }
        
        if (audioPlayerRef.current && response.data.audio) {
          audioPlayerRef.current.src = response.data.audio;
          audioPlayerRef.current.onloadedmetadata = () => {
            if (audioPlayerRef.current) {
              const actualDuration = audioPlayerRef.current.duration * 1000;
              setAudioDuration(actualDuration);
              
              const regex = /\[DRAW:([^\]]+)\]/g;
              let match;
              const markers: { id: string, position: number }[] = [];
              while ((match = regex.exec(explanation)) !== null) {
                markers.push({
                  id: match[1],
                  position: match.index
                });
              }
              
              if (markers.length > 0 && drawings.length > 0) {
                markers.forEach(marker => {
                  const textPercentage = marker.position / cleanExplanation.length;
                  const drawingTime = Math.floor(textPercentage * actualDuration);
                  setTimeout(() => {
                    activateDrawing(marker.id);
                  }, drawingTime);
                });
              }
            }
            
            audioPlayerRef.current?.play().catch(err => {
              console.error("Error playing audio:", err);
              setError('Failed to play audio response.');
              setIsPlaying(false);
            });
          };
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error("Error processing audio:", error);
    } finally {
      setIsProcessing(false);
    }
  };


  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  // Toggle auto-mic function
  const toggleAutoMic = () => {
    const newAutoMicState = !autoMic;
    console.log(`Toggling auto-mic from ${autoMic} to ${newAutoMicState}`);
    
    // If turning off auto-mic, clear any pending auto-start timeouts
    if (!newAutoMicState && audioEndTimeoutRef.current) {
      console.log("Clearing any pending auto-start timeouts");
      clearTimeout(audioEndTimeoutRef.current);
      audioEndTimeoutRef.current = null;
    }
    
    // This will update the state and trigger the useEffect to update the ref
    setAutoMic(newAutoMicState);
  };

  return (
    <div className="flex items-center justify-between w-full h-full">
      <div className="flex items-center space-x-3">
        {/* Mic button */}
        <button
          onClick={toggleRecording}
          className={`p-2 rounded-full ${
            isProcessing 
              ? 'bg-yellow-500 cursor-wait' 
              : isRecording 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
          title={isRecording ? "Stop Recording" : "Start Conversation"}
          disabled={isProcessing}
        >
          {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        
        {/* Auto-mic toggle button */}
        <button 
          onClick={toggleAutoMic}
          className={`p-1.5 rounded-md text-xs flex items-center ${
            autoMic ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-500 border border-gray-300'
          }`}
          title={autoMic ? "Auto-mic is ON - Will automatically listen after AI responds" : "Auto-mic is OFF - Manual listening mode"}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Auto: {autoMic ? "ON" : "OFF"}
        </button>
        
        <span className="ml-1 text-xs text-gray-500">
          {isRecording ? "Listening..." : "Click to talk"}
        </span>
      </div>
      
      {error && (
        <span className="text-red-500 text-sm ml-2">{error}</span>
      )}
      
      {isProcessing && (
        <span className="text-yellow-600 text-sm ml-2">Processing...</span>
      )}
    </div>
  );
};

export default SpeechRecognition;