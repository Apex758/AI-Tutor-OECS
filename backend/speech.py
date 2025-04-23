from TTS.api import TTS
import whisper
import os
import sys
import shutil
import re
import json

TTS_OUTPUT_FILENAME = "current_response.wav"
TTS_OUTPUT_DIR = "tts_output"
TTS_OUTPUT_PATH = os.path.join(TTS_OUTPUT_DIR, TTS_OUTPUT_FILENAME)

# Initialize Coqui TTS model
tts_model = TTS(model_name="tts_models/en/ljspeech/glow-tts", progress_bar=False, gpu=False)

def generate_tts_audio(text: str) -> str:
    os.makedirs(TTS_OUTPUT_DIR, exist_ok=True)
    
    # Remove existing audio file
    if os.path.exists(TTS_OUTPUT_PATH):
        try:
            os.remove(TTS_OUTPUT_PATH)
        except Exception as e:
            print(f"Warning: Could not remove old audio file: {e}")
    
    cleaned_text = text
    try:
        if text.startswith('{') and text.endswith('}') and '"explanation"' in text:
            json_data = json.loads(text)
            if 'explanation' in json_data and isinstance(json_data['explanation'], str):
                cleaned_text = json_data['explanation']
                print(f"Extracted explanation for TTS: {cleaned_text[:100]}...")
            
            if 'scene' in json_data and isinstance(json_data['scene'], list):
                scene_description = " The scene includes: " + ', '.join([f"{item.get('type', 'unknown')} at position ({item.get('x', 'unknown')}, {item.get('y', 'unknown')})" for item in json_data['scene']])
                cleaned_text += scene_description
                print(f"Added scene description for TTS: {scene_description[:100]}...")
            
            if 'final_answer' in json_data and isinstance(json_data['final_answer'], dict):
                final_answer = json_data['final_answer']
                final_answer_text = f" The correct answer is {final_answer.get('correct_value', 'unknown')}. {final_answer.get('explanation', '')}"
                cleaned_text += final_answer_text
                print(f"Added final answer for TTS: {final_answer_text[:100]}...")
        
        elif '```json' in text:
            json_start = text.find('```json') + 7
            json_end = text.rfind('```')
            if json_start > 0 and json_end > json_start:
                json_str = text[json_start:json_end].strip()
                json_data = json.loads(json_str)
                if 'explanation' in json_data and isinstance(json_data['explanation'], str):
                    cleaned_text = json_data['explanation']
                    print(f"Extracted explanation from JSON block for TTS: {cleaned_text[:100]}...")
    except Exception as e:
        print(f"Error parsing JSON for TTS: {e}")
    
    cleaned_text = cleaned_text.replace('\\', '').replace('```json', '').replace('```', '').strip()
    cleaned_text = re.sub(r'\[DRAW:.*?\]', '', cleaned_text).strip()
    cleaned_text = cleaned_text.replace('+', ' plus ').replace('=', ' equals ')
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    cleaned_text = re.sub(r'[^a-zA-Z0-9\s.,!?-]', '', cleaned_text).strip()
    
    print(f"Cleaned text for TTS: {cleaned_text}")
    
    try:
        tts_model.tts_to_file(text=cleaned_text, file_path=TTS_OUTPUT_PATH)
    except UnicodeEncodeError:
        safe_text = cleaned_text.encode('utf-8', errors='replace').decode('utf-8')
        tts_model.tts_to_file(text=safe_text, file_path=TTS_OUTPUT_PATH)
    
    return TTS_OUTPUT_FILENAME

# Load Whisper STT model
stt_model = whisper.load_model("base")

TEMP_AUDIO_PATH = "temp_audio.wav"

def transcribe_audio(file_path: str) -> str:
    # Standardize audio file location
    if file_path != TEMP_AUDIO_PATH:
        shutil.copy(file_path, TEMP_AUDIO_PATH)
    
    result = stt_model.transcribe(TEMP_AUDIO_PATH)
    transcription_text = result.get("text", "")
    
    # Clean up temporary file
    if file_path != TEMP_AUDIO_PATH and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"Warning: Could not remove temp audio file: {e}")
    
    try:
        print(f"Transcription result: {transcription_text}")
    except UnicodeEncodeError:
        safe_text = transcription_text.encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding)
        print(f"Transcription result (safe print): {safe_text}")
        
    return transcription_text