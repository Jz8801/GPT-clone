import React, { useState } from 'react';
import Sidebar from './Sidebar';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { useConversations } from '../hooks/useConversations';
import { useMessages } from '../hooks/useMessages';
import './Chat.css';

function Chat({ setIsAuthenticated }) {
  const [isStreaming, setIsStreaming] = useState(false);


  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  const {
    conversations,
    filteredConversations,
    currentConversation,
    searchQuery,
    setCurrentConversation,
    setConversations,
    searchConversations,
    deleteConversation,
    startNewConversation
  } = useConversations(handleLogout);

  const handleConversationUpdate = (newConversation) => {
    setCurrentConversation(newConversation);
    const updatedConversations = [newConversation, ...conversations];
    setConversations(updatedConversations);
  };

  const {
    messages,
    inputMessage,
    setInputMessage,
    loading,
    sendMessage
  } = useMessages(currentConversation, setIsStreaming, handleLogout, handleConversationUpdate, isStreaming);


  return (
    <div className="chat-container">
      <Sidebar
        conversations={conversations}
        filteredConversations={filteredConversations}
        currentConversation={currentConversation}
        searchQuery={searchQuery}
        onNewChat={startNewConversation}
        onSearchChange={searchConversations}
        onConversationSelect={setCurrentConversation}
        onDeleteConversation={deleteConversation}
        onLogout={handleLogout}
      />
      
      <div className="chat-main">
        <MessageList messages={messages} loading={loading} />
        <MessageInput
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          loading={loading}
          onSendMessage={sendMessage}
        />
      </div>
    </div>
  );
}

export default Chat;