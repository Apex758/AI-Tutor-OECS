import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { estimateSpeechDuration } from '../utils/speechTimingUtils';
import { useTTS, DrawingInstruction } from '../context/TTSContext';

interface SpeechRecognitionProps {
  onTranscriptUpdate?: (transcript: string) => void;
}

// Define the expected response format from the backend
interface AIResponse {
  question: string;
  answer: {
    explanation: string; // Text for TTS
    scene: DrawingInstruction[]; // Drawing instructions
    final_answer?: { // New field for answer validation
      correct_value: string | number;
      explanation: string;
      feedback_correct: string;
      feedback_incorrect: string;
    };
  };
  audio: string; // URL to audio file
  source_documents?: string[]; // Optional source documents reference
}

// Log the expected format for debugging
console.log("Expected response format:", {
  question: "example question",
  answer: {
    explanation: "example explanation",
    scene: [{ type: "apple", x: 100, y: 100, count: 2 }],
    final_answer: {
      correct_value: "5",
      explanation: "explanation of correct answer",
      feedback_correct: "Great job!",
      feedback_incorrect: "Try again!"
    }
  },
  audio: "/path/to/audio.wav"
});

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
  
  // Use autoMicRef to access current autoMic state in event listeners
  const autoMicRef = useRef<boolean>(autoMic);
  
  // Update the ref whenever autoMic state changes
  useEffect(() => {
    console.log(`Updating autoMicRef from ${autoMicRef.current} to ${autoMic}`);
    autoMicRef.current = autoMic;
    
    // When autoMic is toggled off, clear any pending auto-start timeouts
    if (!autoMic && audioEndTimeoutRef.current) {
      console.log("Auto-mic disabled - clearing pending auto-start timeouts");
      clearTimeout(audioEndTimeoutRef.current);
      audioEndTimeoutRef.current = null;
    }
  }, [autoMic]);
  
  // Access TTS context for displaying subtitles and drawings
  const { 
    setCurrentTTS, 
    setIsPlaying, 
    setAudioDuration, 
    setDrawings, 
    activateDrawing, 
    resetActiveDrawings 
  } = useTTS();

  // Handle audio playback ending - use function that accesses current ref value instead of closure
  const handleAudioEnded = () => {
    console.log("Audio playback ended, accessing current autoMicRef.current:", autoMicRef.current);
    setIsPlaying(false);
    
    // Use the ref to access the current value, not the closure
    if (autoMicRef.current) {
      console.log("Auto-mic is enabled via ref, automatically starting recording");
      startRecordingInternal();
    } else {
      console.log("Auto-mic is disabled via ref, NOT automatically starting recording");
      // Do nothing when autoMic is disabled - user must manually start recording
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
      // Add a cache-busting parameter to avoid browser caching
      const timestamp = new Date().getTime();
      const response = await axios.get(`http://localhost:8000/greeting?t=${timestamp}`);
      
      if (response.data?.greeting && response.data?.audio) {
        // Estimate the duration for initial subtitle timing
        const estimatedDuration = estimateSpeechDuration(response.data.greeting);
        console.log(`Estimated greeting duration: ${estimatedDuration}ms`);
        
        // Set the greeting text and estimated duration for subtitle display
        setCurrentTTS(response.data.greeting);
        setAudioDuration(estimatedDuration);
        
        // Reset any active drawings
        resetActiveDrawings();
        setDrawings([]);
        
        // Play the greeting audio
        if (audioPlayerRef.current) {
          // The URL already has a timestamp from the backend
          audioPlayerRef.current.src = response.data.audio;
          
          // Wait for the audio to load before playing
          audioPlayerRef.current.onloadedmetadata = () => {
            // Now we know the actual duration, update it
            if (audioPlayerRef.current) {
              const actualDuration = audioPlayerRef.current.duration * 1000;
              setAudioDuration(actualDuration);
              console.log(`Actual greeting audio duration: ${actualDuration}ms`);
            }
            
            audioPlayerRef.current?.play().catch(err => {
              console.error("Error playing audio:", err);
              setError('Failed to play audio.');
              setIsPlaying(false);
            });
            
            // Clear any existing timeout
            if (audioEndTimeoutRef.current) {
              clearTimeout(audioEndTimeoutRef.current);
              audioEndTimeoutRef.current = null;
            }
            
            // Set a new timeout based on estimated duration ONLY if autoMic is enabled (use ref)
            // This is a fallback in case the 'ended' event doesn't fire
            if (autoMicRef.current) {
              audioEndTimeoutRef.current = setTimeout(() => {
                console.log("Estimated greeting playback completed, checking autoMicRef:", autoMicRef.current);
                setIsPlaying(false);
                
                if (autoMicRef.current) { // Check ref, not state
                  console.log("Auto-mic is enabled (ref), starting recording");
                  startRecordingInternal();
                } else {
                  console.log("Auto-mic is disabled (ref), NOT starting recording");
                }
              }, estimatedDuration + 500); // Add a small buffer
            }
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
      audioEndTimeoutRef.current = null;
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
      console.log("Sending audio to backend...");
      const response = await axios.post<AIResponse>(`http://localhost:8000/tutor/speak?t=${timestamp}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      console.log("Full backend response:", JSON.stringify(response.data, null, 2));
      
      // Handle the response
      if (response.data?.question) {
        // Check if the response is in the new format with explanation, scene, and final_answer
        const answerData = response.data.answer;
        
        // Reset active drawings
        resetActiveDrawings();
        
        // Process the response data
        const explanation = answerData.explanation;
        const drawings = answerData.scene || [];
        const finalAnswer = answerData.final_answer;
        
        console.log("Processing response:", {
          explanation,
          drawings,
          finalAnswer
        });
        
        // Store final answer in local storage for validation
        if (finalAnswer) {
          localStorage.setItem('currentProblemAnswer', JSON.stringify(finalAnswer));
          console.log("Stored final answer for validation:", finalAnswer);
        } else {
          // Clear any existing stored answer
          localStorage.removeItem('currentProblemAnswer');
        }
        
        // Store and activate drawings immediately
        console.log("Setting drawings:", drawings);
        setDrawings(drawings);
        console.log(`Loaded ${drawings.length} drawings from scene`);
        
        // Activate all drawings immediately
        drawings.forEach(drawing => {
          if (drawing.id) {
            console.log(`Immediately activating drawing: ${drawing.id}`);
            activateDrawing(drawing.id);
          } else {
            console.log("Drawing has no ID, cannot activate:", drawing);
          }
        });
        
        // Calculate estimated duration of response speech
        const estimatedDuration = estimateSpeechDuration(explanation);
        console.log(`Estimated response duration: ${estimatedDuration}ms`);
        
        // Extract drawing markers and prepare timings
        const regex = /\[DRAW:([^\]]+)\]/g;
        let match;
        const markers: { id: string, position: number }[] = [];
        
        // Find all drawing markers
        while ((match = regex.exec(explanation)) !== null) {
          markers.push({
            id: match[1],
            position: match.index
          });
        }
        
        // Clean explanation by removing drawing markers for TTS and transcript
        const cleanExplanation = explanation.replace(regex, '');
        console.log(`Found ${markers.length} drawing markers in explanation`);
        
        // Set the response text for subtitle display
        setCurrentTTS(cleanExplanation);
        setAudioDuration(estimatedDuration);
        
        // Update transcript with user question and AI response
        if (onTranscriptUpdate) {
          onTranscriptUpdate("You: " + response.data.question);
          let transcriptText = "PEARL: " + cleanExplanation;
          
          // Add a note if there's a problem to solve
          if (finalAnswer && finalAnswer.correct_value) {
            transcriptText += `\n(The system is expecting an answer: ${finalAnswer.correct_value})`;
          }
          
          if (response.data.source_documents && response.data.source_documents.length > 0) {
            transcriptText += `\n\nReference: ${response.data.source_documents.join(', ')}`;
          }
          onTranscriptUpdate(transcriptText);
        }
        
        // Play the response audio if available
        if (audioPlayerRef.current && response.data.audio) {
          // The URL already has a timestamp from the backend
          audioPlayerRef.current.src = response.data.audio;
          
          // Wait for the audio to load before playing
          audioPlayerRef.current.onloadedmetadata = () => {
            // Update with actual duration once audio is loaded
            if (audioPlayerRef.current) {
              const actualDuration = audioPlayerRef.current.duration * 1000;
              setAudioDuration(actualDuration);
              console.log(`Actual response audio duration: ${actualDuration}ms`);
              
              // Set up drawing activation timers based on marker positions
              if (markers.length > 0 && drawings.length > 0) {
                // Calculate timing for each marker based on its position in the text
                markers.forEach(marker => {
                  // Calculate what percentage through the text this marker appears
                  const textPercentage = marker.position / cleanExplanation.length;
                  // Convert to time based on audio duration
                  const drawingTime = Math.floor(textPercentage * actualDuration);
                  
                  // Set timeout to activate the drawing at the appropriate time
                  setTimeout(() => {
                    console.log(`Activating drawing ${marker.id} at ${drawingTime}ms`);
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
            
            // Clear any existing timeout
            if (audioEndTimeoutRef.current) {
              clearTimeout(audioEndTimeoutRef.current);
              audioEndTimeoutRef.current = null;
            }
            
            // Set a new timeout based on estimated duration ONLY if autoMic is enabled (use ref)
            // This is a fallback in case the 'ended' event doesn't fire
            if (autoMicRef.current) {
              audioEndTimeoutRef.current = setTimeout(() => {
                console.log("Estimated response playback completed (timeout), checking autoMicRef:", autoMicRef.current);
                setIsPlaying(false);
                
                if (autoMicRef.current) { // Check ref, not state
                  console.log("Auto-mic is enabled (ref), starting recording via timeout");
                  startRecordingInternal();
                } else {
                  console.log("Auto-mic is disabled (ref), NOT starting recording via timeout");
                }
              }, estimatedDuration + 1000); // Add a larger buffer for the fallback
            }
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
      
      // Reset TTS playing state
      setIsPlaying(false);
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