// src/components/Whiteboard.tsx
import React, { useRef, useState, useEffect } from 'react';
import Konva from 'konva';
import { Stage, Layer, Line, Rect, Circle, Text, Image, Ellipse } from 'react-konva';
import { Pencil, Eraser, Square, Circle as CircleIcon, Trash2, Download, Undo, Redo, Wand, Image as ImageIcon, Send } from 'lucide-react';
import SubtitleDisplay from './SubtitleDisplay';
import { useTTS } from '../context/TTSContext';

interface ToolButtonProps {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}

interface Line {
  id?: string;
  tool: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

// Apple component
const Apple: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <>
    <Circle
      x={x}
      y={y}
      radius={20}
      fill="#d62828"
      stroke="#6a040f"
      strokeWidth={2}
      shadowColor="black"
      shadowBlur={5}
      shadowOffset={{ x: 2, y: 2 }}
      shadowOpacity={0.3}
    />
    <Ellipse
      x={x + 10}
      y={y - 25}
      radiusX={8}
      radiusY={4}
      fill="#80ed99"
      rotation={-20}
    />
    <Rect
      x={x - 2}
      y={y - 30}
      width={4}
      height={10}
      fill="#4b3f36"
      cornerRadius={2}
    />
  </>
);

// Chocolate component
const Chocolate: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const segments = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      segments.push(
        <Rect
          key={`segment-${i}-${j}`}
          x={x - 12 + (i * 10)}
          y={y - 7 + (j * 9)}
          width={8}
          height={8}
          stroke="#2a1810"
          strokeWidth={0.5}
        />
      );
    }
  }

  return (
    <>
      <Rect
        x={x - 15}
        y={y - 10}
        width={30}
        height={20}
        fill="#4a3728"
        stroke="#2a1810"
        strokeWidth={1}
        cornerRadius={2}
        shadowColor="black"
        shadowBlur={3}
        shadowOffset={{ x: 1, y: 1 }}
        shadowOpacity={0.2}
      />
      {segments}
    </>
  );
};

interface Shape {
  id?: string;
  tool: 'rectangle' | 'circle' | 'text' | 'apple' | 'chocolate';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  count?: number;
}

const ToolButton: React.FC<ToolButtonProps> = ({ 
  onClick, 
  isActive, 
  title, 
  children, 
  className = ""
}) => (
  <button
    onClick={onClick}
    className={`p-2 rounded transition-all ${
      isActive 
        ? 'bg-blue-100 text-blue-700' 
        : 'hover:bg-gray-100'
    } ${className}`}
    title={title}
  >
    {children}
  </button>
);

// Update the Whiteboard component props interface
interface WhiteboardProps {
  initialPrompt?: string;
}

const Whiteboard: React.FC<WhiteboardProps> = ({ initialPrompt = "" }) => {
  const [tool, setTool] = useState<'pencil' | 'eraser' | 'rectangle' | 'circle'>('pencil');
  const [lines, setLines] = useState<Line[]>([]);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [media, setMedia] = useState<Array<{ type: 'image' | 'video', src: string, x: number, y: number, width: number, height: number }>>([]);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [isGlowing, setIsGlowing] = useState(false);
  const isDrawing = useRef(false);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [history, setHistory] = useState<Array<{ lines: Line[], shapes: Shape[] }>>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get TTS text and playing state from context
  const { 
    currentTTS, 
    isPlaying, 
    audioDuration, 
    drawings, 
    activeDrawingIds, 
    setCurrentTTS, 
    setDrawings, 
    activateDrawing 
  } = useTTS();

  // Add prompt state and visibility state
  // Initialize with initialPrompt if provided
  const [prompt, setPrompt] = useState(initialPrompt);
  const [showPrompt, setShowPrompt] = useState(!!initialPrompt);
  const promptInputRef = useRef<HTMLInputElement>(null);

  // Add effect to update prompt when initialPrompt changes
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
      setShowPrompt(true); // Show the prompt input when we receive a new prompt
    }
  }, [initialPrompt]);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setStageSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Effect to focus input when prompt field is shown
  useEffect(() => {
    if (showPrompt && promptInputRef.current) {
      promptInputRef.current.focus();
    }
  }, [showPrompt]);

  // Effect to handle dynamic drawing creation from drawings context
  useEffect(() => {
    console.log("Drawings context changed:", { drawings, activeDrawingIds });
    
    if (!drawings || !activeDrawingIds.length) {
      console.log("No drawings or active IDs");
      return;
    }
    
    // Find newly activated drawings
    const newDrawings = drawings.filter(d =>
      activeDrawingIds.includes(d.id) &&
      !shapes.some(s => s.id === d.id) &&
      !lines.some(l => l.id === d.id)
    );
    
    console.log("Filtered new drawings:", newDrawings);
    
    if (newDrawings.length === 0) {
      console.log("No new drawings to process");
      return;
    }
    
    // Add new shapes or lines
    const newShapes: Shape[] = [];
    const newLines: Line[] = [];
    
    newDrawings.forEach(drawing => {
      console.log("Processing drawing:", drawing);
      if (drawing.type === 'apple' || drawing.type === 'chocolate') {
        const shape: Shape = {
          id: drawing.id,
          tool: drawing.type as 'apple' | 'chocolate',
          x: drawing.x,
          y: drawing.y,
          color: '#000000',
          strokeWidth: 2,
          count: drawing.count
        };
        console.log("Created shape:", shape);
        newShapes.push(shape);
      } else if (drawing.type === 'text' || drawing.type === 'number') {
        newShapes.push({
          id: drawing.id,
          tool: 'text',
          x: drawing.x,
          y: drawing.y,
          color: '#000000',
          strokeWidth: 1,
          text: drawing.type === 'number' ? drawing.value : drawing.text || '',
          fontSize: drawing.fontSize || 24,
          fontFamily: drawing.fontFamily || 'Arial'
        });
      } else if (drawing.type === 'operator') {
        newShapes.push({
          id: drawing.id,
          tool: 'text',
          x: drawing.x,
          y: drawing.y,
          color: '#000000',
          strokeWidth: 1,
          text: drawing.symbol || '',
          fontSize: 24,
          fontFamily: 'Arial'
        });
      }
    });
    
    // Update shapes and lines
    if (newShapes.length > 0) {
      setShapes(prev => [...prev, ...newShapes]);
      console.log(`Added ${newShapes.length} new shapes from drawing instructions`);
    }
    
    if (newLines.length > 0) {
      setLines(prev => [...prev, ...newLines]);
      console.log(`Added ${newLines.length} new lines from drawing instructions`);
    }
    
    // Update history if we added new drawings
    if (newShapes.length > 0 || newLines.length > 0) {
      const updatedLines = [...lines, ...newLines];
      const updatedShapes = [...shapes, ...newShapes];
      
      setHistory([...history.slice(0, historyStep + 1), { 
        lines: updatedLines, 
        shapes: updatedShapes 
      }]);
      setHistoryStep(historyStep + 1);
    }
  }, [activeDrawingIds, drawings, historyStep, history, lines, shapes]);

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    isDrawing.current = true;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (tool === 'pencil' || tool === 'eraser') {
      setLines([...lines, { tool, points: [pos.x, pos.y], color: tool === 'eraser' ? '#FFFFFF' : color, strokeWidth: tool === 'eraser' ? 20 : lineWidth }]);
    } else {
      setShapes([...shapes, {
        tool,
        x: pos.x,
        y: pos.y,
        color,
        strokeWidth: lineWidth,
        count: 1 // Add count for apple/chocolate shapes
      } as Shape]); // Cast to Shape to satisfy TypeScript
    }
  };

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current) return;

    const stage = e.target.getStage();
    if (!stage) return;
    const point = stage.getPointerPosition();
    if (!point) return;

    if (tool === 'pencil' || tool === 'eraser') {
      const lastLine = lines[lines.length - 1];
      lastLine.points = lastLine.points.concat([point.x, point.y]);
      setLines([...lines.slice(0, -1), lastLine]);
    } else {
      const lastShape = shapes[shapes.length - 1];
      if (tool === 'rectangle') {
        lastShape.width = point.x - lastShape.x;
        lastShape.height = point.y - lastShape.y;
      } else if (tool === 'circle') {
        const dx = point.x - lastShape.x;
        const dy = point.y - lastShape.y;
        lastShape.radius = Math.sqrt(dx * dx + dy * dy);
      }
      setShapes([...shapes.slice(0, -1), lastShape]);
    }
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
    setHistory([...history.slice(0, historyStep + 1), { lines, shapes }]);
    setHistoryStep(historyStep + 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      setHistoryStep(historyStep - 1);
      const previous = history[historyStep - 1];
      setLines(previous.lines);
      setShapes(previous.shapes);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      setHistoryStep(historyStep + 1);
      const next = history[historyStep + 1];
      setLines(next.lines);
      setShapes(next.shapes);
    }
  };

  const clearCanvas = () => {
    setLines([]);
    setShapes([]);
    setHistory([...history, { lines: [], shapes: [] }]);
    setHistoryStep(historyStep + 1);
  };

  const saveCanvas = () => {
    if (stageRef.current) {
      const dataURL = stageRef.current.toDataURL();
      const link = document.createElement('a');
      link.download = `whiteboard-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = dataURL;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Toggle prompt input visibility with an option to focus
  const togglePromptInput = (andFocus = false) => {
    setShowPrompt(!showPrompt);
    // If we're showing the prompt and andFocus is true, focus the input when it appears
    if (!showPrompt && andFocus) {
      setTimeout(() => {
        promptInputRef.current?.focus();
      }, 50);
    }
  };

  // Modified handleWandClick function to either use the image or just the text
  const handleWandClick = async () => {
    // If prompt is not visible, show it first and focus it
    if (!showPrompt) {
      togglePromptInput(true);
      return;
    }
    
    if (!prompt.trim()) {
      console.error("Prompt is empty");
      return;
    }
    
    console.log("Wand button clicked. Processing the request.");
   
    // Apply glow effect
    setIsGlowing(true);
    setTimeout(() => {
      setIsGlowing(false);
    }, 1000); // Glow for 1 second (matching animation duration)

    // Reset any stored answer data before sending a new prompt
    localStorage.removeItem('currentProblemAnswer');
    
    // Determine if we should include the canvas image or just use text
    const useImage = stageRef.current && 
                    (lines.length > 0 || shapes.length > 0 || media.length > 0);
    
    try {
      let response;

      if (useImage) {
        // We have drawings, so capture and send the image with the prompt
        console.log("Using image + text mode");
        const endpoint = 'http://localhost:8000/process_whiteboard_image';
        
        // Ensure the stage has a background color to avoid black canvas
        const bgColor = '#FFFFFF'; // White background
      
        // Export the stage with a background color
        const dataURL = stageRef.current.toDataURL({
          mimeType: 'image/png',
          quality: 1,
          pixelRatio: 1, // Explicitly set pixel ratio
          backgroundColor: bgColor
        });

        // Verify the image data is not empty
        console.log("Canvas data URL generated, length:", dataURL.length);
        
        // Convert data URL to Blob
        const blob = await (await fetch(dataURL)).blob();
        console.log("Blob created, size:", blob.size);
        
        // Send the image data directly to the backend
        response = await fetch(endpoint, {
          method: 'POST',
          body: blob,
          headers: {
            'X-Prompt': prompt
          }
        });
      } else {
        // No drawings, just use the text prompt
        console.log("Using text-only mode");
        const endpoint = 'http://localhost:8000/tutor/text';

        // Send the text directly to the backend
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: prompt })
        });
      }

      if (response.ok) {
        console.log("Request processed successfully.");
        const result = await response.json();
        console.log("Response from backend:", result);
        
        // Process the result - ensure it gets to TTS
        // This code mimics what happens in SpeechRecognition.tsx
        if (result && result.answer) {
          if (typeof result.answer === 'object' && result.answer.explanation) {
            // Send the explanation to TTS via context
            setCurrentTTS(result.answer.explanation);
            
            // If there are scene elements, add them to the whiteboard
            if (result.answer.scene && Array.isArray(result.answer.scene)) {
              setDrawings(result.answer.scene);
              result.answer.scene.forEach(drawing => {
                if (drawing.id) {
                  activateDrawing(drawing.id);
                }
              });
            }
            
            // Store final_answer if available for validation
            if (result.answer.final_answer) {
              localStorage.setItem('currentProblemAnswer', 
                                 JSON.stringify(result.answer.final_answer));
            }
          } else {
            // Simple text response
            setCurrentTTS(String(result.answer));
          }
        }
        
        // If audio path is provided, play it
        if (result.audio) {
          const audio = new Audio(result.audio);
          audio.play().catch(error => {
            console.error("Error playing audio:", error);
          });
        }
        
        // Hide prompt after sending
        setShowPrompt(false);
      } else {
        console.error("Error processing request:", response.status, response.statusText);
      }
      
      // Clear the prompt after sending
      setPrompt('');
    } catch (error) {
      console.error("Error processing request:", error);
    }
  };

  // Handle pressing Enter in prompt input
  const handlePromptKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleWandClick();
    } else if (e.key === 'Escape') {
      setShowPrompt(false);
    }
  };

  const handleMediaSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const type = file.type.startsWith('image/') ? 'image' : 'video';

      if (type === 'image') {
        const img = new window.Image();
        img.onload = () => {
          setMedia([...media, { type: 'image', src, x: 50, y: 50, width: img.width, height: img.height }]);
        };
        img.src = src;
      } else if (type === 'video') {
        // Handling video requires a different approach, potentially using a Konva.Image from a video element
        // For simplicity, we'll just add a placeholder for now.
        console.log("Video selected. Video display is not fully implemented yet.");
        // setMedia([...media, { type: 'video', src, x: 50, y: 50, width: 200, height: 150 }]); // Placeholder
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full">
      <style>{`
        @keyframes glow {
          0% { box-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 15px #00bfff, 0 0 20px #00bfff, 0 0 25px #00bfff, 0 0 30px #00bfff, 0 0 35px #00bfff; }
          100% { box-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px #00bfff, 0 0 40px #00bfff, 0 0 50px #00bfff, 0 0 60px #00bfff, 0 0 70px #00bfff; }
        }
        .glow {
          animation: glow 1s ease-in-out infinite alternate;
        }
      `}</style>
      <input
        type="file"
        id="mediaInput"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleMediaSelect}
      />
      <div className="flex flex-wrap items-center gap-2 p-2 bg-white border-b">
        
        <div className="flex space-x-1">
          <ToolButton
            onClick={() => setTool('pencil')}
            isActive={tool === 'pencil'}
            title="Pencil"
          >
            <Pencil className="w-5 h-5" />
          </ToolButton>
          <ToolButton 
            onClick={() => setTool('eraser')}
            isActive={tool === 'eraser'}
            title="Eraser"
          >
            <Eraser className="w-5 h-5" />
          </ToolButton>
          <ToolButton 
            onClick={() => setTool('rectangle')}
            isActive={tool === 'rectangle'}
            title="Rectangle"
          >
            <Square className="w-5 h-5" />
          </ToolButton>
          <ToolButton 
            onClick={() => setTool('circle')}
            isActive={tool === 'circle'}
            title="Circle"
          >
            <CircleIcon className="w-5 h-5" />
          </ToolButton>
          <ToolButton
            onClick={() => togglePromptInput(true)}
            isActive={showPrompt}
            title="Magic Wand"
          >
            <Wand className="w-5 h-5" />
          </ToolButton>
          <ToolButton
            onClick={() => document.getElementById('mediaInput')?.click()}
            isActive={false}
            title="Add Image or Video"
          >
            <ImageIcon className="w-5 h-5" />
          </ToolButton>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
              title="Color picker"
              disabled={tool === 'eraser'}
            />
            <div 
              className={`absolute inset-0 rounded pointer-events-none transition-opacity ${tool === 'eraser' ? 'bg-gray-200 opacity-50' : 'opacity-0'}`}
            ></div>
          </div>
          
          <div className="flex items-center space-x-1">
            <span className="text-xs text-gray-500">Width:</span>
            <input
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(parseInt(e.target.value))}
              className="w-24 h-2"
              title="Line width"
            />
            <span className="text-xs w-5 text-center">{lineWidth}</span>
          </div>
        </div>
        
        {/* Updated prompt input field */}
        {showPrompt && (
          <div className="flex-grow flex items-center">
            <div className="relative flex-grow max-w-lg">
              <input
                ref={promptInputRef}
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 pr-10"
                placeholder="Ask a question or give instructions..."
                onKeyDown={handlePromptKeyDown}
              />
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-500 hover:text-blue-700"
                onClick={handleWandClick}
                title="Send"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        
        {!showPrompt && <div className="flex-grow"></div>}
        
        <div className="flex space-x-1">
          <ToolButton 
            onClick={undo}
            isActive={false}
            title="Undo"
            className={historyStep <= 0 ? 'opacity-50 cursor-not-allowed' : ''}
          >
            <Undo className="w-5 h-5" />
          </ToolButton>
          <ToolButton 
            onClick={redo}
            isActive={false}
            title="Redo"
            className={historyStep >= history.length - 1 ? 'opacity-50 cursor-not-allowed' : ''}
          >
            <Redo className="w-5 h-5" />
          </ToolButton>
          <ToolButton 
            onClick={saveCanvas}
            isActive={false}
            title="Save as Image"
          >
            <Download className="w-5 h-5" />
          </ToolButton>
          <ToolButton 
            onClick={clearCanvas}
            isActive={false}
            title="Clear canvas"
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-5 h-5" />
          </ToolButton>
        </div>
      </div>
      
      <div className={`flex-grow relative overflow-hidden ${isGlowing ? 'glow' : ''}`} ref={containerRef}>
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onMouseleave={handleMouseUp}
          ref={stageRef}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={`line-${line.id || i}`}
                points={line.points}
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
            {shapes.map((shape, i) => {
              if (shape.tool === 'apple') {
                console.log("Rendering apple shape:", shape);
                const count = shape.count || 1;
                const spacing = 60; // Space between apples
                return Array.from({ length: count }).map((_, j) => {
                  const x = shape.x + (j * spacing);
                  console.log(`Drawing apple ${j + 1}/${count} at (${x}, ${shape.y})`);
                  return (
                    <Apple
                      key={`shape-${shape.id || i}-${j}`}
                      x={x}
                      y={shape.y}
                    />
                  );
                });
              } else if (shape.tool === 'chocolate') {
                console.log("Rendering chocolate shape:", shape);
                const count = shape.count || 1;
                const spacing = 50; // Space between chocolates
                return Array.from({ length: count }).map((_, j) => {
                  const x = shape.x + (j * spacing);
                  console.log(`Drawing chocolate ${j + 1}/${count} at (${x}, ${shape.y})`);
                  return (
                    <Chocolate
                      key={`shape-${shape.id || i}-${j}`}
                      x={x}
                      y={shape.y}
                    />
                  );
                });
              } else if (shape.tool === 'rectangle' && shape.width && shape.height) {
                return (
                  <Rect
                    key={`shape-${shape.id || i}`}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                  />
                );
              } else if (shape.tool === 'circle' && shape.radius) {
                return (
                  <Circle
                    key={`shape-${shape.id || i}`}
                    x={shape.x}
                    y={shape.y}
                    radius={shape.radius}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
                  />
                );
              } else if (shape.tool === 'text' && shape.text) {
                return (
                  <Text
                    key={`shape-${shape.id || i}`}
                    x={shape.x}
                    y={shape.y}
                    text={shape.text}
                    fontSize={shape.fontSize || 24}
                    fontFamily={shape.fontFamily || 'Arial'}
                    fill={shape.color}
                  />
                );
              }
              return null;
            })}
            {media.map((item, i) => {
              if (item.type === 'image') {
                const img = new window.Image();
                img.src = item.src;
                return (
                  <Image
                    key={`media-${i}`}
                    image={img}
                    x={item.x}
                    y={item.y}
                    width={item.width}
                    height={item.height}
                    draggable
                  />
                );
              }
              // Video handling is more complex and not fully implemented here
              return null;
            })}
          </Layer>
        </Stage>
        
        {/* Subtitle display at the bottom of the whiteboard */}
        {isPlaying && currentTTS && (
          <SubtitleDisplay 
            text={currentTTS} 
            isPlaying={isPlaying}
            audioDuration={audioDuration}
          />
        )}
      </div>
    </div>
  );
};

export default Whiteboard;