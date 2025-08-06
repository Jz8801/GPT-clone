import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import ExportModal from './ExportModal';
import { 
  Plus, 
  MessageCircle, 
  Sun, 
  Moon, 
  LogOut, 
  Trash2,
  Search,
  Download
} from 'lucide-react';

function Sidebar({ 
  conversations, 
  filteredConversations, 
  currentConversation, 
  searchQuery, 
  onNewChat, 
  onSearchChange, 
  onConversationSelect, 
  onDeleteConversation, 
  onExportConversation,
  onLogout 
}) {
  const { isDarkMode, toggleTheme } = useTheme();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [conversationToExport, setConversationToExport] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportClick = (conversation, e) => {
    e.stopPropagation();
    setConversationToExport(conversation);
    setExportModalOpen(true);
  };

  const handleExport = async (conversationId, format, conversation) => {
    setIsExporting(true);
    try {
      await onExportConversation(conversationId, format, conversation);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button onClick={onNewChat} className="new-chat-btn">
          <Plus size={16} />
          New chat
        </button>
        
        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
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
              onClick={() => onConversationSelect(conv)}
            >
              <MessageCircle size={16} />
              <span className="conversation-title">{conv.title || 'New Conversation'}</span>
              <div className="conversation-actions">
                <button
                  className="export-conversation-btn"
                  onClick={(e) => handleExportClick(conv, e)}
                  title="Export conversation"
                >
                  <Download size={14} />
                </button>
                <button
                  className="delete-conversation-btn"
                  onClick={(e) => onDeleteConversation(conv.id, e)}
                  title="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
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
        
        <button onClick={onLogout} className="logout-btn" title="Logout">
          <LogOut size={16} />
        </button>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => {
          setExportModalOpen(false);
          setConversationToExport(null);
        }}
        onExport={handleExport}
        conversation={conversationToExport}
        isExporting={isExporting}
      />
    </div>
  );
}

export default Sidebar;