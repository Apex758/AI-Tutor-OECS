import React, { useState, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface SpeechRecognitionProps {
  onTranscriptUpdate?: (transcript: string) => void;
}

const SpeechRecognition: React.FC<SpeechRecognitionProps> = ({ onTranscriptUpdate }) => {
  const [isRecording, setIsRecording] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const playGreeting = async () => {
    const greetingEndpoint = 'http://localhost:8000/tts'; // Placeholder TTS endpoint - requires backend implementation
    const greetingText = "hi how can i help";

    try {
      const response = await fetch(greetingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: greetingText }),
      });

      if (!response.ok) {
        console.error('TTS server error:', response.status);
      }
      // Assuming the TTS endpoint plays the audio directly or returns a playable audio file
      // If it returns an audio file, you would need to handle playing it here.
      console.log("Greeting sent to TTS endpoint.");

    } catch (error) {
      console.error('Error sending greeting to TTS endpoint:', error);
    }
  };

  const startRecording = async () => {
    try {
      // Play greeting before starting STT
      await playGreeting();

      // Add a delay to allow the greeting to play before starting recording
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      chunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Play the recorded audio (for now)
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.play();
        console.log("Playing recorded audio.");

        // Clean up stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="flex items-center justify-between w-full h-full">
      <button
        onClick={toggleRecording}
        className={`p-2 rounded-full ${
          isRecording 
            ? 'bg-red-500 hover:bg-red-600' 
            : 'bg-blue-500 hover:bg-blue-600'
        } text-white`}
        title={isRecording ? "Stop Recording" : "Start Recording"}
      >
        {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default SpeechRecognition;