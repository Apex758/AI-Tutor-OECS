from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import uuid
import os
import shutil
from backend.query_model import get_answer_from_text
from backend.speech import transcribe_audio, generate_tts_audio

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/tutor/speak")
def tutor_from_audio(file: UploadFile = File(...)):
    temp_path = f"temp_{uuid.uuid4()}.wav"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    text = transcribe_audio(temp_path)
    os.remove(temp_path)

    answer = get_answer_from_text(text)
    audio_file = generate_tts_audio(answer)
    return {
        "question": text,
        "answer": answer,
        "audio": f"/tts_output/{audio_file}"
    }
