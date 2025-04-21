from fastapi import FastAPI, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import shutil
from typing import Optional, Dict, Any
from pydantic import BaseModel
import json

# Import our backend modules
from backend.query_model import get_answer_from_text
from backend.speech import transcribe_audio, generate_tts_audio, TEMP_AUDIO_PATH, TTS_OUTPUT_DIR

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the TTS output directory to serve audio files
os.makedirs(TTS_OUTPUT_DIR, exist_ok=True)
app.mount("/tts_output", StaticFiles(directory=TTS_OUTPUT_DIR), name="tts_output")

# Create a directory for whiteboard images
WHITEBOARD_DIR = "whiteboard_images"
os.makedirs(WHITEBOARD_DIR, exist_ok=True)

# Models for request/response
class TTSRequest(BaseModel):
    text: str

class TranscriptUpdateRequest(BaseModel):
    transcript: str

# Store conversation history
conversation_history = []

# These are the updated route handlers for the main.py file

@app.post("/tutor/speak")
async def tutor_from_audio(file: UploadFile = File(...)):
    """
    Process audio from the user, transcribe it, generate a response, and return both text and audio.
    """
    try:
        # Always save to the same temp file path to avoid accumulation
        with open(TEMP_AUDIO_PATH, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Transcribe the audio to text
        text = transcribe_audio(TEMP_AUDIO_PATH)
        
        try:
            # Get a response based on the transcript by passing to query model
            answer = get_answer_from_text(text)
            
            # Update conversation history
            conversation_history.append({"role": "user", "content": text})
            conversation_history.append({"role": "assistant", "content": answer})
            
            # Generate audio for the response (this function handles reusing the same filename)
            audio_file = generate_tts_audio(answer)
            
            return {
                "question": text,
                "answer": answer,
                "audio": f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
            }
        except Exception as model_error:
            print(f"Error with language model: {model_error}")
            # Return a graceful error response with appropriate status code
            error_response = {
                "error": f"The AI model encountered an error: {str(model_error)}",
                "question": text,
                "answer": "I'm sorry, I had trouble processing your request. The AI model is currently experiencing issues. Please try again later."
            }
            
            # Generate audio for the error message
            audio_file = generate_tts_audio(error_response["answer"])
            error_response["audio"] = f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
            
            return error_response
            
    except Exception as e:
        print(f"Error in audio processing: {e}")
        return {"error": str(e)}      
        
        
@app.post("/tts")
async def text_to_speech(request: TTSRequest):
    """
    Generate speech from text.
    """
    try:
        audio_file = generate_tts_audio(request.text)
        return {
            "message": "Speech generated successfully",
            "audio": f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/update_transcript")
async def update_transcript(request: TranscriptUpdateRequest):
    """
    Update the transcript with new text.
    """
    # Add to conversation history
    conversation_history.append({"role": "user", "content": request.transcript})
    
    # Generate a response (optional)
    response = get_answer_from_text(request.transcript)
    conversation_history.append({"role": "assistant", "content": response})
    
    return {
        "status": "success",
        "response": response
    }

@app.get("/greeting")
async def get_greeting():
    """
    Get a greeting to start the conversation.
    """
    greeting = "Hello! I'm your AI tutor. How can I help you today?"
    
    # Generate TTS for the greeting
    audio_file = generate_tts_audio(greeting)
    
    return {
        "greeting": greeting,
        "audio": f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
    }

@app.post("/process_whiteboard_image")
async def process_whiteboard_image(file: UploadFile = File(...)):
    """
    Process an uploaded whiteboard image, potentially recognizing content.
    """
    # Use a fixed filename for the whiteboard image to avoid accumulation
    image_path = f"{WHITEBOARD_DIR}/current_whiteboard.png"
    
    # Remove the old file if it exists
    if os.path.exists(image_path):
        try:
            os.remove(image_path)
        except Exception as e:
            print(f"Warning: Could not remove old whiteboard image: {e}")
    
    # Save the new image
    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Here you would add image processing logic
    # For now, just return a placeholder response
    
    return {
        "message": "Whiteboard image processed successfully",
        "detected_text": "This is a placeholder for detected text from the whiteboard image.",
        "saved_path": image_path
    }

# Cleanup endpoint to manually clean temporary files if needed
@app.post("/cleanup")
async def cleanup_temp_files():
    """
    Clean up temporary files.
    """
    files_cleaned = []
    
    # Clean up temp audio file
    if os.path.exists(TEMP_AUDIO_PATH):
        try:
            os.remove(TEMP_AUDIO_PATH)
            files_cleaned.append(TEMP_AUDIO_PATH)
        except Exception as e:
            pass
    
    return {
        "message": "Cleanup completed",
        "files_cleaned": files_cleaned
    }

if __name__ == "__main__":
    import uvicorn
    
    # Ensure clean state on startup
    for path in [TEMP_AUDIO_PATH]:
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception as e:
                print(f"Warning: Could not remove temp file at startup: {e}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)