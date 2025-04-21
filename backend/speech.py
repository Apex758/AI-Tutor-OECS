from TTS.api import TTS
import whisper
import os

# Coqui TTS (CPU)
tts_model = TTS(model_name="tts_models/en/ljspeech/tacotron2-DDC", progress_bar=False, gpu=False)

def generate_tts_audio(text: str) -> str:
    filename = "temp_audio.wav"
    path = os.path.join("tts_output", filename)
    os.makedirs("tts_output", exist_ok=True)
    tts_model.tts_to_file(text=text, file_path=path)
    return filename

# Whisper STT (CPU)
stt_model = whisper.load_model("base")

def transcribe_audio(file_path: str) -> str:
    result = stt_model.transcribe(file_path)
    return result.get("text", "")
