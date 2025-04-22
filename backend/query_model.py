from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
from langchain_community.llms import HuggingFacePipeline
import torch
import os
from huggingface_hub import hf_hub_download, login
from llama_cpp import Llama

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

prompt_template = """<|begin_of_text|><|system|>
You are a helpful tutor for primary school students.
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
        formatted_prompt = prompt_template.format(query=str(text))
        print(f"Formatted prompt type: {type(formatted_prompt)}")
        print(f"LLM type: {type(llm)}")
        
        # Check if we're using llama-cpp or transformers
        if hasattr(llm, '__call__') and not hasattr(llm, 'invoke'):
            # This is a direct Llama model (llama-cpp)
            response = llm(
                formatted_prompt,
                max_tokens=512,
                temperature=0.7,
                top_p=0.9,
                repeat_penalty=1.2,
                echo=False
            )
            print("Direct Llama model response received")
            return response["choices"][0]["text"]
        else:
            # This is a transformers pipeline
            response = llm(
                formatted_prompt,
                max_new_tokens=512,
                temperature=0.7,
                top_p=0.9,
                repetition_penalty=1.2,
                do_sample=True
            )
            print("Transformers pipeline response received")
            return response[0]["generated_text"]
    except Exception as e:
        print(f"Error in get_answer_from_text: {e}")
        print(f"Text: {text} ({type(text)})")
        print(f"Formatted prompt: {formatted_prompt} ({type(formatted_prompt)})")
        raise

def main():
    os.environ["HF_TOKEN"] = "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"
    print("Initializing Llama-3.2-1B model...")
    global llm
    llm = setup_llamacpp_pipeline()
    
if __name__ == "__main__":
    main()