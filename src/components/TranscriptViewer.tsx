import React, { useEffect, useRef } from 'react';

interface TranscriptViewerProps {
  transcript: string;
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript }) => {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Split the transcript string into lines
  const transcriptLines = transcript.trim() ? transcript.split('\n') : [];

  useEffect(() => {
    // Scroll to the bottom of the transcript whenever it updates
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const getLineStyle = (line: string) => {
    if (line.startsWith('You:')) {
      return 'mb-2 text-blue-800 self-start max-w-3/4';
    } else if (line.startsWith('PEARL:')) {
      return 'mb-2 text-green-800 self-end max-w-3/4 text-right';
    } else {
      return 'mb-2 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-100 p-4 rounded-lg shadow-inner" id="transcript-container">
      <h2 className="text-lg font-semibold mb-3">Conversation Transcript</h2>
      
      {transcriptLines.length === 0 ? (
        <p className="text-gray-500 italic">Transcript will appear here...</p>
      ) : (
        transcriptLines.map((line, index) => (
          <div key={index} className={getLineStyle(line)}>
            {line}
          </div>
        ))
      )}
      <div ref={transcriptEndRef} /> {/* Element to scroll to */}
    </div>
  );
};

export default TranscriptViewer;