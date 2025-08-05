import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

export function useConversations(onLogout) {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

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
        onLogout();
      }
    }
  };

  const searchConversations = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv => {
        if (conv.title && conv.title.toLowerCase().includes(query.toLowerCase())) {
          return true;
        }
        
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

  const deleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/conversations/${conversationId}`, {
        headers: getAuthHeaders()
      });
      
      const updatedConversations = conversations.filter(conv => conv.id !== conversationId);
      setConversations(updatedConversations);
      setFilteredConversations(updatedConversations.filter(conv => 
        !searchQuery || 
        (conv.title && conv.title.toLowerCase().includes(searchQuery.toLowerCase()))
      ));
      
      if (currentConversation?.id === conversationId) {
        if (updatedConversations.length > 0) {
          setCurrentConversation(updatedConversations[0]);
        } else {
          setCurrentConversation(null);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      if (error.response?.status === 401) {
        onLogout();
      }
    }
  };

  const startNewConversation = () => {
    setCurrentConversation(null);
  };

  const addNewConversation = (newConversation) => {
    const updatedConversations = [newConversation, ...conversations];
    setConversations(updatedConversations);
    setFilteredConversations(updatedConversations);
  };

  useEffect(() => {
    loadConversations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!searchQuery) {
      setFilteredConversations(conversations);
    } else {
      searchConversations(searchQuery);
    }
  }, [conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    conversations,
    filteredConversations,
    currentConversation,
    searchQuery,
    setCurrentConversation,
    setConversations,
    searchConversations,
    deleteConversation,
    startNewConversation,
    addNewConversation,
    loadConversations
  };
}