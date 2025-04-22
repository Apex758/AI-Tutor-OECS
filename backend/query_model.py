from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
from langchain_community.llms import HuggingFacePipeline
from langchain.prompts import PromptTemplate
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
        
        try:
            llm = Llama(
                model_path=str(model_path),  # Ensure string path
                n_ctx=int(2048),
                n_batch=int(512),
                n_threads=int(8),
                n_gpu_layers=int(0),
                verbose=True
            )
            print("Llama model initialized successfully")
        except Exception as e:
            print(f"Error initializing Llama model: {e}")
            print(f"Parameters types:")
            print(f"- model_path: {type(model_path)}")
            print(f"- n_ctx: {type(2048)}")
            print(f"- n_batch: {type(512)}")
            print(f"- n_threads: {type(8)}")
            print(f"- n_gpu_layers: {type(0)}")
            raise
        
        class CustomPipeline:
            def __init__(self, llm_model):
                self.llm = llm_model
                self.task = "text-generation"  # Required by HuggingFacePipeline
            
            def __call__(self, prompt, max_tokens=512, temperature=0.7, top_p=0.9):
                print(f"CustomPipeline call - Prompt type: {type(prompt)}")
                print(f"Parameters: max_tokens={max_tokens} ({type(max_tokens)}), temperature={temperature} ({type(temperature)})")
                try:
                    # Handle both string and list inputs
                    if isinstance(prompt, list):
                        prompt = " ".join(str(p) for p in prompt)
                    
                    response = self.llm(
                        str(prompt),  # Ensure string prompt
                        max_tokens=int(max_tokens),
                        temperature=float(temperature),
                        top_p=float(top_p),
                        repeat_penalty=float(1.2),
                        echo=False
                    )
                    print("LLM call successful")
                    return response["choices"][0]["text"]
                except Exception as e:
                    print(f"Error in CustomPipeline call: {e}")
                    print(f"Full parameters:")
                    print(f"- prompt: {prompt} ({type(prompt)})")
                    print(f"- max_tokens: {max_tokens} ({type(max_tokens)})")
                    print(f"- temperature: {temperature} ({type(temperature)})")
                    print(f"- top_p: {top_p} ({type(top_p)})")
                    raise
                return response["choices"][0]["text"]
        
        pipe = CustomPipeline(llm)
        langchain_llm = HuggingFacePipeline(pipeline=pipe)
        return langchain_llm
        
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
    
    llm = HuggingFacePipeline(pipeline=pipe)
    return llm

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
        # Use invoke instead of __call__ to handle deprecation warning
        response = llm.invoke(formatted_prompt)
        return response.strip()
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