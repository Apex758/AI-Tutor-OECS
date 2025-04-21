import React, { useRef, useState, useEffect } from 'react';
import Konva from 'konva';
import { Stage, Layer, Line, Rect, Circle } from 'react-konva';
import { Pencil, Eraser, Square, Circle as CircleIcon, Trash2, Download, Undo, Redo, Wand, Image as ImageIcon } from 'lucide-react';

interface ToolButtonProps {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
}

interface Line {
  tool: string;
  points: number[];
  color: string;
  strokeWidth: number;
}

interface Shape {
  tool: 'rectangle' | 'circle';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  color: string;
  strokeWidth: number;
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

const Whiteboard: React.FC = () => {
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

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    isDrawing.current = true;
    const stage = e.target.getStage();
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (tool === 'pencil' || tool === 'eraser') {
      setLines([...lines, { tool, points: [pos.x, pos.y], color: tool === 'eraser' ? '#FFFFFF' : color, strokeWidth: tool === 'eraser' ? 20 : lineWidth }]);
    } else {
      setShapes([...shapes, { tool, x: pos.x, y: pos.y, color, strokeWidth: lineWidth }]);
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

  const handleWandClick = async () => {
    console.log("Wand button clicked. Capturing canvas and sending to placeholder endpoint.");

    // Apply glow effect
    setIsGlowing(true);
    setTimeout(() => {
      setIsGlowing(false);
    }, 1000); // Glow for 1 second (matching animation duration)

    // Placeholder endpoint - replace with actual backend endpoint
    const placeholderEndpoint = 'http://localhost:8000/process_whiteboard_image'; // Placeholder endpoint - requires backend implementation

    if (!stageRef.current) {
      console.error("Stage is not available.");
      return;
    }

    try {
      // Capture the canvas as a data URL
      const dataURL = stageRef.current.toDataURL({
        mimeType: 'image/png',
        quality: 1,
      });

      // Convert data URL to Blob
      const blob = await (await fetch(dataURL)).blob();

      // Send the image data (Blob) to the endpoint
      const response = await fetch(placeholderEndpoint, {
        method: 'POST',
        body: blob,
        headers: {
          'Content-Type': 'image/png',
        },
      });

      if (response.ok) {
        console.log("Canvas image sent successfully to placeholder endpoint.");
        // Handle response from backend if needed
        const result = await response.text(); // Assuming backend might return text confirmation
        console.log("Response from backend:", result);
      } else {
        console.error("Error sending canvas image to placeholder endpoint:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Error during canvas capture or fetch:", error);
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
            onClick={() => handleWandClick()}
            isActive={false}
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
        
        <div className="flex-grow"></div>
        
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
                key={`line-${i}`}
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
              if (shape.tool === 'rectangle' && shape.width && shape.height) {
                return (
                  <Rect
                    key={`shape-${i}`}
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
                    key={`shape-${i}`}
                    x={shape.x}
                    y={shape.y}
                    radius={shape.radius}
                    stroke={shape.color}
                    strokeWidth={shape.strokeWidth}
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
      </div>
    </div>
  );
};

export default Whiteboard;