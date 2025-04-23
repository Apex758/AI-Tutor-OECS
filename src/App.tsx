import React, { useState } from "react";
import Whiteboard from "./components/Whiteboard";
import SpeechRecognition from "./components/SpeechRecognition";
import CameraFeed from "./components/CameraFeed";
import TranscriptViewer from "./components/TranscriptViewer";
import DocumentManager from "./components/DocumentManager";
import { ArrowLeftCircle, ArrowRightCircle, Mic, Brain } from "lucide-react";
import { TTSProvider } from "./context/TTSContext";

const App: React.FC = () => {
  const [transcript, setTranscript] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>("");
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false);

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  const updateTranscript = (newText: string) => {
    setTranscript(prev => {
      return prev ? `${prev}\n${newText}` : newText;
    });
    
    if (newText.startsWith("You:") && localStorage.getItem('currentProblemAnswer')) {
      setIsProcessingAnswer(true);
      setTimeout(() => setIsProcessingAnswer(false), 2000);
    }
  };

  const handleSendMessage = (message: string) => {
    const userMessage = `You: ${message}`;
    updateTranscript(userMessage);
    setCurrentPrompt(message);
    
    const savedProblem = localStorage.getItem('currentProblemAnswer');
    if (savedProblem && !isProcessingAnswer) {
      try {
        const problem = JSON.parse(savedProblem);
        const studentAnswer = message.trim().toLowerCase();
        const correctAnswer = String(problem.correct_value).trim().toLowerCase();
        const isCorrect = studentAnswer === correctAnswer;
        
        setTimeout(() => {
          const feedback = isCorrect
            ? problem.feedback_correct
            : `${problem.feedback_incorrect} ${isCorrect ? '' : problem.explanation}`;
          updateTranscript(`PEARL: ${feedback}`);
        }, 500);
        return;
      } catch (e) {
        console.error('Error processing saved problem:', e);
      }
    }
    
    setTimeout(() => {
      const pearlResponse = `PEARL: I see you're asking about "${message}". Let me analyze your drawing.`;
      updateTranscript(pearlResponse);
    }, 500);
  };

  return (
    <TTSProvider>
      <div className="h-screen w-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b px-4 py-3 shadow-sm flex items-center">
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-blue-900">PEARL Tutor</h1>
          </div>
          <div className="flex-grow"></div>
          <div className="text-sm text-gray-500">
            Interactive Learning Assistant
          </div>
        </header>
        
        <div className="flex-grow flex relative overflow-hidden">
          <div className={`${sidebarCollapsed ? 'w-full' : 'w-3/4'} h-full transition-all duration-300 ease-in-out`}>
            <Whiteboard initialPrompt={currentPrompt} />
          </div>

          <button
            onClick={toggleSidebar}
            className="absolute top-1/2 right-0 transform -translate-y-1/2 z-10 bg-white rounded-l-full p-1 shadow-md text-gray-600 hover:text-gray-900"
          >
            {sidebarCollapsed ? (
              <ArrowLeftCircle className="w-6 h-6" />
            ) : (
              <ArrowRightCircle className="w-6 h-6" />
            )}
          </button>

          <div
            className={`h-full overflow-hidden flex flex-col border-l border-gray-300 bg-white transition-all duration-300 ease-in-out ${
              sidebarCollapsed ? 'w-0 opacity-0' : 'w-1/4 opacity-100'
            }`}
          >
            {!sidebarCollapsed && (
              <>
                <div className="h-2/5 p-4 border-b border-gray-200">
                  <CameraFeed />
                </div>
                
                <div className="h-[50px] bg-white border-b border-gray-200 p-2 flex items-center">
                  <div className="mr-2 flex items-center">
                    <Mic className="w-4 h-4 text-gray-500 mr-1" />
                    <span className="text-sm font-medium">Voice Control:</span>
                  </div>
                  <SpeechRecognition onTranscriptUpdate={updateTranscript} />
                </div>
                
                <div className="flex-grow p-4 overflow-hidden">
                  <TranscriptViewer
                    transcript={transcript}
                    onSendMessage={handleSendMessage}
                  />
                </div>
              </>
            )}
          </div>
        </div>
        
        <DocumentManager />
      </div>
    </TTSProvider>
  );
};

export default App;