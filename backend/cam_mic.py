import cv2
import sounddevice as sd
import scipy.io.wavfile as wav
import threading
import backend.speech_processing as speech_processing
import requests
import time

# SETTINGS
AUDIO_FILENAME = "temp_speech.wav"
duration = 10  # seconds
fps = 20
audio_rate = 44100
audio_channels = 1

# -------- AUDIO RECORD FUNCTION --------
def record_audio(audio_buffer):
    print("Recording audio...")
    audio = sd.rec(int(duration * audio_rate), samplerate=audio_rate, channels=audio_channels, dtype='int16')
    sd.wait()
    audio_buffer.append(audio)
    wav.write(AUDIO_FILENAME, audio_rate, audio)
    print("Audio recorded.")
    try:
        with open(AUDIO_FILENAME, "rb") as audio_file:
            response = requests.post("http://localhost:8000/run_speech", data=audio_file)
            response.raise_for_status()  # Raise HTTPError for bad responses (4xx or 5xx)
            transcript = response.json()["transcript"]
            print("Transcribed text:", transcript)
    except Exception as e:
        print(f"Error during transcription: {e}")

# -------- CAMERA FRAME VIEW (NO SAVE) --------
def camera_view_only():
    print("Opening camera...")
    cap = cv2.VideoCapture(0)
    start_time = time.time()

    while time.time() - start_time < duration:
        ret, frame = cap.read()
        if not ret:
            break

        # Optional: process frame here (face detection, etc.)
        cv2.imshow("Live Camera", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("Camera closed.")

def start_camera():
    cam_thread = threading.Thread(target=camera_view_only)
    cam_thread.start()
    return cam_thread

def start_microphone():
    audio_data = []
    mic_thread = threading.Thread(target=record_audio, args=(audio_data,))
    mic_thread.start()
    return mic_thread, audio_data