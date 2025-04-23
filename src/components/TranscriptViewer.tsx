import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';

interface TranscriptViewerProps {
  transcript: string;
  onSendMessage?: (message: string) => void;
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript, onSendMessage }) => {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');

  // Split the transcript string into lines
  const transcriptLines = transcript.trim() ? transcript.split('\n') : [];

  useEffect(() => {
    // Scroll to the bottom of the transcript whenever it updates
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const getLineStyle = (line: string) => {
    if (line.startsWith('You:')) {
      return 'mb-2 text-blue-800 self-start max-w-3/4 bg-blue-50 p-2 rounded-lg';
    } else if (line.startsWith('PEARL:')) {
      return 'mb-2 text-green-800 self-end max-w-3/4 text-right bg-green-50 p-2 rounded-lg';
    } else {
      return 'mb-2 text-gray-800';
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && onSendMessage) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-auto bg-gray-100 p-4 rounded-lg shadow-inner mb-2" id="transcript-container">
        <h2 className="text-lg font-semibold mb-3">Conversation</h2>
        
        {transcriptLines.length === 0 ? (
          <p className="text-gray-500 italic">Your conversation will appear here...</p>
        ) : (
          transcriptLines.map((line, index) => (
            <div key={index} className={getLineStyle(line)}>
              {line}
            </div>
          ))
        )}
        <div ref={transcriptEndRef} /> {/* Element to scroll to */}
      </div>
      
      {/* Add chat input */}
      <div className="flex items-center bg-white rounded-lg border border-gray-300 overflow-hidden">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="flex-grow p-2 focus:outline-none resize-none min-h-[40px] max-h-[120px]"
          rows={1}
        />
        <button
          onClick={handleSendMessage}
          className="p-2 text-blue-500 hover:text-blue-700 focus:outline-none"
          disabled={!message.trim()}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TranscriptViewer;