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
    except Exception as e:
        return {"error": str(e)}