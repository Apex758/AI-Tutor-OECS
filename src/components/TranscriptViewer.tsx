// src/components/TranscriptViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import AnswerValidator from './AnswerValidator';

interface TranscriptViewerProps {
  transcript: string;
  onSendMessage?: (message: string) => void;
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript, onSendMessage }) => {
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [feedbackMessages, setFeedbackMessages] = useState<string[]>([]);
  const [processedLines, setProcessedLines] = useState<string[]>([]);

  useEffect(() => {
    const lines = transcript.trim() ? transcript.split('\n') : [];
    const processed = lines.map(line => {
      if (line.includes('```json')) {
        try {
          const jsonStart = line.indexOf('```json') + 7;
          const jsonEnd = line.lastIndexOf('```');
          
          if (jsonStart > 0 && jsonEnd > jsonStart) {
            const jsonStr = line.substring(jsonStart, jsonEnd).trim();
            const parsed = JSON.parse(jsonStr);
            if (parsed.explanation) {
              return `PEARL: ${parsed.explanation}`;
            }
          }
        } catch (error) {
          console.error("Error parsing JSON in transcript:", error);
        }
      }
      
      if (line.startsWith('PEARL: {') && line.includes('"explanation":')) {
        try {
          const jsonStart = line.indexOf('{');
          const jsonEnd = line.lastIndexOf('}') + 1;
          if (jsonStart >= 0 && jsonEnd > jsonStart) {
            const jsonStr = line.substring(jsonStart, jsonEnd);
            const parsed = JSON.parse(jsonStr);
            if (parsed.explanation) {
              return `PEARL: ${parsed.explanation}`;
            }
          }
        } catch (error) {
          console.error("Error parsing JSON in transcript:", error);
        }
      }
      
      return line;
    });
    
    setProcessedLines(processed);
  }, [transcript]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [processedLines, feedbackMessages]);

  const getLineStyle = (line: string) => {
    if (line.startsWith('You:')) {
      return 'mb-2 text-blue-800 self-start max-w-3/4 bg-blue-50 p-2 rounded-lg';
    } else if (line.startsWith('PEARL:')) {
      return 'mb-2 text-green-800 self-end max-w-3/4 text-right bg-green-50 p-2 rounded-lg';
    } else if (line.startsWith('System:')) {
      return 'mb-2 text-gray-800 italic';
    } else if (line.startsWith('(The system is expecting')) {
      return 'mb-2 text-gray-500 italic text-sm';
    } else if (line.startsWith('Reference:')) {
      return 'mb-2 text-gray-500 italic text-sm';
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

  const handleFeedback = (feedback: string, isCorrect: boolean) => {
    const feedbackPrefix = isCorrect ? "[CORRECT] " : "[INCORRECT] ";
    setFeedbackMessages(prev => [...prev, `${feedbackPrefix}${feedback}`]);
  };

  const hasProblemToSolve =
    transcript.includes('(The system is expecting an answer') ||
    transcript.includes('"correct_value"') ||
    transcript.includes('"final_answer"');

  return (
    <div className="flex flex-col h-full">
      <div className="flex-grow overflow-y-auto bg-gray-100 p-4 rounded-lg shadow-inner mb-2" id="transcript-container">
        <h2 className="text-lg font-semibold mb-3">Conversation</h2>
        
        {processedLines.length === 0 ? (
          <p className="text-gray-500 italic">Your conversation will appear here...</p>
        ) : (
          processedLines.map((line, index) => (
            <div key={index} className={getLineStyle(line)}>
              {line}
            </div>
          ))
        )}

        {feedbackMessages.map((msg, index) => (
          <div key={`feedback-${index}`} className="mb-2 text-purple-800 self-start max-w-3/4 bg-purple-50 p-2 rounded-lg">
            {msg}
          </div>
        ))}
        
        <div ref={transcriptEndRef} /> {/* Element to scroll to */}
      </div>
      
      {hasProblemToSolve && (
        <AnswerValidator onFeedback={handleFeedback} />
      )}
      
      <div className="flex items-center bg-white rounded-lg border border-gray-300 overflow-hidden mt-2">
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