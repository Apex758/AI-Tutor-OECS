from fastapi import FastAPI, UploadFile, File, Form, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import shutil
from typing import Optional, Dict, Any, List
from pydantic import BaseModel
import json

# Import our backend modules
from backend.query_model import get_answer_from_text
from backend.speech import transcribe_audio, generate_tts_audio, TEMP_AUDIO_PATH, TTS_OUTPUT_DIR
from backend.rag_system import get_rag_system, Document, RAG_DOCS_DIR

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

# Ensure RAG_docs directory exists
os.makedirs(RAG_DOCS_DIR, exist_ok=True)

# Models for request/response
class TTSRequest(BaseModel):
    text: str

class TranscriptUpdateRequest(BaseModel):
    transcript: str
    
class DocumentInfo(BaseModel):
    id: str
    title: str
    original_file: str
    in_folder: bool
    in_faiss: bool
    last_modified: float

class ScanResponse(BaseModel):
    added: int
    updated: int
    total_docs: int
    total_in_faiss: int
    
class RemoveDocumentRequest(BaseModel):
    doc_id: str

class TextOnlyRequest(BaseModel):
    text: str

# Store conversation history
conversation_history = []



@app.post("/tutor/speak")
async def tutor_from_audio(file: UploadFile = File(...)):
    """
    Process audio from the user, transcribe it, generate a response, and return both text and audio.
    """
    try:
        print("Step 1: Received audio file:", file.filename)

        # Always save to the same temp file path to avoid accumulation
        with open(TEMP_AUDIO_PATH, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"Step 2: Saved uploaded audio to {TEMP_AUDIO_PATH}")

        # Transcribe the audio to text
        print("Step 3: Starting transcription...")
        text = transcribe_audio(TEMP_AUDIO_PATH)
        print("Step 4: Transcription result:", text)
        
        try:
            # Get a response based on the transcript by passing to query model
            print("Step 5: Sending transcription to OpenRouter API...")
            response = get_answer_from_text(text)
            print("Step 6: OpenRouter API response:", response)
            
            # Check if response is a string (error) or the new format
            if isinstance(response, str):
                # Handle legacy error response format
                answer = response
                audio_path = None
            else:
                # Handle new structured response format
                answer = response
                
                # Check if we have an explanation field in the answer
                if isinstance(answer, dict) and isinstance(answer.get('answer', {}), dict):
                    explanation = answer['answer'].get('explanation', '')
                    
                    # Check if explanation is a JSON string
                    try:
                        explanation_json = json.loads(explanation)
                        if isinstance(explanation_json, dict) and 'explanation' in explanation_json:
                            # Use the 'explanation' field from the JSON for TTS
                            tts_text = explanation_json['explanation']
                        else:
                            tts_text = explanation
                    except json.JSONDecodeError:
                        tts_text = explanation
                    
                    # Use the extracted text for TTS
                    audio_file = generate_tts_audio(tts_text)
                    
                    # Update the audio path in the response
                    answer['audio'] = f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
                else:
                    # Use the entire response for TTS (fallback for legacy format)
                    tts_text = str(answer)
                    audio_file = generate_tts_audio(tts_text)
                    audio_path = f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
                    
                    # If response was not structured, wrap it
                    if not isinstance(answer, dict):
                        answer = {
                            "question": text,
                            "answer": {
                                "explanation": answer,
                                "scene": [],
                                "final_answer": {
                                    "correct_value": "",
                                    "explanation": "",
                                    "feedback_correct": "Good job!",
                                    "feedback_incorrect": "Try again!"
                                }
                            },
                            "audio": audio_path
                        }
            
            # Update conversation history
            conversation_history.append({"role": "user", "content": text})
            
            # Extract explanation from structured response if available
            if isinstance(response, dict) and isinstance(response.get('answer', {}), dict):
                explanation = response['answer'].get('explanation', '')
                
                # Check if there's a final_answer field to include in the conversation history
                final_answer = response['answer'].get('final_answer', {})
                if final_answer:
                    explanation_with_answer = f"{explanation} [ANSWER_INFO: {json.dumps(final_answer)}]"
                    conversation_history.append({"role": "assistant", "content": explanation_with_answer})
                else:
                    conversation_history.append({"role": "assistant", "content": explanation})
            else:
                conversation_history.append({"role": "assistant", "content": str(response)})
            
            return answer
        
        except Exception as model_error:
            print("OpenRouter API Error:", model_error)
            error_response = {
                "error": f"The OpenRouter API encountered an error: {str(model_error)}",
                "question": text,
                "answer": {
                    "explanation": "I'm sorry, I had trouble processing your request. The OpenRouter API is currently experiencing issues. Please try again later.",
                    "scene": [],
                    "final_answer": {
                        "correct_value": "",
                        "explanation": "",
                        "feedback_correct": "",
                        "feedback_incorrect": ""
                    }
                }
            }

            print("Generating TTS for error message...")
            audio_file = generate_tts_audio(error_response["answer"]["explanation"])
            audio_path = f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
            error_response["audio"] = audio_path
            print("Error TTS audio at", audio_path)

            return error_response
            
    except Exception as e:
        print("Audio Processing Error:", e)
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



# Modified tutor/text endpoint to ensure proper JSON handling
@app.post("/tutor/text")
async def tutor_from_text(request: TextOnlyRequest):
    """
    Process text input from the user, generate a response, and return both text and audio.
    """
    try:
        print("Received text input:", request.text)
        
        try:
            # Get a response based on the text by passing to query model
            print("Sending text to OpenRouter API...")
            response = get_answer_from_text(request.text)
            print("OpenRouter API response:", response)
            
            # Check if response is a string (error) or the structured format
            if isinstance(response, str):
                # Handle legacy error response format
                answer = response
                audio_path = None
            else:
                # Handle structured response format
                answer = response
                
                # Check if we have an explanation field in the answer
                if isinstance(answer, dict) and isinstance(answer.get('answer', {}), dict):
                    explanation = answer['answer'].get('explanation', '')
                    
                    # Process explanation - if it's JSON, extract the explanation text
                    try:
                        if explanation.startswith('{') and explanation.endswith('}'):
                            explanation_json = json.loads(explanation)
                            if isinstance(explanation_json, dict) and 'explanation' in explanation_json:
                                # Use the 'explanation' field from the JSON for TTS
                                tts_text = explanation_json['explanation']
                            else:
                                tts_text = explanation
                        else:
                            tts_text = explanation
                    except (json.JSONDecodeError, AttributeError):
                        tts_text = explanation
                    
                    # Use the extracted text for TTS
                    audio_file = generate_tts_audio(tts_text)
                    
                    # Update the audio path in the response
                    answer['audio'] = f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
                else:
                    # Use the entire response for TTS (fallback for legacy format)
                    tts_text = str(answer)
                    audio_file = generate_tts_audio(tts_text)
                    audio_path = f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
                    
                    # If response was not structured, wrap it
                    if not isinstance(answer, dict):
                        answer = {
                            "question": request.text,
                            "answer": {
                                "explanation": answer,
                                "scene": [],
                                "final_answer": {
                                    "correct_value": "",
                                    "explanation": "",
                                    "feedback_correct": "Good job!",
                                    "feedback_incorrect": "Try again!"
                                }
                            },
                            "audio": audio_path
                        }
            
            # Update conversation history - store only the clean explanation text
            conversation_history.append({"role": "user", "content": request.text})
            
            # Extract explanation from structured response if available
            if isinstance(response, dict) and isinstance(response.get('answer', {}), dict):
                explanation = response['answer'].get('explanation', '')
                
                # Remove any JSON formatting if present
                if isinstance(explanation, str) and explanation.startswith('{') and explanation.endswith('}'):
                    try:
                        explanation_json = json.loads(explanation)
                        if isinstance(explanation_json, dict) and 'explanation' in explanation_json:
                            explanation = explanation_json['explanation']
                    except json.JSONDecodeError:
                        pass
                
                # Check if there's a final_answer field to include in the conversation history
                final_answer = response['answer'].get('final_answer', {})
                if final_answer:
                    explanation_with_answer = f"{explanation} [ANSWER_INFO: {json.dumps(final_answer)}]"
                    conversation_history.append({"role": "assistant", "content": explanation_with_answer})
                else:
                    conversation_history.append({"role": "assistant", "content": explanation})
            else:
                conversation_history.append({"role": "assistant", "content": str(response)})
            
            # Make sure we're returning the fully structured response
            if isinstance(answer, dict):
                # Ensure the answer has the required structure
                if 'answer' not in answer:
                    answer = {
                        "question": request.text,
                        "answer": {
                            "explanation": str(answer),
                            "scene": [],
                            "final_answer": {
                                "correct_value": "",
                                "explanation": "",
                                "feedback_correct": "Good job!",
                                "feedback_incorrect": "Try again!"
                            }
                        }
                    }
                elif isinstance(answer['answer'], dict) and 'final_answer' not in answer['answer']:
                    # Add a default final_answer if missing
                    answer['answer']['final_answer'] = {
                        "correct_value": "",
                        "explanation": "",
                        "feedback_correct": "Good job!",
                        "feedback_incorrect": "Try again!"
                    }
                
                # Make sure there's an audio field
                if 'audio' not in answer:
                    # Generate TTS for the explanation
                    explanation = ""
                    if isinstance(answer['answer'], dict):
                        explanation = answer['answer'].get('explanation', '')
                    else:
                        explanation = str(answer['answer'])
                    
                    audio_file = generate_tts_audio(explanation)
                    answer['audio'] = f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
            
            print("Final structured response ready")
            return answer
        
        except Exception as model_error:
            print("OpenRouter API Error:", model_error)
            error_response = {
                "error": f"The OpenRouter API encountered an error: {str(model_error)}",
                "question": request.text,
                "answer": {
                    "explanation": "I'm sorry, I had trouble processing your request. The OpenRouter API is currently experiencing issues. Please try again later.",
                    "scene": [],
                    "final_answer": {
                        "correct_value": "",
                        "explanation": "",
                        "feedback_correct": "",
                        "feedback_incorrect": ""
                    }
                }
            }

            print("Generating TTS for error message...")
            audio_file = generate_tts_audio(error_response["answer"]["explanation"])
            audio_path = f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
            error_response["audio"] = audio_path
            print("Error TTS audio at", audio_path)

            return error_response

    except Exception as e:
        print("Text Processing Error:", e)
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

from backend.query_model import get_answer_from_image_and_prompt

@app.post("/process_whiteboard_image")
async def process_whiteboard_image(
    request: Request
):
    """
    Process the whiteboard image sent directly in the request body along with a prompt in the header.
    """
    try:
        # Get the prompt from the header
        prompt = request.headers.get('x-prompt', '')
        if not prompt:
            return {"error": "Missing X-Prompt header"}
        
        # Read the image data from the request body
        image_data = await request.body()
        
        # Get a response based on the image and prompt
        response = get_answer_from_image_and_prompt(image_data, prompt)
        
        # Generate TTS for the response
        audio_file = generate_tts_audio(response)
        audio_path = f"/tts_output/{audio_file}?t={os.path.getmtime(os.path.join(TTS_OUTPUT_DIR, audio_file))}"
        
        return {
            "response": response,
            "audio": audio_path
        }
    except Exception as e:
        return {"error": str(e)}

# =============== New RAG System Endpoints ===============

@app.get("/rag/documents", response_model=List[DocumentInfo])
async def get_documents():
    """
    Get the list of all documents in the RAG system.
    """
    try:
        rag_system = get_rag_system()
        return rag_system.get_document_list()
    except Exception as e:
        print(f"Error getting document list: {e}")
        return {"error": str(e)}

@app.post("/rag/scan", response_model=ScanResponse)
async def scan_documents():
    """
    Scan the RAG_docs folder for new or updated documents.
    """
    try:
        rag_system = get_rag_system()
        result = rag_system.scan_rag_docs_folder()
        return result
    except Exception as e:
        print(f"Error scanning RAG_docs folder: {e}")
        return {"error": str(e)}

@app.post("/rag/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a document to the RAG_docs folder.
    """
    try:
        # Save the file to the RAG_docs directory
        file_path = os.path.join(RAG_DOCS_DIR, file.filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Scan the folder to process the new file
        rag_system = get_rag_system()
        result = rag_system.scan_rag_docs_folder()
        
        return {
            "message": f"File uploaded successfully: {file.filename}",
            "scan_result": result
        }
    except Exception as e:
        print(f"Error uploading document: {e}")
        return {"error": str(e)}

@app.post("/rag/remove")
async def remove_document(request: RemoveDocumentRequest):
    """
    Remove a document from the RAG system (but not from the folder).
    """
    try:
        rag_system = get_rag_system()
        success = rag_system.remove_document(request.doc_id)
        
        if success:
            return {"message": f"Document removed successfully: {request.doc_id}"}
        else:
            return {"error": f"Failed to remove document: {request.doc_id}"}
    except Exception as e:
        print(f"Error removing document: {e}")
        return {"error": str(e)}

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
    
    # Set the OpenRouter API key
    os.environ["OPENROUTER_API_KEY"] = "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"
    print("OpenRouter API key set")
    
    # Scan RAG_docs folder on startup
    try:
        rag_system = get_rag_system()
        result = rag_system.scan_rag_docs_folder()
        print("RAG_docs scan result:", result)
    except Exception as e:
        print(f"Error scanning RAG_docs on startup: {e}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)