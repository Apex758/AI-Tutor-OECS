import re
import json
import random
from typing import List, Dict, Tuple, Any, Optional

class DrawingGenerator:
    """
    Handles the generation and formatting of drawing instructions based on
    AI-generated explanations.
    """
    
    @staticmethod
    def extract_drawing_commands(text: str) -> List[Dict[str, Any]]:
        """
        Extract drawing commands from text marked with special syntax.
        
        Example syntax:
        - {CIRCLE:center}
        - {RECT:example_rectangle}
        - {FRACTION:1/4}
        
        Args:
            text: The text containing drawing commands
            
        Returns:
            List of dictionaries with command info (type, id, params)
        """
        # Pattern for extracting drawing commands
        pattern = r'\{([A-Z_]+):([^}]+)\}'
        matches = re.findall(pattern, text)
        
        commands = []
        for match in matches:
            cmd_type, params = match
            cmd_id = f"{cmd_type.lower()}_{len(commands)}"
            
            commands.append({
                "type": cmd_type,
                "id": cmd_id,
                "params": params
            })
        
        return commands
    
    @staticmethod
    def generate_drawing_from_command(command: Dict[str, Any], base_x: int = 200, base_y: int = 200) -> Dict[str, Any]:
        """
        Generate a drawing instruction based on the command type.
        
        Args:
            command: The command dictionary with type, id, params
            base_x: Base X coordinate for positioning
            base_y: Base Y coordinate for positioning
            
        Returns:
            Drawing instruction dictionary
        """
        cmd_type = command["type"]
        cmd_id = command["id"]
        params = command["params"]
        
        # Default drawing properties
        drawing = {
            "id": cmd_id,
            "lineWidth": 2,
            "color": "#000000"
        }
        
        # Generate different types of drawings based on command type
        if cmd_type == "CIRCLE":
            drawing.update({
                "type": "circle",
                "startX": base_x + random.randint(-50, 50),
                "startY": base_y + random.randint(-50, 50),
                "radius": 50,
                "color": "#0000FF"
            })
        
        elif cmd_type == "RECT":
            drawing.update({
                "type": "rectangle",
                "startX": base_x + random.randint(-50, 50),
                "startY": base_y + random.randint(-50, 50),
                "width": 100,
                "height": 80,
                "color": "#FF0000"
            })
        
        elif cmd_type == "LINE":
            drawing.update({
                "type": "line",
                "startX": base_x + random.randint(-50, 50),
                "startY": base_y + random.randint(-50, 50),
                "endX": base_x + 100 + random.randint(-20, 20),
                "endY": base_y + 100 + random.randint(-20, 20),
                "color": "#00CC00"
            })
            
        elif cmd_type == "FRACTION":
            # For fractions, create a text element
            parts = params.split('/')
            drawing.update({
                "type": "text",
                "startX": base_x,
                "startY": base_y,
                "text": params,
                "fontSize": 24,
                "fontFamily": "Arial",
                "color": "#000000"
            })
            
            # Also create a line for the fraction
            if len(parts) == 2:
                return [
                    drawing,
                    {
                        "id": f"{cmd_id}_line",
                        "type": "line",
                        "startX": base_x - 10,
                        "startY": base_y + 10,
                        "endX": base_x + 30,
                        "endY": base_y + 10,
                        "color": "#000000",
                        "lineWidth": 2
                    }
                ]
                
        elif cmd_type == "PATH":
            # Create a simple path (e.g., for division lines)
            points = []
            start_x = base_x + random.randint(-50, 50)
            start_y = base_y + random.randint(-50, 50)
            
            # Generate some random points for the path
            for i in range(3):
                points.append({
                    "x": start_x + i * 40 + random.randint(-10, 10),
                    "y": start_y + i * 30 + random.randint(-10, 10)
                })
            
            drawing.update({
                "type": "path",
                "points": points,
                "color": "#663399"
            })
            
        else:
            # Default to a simple text element
            drawing.update({
                "type": "text",
                "startX": base_x,
                "startY": base_y,
                "text": params,
                "fontSize": 20,
                "fontFamily": "Arial",
                "color": "#000000"
            })
            
        return [drawing]
    
    @staticmethod
    def process_explanation(explanation: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Process an explanation text to extract drawing commands and generate
        drawing instructions.
        
        Args:
            explanation: The explanation text with embedded drawing commands
            
        Returns:
            Tuple of (cleaned_explanation, drawing_instructions)
        """
        # Extract commands from the explanation
        commands = DrawingGenerator.extract_drawing_commands(explanation)
        
        # Generate drawings based on commands
        drawings = []
        base_x = 200
        base_y = 200
        
        for i, command in enumerate(commands):
            # Adjust position for each new drawing to spread them out
            adjusted_x = base_x + (i % 3) * 150
            adjusted_y = base_y + (i // 3) * 120
            
            drawing_items = DrawingGenerator.generate_drawing_from_command(
                command, 
                adjusted_x, 
                adjusted_y
            )
            
            if isinstance(drawing_items, list):
                drawings.extend(drawing_items)
            else:
                drawings.append(drawing_items)
        
        # Replace commands with markers in the explanation
        cleaned_explanation = explanation
        for command in commands:
            cmd_type = command["type"]
            params = command["params"]
            cmd_id = command["id"]
            
            # Replace the command with a marker
            pattern = f"{{{cmd_type}:{params}}}"
            marker = f"[DRAW:{cmd_id}]"
            cleaned_explanation = cleaned_explanation.replace(pattern, marker)
        
        return cleaned_explanation, drawings
    
    @staticmethod
    def format_response(question: str, explanation: str, audio_path: str) -> Dict[str, Any]:
        """
        Format the response with explanation and drawings.
        
        Args:
            question: The user's question
            explanation: The AI-generated explanation with drawing commands
            audio_path: Path to the TTS audio file
            
        Returns:
            Formatted response dictionary
        """
        # Process the explanation to extract and generate drawings
        processed_explanation, drawings = DrawingGenerator.process_explanation(explanation)
        
        # Format the response
        response = {
            "question": question,
            "answer": {
                "explanation": processed_explanation,
                "drawings": drawings
            },
            "audio": audio_path
        }
        
        return response

# Testing function
def test_drawing_generator():
    explanation = """
    Fractions are parts of a whole. For example, if we have a pizza {CIRCLE:pizza} 
    and cut it into 4 equal parts with lines {PATH:division}, each part would be 
    {FRACTION:1/4} of the whole pizza. We can also represent fractions with rectangles 
    {RECT:fraction_rect}.
    """
    
    processed_explanation, drawings = DrawingGenerator.process_explanation(explanation)
    
    print("Processed explanation:")
    print(processed_explanation)
    print("\nDrawings:")
    for drawing in drawings:
        print(json.dumps(drawing, indent=2))
    
    return processed_explanation, drawings

if __name__ == "__main__":
    test_drawing_generator()