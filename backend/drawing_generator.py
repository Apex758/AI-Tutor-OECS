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
        if cmd_type == "apple":
            drawing.update({
                "type": "apple",
                "x": base_x,
                "y": base_y,
                "count": int(params) if params.isdigit() else 1
            })
            
        elif cmd_type == "chocolate":
            drawing.update({
                "type": "chocolate",
                "x": base_x,
                "y": base_y,
                "count": int(params) if params.isdigit() else 1
            })
            
        elif cmd_type == "number":
            drawing.update({
                "type": "text",
                "x": base_x,
                "y": base_y,
                "text": params,
                "fontSize": 24,
                "fontFamily": "Arial",
                "color": "#000000"
            })
            
        elif cmd_type == "operator":
            drawing.update({
                "type": "text",
                "x": base_x,
                "y": base_y,
                "text": params,  # params should be one of: +, -, =, *, /
                "fontSize": 24,
                "fontFamily": "Arial",
                "color": "#000000"
            })
        
        elif cmd_type == "LINE":
            drawing.update({
                "type": "line",
                # Use base coordinates directly for start, remove randomness for consistency
                "x": base_x,
                "y": base_y,
                # Draw a fixed horizontal line of length 100
                "width": 100,
                "color": "#00CC00"
            })
            
        elif cmd_type == "FRACTION":
            # For fractions, create a text element
            parts = params.split('/')
            drawing.update({
                "type": "text",
                "x": base_x,
                "y": base_y,
                "text": params,
                "fontSize": 24,
                "fontFamily": "Arial",
                "color": "#000000"
                # Konva text aligns left by default, which is okay for now
            })
            
            # Also create a line for the fraction, better centered
            if len(parts) == 2:
                # Estimate text width (simple approximation)
                approx_text_width = len(params) * 12 # Approx 12px per char at 24px font size
                line_start_x = base_x - 5 # Start slightly left of text
                line_end_x = base_x + approx_text_width + 5 # End slightly right of text
                line_y = base_y + 12 # Position below the baseline of the text
                
                return [
                    drawing, # The text itself
                    {
                        "id": f"{cmd_id}_line",
                        "type": "line",
                        "x": line_start_x,
                        "y": line_y,
                        "width": line_end_x - line_start_x,
                        "color": "#000000",
                        "lineWidth": 2
                    }
                ]
                
        elif cmd_type == "PATH":
            # Create a simple, consistent path (e.g., a horizontal zigzag)
            start_x = base_x # Use base coordinates directly
            start_y = base_y
            
            # Define points for a fixed zigzag path
            points = [
                {"x": start_x, "y": start_y},
                {"x": start_x + 25, "y": start_y - 15},
                {"x": start_x + 50, "y": start_y},
                {"x": start_x + 75, "y": start_y + 15},
                {"x": start_x + 100, "y": start_y}
            ]
            
            drawing.update({
                "type": "path",
                "points": points,
                "color": "#663399"
            })
            
        elif cmd_type == "PLUS":
            drawing.update({
                "type": "text",
                "x": base_x,
                "y": base_y,
                "text": "+",
                "fontSize": 24, # Match fraction size
                "fontFamily": "Arial",
                "color": "#000000"
            })
            
        elif cmd_type == "EQUALS":
            drawing.update({
                "type": "text",
                "x": base_x,
                "y": base_y,
                "text": "=",
                "fontSize": 24, # Match fraction size
                "fontFamily": "Arial",
                "color": "#000000"
            })
            
        # Add other operators like MINUS, TIMES, DIVIDE here if needed
            
        else:
            # Default to a simple text element if command type is unknown
            drawing.update({
                "type": "text",
                "x": base_x,
                "y": base_y,
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
        base_x = 100 # Start closer to top-left
        base_y = 100 # Start closer to top-left
        
        for i, command in enumerate(commands):
            # Adjust position for each new drawing - increased horizontal, decreased vertical spacing
            adjusted_x = base_x + (i % 3) * 180 # Wider horizontal spacing
            adjusted_y = base_y + (i // 3) * 100 # Smaller vertical spacing
            
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
                "scene": drawings
            },
            "audio": audio_path
        }
        
        return response


