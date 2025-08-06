import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X } from 'lucide-react';

const FileUpload = ({ onFileAttached, onClose }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file) => {
    setIsUploading(true);
    setError('');
    setSuccess(false);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result;
        
        setSuccess(true);
        setIsUploading(false);
        
        if (onFileAttached) {
          onFileAttached({
            filename: file.name,
            mimetype: file.type,
            size: file.size,
            base64Data: base64Data
          });
        }

        setTimeout(() => {
          if (onClose) onClose();
        }, 1000);
      };

      reader.onerror = () => {
        throw new Error('Failed to read file');
      };

      reader.readAsDataURL(file);

    } catch (error) {
      console.error('File processing error:', error);
      setError(error.message || 'Failed to process file');
      setIsUploading(false);
    }
  };

  return (
    <div className="file-upload-overlay">
      <div className="file-upload-modal">
        <div className="file-upload-header">
          <h3>Attach File</h3>
          <button className="close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="upload-success">
            <CheckCircle size={48} className="success-icon" />
            <p>File attached successfully!</p>
          </div>
        ) : (
          <>
            <div
              className={`file-drop-zone ${isDragOver ? 'drag-over' : ''} ${isUploading ? 'uploading' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <div className="upload-progress">
                  <div className="spinner"></div>
                  <p>Processing file...</p>
                </div>
              ) : (
                <>
                  <Upload size={48} className="upload-icon" />
                  <p>
                    <strong>Click to browse</strong> or drag and drop your file here
                  </p>
                  <p className="file-types">
                    Supported: PDF, Word (DOC/DOCX), Text (TXT), Markdown (MD), JSON, CSV
                  </p>
                </>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.docx,.doc,.txt,.csv,.json,.md"
              style={{ display: 'none' }}
            />

            {error && (
              <div className="upload-error">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <div className="upload-info">
              <FileText size={16} />
              <span>Maximum file size: 50MB for spreadsheets, 512MB for documents</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FileUpload;