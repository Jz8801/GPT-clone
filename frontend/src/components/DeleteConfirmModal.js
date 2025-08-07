import React from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

/**
 * Delete Confirmation Modal Component  
 * Custom styled modal to replace browser's confirm() dialog
 */
function DeleteConfirmModal({ isOpen, onClose, onConfirm, conversation, isDeleting }) {
  
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !isDeleting) {
      onClose();
    }
  };

  const handleConfirm = async () => {
    if (!conversation || isDeleting) return;
    await onConfirm();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div className="modal-content delete-modal">
        <div className="modal-header">
          <h3>Delete Conversation</h3>
          <button 
            className="modal-close-btn" 
            onClick={onClose}
            disabled={isDeleting}
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="delete-warning">
            <AlertTriangle size={48} className="warning-icon" />
            <p>
              Are you sure you want to delete this conversation?
            </p>
          </div>

          <div className="conversation-info">
            <h4>{conversation?.title || 'Untitled Conversation'}</h4>
            <p className="conversation-date">
              Created: {conversation?.createdAt ? new Date(conversation.createdAt).toLocaleDateString() : 'Unknown'}
            </p>
          </div>

          <div className="delete-notice">
            <p><strong>This action cannot be undone.</strong> All messages in this conversation will be permanently deleted.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button 
            className="btn btn-danger delete-btn" 
            onClick={handleConfirm}
            disabled={isDeleting || !conversation}
          >
            <Trash2 size={16} />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;