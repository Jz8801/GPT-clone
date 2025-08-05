import React from 'react';
import { Send } from 'lucide-react';

function MessageInput({ inputMessage, setInputMessage, loading, onSendMessage }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(e);
    }
  };

  return (
    <div className="input-section">
      <form onSubmit={onSendMessage} className="message-input-form">
        <div className="input-container">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Message ChatGPT..."
            disabled={loading}
            className="message-input"
            rows={1}
            onKeyDown={handleKeyDown}
          />
          <button 
            type="submit" 
            disabled={loading || !inputMessage.trim()} 
            className="send-btn"
            title="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}

export default MessageInput;