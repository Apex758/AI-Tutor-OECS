import React, { useState, useEffect } from 'react';
import { useTTS } from '../context/TTSContext';

interface FinalAnswer {
  correct_value: string | number;
  explanation: string;
  feedback_correct: string;
  feedback_incorrect: string;
}

interface AnswerValidatorProps {
  onFeedback?: (feedback: string, isCorrect: boolean) => void;
}

const AnswerValidator: React.FC<AnswerValidatorProps> = ({ onFeedback }) => {
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [showValidator, setShowValidator] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{ message: string, isCorrect: boolean } | null>(null);
  const [currentProblem, setCurrentProblem] = useState<FinalAnswer | null>(null);
  
  const { setCurrentTTS } = useTTS();

  // Load the current problem from localStorage if available
  useEffect(() => {
    const savedProblem = localStorage.getItem('currentProblemAnswer');
    if (savedProblem) {
      try {
        const parsedProblem = JSON.parse(savedProblem) as FinalAnswer;
        setCurrentProblem(parsedProblem);
        setShowValidator(true);
      } catch (e) {
        console.error('Error parsing saved problem:', e);
        setShowValidator(false);
      }
    } else {
      setShowValidator(false);
    }
  }, []);

  // Reset the form when a new problem is loaded
  useEffect(() => {
    setStudentAnswer('');
    setValidationResult(null);
  }, [currentProblem]);

  const validateAnswer = () => {
    if (!currentProblem || !studentAnswer.trim()) return;
    
    // Normalize answers for comparison
    const normalizedCorrect = String(currentProblem.correct_value).trim().toLowerCase();
    const normalizedStudent = studentAnswer.trim().toLowerCase();
    
    // Check if answer is correct
    const isCorrect = normalizedCorrect === normalizedStudent;
    
    // Determine feedback message
    const feedbackMessage = isCorrect 
      ? currentProblem.feedback_correct
      : currentProblem.feedback_incorrect;
    
    // Set validation result
    setValidationResult({
      message: feedbackMessage,
      isCorrect
    });
    
    // Speak the feedback
    setCurrentTTS(feedbackMessage);
    
    // Call the onFeedback callback if provided
    if (onFeedback) {
      onFeedback(feedbackMessage, isCorrect);
    }
  };

  // Only render if there's a problem to solve
  if (!showValidator) return null;

  return (
    <div className="mt-4 p-4 bg-white rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-2">Your Answer</h3>
      
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={studentAnswer}
          onChange={(e) => setStudentAnswer(e.target.value)}
          className="flex-grow p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Type your answer here..."
          onKeyDown={(e) => e.key === 'Enter' && validateAnswer()}
        />
        <button
          onClick={validateAnswer}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Check
        </button>
      </div>
      
      {validationResult && (
        <div className={`mt-2 p-3 rounded ${validationResult.isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {validationResult.message}
          {!validationResult.isCorrect && currentProblem.explanation && (
            <div className="mt-1 text-sm">
              <strong>Hint:</strong> {currentProblem.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnswerValidator;