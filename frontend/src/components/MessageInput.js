import React, { useState } from 'react';
import { Send, Paperclip, X, FileText } from 'lucide-react';
import FileUpload from './FileUpload';
import './FileUpload.css';

function MessageInput({ inputMessage, setInputMessage, loading, onSendMessage }) {
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleFileAttached = (fileData) => {
    setAttachedFile(fileData);
    setShowFileUpload(false);
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (loading) return;
    
    // Check if we have content (either text or file)
    if (!inputMessage.trim() && !attachedFile) return;
    
    // Call the original onSendMessage with both text and file
    onSendMessage(e, attachedFile);
    
    // Clear the attached file after sending
    setAttachedFile(null);
  };

  return (
    <div className="input-section">
      <form onSubmit={handleSendMessage} className="message-input-form">
        {attachedFile && (
          <div className="attached-file">
            <div className="file-info">
              <FileText size={16} className="file-icon" />
              <span className="file-name">{attachedFile.filename}</span>
              <span className="file-size">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="remove-file-btn"
              title="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        )}
        
        <div className="input-container">
          <button
            type="button"
            onClick={() => setShowFileUpload(true)}
            disabled={loading || attachedFile}
            className="file-upload-btn"
            title={attachedFile ? "File already attached" : "Attach file"}
          >
            <Paperclip size={16} />
          </button>
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={attachedFile ? "Ask something about this file..." : "Message ChatGPT..."}
            disabled={loading}
            className="message-input"
            rows={1}
            onKeyDown={handleKeyDown}
          />
          <button 
            type="submit" 
            disabled={loading || (!inputMessage.trim() && !attachedFile)} 
            className="send-btn"
            title="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
      
      {showFileUpload && (
        <FileUpload 
          onFileAttached={handleFileAttached}
          onClose={() => setShowFileUpload(false)}
        />
      )}
    </div>
  );
}

export default MessageInput;