import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export function useMessages(currentConversation, setIsStreaming, onLogout, onConversationUpdate, isStreaming) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
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
        onLogout();
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
            setMessages(prev => {
              const withoutTempUser = prev.filter(msg => msg.id !== tempUserMessage.id);
              const withoutStreamingAtEnd = withoutTempUser.slice(0, -1);
              const newMessages = [...withoutStreamingAtEnd, data.userMessage, streamingMessage];
              return newMessages;
            });
            
            if (!currentConversation || currentConversation.id !== data.conversation.id) {
              onConversationUpdate(data.conversation);
            }
            break;
            
          case 'chunk':
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...msg, content: msg.content + data.content, streaming: true }
                : msg
            ));
            break;
            
          case 'complete':
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

  useEffect(() => {
    if (currentConversation && !isStreaming) {
      loadMessages(currentConversation.id);
    }
  }, [currentConversation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentConversation) {
      setMessages([]);
    }
  }, [currentConversation]);

  return {
    messages,
    inputMessage,
    setInputMessage,
    loading,
    sendMessage
  };
}