import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Files, RefreshCw, FileUp, CheckCircle, XCircle, Trash2 } from 'lucide-react';

interface Document {
  id: string;
  title: string;
  original_file: string;
  in_folder: boolean;
  in_faiss: boolean;
  last_modified: number;
}

interface ScanResult {
  added: number;
  updated: number;
  total_docs: number;
  total_in_faiss: number;
}

const DocumentManager: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Load documents on initial mount and when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchDocuments();
    }
  }, [isOpen]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await axios.get('http://localhost:8000/rag/documents');
      setDocuments(response.data);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const scanDocuments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setScanResult(null);
      
      const response = await axios.post('http://localhost:8000/rag/scan');
      setScanResult(response.data);
      
      // Refresh document list
      await fetchDocuments();
    } catch (err) {
      console.error('Error scanning documents:', err);
      setError('Failed to scan documents. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeDocument = async (docId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      await axios.post('http://localhost:8000/rag/remove', { doc_id: docId });
      
      // Refresh document list
      await fetchDocuments();
    } catch (err) {
      console.error('Error removing document:', err);
      setError('Failed to remove document. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      setError(null);
      setUploadStatus(`Uploading ${file.name}...`);
      
      const formData = new FormData();
      formData.append('file', file);
      
      await axios.post('http://localhost:8000/rag/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      setUploadStatus(`Successfully uploaded ${file.name}`);
      
      // Refresh document list and scan result
      await scanDocuments();
      
      // Clear the input value so the same file can be uploaded again
      event.target.value = '';
      
      // Clear upload status after a delay
      setTimeout(() => {
        setUploadStatus(null);
      }, 3000);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file. Please try again.');
      setUploadStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const getFileNameFromPath = (path: string) => {
    return path.split('/').pop() || path;
  };

  return (
    <div>
      {/* Button to toggle the document manager */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-30 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
        title="Manage Knowledge Base Documents"
      >
        <Files className="h-6 w-6" />
      </button>

      {/* Document manager modal */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Knowledge Base Document Manager</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-600 hover:text-gray-800"
              >
                ×
              </button>
            </div>

            {/* Toolbar */}
            <div className="p-4 border-b flex items-center space-x-4">
              <button
                onClick={scanDocuments}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Scan Directory
              </button>
              
              <label className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center cursor-pointer">
                <FileUp className="h-4 w-4 mr-2" />
                Upload Document
                <input 
                  type="file" 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept=".txt,.md,.csv,.json,.html,.xml,.py,.js,.ts,.css"
                  disabled={isLoading}
                />
              </label>
              
              {scanResult && (
                <div className="text-sm text-gray-700">
                  Last scan: Added {scanResult.added}, Updated {scanResult.updated}
                </div>
              )}
              
              {uploadStatus && (
                <div className="text-sm text-green-600">
                  {uploadStatus}
                </div>
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="m-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}

            {/* Document list */}
            <div className="flex-grow overflow-auto p-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Files className="h-16 w-16 mb-4" />
                  <p>No documents found. Upload a document or scan the directory.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In Folder</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">In FAISS</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.title}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {doc.original_file ? getFileNameFromPath(doc.original_file) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {doc.in_folder ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {doc.in_faiss ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(doc.last_modified)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => removeDocument(doc.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Remove from FAISS"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentManager;