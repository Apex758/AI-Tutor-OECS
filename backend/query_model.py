from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
from langchain_community.llms import HuggingFacePipeline
from langchain.prompts import PromptTemplate
import torch
import os
from huggingface_hub import hf_hub_download, login
from llama_cpp import Llama

def setup_llamacpp_pipeline():
    # Login to Hugging Face
    hf_token = os.environ.get("HF_TOKEN")
    login(token=hf_token)
    
    repo_id = "TheBloke/Llama-3.2-1B-GGUF"
    filename = "llama-3.2-1b.q4_0.gguf"
    
    try:
        # Pass token to download
        model_path = hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            repo_type="model",
            token=hf_token
        )
        
        llm = Llama(
            model_path=model_path,
            n_ctx=2048,
            n_batch=512,
            n_threads=8,
            n_gpu_layers=0,
            verbose=True  
        )
        
        class CustomPipeline:
            def __init__(self, llm_model):
                self.llm = llm_model
            
            def __call__(self, prompt, max_tokens=512, temperature=0.7, top_p=0.9):
                response = self.llm(
                    prompt,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=top_p,
                    repeat_penalty=1.2,
                    echo=False
                )
                return response["choices"][0]["text"]
        
        pipe = CustomPipeline(llm)
        langchain_llm = HuggingFacePipeline(pipeline=pipe)
        return langchain_llm
        
    except Exception as e:
        print(f"Error loading GGUF model: {e}")
        print("Falling back to transformers implementation...")
        return setup_transformers_cpu_pipeline()

def setup_transformers_cpu_pipeline():
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
        max_new_tokens=512,
        temperature=0.7,
        top_p=0.9,
        repetition_penalty=1.2,
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

def get_answer_from_text(text: str) -> str:
    formatted_prompt = prompt_template.format(query=text)
    response = llm(formatted_prompt)
    return response.strip()

def main():
    os.environ["HF_TOKEN"] = "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"
    print("Initializing Llama-3.2-1B model...")
    global llm
    llm = setup_llamacpp_pipeline()
    
    
if __name__ == "__main__":
    main()