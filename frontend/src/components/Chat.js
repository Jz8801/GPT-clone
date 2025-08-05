import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Plus, 
  MessageCircle, 
  Sun, 
  Moon, 
  LogOut, 
  User, 
  Send 
} from 'lucide-react';
import './Chat.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function Chat({ setIsAuthenticated }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadConversations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (currentConversation) {
      loadMessages(currentConversation.id);
    }
  }, [currentConversation]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  };

  const loadConversations = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/conversations`, {
        headers: getAuthHeaders()
      });
      setConversations(response.data);
      if (response.data.length > 0 && !currentConversation) {
        setCurrentConversation(response.data[0]);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await axios.get(`${API_URL}/api/messages/${conversationId}`, {
        headers: getAuthHeaders()
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  const createNewConversation = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/conversations`, {}, {
        headers: getAuthHeaders()
      });
      const newConversation = response.data;
      setConversations([newConversation, ...conversations]);
      setCurrentConversation(newConversation);
      setMessages([]);
    } catch (error) {
      console.error('Error creating conversation:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');
    setLoading(true);

    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      role: 'user',
      createdAt: new Date()
    };

    setMessages(prev => [...prev, tempUserMessage]);

    // Add streaming assistant message placeholder
    const streamingMessageId = `streaming-${Date.now()}`;
    const streamingMessage = {
      id: streamingMessageId,
      content: '',
      role: 'assistant',
      createdAt: new Date(),
      streaming: true
    };
    setMessages(prev => [...prev, streamingMessage]);

    try {
      // Create EventSource for streaming
      const eventSource = new EventSource(
        `${API_URL}/api/messages/stream?${new URLSearchParams({
          conversationId: currentConversation?.id || '',
          content: messageContent,
          authorization: `Bearer ${localStorage.getItem('token')}`
        })}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'start':
            // Replace temp user message with real one
            setMessages(prev => {
              const filtered = prev.filter(msg => msg.id !== tempUserMessage.id);
              return [...filtered.slice(0, -1), data.userMessage, streamingMessage];
            });
            
            if (!currentConversation || currentConversation.id !== data.conversationId) {
              loadConversations().then(() => {
                const newConv = conversations.find(c => c.id === data.conversationId);
                if (newConv) setCurrentConversation(newConv);
              });
            }
            break;
            
          case 'chunk':
            // Append content to streaming message
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...msg, content: msg.content + data.content }
                : msg
            ));
            break;
            
          case 'complete':
            // Replace streaming message with final message
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...data.assistantMessage, streaming: false }
                : msg
            ));
            eventSource.close();
            setLoading(false);
            break;
            
          case 'error':
            setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
            const errorMessage = {
              id: `error-${Date.now()}`,
              content: 'Sorry, I encountered an error. Please try again.',
              role: 'assistant',
              createdAt: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            eventSource.close();
            setLoading(false);
            break;
            
          default:
            console.warn('Unknown message type:', data.type);
            break;
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
        
        const errorMessage = {
          id: `error-${Date.now()}`,
          content: 'Sorry, I encountered an error. Please try again.',
          role: 'assistant',
          createdAt: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        
        eventSource.close();
        setLoading(false);
      };

    } catch (error) {
      console.error('Error setting up streaming:', error);
      setMessages(prev => prev.filter(msg => msg.id !== tempUserMessage.id && msg.id !== streamingMessageId));
      
      const errorMessage = {
        id: `error-${Date.now()}`,
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        createdAt: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <button onClick={createNewConversation} className="new-chat-btn">
            <Plus size={16} />
            New chat
          </button>
        </div>
        
        <div className="conversations-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
              onClick={() => setCurrentConversation(conv)}
            >
              <MessageCircle size={16} />
              <span className="conversation-title">{conv.title || 'New Conversation'}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button onClick={toggleTheme} className="theme-toggle-btn" title={`Switch to ${isDarkMode ? 'light' : 'dark'} mode`}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          <button onClick={handleLogout} className="logout-btn" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
      
      <div className="chat-main">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            <div className="welcome-content">
              <h1>ChatGPT Clone</h1>
              <p>How can I help you today?</p>
            </div>
          </div>
        ) : (
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
        )}
        
        <div className="input-section">
          <form onSubmit={sendMessage} className="message-input-form">
            <div className="input-container">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Message ChatGPT..."
                disabled={loading}
                className="message-input"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
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
      </div>
    </div>
  );
}

export default Chat;