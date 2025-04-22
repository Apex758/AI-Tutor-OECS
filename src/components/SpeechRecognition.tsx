import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import axios from 'axios';
import { estimateSpeechDuration } from '../utils/speechTimingUtils';

interface SpeechRecognitionProps {
  onTranscriptUpdate?: (transcript: string) => void;
}

const SpeechRecognition: React.FC<SpeechRecognitionProps> = ({ onTranscriptUpdate }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Initialize audio player for playing response audio
    audioPlayerRef.current = new Audio();
    
    // Set up audio player end event for automatic conversation flow
    audioPlayerRef.current.addEventListener('ended', handleAudioEnded);
    
    // Cleanup function
    return () => {
      // Clear any pending timeouts
      if (audioEndTimeoutRef.current) {
        clearTimeout(audioEndTimeoutRef.current);
      }
      
      // Remove event listener
      if (audioPlayerRef.current) {
        audioPlayerRef.current.removeEventListener('ended', handleAudioEnded);
      }
      
      // Stop any active streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Handle audio playback ending - automatically start recording again
  const handleAudioEnded = () => {
    console.log("Audio playback ended, automatically starting recording");
    startRecordingInternal();
  };

  const playGreeting = async () => {
    setIsProcessing(true);
    try {
      // Add a cache-busting parameter to avoid browser caching
      const timestamp = new Date().getTime();
      const response = await axios.get(`http://localhost:8000/greeting?t=${timestamp}`);
      
      if (response.data?.greeting && response.data?.audio) {
        // Play the greeting audio
        if (audioPlayerRef.current) {
          // The URL already has a timestamp from the backend
          audioPlayerRef.current.src = response.data.audio;
          
          // Calculate estimated duration of the greeting speech
          const estimatedDuration = estimateSpeechDuration(response.data.greeting);
          console.log(`Estimated greeting duration: ${estimatedDuration}ms`);
          
          // Wait for the audio to load before playing
          audioPlayerRef.current.onloadedmetadata = () => {
            audioPlayerRef.current?.play().catch(err => {
              console.error("Error playing audio:", err);
              setError('Failed to play audio.');
            });
            
            // Use setTimeout as a fallback to the 'ended' event
            // Clear any existing timeout
            if (audioEndTimeoutRef.current) {
              clearTimeout(audioEndTimeoutRef.current);
            }
            
            // Set a new timeout based on estimated duration
            audioEndTimeoutRef.current = setTimeout(() => {
              console.log("Estimated greeting playback completed, starting recording");
              startRecordingInternal();
            }, estimatedDuration + 500); // Add a small buffer
          };
          
          // Add the greeting to the transcript if callback provided
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

  // Separate internal start recording function (without playing greeting)
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
        
        // Send to backend for processing
        await processAudio(audioBlob);
        
        // Clean up stream
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
    // If this is the first recording, play greeting first
    if (!document.getElementById('transcript-container')?.textContent?.includes('PEARL:')) {
      await playGreeting();
      // The recording will be started by the timeout or ended event in playGreeting
    } else {
      // For subsequent recordings, start recording directly
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
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      
      // Create form data with the audio blob
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      
      // Send to backend with timestamp to avoid caching
      const timestamp = new Date().getTime();
      const response = await axios.post(`http://localhost:8000/tutor/speak?t=${timestamp}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Handle the response
      if (response.data?.question && response.data?.answer) {
        // Update transcript with user question and AI response
        if (onTranscriptUpdate) {
          onTranscriptUpdate("You: " + response.data.question);
          onTranscriptUpdate("PEARL: " + response.data.answer);
        }
        
        // Play the response audio if available
        if (audioPlayerRef.current && response.data.audio) {
          // Calculate estimated duration of response speech
          const estimatedDuration = estimateSpeechDuration(response.data.answer);
          console.log(`Estimated response duration: ${estimatedDuration}ms`);
          
          // The URL already has a timestamp from the backend
          audioPlayerRef.current.src = response.data.audio;
          
          // Wait for the audio to load before playing
          audioPlayerRef.current.onloadedmetadata = () => {
            audioPlayerRef.current?.play().catch(err => {
              console.error("Error playing audio:", err);
              setError('Failed to play audio response.');
            });
            
            // Use a timeout as a fallback to the 'ended' event for automatic conversation flow
            // Clear any existing timeout
            if (audioEndTimeoutRef.current) {
              clearTimeout(audioEndTimeoutRef.current);
            }
            
            // Set a new timeout based on estimated duration
            audioEndTimeoutRef.current = setTimeout(() => {
              console.log("Estimated response playback completed (timeout), starting recording");
              startRecordingInternal();
            }, estimatedDuration + 1000); // Add a larger buffer for the fallback
          };
        }
      } else {
        // If response format is invalid but request succeeded
        console.error('Invalid response format received:', response.data);
        throw new Error('Invalid response format');
      }
    } catch (error) {
      let errorMessage = 'Failed to process audio. Please check server connection.';
      let logMessage = 'Error processing audio:';

      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          logMessage = `Backend error: ${error.response.status}`;
          console.error(logMessage, error.response.data);
          // Try to get the specific error message from the backend response
          errorMessage = `Error: ${error.response.data?.error || 'Unknown backend error'}`;
        } else if (error.request) {
          // The request was made but no response was received
          logMessage = 'No response received from server.';
          console.error(logMessage, error.request);
          errorMessage = 'Could not connect to the PEARL server.';
        } else {
          // Something happened in setting up the request that triggered an Error
          logMessage = 'Axios request setup error:';
          console.error(logMessage, error.message);
          errorMessage = 'Failed to send request.';
        }
      } else if (error instanceof Error && error.message === 'Invalid response format') {
         // Handle the specific "Invalid response format" error thrown earlier
         logMessage = 'Invalid response format from backend.';
         console.error(logMessage, error);
         errorMessage = 'Received an unexpected response from the server.';
      }
       else {
        // Handle non-Axios errors
        logMessage = 'Unexpected error:';
        console.error(logMessage, error);
        errorMessage = 'An unexpected error occurred.';
      }

      setError(errorMessage);
      if (onTranscriptUpdate) {
        onTranscriptUpdate(`System: ${errorMessage}`);
      }
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

  return (
    <div className="flex items-center justify-between w-full h-full">
      <div className="flex items-center">
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
        
        <span className="ml-2 text-xs text-gray-500">
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