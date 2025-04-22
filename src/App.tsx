import React, { useState } from "react";
import Whiteboard from "./components/Whiteboard";
import SpeechRecognition from "./components/SpeechRecognition";
import CameraFeed from "./components/CameraFeed";
import TranscriptViewer from "./components/TranscriptViewer";
import DocumentManager from "./components/DocumentManager";
import { ArrowLeftCircle, ArrowRightCircle, Mic, Book, Brain } from "lucide-react";
import { TTSProvider } from "./context/TTSContext";

const App: React.FC = () => {
  const [transcript, setTranscript] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  // Function to update transcript that can be passed to SpeechRecognition
  const updateTranscript = (newText: string) => {
    setTranscript(prev => {
      // Add a newline if there's already content
      return prev ? `${prev}\n${newText}` : newText;
    });
  };

  return (
    <TTSProvider>
      <div className="h-screen w-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b px-4 py-3 shadow-sm flex items-center">
          <div className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-blue-900">AI Tutor</h1>
          </div>
          <div className="flex-grow"></div>
          <div className="text-sm text-gray-500">
            Interactive Learning Assistant
          </div>
        </header>
        
        <div className="flex-grow flex relative overflow-hidden">
          {/* Whiteboard area */}
          <div className={`${sidebarCollapsed ? 'w-full' : 'w-3/4'} h-full transition-all duration-300 ease-in-out`}>
            <Whiteboard />
          </div>

          {/* Sidebar toggle button */}
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

          {/* Sidebar */}
          <div 
            className={`h-full overflow-hidden flex flex-col border-l border-gray-300 bg-white transition-all duration-300 ease-in-out ${
              sidebarCollapsed ? 'w-0 opacity-0' : 'w-1/4 opacity-100'
            }`}
          >
            {!sidebarCollapsed && (
              <>
                {/* Camera feed */}
                <div className="h-2/5 p-4 border-b border-gray-200">
                  <CameraFeed />
                </div>
                
                {/* Speech recognition controls */}
                <div className="h-[50px] bg-white border-b border-gray-200 p-2 flex items-center">
                  <div className="mr-2 flex items-center">
                    <Mic className="w-4 h-4 text-gray-500 mr-1" />
                    <span className="text-sm font-medium">Voice Control:</span>
                  </div>
                  <SpeechRecognition onTranscriptUpdate={updateTranscript} />
                </div>
                
                {/* Transcript area */}
                <div className="flex-grow p-4 overflow-hidden">
                  <TranscriptViewer transcript={transcript} />
                </div>
              </>
            )}
          </div>
        </div>
        
        {/* Document Manager Component */}
        <DocumentManager />
      </div>
    </TTSProvider>
  );
};

export default App;