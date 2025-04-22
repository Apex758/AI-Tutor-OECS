import os
import numpy as np
import faiss
from typing import List, Dict, Tuple, Optional, Any
import json
import time
from dataclasses import dataclass, asdict, field
from transformers import AutoTokenizer, AutoModel
import torch
import hashlib
from pathlib import Path
import pytesseract
from PIL import Image
from pdf2image import convert_from_path

# Set paths for Tesseract and Poppler
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
POPPLER_PATH = r'C:\Users\LG\Desktop\Curriculum Filler\poppler\poppler-24.08.0\Library\bin'

# Constants
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIMENSION = 384  # Dimension of the MiniLM-L6-v2 model
FAISS_INDEX_DIR = "vector_store"
DOCUMENT_STORE_DIR = "document_store"
RAG_DOCS_DIR = "backend/RAG_docs"  # Directory to scan for documents
SIMILARITY_THRESHOLD = 0.7  # Minimum similarity score to consider a document relevant

@dataclass
class Document:
    """Class representing a document in the RAG system."""
    id: str
    content: str
    title: str
    original_file: str = ""  # Original file path
    last_modified: float = 0.0  # Last modification timestamp
    in_folder: bool = True  # Whether the file is still in the folder
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class EmbeddingModel:
    """Class for generating embeddings for queries and documents."""
    def __init__(self):
        print(f"Initializing embedding model: {EMBEDDING_MODEL}")
        self.tokenizer = AutoTokenizer.from_pretrained(EMBEDDING_MODEL)
        self.model = AutoModel.from_pretrained(EMBEDDING_MODEL)
        # Move to CPU
        self.model.to('cpu')
        
    def generate_embedding(self, text: str) -> np.ndarray:
        """Generate embedding for a given text."""
        inputs = self.tokenizer(
            text, 
            padding=True, 
            truncation=True, 
            return_tensors="pt",
            max_length=512
        )
        
        # Move inputs to CPU
        inputs = {k: v.to('cpu') for k, v in inputs.items()}
        
        with torch.no_grad():
            outputs = self.model(**inputs)
            
            # Mean Pooling - Take average of all token embeddings
            attention_mask = inputs['attention_mask']
            embeddings = outputs.last_hidden_state
            input_mask_expanded = attention_mask.unsqueeze(-1).expand(embeddings.size()).float()
            sum_embeddings = torch.sum(embeddings * input_mask_expanded, 1)
            sum_mask = torch.clamp(input_mask_expanded.sum(1), min=1e-9)
            
            # Normalize embeddings
            embeddings = sum_embeddings / sum_mask
            
            return embeddings[0].cpu().numpy()


class RAGSystem:
    """Retrieval-Augmented Generation system using FAISS for vector search."""
    def __init__(self):
        # Create necessary directories
        os.makedirs(FAISS_INDEX_DIR, exist_ok=True)
        os.makedirs(DOCUMENT_STORE_DIR, exist_ok=True)
        os.makedirs(RAG_DOCS_DIR, exist_ok=True)
        
        self.embedding_model = EmbeddingModel()
        self.index_path = os.path.join(FAISS_INDEX_DIR, "index.faiss")
        self.document_path = os.path.join(DOCUMENT_STORE_DIR, "documents.json")
        self.documents = {}  # Document store: {id: Document}
        self.doc_id_to_index = {}  # Mapping from document ID to FAISS index
        
        # Initialize or load FAISS index
        if os.path.exists(self.index_path):
            print(f"Loading existing FAISS index from {self.index_path}")
            self.index = faiss.read_index(self.index_path)
            self._load_documents()
            
            # Initialize the doc_id_to_index mapping
            for i, doc_id in enumerate(self.documents.keys()):
                self.doc_id_to_index[doc_id] = i
        else:
            print("Creating new FAISS index")
            self.index = faiss.IndexFlatIP(EMBEDDING_DIMENSION)  # Inner product for cosine similarity with normalized vectors
            self._save_index()
        
        # Scan the RAG_docs directory on startup
        self.scan_rag_docs_folder()

    def pdf_to_text(self, pdf_path: str, timeout: int = 30) -> str:
        """Extract text from a PDF file using OCR with timeout."""
        try:
            import concurrent.futures
            
            # Convert PDF to images using poppler path
            images = convert_from_path(pdf_path, poppler_path=POPPLER_PATH)
            
            text = ""
            with concurrent.futures.ThreadPoolExecutor() as executor:
                futures = []
                for image in images:
                    future = executor.submit(pytesseract.image_to_string, image)
                    futures.append(future)
                
                for future in concurrent.futures.as_completed(futures, timeout=timeout):
                    try:
                        text += future.result()
                    except concurrent.futures.TimeoutError:
                        print(f"Timeout processing PDF page in {pdf_path}")
                        text += "\n[Timeout processing page]\n"
                    except Exception as e:
                        print(f"Error processing PDF page in {pdf_path}: {e}")
                        text += f"\n[Error processing page: {str(e)}]\n"
            
            return text.strip()
        except Exception as e:
            print(f"Error extracting text from PDF {pdf_path}: {e}")
            return ""
         
    def _generate_document_id(self, content: str, filepath: str = "") -> str:
        """Generate a unique ID for a document based on its content and filepath."""
        content_hash = hashlib.md5(content.encode()).hexdigest()
        if filepath:
            # Include the filename in the ID to help with identification
            filename = os.path.basename(filepath)
            return f"{content_hash}_{filename}"
        return content_hash
    
    def _load_documents(self):
        """Load documents from disk."""
        if os.path.exists(self.document_path):
            with open(self.document_path, 'r') as f:
                doc_dicts = json.load(f)
                self.documents = {
                    doc_id: Document(**doc_data)
                    for doc_id, doc_data in doc_dicts.items()
                }
            print(f"Loaded {len(self.documents)} documents from {self.document_path}")
        else:
            print(f"No document store found at {self.document_path}")
            
    def _save_documents(self):
        """Save documents to disk."""
        doc_dicts = {
            doc_id: doc.to_dict()
            for doc_id, doc in self.documents.items()
        }
        with open(self.document_path, 'w') as f:
            json.dump(doc_dicts, f, indent=2)
        print(f"Saved {len(self.documents)} documents to {self.document_path}")
    
    def _save_index(self):
        """Save FAISS index to disk."""
        faiss.write_index(self.index, self.index_path)
        print(f"Saved FAISS index to {self.index_path}")
    
    def add_document(self, content: str, title: str = "", original_file: str = "", metadata: Dict[str, Any] = None) -> str:
        """
        Add a document to the RAG system.
        
        Args:
            content: The text content of the document
            title: An optional title for the document
            original_file: The original file path
            metadata: Optional metadata for the document
            
        Returns:
            The ID of the added document
        """
        doc_id = self._generate_document_id(content, original_file)
        
        # Check if document already exists
        if doc_id in self.documents:
            print(f"Document already exists with ID: {doc_id}")
            
            # Update the document's in_folder status
            if original_file:
                self.documents[doc_id].in_folder = True
                self.documents[doc_id].last_modified = os.path.getmtime(original_file) if os.path.exists(original_file) else time.time()
                self._save_documents()
                
            return doc_id
        
        # Get last modified time if file exists
        last_modified = os.path.getmtime(original_file) if original_file and os.path.exists(original_file) else time.time()
        
        # Create document
        document = Document(
            id=doc_id,
            content=content,
            title=title or f"Document {len(self.documents) + 1}",
            original_file=original_file,
            last_modified=last_modified,
            in_folder=True,
            metadata=metadata or {}
        )
        
        # Generate embedding
        embedding = self.embedding_model.generate_embedding(content)
        
        # Normalize embedding for cosine similarity
        faiss.normalize_L2(np.array([embedding], dtype=np.float32))
        
        # Add to FAISS index
        self.index.add(np.array([embedding], dtype=np.float32))
        
        # Update doc_id_to_index mapping
        self.doc_id_to_index[doc_id] = self.index.ntotal - 1
        
        # Add to document store
        self.documents[doc_id] = document
        
        # Save to disk
        self._save_index()
        self._save_documents()
        
        print(f"Added document with ID: {doc_id}")
        return doc_id
    
    def scan_rag_docs_folder(self) -> Dict[str, Any]:
        """
        Scan the RAG_docs folder and add/update documents.
        
        Returns:
            Dictionary with stats about the scan operation
        """
        print(f"Scanning directory: {RAG_DOCS_DIR}") # Added log
        if not os.path.exists(RAG_DOCS_DIR):
            os.makedirs(RAG_DOCS_DIR, exist_ok=True)
            print(f"Created or found directory: {RAG_DOCS_DIR}") # Added log
            return {"added": 0, "updated": 0, "total_docs": 0, "total_in_faiss": 0}

        # Log all files found initially
        all_files_in_dir = list(Path(RAG_DOCS_DIR).glob("*"))
        print(f"Found files/dirs in {RAG_DOCS_DIR}: {all_files_in_dir}") # Added log

        # Get all files in directory with common text extensions
        extensions = ['.txt', '.md', '.csv', '.json', '.html', '.xml', '.py', '.js', '.ts', '.css', '.pdf']
        print(f"Allowed extensions: {extensions}") # Added log
        files = []
        for ext in extensions:
            files.extend(Path(RAG_DOCS_DIR).glob(f"*{ext}"))
     
        print(f"Files matching allowed extensions: {files}") # Added log

        added_count = 0
        updated_count = 0
        
        # Mark all documents as not in folder, we'll update this as we scan
        for doc_id, doc in self.documents.items():
            if doc.original_file.startswith(RAG_DOCS_DIR):
                doc.in_folder = False
        
        for file_path in files:
            try:
                file_path_str = str(file_path)
                file_last_modified = os.path.getmtime(file_path_str)
                
                if file_path.suffix.lower() == '.pdf':
                    content = self.pdf_to_text(file_path_str)
                else:
                    with open(file_path_str, 'r', encoding='utf-8') as f:
                        content = f.read()
                
                # Check if this file is already in our documents by path
                existing_doc_id = None
                for doc_id, doc in self.documents.items():
                    if doc.original_file == file_path_str:
                        existing_doc_id = doc_id
                        break
                
                if existing_doc_id:
                    # Document exists, check if it's been modified
                    if file_last_modified > self.documents[existing_doc_id].last_modified:
                        # File has been modified, update the document
                        if file_path.suffix.lower() == '.pdf':
                            content = self.pdf_to_text(file_path_str)
                        else:
                            with open(file_path_str, 'r', encoding='utf-8') as f:
                                content = f.read()
                        
                        # Generate new embedding
                        embedding = self.embedding_model.generate_embedding(content)
                        faiss.normalize_L2(np.array([embedding], dtype=np.float32))
                        
                        # Update the document content and last_modified
                        self.documents[existing_doc_id].content = content
                        self.documents[existing_doc_id].last_modified = file_last_modified
                        self.documents[existing_doc_id].in_folder = True
                        
                        # Update the embedding in FAISS
                        if existing_doc_id in self.doc_id_to_index:
                            index_pos = self.doc_id_to_index[existing_doc_id]
                            # Currently FAISS doesn't support direct update, so we'd need to rebuild the index
                            # For now, we'll just note that an update is needed
                            print(f"Document {existing_doc_id} needs embedding update (not supported in current implementation)")
                        
                        updated_count += 1
                    else:
                        # File hasn't been modified, just mark it as in_folder
                        self.documents[existing_doc_id].in_folder = True
                else:
                    # New document, add it
                    if file_path.suffix.lower() == '.pdf':
                        content = self.pdf_to_text(file_path_str)
                    else:
                        with open(file_path_str, 'r', encoding='utf-8') as f:
                            content = f.read()
                    
                    # Use filename as title
                    title = file_path.stem
                    
                    # Add document
                    doc_id = self.add_document(
                        content=content,
                        title=title,
                        original_file=file_path_str,
                        metadata={"source": file_path_str}
                    )
                    
                    added_count += 1
                    print(f"Added document from file: {file_path}")
                    
            except Exception as e:
                print(f"Error processing file {file_path}: {e}")
        
        # Save the updated document status
        self._save_documents()
        
        # Return stats
        return {
            "added": added_count,
            "updated": updated_count,
            "total_docs": len(files),
            "total_in_faiss": len(self.documents)
        }
    
    def get_document_list(self) -> List[Dict[str, Any]]:
        """
        Get a list of all documents with their status.
        
        Returns:
            List of document info dictionaries
        """
        document_list = []
        for doc_id, doc in self.documents.items():
            document_list.append({
                "id": doc_id,
                "title": doc.title,
                "original_file": doc.original_file,
                "in_folder": doc.in_folder,
                "in_faiss": True,  # It's in FAISS if it's in self.documents
                "last_modified": doc.last_modified
            })
        
        # Sort by title
        document_list.sort(key=lambda x: x["title"])
        
        return document_list
        
    def retrieve(self, query: str, top_k: int = 3) -> List[Tuple[Document, float]]:
        """
        Retrieve relevant documents for a given query.
        
        Args:
            query: The search query
            top_k: Number of documents to retrieve
             
        Returns:
            List of (document, similarity_score) tuples
        """
        if self.index.ntotal == 0:
            print("No documents in the index")
            return []
         
        # Generate query embedding
        query_embedding = self.embedding_model.generate_embedding(query)
         
        # Normalize query embedding for cosine similarity
        faiss.normalize_L2(np.array([query_embedding], dtype=np.float32))
         
        # Search FAISS index
        scores, indices = self.index.search(np.array([query_embedding], dtype=np.float32), min(top_k, self.index.ntotal))
         
        # Get documents for the indices
        results = []
        for i, idx in enumerate(indices[0]):
            if idx != -1:  # -1 means no result
                score = scores[0][i]
                if score >= SIMILARITY_THRESHOLD:  # Only include results above threshold
                    # Find the document ID for this index
                    doc_id = None
                    for did, index in self.doc_id_to_index.items():
                        if index == idx:
                            doc_id = did
                            break
                     
                    if doc_id and doc_id in self.documents:
                        results.append((self.documents[doc_id], float(score)))
         
        results.sort(key=lambda x: x[1], reverse=True)
        return results

    def remove_document(self, doc_id: str) -> bool:
        """
        Remove a document from the RAG system.
        
        Args:
            doc_id: The ID of the document to remove
             
        Returns:
            True if successful, False otherwise
        """
        if doc_id not in self.documents:
            print(f"Document with ID {doc_id} not found")
            return False
         
        # Currently, FAISS doesn't support direct deletion of vectors
        # To properly implement this, we'd need to rebuild the index without the document
        # For now, we'll just remove it from our documents list
        print(f"Removing document with ID: {doc_id}")
        del self.documents[doc_id]
         
        # Remove from doc_id_to_index mapping
        if doc_id in self.doc_id_to_index:
            del self.doc_id_to_index[doc_id]
         
        # Save the updated document list
        self._save_documents()
         
        return True

    def remove_all_documents(self) -> None:
        """Remove all documents from the system."""
        print("Removing all documents from the RAG system")
        # Reset the index
        self.index = faiss.IndexFlatIP(EMBEDDING_DIMENSION)
        self._save_index()
        
        # Clear document store and mapping
        self.documents = {}
        self.doc_id_to_index = {}
        self._save_documents()
        print("All documents removed")

def format_retrieved_context(retrieved_docs: List[Tuple[Document, float]], query: str) -> str:
    """
    Format retrieved documents as context for the language model.
    
    Args:
        retrieved_docs: List of (document, similarity_score) tuples
        query: The original query
        
    Returns:
        Formatted context string
    """
    if not retrieved_docs:
        return ""
    
    context_parts = ["RELEVANT INFORMATION:"]
    
    for doc, score in retrieved_docs:
        # Truncate document content if too long
        MAX_CHARS = 1000
        content = doc.content
        if len(content) > MAX_CHARS:
            content = content[:MAX_CHARS] + "..."
        
        context_parts.append(f"Title: {doc.title}")
        context_parts.append(f"Relevance: {score:.2f}")
        context_parts.append(f"Content: {content}")
        context_parts.append("-" * 40)
    
    return "\n".join(context_parts)

# Singleton instance
_rag_system = None

def get_rag_system() -> RAGSystem:
    """Get or create the RAG system singleton."""
    global _rag_system
    if _rag_system is None:
        _rag_system = RAGSystem()
    return _rag_system