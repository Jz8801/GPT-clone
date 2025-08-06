const prisma = require('../lib/prisma');

/**
 * Conversation management utilities
 */

/**
 * Generate conversation title from content
 * @param {string} content - Message content
 * @param {number} maxLength - Maximum title length (default: 50)
 * @returns {string} - Generated title
 */
const generateConversationTitle = (content, maxLength = 50) => {
  if (!content || !content.trim()) {
    return 'New Conversation';
  }
  
  const trimmed = content.trim();
  return trimmed.length > maxLength ? 
    trimmed.substring(0, maxLength) + '...' : 
    trimmed;
};

/**
 * Find existing conversation or create new one
 * @param {string|null} conversationId - Existing conversation ID or null
 * @param {string} userId - User ID
 * @param {string} content - Message content for title generation
 * @returns {Promise<Object>} - Conversation object
 */
const findOrCreateConversation = async (conversationId, userId, content) => {
  let conversation;
  
  if (conversationId) {
    // Find existing conversation and verify ownership
    conversation = await prisma.conversation.findFirst({
      where: { 
        id: conversationId,
        userId: userId 
      }
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }
  } else {
    // Create new conversation with auto-generated title
    const title = generateConversationTitle(content);
    
    conversation = await prisma.conversation.create({
      data: {
        userId: userId,
        title: title
      }
    });
  }
  
  return conversation;
};

/**
 * Validate conversation ownership
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Conversation object if valid
 * @throws {Error} - If conversation not found or not owned by user
 */
const validateConversationOwnership = async (conversationId, userId) => {
  const conversation = await prisma.conversation.findFirst({
    where: { 
      id: conversationId,
      userId: userId 
    }
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  return conversation;
};

/**
 * Update conversation timestamp
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object>} - Updated conversation
 */
const updateConversationTimestamp = async (conversationId) => {
  return await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() }
  });
};

/**
 * Get user's conversations with latest message
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of conversations with messages
 */
const getUserConversations = async (userId) => {
  return await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    }
  });
};

/**
 * Create new conversation
 * @param {string} userId - User ID
 * @param {string|null} title - Optional title
 * @returns {Promise<Object>} - Created conversation
 */
const createConversation = async (userId, title = null) => {
  return await prisma.conversation.create({
    data: {
      title,
      userId
    }
  });
};

/**
 * Update conversation title
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID (for ownership validation)
 * @param {string} title - New title
 * @returns {Promise<Object>} - Updated conversation
 */
const updateConversationTitle = async (conversationId, userId, title) => {
  // First validate ownership
  await validateConversationOwnership(conversationId, userId);
  
  return await prisma.conversation.update({
    where: { id: conversationId },
    data: { title }
  });
};

/**
 * Delete conversation (cascade deletes messages)
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID (for ownership validation)
 * @returns {Promise<void>}
 */
const deleteConversation = async (conversationId, userId) => {
  // First validate ownership
  await validateConversationOwnership(conversationId, userId);
  
  await prisma.conversation.delete({
    where: { id: conversationId }
  });
};

/**
 * Get conversation with all messages (for export)
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID (for ownership validation)
 * @returns {Promise<Object>} - Conversation with messages
 */
const getConversationWithMessages = async (conversationId, userId) => {
  // First validate ownership
  const conversation = await validateConversationOwnership(conversationId, userId);
  
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      content: true,
      role: true,
      createdAt: true
    }
  });
  
  return { conversation, messages };
};

/**
 * Create conversation response object for API
 * @param {Object} conversation - Conversation from database
 * @returns {Object} - Formatted conversation object
 */
const createConversationResponse = (conversation) => ({
  id: conversation.id,
  title: conversation.title,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt
});

module.exports = {
  generateConversationTitle,
  findOrCreateConversation,
  validateConversationOwnership,
  updateConversationTimestamp,
  getUserConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  getConversationWithMessages,
  createConversationResponse
};