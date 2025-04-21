import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import axios from 'axios';

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

  useEffect(() => {
    // Initialize audio player for playing response audio
    audioPlayerRef.current = new Audio();
    
    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const playGreeting = async () => {
    setIsProcessing(true);
    try {
      // Add a cache-busting parameter to avoid browser caching
      const timestamp = new Date().getTime();
      const response = await axios.get(`http://localhost:8000/greeting?t=${timestamp}`);
      
      if (response.data && response.data.audio) {
        // Play the greeting audio - add cache buster to audio URL too
        if (audioPlayerRef.current) {
          // The URL already has a timestamp from the backend
          audioPlayerRef.current.src = response.data.audio;
          
          // Wait for the audio to load before playing
          audioPlayerRef.current.onloadedmetadata = () => {
            audioPlayerRef.current?.play().catch(err => {
              console.error("Error playing audio:", err);
            });
          };
          
          // Add the greeting to the transcript if callback provided
          if (onTranscriptUpdate) {
            onTranscriptUpdate("AI Tutor: " + response.data.greeting);
          }
        }
      }
    } catch (error) {
      console.error('Error getting greeting:', error);
      setError('Failed to play greeting.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      // First play the greeting
      await playGreeting();
      
      // Give time for the greeting to be played before starting recording
      setTimeout(async () => {
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
      }, 3000); // Wait 3 seconds for greeting to play
    } catch (err) {
      console.error('Error in startRecording:', err);
      setError('Failed to start recording.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
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
      if (response.data) {
        // Update transcript with user question and AI response
        if (onTranscriptUpdate) {
          onTranscriptUpdate("You: " + response.data.question);
          onTranscriptUpdate("AI Tutor: " + response.data.answer);
        }
        
        // Play the response audio
        if (audioPlayerRef.current && response.data.audio) {
          // The URL already has a timestamp from the backend
          audioPlayerRef.current.src = response.data.audio;
          
          // Wait for the audio to load before playing
          audioPlayerRef.current.onloadedmetadata = () => {
            audioPlayerRef.current?.play().catch(err => {
              console.error("Error playing audio:", err);
            });
          };
        }
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setError('Failed to process audio.');
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
      <button
        onClick={toggleRecording}
        className={`p-2 rounded-full ${
          isProcessing 
            ? 'bg-yellow-500 cursor-wait' 
            : isRecording 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
        title={isRecording ? "Stop Recording" : "Start Recording"}
        disabled={isProcessing}
      >
        {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      
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