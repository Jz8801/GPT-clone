const prisma = require('../lib/prisma');

/**
 * Message management utilities
 */

/**
 * Create user message in database
 * @param {string} content - Message content
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Created message object
 */
const createUserMessage = async (content, conversationId, userId) => {
  return await prisma.message.create({
    data: {
      content: content.trim(),
      role: 'user',
      conversationId,
      userId
    }
  });
};

/**
 * Create assistant message in database
 * @param {string} content - Message content
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Created message object
 */
const createAssistantMessage = async (content, conversationId, userId) => {
  return await prisma.message.create({
    data: {
      content,
      role: 'assistant',
      conversationId,
      userId
    }
  });
};

/**
 * Get all messages for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Array>} - Array of messages ordered by creation time
 */
const getConversationMessages = async (conversationId) => {
  return await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' }
  });
};

/**
 * Format messages for OpenAI API
 * @param {Array} messages - Array of message objects from database
 * @returns {Array} - Array formatted for OpenAI API
 */
const formatMessagesForOpenAI = (messages) => {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content
  }));
};

/**
 * Get messages for a specific conversation with user validation
 * @param {string} conversationId - Conversation ID
 * @param {string} userId - User ID for validation
 * @returns {Promise<Array>} - Array of messages
 */
const getMessagesForUser = async (conversationId, userId) => {
  // First verify user has access to this conversation
  const conversation = await prisma.conversation.findFirst({
    where: { 
      id: conversationId,
      userId: userId 
    }
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  return await getConversationMessages(conversationId);
};

/**
 * Delete all messages for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<number>} - Number of deleted messages
 */
const deleteConversationMessages = async (conversationId) => {
  const result = await prisma.message.deleteMany({
    where: { conversationId }
  });
  
  return result.count;
};

/**
 * Get message count for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<number>} - Number of messages
 */
const getMessageCount = async (conversationId) => {
  return await prisma.message.count({
    where: { conversationId }
  });
};

/**
 * Get latest message for a conversation
 * @param {string} conversationId - Conversation ID
 * @returns {Promise<Object|null>} - Latest message or null if none
 */
const getLatestMessage = async (conversationId) => {
  return await prisma.message.findFirst({
    where: { conversationId },
    orderBy: { createdAt: 'desc' }
  });
};

/**
 * Update message content
 * @param {string} messageId - Message ID
 * @param {string} content - New content
 * @param {string} userId - User ID for validation
 * @returns {Promise<Object>} - Updated message
 */
const updateMessage = async (messageId, content, userId) => {
  // First verify user owns this message
  const message = await prisma.message.findFirst({
    where: { 
      id: messageId,
      userId: userId 
    }
  });

  if (!message) {
    throw new Error('Message not found');
  }

  return await prisma.message.update({
    where: { id: messageId },
    data: { content }
  });
};

/**
 * Delete a specific message
 * @param {string} messageId - Message ID
 * @param {string} userId - User ID for validation
 * @returns {Promise<void>}
 */
const deleteMessage = async (messageId, userId) => {
  // First verify user owns this message
  const message = await prisma.message.findFirst({
    where: { 
      id: messageId,
      userId: userId 
    }
  });

  if (!message) {
    throw new Error('Message not found');
  }

  await prisma.message.delete({
    where: { id: messageId }
  });
};

/**
 * Validate message content
 * @param {string} content - Message content
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
const validateMessageContent = (content) => {
  const errors = [];
  
  if (!content || typeof content !== 'string') {
    errors.push('Message content is required');
  } else if (!content.trim()) {
    errors.push('Message content cannot be empty');
  } else if (content.length > 10000) {
    errors.push('Message content is too long (maximum 10,000 characters)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Create message response object for API
 * @param {Object} message - Message from database
 * @returns {Object} - Formatted message object
 */
const createMessageResponse = (message) => ({
  id: message.id,
  content: message.content,
  role: message.role,
  createdAt: message.createdAt,
  conversationId: message.conversationId
});

module.exports = {
  createUserMessage,
  createAssistantMessage,
  getConversationMessages,
  formatMessagesForOpenAI,
  getMessagesForUser,
  deleteConversationMessages,
  getMessageCount,
  getLatestMessage,
  updateMessage,
  deleteMessage,
  validateMessageContent,
  createMessageResponse
};