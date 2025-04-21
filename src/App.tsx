import React, { useState } from "react";
import Whiteboard from "./components/Whiteboard";
import SpeechRecognition from "./components/SpeechRecognition";
import CameraFeed from "./components/CameraFeed";
import TranscriptViewer from "./components/TranscriptViewer";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";

const App: React.FC = () => {
  const [transcript, setTranscript] = useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    setSidebarCollapsed(prev => !prev);
  };

  // Function to update transcript that can be passed to SpeechRecognition
  const updateTranscript = (newTranscript: string) => {
    setTranscript(prev => prev + "\n" + newTranscript);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b px-4 py-2 shadow-sm">
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
              <div className="h-[50px] bg-white border-b border-gray-200 p-2">
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
    </div>
  );
};

export default App;