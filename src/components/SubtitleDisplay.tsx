import React, { useState, useEffect, useRef } from 'react';
import { estimateSpeechDuration } from '../utils/speechTimingUtils';

interface SubtitleDisplayProps {
  text: string;
  isPlaying: boolean;
  audioDuration?: number;  // Optional total audio duration in ms
  onComplete?: () => void;
}

const SubtitleDisplay: React.FC<SubtitleDisplayProps> = ({ 
  text, 
  isPlaying,
  audioDuration,
  onComplete 
}) => {
  const [visibleLetters, setVisibleLetters] = useState<number>(0);
  const [currentSegment, setCurrentSegment] = useState<string>('');
  const [segments, setSegments] = useState<string[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(0);
  const [segmentTimings, setSegmentTimings] = useState<number[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const letterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Split text into natural segments and calculate timings
  useEffect(() => {
    if (!text) {
      setSegments([]);
      setSegmentTimings([]);
      setCurrentSegmentIndex(0);
      setCurrentSegment('');
      setVisibleLetters(0);
      return;
    }

    // Split by punctuation followed by space, or by chunks of ~8-12 words if no punctuation
    const segmentRegex = /([^.!?]+[.!?]\s*|\S+(?:\s+\S+){7,11}\s*)/g;
    const extractedSegments = text.match(segmentRegex) || [text];
    const trimmedSegments = extractedSegments.map(s => s.trim());
    setSegments(trimmedSegments);
    
    // Calculate approx timing for each segment based on its length relative to total text
    const totalTextLength = text.length;
    const totalDuration = audioDuration || estimateSpeechDuration(text);
    
    const timings = trimmedSegments.map(segment => {
      const segmentProportion = segment.length / totalTextLength;
      return Math.round(totalDuration * segmentProportion);
    });
    
    setSegmentTimings(timings);
    setCurrentSegmentIndex(0);
    setCurrentSegment(trimmedSegments[0] || '');
    setVisibleLetters(0);
  }, [text, audioDuration]);

  // Handle playing state and segment timing
  useEffect(() => {
    // Clear any existing timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    
    if (letterTimerRef.current) {
      clearInterval(letterTimerRef.current);
      letterTimerRef.current = null;
    }
    
    if (!isPlaying || !text || segments.length === 0) {
      return;
    }
    
    // Start animation for the current segment
    setVisibleLetters(0);
    const segment = segments[currentSegmentIndex];
    setCurrentSegment(segment);
    
    // Get timing for this segment
    const segmentDuration = segmentTimings[currentSegmentIndex] || 2000; // default 2s if no timing
    const letterCount = segment.length;
    
    // Set timing interval to distribute letters evenly across the segment duration
    // This ensures the letters finish appearing just as the audio for that segment completes
    const typingInterval = Math.max(15, Math.min(50, segmentDuration / letterCount));
    let lettersShown = 0;
    
    startTimeRef.current = Date.now();
    
    letterTimerRef.current = setInterval(() => {
      lettersShown++;
      setVisibleLetters(lettersShown);
      
      // If we've revealed all letters in this segment
      if (lettersShown >= letterCount) {
        if (letterTimerRef.current) {
          clearInterval(letterTimerRef.current);
          letterTimerRef.current = null;
        }
        
        // Calculate how much time has elapsed for this segment
        const elapsedTime = Date.now() - startTimeRef.current;
        
        // If we finished letters faster than the audio segment, wait for audio to catch up
        const remainingTime = Math.max(0, segmentDuration - elapsedTime);
        
        // Move to the next segment after appropriate delay
        timerRef.current = setTimeout(() => {
          if (currentSegmentIndex < segments.length - 1) {
            setCurrentSegmentIndex(prev => prev + 1);
          } else {
            // We've completed all segments
            if (onComplete) {
              onComplete();
            }
          }
        }, remainingTime);
      }
    }, typingInterval);
    
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (letterTimerRef.current) {
        clearInterval(letterTimerRef.current);
      }
    };
  }, [isPlaying, currentSegmentIndex, segments, segmentTimings, onComplete]);

  // Create the letter elements with fade-in effect, ensuring proper word spacing
  const renderLetters = () => {
    if (!currentSegment) return null;
    
    // Render words with proper spacing
    const words = currentSegment.split(' ');
    let letterCounter = 0;
    
    return words.map((word, wordIndex) => {
      // Create a wrapper for each word to maintain spacing
      return (
        <span key={`word-${wordIndex}`} className="inline-block whitespace-normal" style={{ marginRight: '0.25em' }}>
          {/* Render each letter in the word with the fade effect */}
          {word.split('').map((letter, letterIndex) => {
            const absoluteLetterIndex = letterCounter++;
            const isVisible = absoluteLetterIndex < visibleLetters;
            
            return (
              <span
                key={`letter-${wordIndex}-${letterIndex}`}
                className={`transition-opacity duration-200 ease-in 
                  ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                  animationDelay: `${absoluteLetterIndex * 30}ms`,
                  display: 'inline-block'
                }}
              >
                {letter}
              </span>
            );
          })}
        </span>
      );
    });
  };

  return (
    <div className="subtitle-container w-full py-4 px-6 bg-black bg-opacity-50 text-white text-2xl font-semibold text-center absolute bottom-0 left-0 right-0 z-10">
      {renderLetters()}
    </div>
  );
};

export default SubtitleDisplay;