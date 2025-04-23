from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
from langchain_community.llms import HuggingFacePipeline
import torch
import os
from huggingface_hub import hf_hub_download, login
from llama_cpp import Llama
from backend.rag_system import get_rag_system, format_retrieved_context
import requests
import json
import time
# from backend.drawing_generator import DrawingGenerator # No longer needed for generation

# Global variable to hold the LLM
global llm


def setup_llamacpp_pipeline():
    global llm
    # Login to Hugging Face
    hf_token = os.environ.get("HF_TOKEN")
    login(token=hf_token)
    
    repo_id = "bartowski/Llama-3.2-1B-Instruct-GGUF"
    filename = "Llama-3.2-1B-Instruct-IQ3_M.gguf"
    
    try:
        # Pass token to download
        model_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            repo_type="model",
            token=hf_token
        )
        
        # Debug print model path type
        print(f"Model path type: {type(model_path)}")
        
        # Create direct Llama model without LangChain for complete control
        # We'll handle the LangChain conversion differently
        try:
            llm_core = Llama(
                model_path=str(model_path),  # Ensure string path
                n_ctx=int(2048),
                n_batch=int(512),
                n_threads=int(8),
                n_gpu_layers=int(0),
                verbose=True
            )
            print("Llama model initialized successfully")
            return llm_core  # Return the direct Llama model
        except Exception as e:
            print(f"Error initializing Llama model: {e}")
            print(f"Parameters types:")
            print(f"- model_path: {type(model_path)}")
            print(f"- n_ctx: {type(2048)}")
            print(f"- n_batch: {type(512)}")
            print(f"- n_threads: {type(8)}")
            print(f"- n_gpu_layers: {type(0)}")
            raise
        
    except Exception as e:
        print(f"Error loading GGUF model: {e}")
        print("Falling back to transformers implementation...")
        return setup_transformers_cpu_pipeline()

def setup_transformers_cpu_pipeline():
    global llm
    model_name = "meta-llama/Llama-3.2-1B"
    print("Using CPU-optimized transformers implementation")
    
    hf_token = os.environ.get("HF_TOKEN")
    login(token=hf_token)
    
    tokenizer = AutoTokenizer.from_pretrained(
        model_name, 
        token=hf_token
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float16,
        load_in_4bit=True,
        low_cpu_mem_usage=True,
        device_map="cpu",
        token=hf_token
    )
    
    pipe = pipeline(
        "text-generation",
        model=model,
        tokenizer=tokenizer,
        max_new_tokens=int(512),
        temperature=float(0.7),
        top_p=float(0.9),
        repetition_penalty=float(1.2),
        do_sample=True
    )
    
    # Return the pipeline directly
    return pipe


# New OpenRouter query function
def setup_openrouter_client():
    """
    Initializes the OpenRouter client configuration.
    No actual model initialization needed since we're using the API.
    """
    print("Setting up OpenRouter client")
    # Just return a placeholder since we don't need an actual model object
    return "openrouter_client"

def get_rag_enhanced_prompt(query, prompt_template):
    """
    Enhance the prompt with relevant context from the RAG system.
    
    Args:
        query: The user's query
        prompt_template: The base prompt template
        
    Returns:
        Enhanced prompt with retrieved context
    """
    # Get the RAG system
    rag_system = get_rag_system()
    
    # Retrieve relevant documents
    retrieved_docs = rag_system.retrieve(query, top_k=3)
    
    # Format the retrieved context
    context = format_retrieved_context(retrieved_docs, query)
    
    # If we have relevant context, add it to the prompt
    if context:
        # For OpenRouter, we're just returning the context and query
        # as we'll format it differently in the API call
        return {
            "context": context,
            "query": query
        }
        
    # If no context, just return the query itself
    return {
        "context": "",
        "query": query
    }

# Base prompt template (we'll use this differently with OpenRouter)
prompt_template = """<|begin_of_text|><|system|>
Ensure responses are children friendly.
<|user|>
{query}
<|assistant|>
"""


def get_answer_from_text(text):
    global llm
    # Ensure llm is initialized
    if 'llm' not in globals() or llm is None:
        main()  # Initialize llm if not already done
    
    try:
        print(f"Input text type: {type(text)}")
        
        # Get enhanced prompt with RAG context if available
        enhanced_prompt = get_rag_enhanced_prompt(str(text), prompt_template)
        
        # Define the system message with the NEW JSON schema instructions
        system_message = """
        You are a helpful tutor for primary school students. Keep responses short and engaging.
        
        When your response requires a visual representation (like explaining math with objects),
        you MUST output a JSON object containing BOTH the spoken explanation AND a scene description.
        
        The JSON object MUST follow this exact schema:
        {
          "explanation": "The text to be spoken aloud by the TTS engine.",
          "scene": [
            {
              "type": "object_type",  // e.g., "apple", "chocolate", "pencil", "number"
              "x": number,           // x-coordinate (integer)
              "y": number,           // y-coordinate (integer)
              "count": number,         // (Optional) How many of this object to draw side-by-side
              "value": string | number // (Optional) e.g., for "number" type, the actual number like 5 or "5"
            },
            {
              "type": "operator",
              "x": number,
              "y": number,
              "symbol": "+" | "-" | "=" | "*" | "/" // The operator symbol as a string
            }
            // ... more items in the scene array
          ]
        }
        
        RULES:
        - ALWAYS respond with a valid JSON object matching the schema.
        - The `explanation` field should contain the complete text to be spoken.
        - The `scene` field should be an array describing the visual elements.
        - Allowed `type` values for objects currently include: "apple", "chocolate", "pencil", "number". More may be added later. Use "number" for digits.
        - Allowed `symbol` values for operators are: "+", "-", "=", "*", "/".
        - Provide reasonable integer values for `x` and `y` coordinates (e.g., between 50 and 500).
        - Use the `count` property if multiple identical items should be drawn (e.g., 3 apples).
        - Use the `value` property for the "number" type.
        - If no drawing is needed, return JSON with an empty `scene` array: {"explanation": "Your text here", "scene": []}.
        - Do NOT include any text outside the JSON object. Your entire response must be the JSON itself.
        """
        
        # Prepare the user message with context if available
        user_content = text
        if enhanced_prompt.get("context"):
            user_content = f"{enhanced_prompt['context']}\n\nBased on the above information (if relevant), please answer the following question:\n{enhanced_prompt['query']}"
        
        # Make the API call to OpenRouter
        api_key = os.environ.get("OPENROUTER_API_KEY", "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")
        
        print(f"Making OpenRouter API call for: {user_content[:100]}...")
        
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:8000",  # Placeholder
                "X-Title": "AI Tutor App",  # Placeholder name
                "Content-Type": "application/json",
            },
            data=json.dumps({
                "model": "meta-llama/llama-4-maverick:free",  # Using the specified model
                "messages": [
                    {
                        "role": "system",
                        "content": system_message
                    },
                    {
                        "role": "user",
                        "content": user_content
                    }
                ]
            })
        )
        
        response_data = response.json()
        print("OpenRouter response received")
        
        if response.status_code == 200 and "choices" in response_data and len(response_data["choices"]) > 0:
            llm_response_content = response_data["choices"][0]["message"]["content"]
            
            # Attempt to parse the LLM response as JSON
            try:
                parsed_json = json.loads(llm_response_content)
                
                # Validate the structure
                if isinstance(parsed_json, dict) and \
                   "explanation" in parsed_json and isinstance(parsed_json["explanation"], str) and \
                   "scene" in parsed_json and isinstance(parsed_json["scene"], list):
                    
                    explanation_text = parsed_json["explanation"]
                    scene_data = parsed_json["scene"]
                    
                    # Construct the result in the new format
                    result = {
                        "question": text, # Original user query
                        "answer": {
                            "explanation": explanation_text, # Text for TTS
                            "scene": scene_data # Scene description for frontend
                        }
                        # Audio path will be added in main.py after TTS generation
                    }
                    print(f"Successfully parsed LLM response. Explanation: '{explanation_text[:50]}...', Scene items: {len(scene_data)}")
                    return result
                else:
                    print("Error: LLM response is valid JSON but does not match the expected schema.")
                    print(f"Received JSON: {llm_response_content}")
                    return f"I'm sorry, I received an unexpected response format from the AI model."
                    
            except json.JSONDecodeError:
                print("Error: LLM response was not valid JSON.")
                print(f"Received content: {llm_response_content}")
                # Fallback: return the raw content as explanation, assuming no scene
                result = {
                    "question": text,
                    "answer": {
                        "explanation": llm_response_content, # Use raw response as explanation
                        "scene": [] # Empty scene
                    }
                }
                return result
        else:
            error_message = response_data.get("error", {}).get("message", "Unknown API error")
            print(f"OpenRouter API error: {error_message}")
            return f"I'm sorry, I couldn't process your request. Error: {error_message}"
            
    except Exception as e:
        print(f"Error in get_answer_from_text: {e}")
        print(f"Text: {text} ({type(text)})")
        return f"I'm sorry, an error occurred: {str(e)}"


def main():
    # Set the OpenRouter API key in environment variables
    os.environ["OPENROUTER_API_KEY"] = "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"
    print("Initializing OpenRouter client...")
    global llm
    llm = setup_openrouter_client()
    
if __name__ == "__main__":
    main()