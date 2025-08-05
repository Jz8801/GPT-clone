import React, { useRef, useEffect } from 'react';
import { User } from 'lucide-react';

function MessageList({ messages, loading }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="welcome-screen">
        <div className="welcome-content">
          <h1>ChatGPT Clone</h1>
          <p>How can I help you today?</p>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-container">
      {messages.map(message => (
        <div key={message.id} className={`message-wrapper ${message.role}`}>
          <div className="message-content">
            <div className="avatar">
              {message.role === 'user' ? (
                <User size={20} />
              ) : (
                <div className="ai-avatar">AI</div>
              )}
            </div>
            <div className="message-text">
              {message.content}
              {message.streaming && <span className="streaming-cursor">▋</span>}
            </div>
          </div>
        </div>
      ))}
      {loading && !messages.some(msg => msg.streaming) && (
        <div className="message-wrapper assistant">
          <div className="message-content">
            <div className="avatar">
              <div className="ai-avatar">AI</div>
            </div>
            <div className="message-text">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;