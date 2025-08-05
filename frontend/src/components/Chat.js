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
  Send,
  Trash2,
  Search,
  Paperclip,
  Download
} from 'lucide-react';
import './Chat.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

function Chat({ setIsAuthenticated }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
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
    if (currentConversation && !isStreaming) {
      loadMessages(currentConversation.id);
    }
  }, [currentConversation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Re-apply search filter when conversations change
    if (!searchQuery) {
      setFilteredConversations(conversations);
    } else {
      searchConversations(searchQuery);
    }
  }, [conversations]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setFilteredConversations(response.data);
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

  const searchConversations = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv => {
        // Search in conversation title
        if (conv.title && conv.title.toLowerCase().includes(query.toLowerCase())) {
          return true;
        }
        
        // Search in conversation messages (if loaded)
        if (conv.messages && conv.messages.length > 0) {
          return conv.messages.some(msg => 
            msg.content.toLowerCase().includes(query.toLowerCase())
          );
        }
        
        return false;
      });
      setFilteredConversations(filtered);
    }
  };

  const exportConversations = () => {
    const dataToExport = conversations.map(conv => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messages: messages.filter(msg => msg.conversationId === conv.id)
    }));

    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `chatgpt-conversations-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
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

  const startNewConversation = () => {
    // Just clear the current conversation - new one will be created when user sends first message
    setCurrentConversation(null);
    setMessages([]);
  };

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation(); // Prevent selecting the conversation when clicking delete
    
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/conversations/${conversationId}`, {
        headers: getAuthHeaders()
      });
      
      // Remove from conversations list
      const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
      setConversations(updatedConversations);
      setFilteredConversations(updatedConversations.filter(conv => 
        !searchQuery || 
        (conv.title && conv.title.toLowerCase().includes(searchQuery.toLowerCase()))
      ));
      
      // If we deleted the current conversation, switch to another one or clear
      if (currentConversation?.id === conversationId) {
        if (updatedConversations.length > 0) {
          setCurrentConversation(updatedConversations[0]);
        } else {
          setCurrentConversation(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
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
    setIsStreaming(true);

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
    
    // Add the streaming message immediately
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
            // Replace temp user message with real one, but keep the streaming message
            setMessages(prev => {
              const withoutTempUser = prev.filter(msg => msg.id !== tempUserMessage.id);
              const withoutStreamingAtEnd = withoutTempUser.slice(0, -1);
              const newMessages = [...withoutStreamingAtEnd, data.userMessage, streamingMessage];
              return newMessages;
            });
            
            if (!currentConversation || currentConversation.id !== data.conversation.id) {
              // Set the new conversation as current immediately
              setCurrentConversation(data.conversation);
              
              // Add the new conversation to the lists immediately
              const updatedConversations = [data.conversation, ...conversations];
              setConversations(updatedConversations);
              
              // Update filtered conversations - the useEffect will handle the search filtering
            }
            break;
            
          case 'chunk':
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
            setIsStreaming(false);
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
            setIsStreaming(false);
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
        setIsStreaming(false);
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
      setIsStreaming(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <button onClick={startNewConversation} className="new-chat-btn">
            <Plus size={16} />
            New chat
          </button>
          
          <div className="search-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => searchConversations(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
        
        <div className="conversations-list">
          {filteredConversations.length > 0 ? (
            filteredConversations.map(conv => (
              <div
                key={conv.id}
                className={`conversation-item ${currentConversation?.id === conv.id ? 'active' : ''}`}
                onClick={() => setCurrentConversation(conv)}
              >
                <MessageCircle size={16} />
                <span className="conversation-title">{conv.title || 'New Conversation'}</span>
                <button
                  className="delete-conversation-btn"
                  onClick={(e) => deleteConversation(conv.id, e)}
                  title="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : searchQuery ? (
            <div className="no-results">
              <p>No conversations found</p>
            </div>
          ) : null}
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