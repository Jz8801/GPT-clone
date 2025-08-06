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

  /**
   * Send a message and handle streaming response from the server
   * Supports both text-only messages (EventSource) and file uploads (fetch with ReadableStream)
   */
  const sendMessage = async (e, attachedFile = null) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !attachedFile) || loading) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');
    setLoading(true);
    setIsStreaming(true);

    // Create temporary user message for immediate UI feedback
    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      role: 'user',
      createdAt: new Date()
    };

    setMessages(prev => [...prev, tempUserMessage]);

    // Create placeholder streaming message that will be updated with AI response chunks
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
      let eventSource;

      if (attachedFile) {
        // For file uploads, use POST to avoid URL length limitations
        const response = await fetch(`${API_URL}/api/messages/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            conversationId: currentConversation?.id || '',
            content: messageContent,
            hasFile: true,
            filename: attachedFile.filename,
            mimetype: attachedFile.mimetype,
            fileData: attachedFile.base64Data
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Backend error:', errorText);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        // Create a reader for the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        /**
         * Process Server-Sent Events from fetch ReadableStream for file uploads
         * Handles timeout management and SSE format parsing manually
         */
        const processStream = async () => {
          try {
            // Set up a 5-minute timeout for file processing (large files take time)
            const timeoutId = setTimeout(() => {
              reader.cancel();
              handleStreamError('Request timeout. The file may be too large or the server is experiencing high load.');
            }, 300000);

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                clearTimeout(timeoutId);
                break;
              }

              // Decode binary data to text and parse SSE format
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              // Process each line that contains SSE data
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
                  handleEventData(data);
                  
                  // Clear timeout when stream completes or errors
                  if (data.type === 'complete' || data.type === 'error') {
                    clearTimeout(timeoutId);
                  }
                }
              }
            }
          } catch (error) {
            console.error('Stream reading error:', error);
            handleStreamError(error.message);
          }
        };

        processStream();
      } else {
        // For text-only messages, use GET with EventSource
        const params = {
          conversationId: currentConversation?.id || '',
          content: messageContent,
          authorization: `Bearer ${localStorage.getItem('token')}`
        };

        eventSource = new EventSource(
          `${API_URL}/api/messages/stream?${new URLSearchParams(params)}`
        );

        eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          handleEventData(data);
        };

        eventSource.onerror = (error) => {
          console.error('EventSource error:', error);
          handleStreamError();
          eventSource.close();
        };
      }

      /**
       * Handle different types of streaming events from the server
       * Manages message state transitions and UI updates
       */
      const handleEventData = (data) => {
        switch (data.type) {
          case 'start':
            // Replace temporary user message with server-confirmed version
            // and ensure streaming assistant message is in correct position
            setMessages(prev => {
              const withoutTempUser = prev.filter(msg => msg.id !== tempUserMessage.id);
              const withoutStreamingAtEnd = withoutTempUser.slice(0, -1);
              const newMessages = [...withoutStreamingAtEnd, data.userMessage, streamingMessage];
              return newMessages;
            });
            
            // Update conversation context if this created a new conversation
            if (!currentConversation || currentConversation.id !== data.conversation.id) {
              onConversationUpdate(data.conversation);
            }
            break;
            
          case 'chunk':
            // Append incoming text chunks to the streaming message
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...msg, content: msg.content + data.content, streaming: true }
                : msg
            ));
            break;
            
          case 'complete':
            // Replace streaming message with final server-confirmed message
            setMessages(prev => prev.map(msg => 
              msg.id === streamingMessageId 
                ? { ...data.assistantMessage, streaming: false }
                : msg
            ));
            if (eventSource) {
              eventSource.close();
            }
            setLoading(false);
            setIsStreaming(false);
            break;
            
          case 'error':
            // Remove streaming placeholder and show user-friendly error message
            setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
            
            // Create contextual error messages based on error type
            let errorContent = 'Sorry, I encountered an error. Please try again.';
            if (data.error) {
              if (data.error.includes('rate_limit_exceeded') || data.error.includes('Request too large')) {
                errorContent = 'The file is too large or I\'m currently experiencing high demand. Please try with a smaller file or try again in a few minutes.';
              } else if (data.error.includes('tokens per min')) {
                errorContent = 'I\'m currently experiencing high demand. Please try again in a few minutes.';
              } else {
                errorContent = `Error: ${data.error}`;
              }
            }
            
            const errorMessage = {
              id: `error-${Date.now()}`,
              content: errorContent,
              role: 'assistant',
              createdAt: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
            if (eventSource) {
              eventSource.close();
            }
            setLoading(false);
            setIsStreaming(false);
            break;
            
          default:
            console.warn('Unknown message type:', data.type);
            break;
        }
      };

      /**
       * Handle connection-level streaming errors (network, timeout, etc.)
       * Provides user-friendly error messages and cleans up UI state
       */
      const handleStreamError = (errorInfo = null) => {
        // Remove streaming placeholder message
        setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
        
        // Generate appropriate error message based on error type
        let errorContent = 'Sorry, I encountered an error. Please try again.';
        if (errorInfo && typeof errorInfo === 'string') {
          if (errorInfo.includes('rate_limit_exceeded') || errorInfo.includes('Request too large')) {
            errorContent = 'The file is too large or I\'m currently experiencing high demand. Please try with a smaller file or try again in a few minutes.';
          } else if (errorInfo.includes('tokens per min')) {
            errorContent = 'I\'m currently experiencing high demand. Please try again in a few minutes.';
          }
        }
        
        const errorMessage = {
          id: `error-${Date.now()}`,
          content: errorContent,
          role: 'assistant',
          createdAt: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        
        // Reset loading states
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