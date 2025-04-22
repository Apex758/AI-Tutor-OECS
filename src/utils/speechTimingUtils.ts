/**
 * Speech timing utility functions
 * 
 * These functions help estimate the duration of speech for TTS playback
 * to allow for automatic switching between listening and speaking modes.
 */

/**
 * Estimates the duration in milliseconds of speech based on text content.
 * 
 * Uses a simple model based on average reading speeds:
 * - Average English speaker speaks at ~150 words per minute
 * - Adds pauses for punctuation
 * - Accounts for minimum duration for very short texts
 * 
 * @param text The text to be spoken
 * @returns Estimated duration in milliseconds
 */
export const estimateSpeechDuration = (text: string): number => {
    if (!text) return 0;
    
    // Basic parameters
    const WORDS_PER_MINUTE = 150; // Average speaking rate
    const CHARS_PER_WORD = 5; // Average characters per word
    const MS_PER_WORD = (60 * 1000) / WORDS_PER_MINUTE; // Milliseconds per word
    const PAUSE_FOR_PERIOD = 300; // Extra pause for periods in ms
    const PAUSE_FOR_COMMA = 150; // Extra pause for commas in ms
    const MINIMUM_DURATION = 1000; // Minimum duration for any speech in ms
    
    // Count words (approximate)
    const wordCount = text.trim().split(/\s+/).length;
    
    // Count punctuation for pauses
    const periodCount = (text.match(/\./g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;
    
    // Calculate base duration from words
    let duration = wordCount * MS_PER_WORD;
    
    // Add time for punctuation pauses
    duration += periodCount * PAUSE_FOR_PERIOD;
    duration += commaCount * PAUSE_FOR_COMMA;
    
    // Ensure minimum duration
    return Math.max(duration, MINIMUM_DURATION);
  };
  
  /**
   * Alternative estimation based on character count which may be more accurate for some TTS systems
   * 
   * @param text The text to be spoken
   * @returns Estimated duration in milliseconds
   */
  export const estimateSpeechDurationByChars = (text: string): number => {
    if (!text) return 0;
    
    // Average speaking rate is about 15-17 characters per second for TTS
    const CHARS_PER_SECOND = 15;
    const MINIMUM_DURATION = 1000;
    
    // Calculate duration
    const charCount = text.length;
    const duration = (charCount / CHARS_PER_SECOND) * 1000;
    
    // Ensure minimum duration
    return Math.max(duration, MINIMUM_DURATION);
  };