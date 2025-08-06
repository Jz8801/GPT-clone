import React, { useState } from 'react';
import { Download, X, FileText, Code, Hash } from 'lucide-react';

/**
 * Export Modal Component
 * Allows users to select export format and download conversations
 */
function ExportModal({ isOpen, onClose, onExport, conversation, isExporting }) {
  const [selectedFormat, setSelectedFormat] = useState('json');

  const exportFormats = [
    {
      id: 'json',
      name: 'JSON',
      description: 'Structured data with complete metadata',
      icon: <Code size={20} />,
      extension: '.json'
    },
    {
      id: 'txt', 
      name: 'Plain Text',
      description: 'Human-readable text with timestamps',
      icon: <FileText size={20} />,
      extension: '.txt'
    },
    {
      id: 'md',
      name: 'Markdown',
      description: 'Formatted text with proper headings',
      icon: <Hash size={20} />,
      extension: '.md'
    }
  ];

  const handleExport = async () => {
    if (!conversation || isExporting) return;
    
    try {
      await onExport(conversation.id, selectedFormat, conversation);
      onClose();
    } catch (error) {
      // Error is already handled in the hook
      console.error('Export failed:', error);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isExporting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content export-modal">
        <div className="modal-header">
          <h3>Export Conversation</h3>
          <button 
            className="modal-close-btn" 
            onClick={onClose}
            disabled={isExporting}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="conversation-info">
            <h4>{conversation?.title || 'Untitled Conversation'}</h4>
            <p className="conversation-date">
              Created: {conversation?.createdAt ? new Date(conversation.createdAt).toLocaleDateString() : 'Unknown'}
            </p>
          </div>

          <div className="format-selection">
            <h5>Choose export format:</h5>
            <div className="format-options">
              {exportFormats.map(format => (
                <label
                  key={format.id}
                  className={`format-option ${selectedFormat === format.id ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value={format.id}
                    checked={selectedFormat === format.id}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    disabled={isExporting}
                  />
                  <div className="format-content">
                    <div className="format-header">
                      {format.icon}
                      <span className="format-name">
                        {format.name}
                        <span className="format-extension">{format.extension}</span>
                      </span>
                    </div>
                    <p className="format-description">{format.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="export-preview">
            <h5>Export details:</h5>
            <div className="preview-info">
              <div className="preview-item">
                <strong>Format:</strong> {exportFormats.find(f => f.id === selectedFormat)?.name}
              </div>
              <div className="preview-item">
                <strong>Filename:</strong> 
                <span className="filename">
                  {conversation?.title?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'conversation'}
                  _{new Date().toISOString().split('T')[0]}
                  {exportFormats.find(f => f.id === selectedFormat)?.extension}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={isExporting}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary export-btn" 
            onClick={handleExport}
            disabled={isExporting || !conversation}
          >
            <Download size={16} />
            {isExporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;