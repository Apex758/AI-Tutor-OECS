import React, { useState, useRef, useEffect } from 'react';
import { Camera, CameraOff } from 'lucide-react';

const CameraFeed: React.FC = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const toggleCamera = async () => {
    if (isStreaming) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setIsStreaming(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;

        // Send the stream to the backend
        const mediaRecorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
          chunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          // Send the blob to the backend
          fetch('http://localhost:8001/access/camera', { // Placeholder endpoint - requires backend implementation
            method: 'POST',
            body: blob,
            headers: {
              'Content-Type': 'video/webm',
            },
          })
            .then((response) => response.text())
            .then((data) => console.log(data))
            .catch((error) => console.error('Error sending video to backend:', error));
        };

        mediaRecorder.start(100); // Start recording with a timeslice of 100ms

        // Stop recording when the stream is stopped
        stream.getTracks()[0].onended = () => {
          mediaRecorder.stop();
        };

        setIsStreaming(true);
      } catch (err) {
        setError(`Failed to access camera: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };

  return (
    <div className="relative h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">Camera Feed</h2>
        <button 
          onClick={toggleCamera}
          className={`p-2 rounded-full ${
            isStreaming 
              ? 'bg-red-500 hover:bg-red-600' 
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white`}
          title={isStreaming ? "Stop Camera" : "Start Camera"}
        >
          {isStreaming ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
        </button>
      </div>
      
      <div className="flex-grow bg-gray-800 rounded-lg overflow-hidden relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <p className="text-white text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraFeed;