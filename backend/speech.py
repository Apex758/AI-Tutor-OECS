from TTS.api import TTS
import whisper
import os
import shutil

# Fixed filename for TTS output to avoid accumulating files
TTS_OUTPUT_FILENAME = "current_response.wav"
TTS_OUTPUT_DIR = "tts_output"
TTS_OUTPUT_PATH = os.path.join(TTS_OUTPUT_DIR, TTS_OUTPUT_FILENAME)

# Coqui TTS (CPU)
tts_model = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False, gpu=False)

def generate_tts_audio(text: str) -> str:
    """
    Generate speech from text.
    Always uses the same filename to avoid accumulating files.
    """
    os.makedirs(TTS_OUTPUT_DIR, exist_ok=True)
    
    # Remove old file if it exists
    if os.path.exists(TTS_OUTPUT_PATH):
        try:
            os.remove(TTS_OUTPUT_PATH)
        except Exception as e:
            print(f"Warning: Could not remove old audio file: {e}")
    
    # Generate new audio
    tts_model.tts_to_file(text=text, file_path=TTS_OUTPUT_PATH)
    
    return TTS_OUTPUT_FILENAME

# Whisper STT (CPU)
stt_model = whisper.load_model("base")

# Fixed filename for temporary audio uploads
TEMP_AUDIO_PATH = "temp_audio.wav"

def transcribe_audio(file_path: str) -> str:
    """
    Transcribe audio to text.
    """
    # Copy the file to a standardized location to avoid accumulating temp files
    if file_path != TEMP_AUDIO_PATH:
        shutil.copy(file_path, TEMP_AUDIO_PATH)
    
    result = stt_model.transcribe(TEMP_AUDIO_PATH)
    
    # Clean up if not using the standard temp path
    if file_path != TEMP_AUDIO_PATH and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Warning: Could not remove temp audio file: {e}")
            
    return result.get("text", "")