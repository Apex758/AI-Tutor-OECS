import React, { useEffect, useRef } from 'react';

interface TranscriptEntry {
  speaker: string;
  text: string;
}

interface TranscriptViewerProps {
  transcript: TranscriptEntry[];
}

const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript }) => {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the bottom of the transcript whenever it updates
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-100 p-4 rounded-lg shadow-inner">
      {transcript.length === 0 ? (
        <p className="text-gray-500 italic">Transcript will appear here...</p>
      ) : (
        transcript.map((entry, index) => (
          <div key={index} className={`mb-2 ${entry.speaker === 'Speaker 1' ? 'text-blue-800 self-start' : 'text-green-800 self-end text-right'}`}>
            <span className="font-semibold">{entry.speaker}:</span> {entry.text}
          </div>
        ))
      )}
      <div ref={transcriptEndRef} /> {/* Element to scroll to */}
    </div>
  );
};

export default TranscriptViewer;