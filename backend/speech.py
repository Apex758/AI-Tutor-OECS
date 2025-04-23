from TTS.api import TTS
import whisper
import os
import sys
import shutil
import re # Import the regex module

# Fixed filename for TTS output to avoid accumulating files
TTS_OUTPUT_FILENAME = "current_response.wav"
TTS_OUTPUT_DIR = "tts_output"
TTS_OUTPUT_PATH = os.path.join(TTS_OUTPUT_DIR, TTS_OUTPUT_FILENAME)

# Coqui TTS (CPU)
tts_model = TTS(model_name="tts_models/en/ljspeech/glow-tts", progress_bar=False, gpu=False)

def generate_tts_audio(text: str) -> str:
    os.makedirs(TTS_OUTPUT_DIR, exist_ok=True)
    
    # Remove old file if it exists
    if os.path.exists(TTS_OUTPUT_PATH):
        try:
            os.remove(TTS_OUTPUT_PATH)
        except Exception as e:
            print(f"Warning: Could not remove old audio file: {e}")
    
    # First remove any JSON formatting and backslashes
    cleaned_text = text.replace('\\', '').replace('```json', '').replace('```', '').strip()
    
    # Then remove [DRAW:...] tags
    cleaned_text = re.sub(r'\[DRAW:.*?\]', '', cleaned_text).strip()
    
    # Replace common symbols with words for TTS
    cleaned_text = cleaned_text.replace('+', ' plus ')
    cleaned_text = cleaned_text.replace('=', ' equals ')
    # Add more replacements if needed (e.g., '-', '*', '/')
    
    # Collapse multiple spaces into one
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    
    # Remove any remaining special characters that might cause issues
    cleaned_text = re.sub(r'[^a-zA-Z0-9\s.,!?-]', '', cleaned_text).strip()
    
    print(f"Final cleaned text for TTS: {cleaned_text}") # Optional: for debugging
    
    # Generate new audio using final cleaned text
    try:
        tts_model.tts_to_file(text=cleaned_text, file_path=TTS_OUTPUT_PATH)
    except UnicodeEncodeError:
        safe_text = cleaned_text.encode('utf-8', errors='replace').decode('utf-8')
        tts_model.tts_to_file(text=safe_text, file_path=TTS_OUTPUT_PATH)
    
    return TTS_OUTPUT_FILENAME

# Whisper STT (CPU)
stt_model = whisper.load_model("base")

# Fixed filename for temporary audio uploads
TEMP_AUDIO_PATH = "temp_audio.wav"

def transcribe_audio(file_path: str) -> str:
    # Copy the file to a standardized location to avoid accumulating temp files
    if file_path != TEMP_AUDIO_PATH:
        shutil.copy(file_path, TEMP_AUDIO_PATH)
    
    result = stt_model.transcribe(TEMP_AUDIO_PATH)
    
    transcription_text = result.get("text", "")
    
    # Clean up if not using the standard temp path
    if file_path != TEMP_AUDIO_PATH and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Warning: Could not remove temp audio file: {e}")
    
    # Print transcription text with proper encoding handling
    try:
        print(f"Transcription result: {transcription_text}")
    except UnicodeEncodeError:
        safe_text = transcription_text.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding)
        print(f"Transcription result (safe print): {safe_text}")
        
    return transcription_text