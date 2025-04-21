from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
from langchain_community.llms import HuggingFacePipeline  
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain

model_name = "google/flan-t5-small"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
pipe = pipeline("text2text-generation", model=model, tokenizer=tokenizer, device=-1)
llm = HuggingFacePipeline(pipeline=pipe)

prompt = PromptTemplate.from_template("Explain the concept of {topic} in a way a student can understand.")
chain = prompt | llm

def get_answer_from_text(text: str) -> str:
    return chain.invoke({"topic": text})