const express = require('express');
const OpenAI = require('openai');
const authenticateToken = require('../middleware/auth');

// Import utilities
const { authenticateFromQuery, authenticateFromHeader } = require('../utils/authUtils');
const { findOrCreateConversation, updateConversationTimestamp } = require('../utils/conversationUtils');
const { 
  createUserMessage, 
  createAssistantMessage, 
  getConversationMessages, 
  formatMessagesForOpenAI,
  validateMessageContent
} = require('../utils/messageUtils');
const {
  handleFileUploadRequest,
  handleStreamingRequest,
  handleChatRequest,
  simulateStreamingFromText,
  processStreamingResponse,
  getErrorMessage
} = require('../utils/openaiUtils');
const {
  setupSSEHeaders,
  sendStartEvent,
  sendChunkEvent,
  sendCompleteEvent,
  sendErrorEvent,
  addStreamDelay
} = require('../utils/streamingUtils');

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Shared streaming message handler for both GET and POST endpoints
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {boolean} isPost - Whether this is a POST request
 */
const handleStreamingMessage = async (req, res, isPost = false) => {
  try {
    // Extract parameters based on request type
    const { conversationId, content, hasFile, filename, mimetype, fileData } = 
      isPost ? req.body : req.query;
    const authorization = isPost ? req.headers.authorization : req.query.authorization;

    // Validate content
    const contentValidation = validateMessageContent(content);
    if (!contentValidation.isValid && (!hasFile || (hasFile !== 'true' && hasFile !== true))) {
      return res.status(400).json({ error: contentValidation.errors[0] });
    }

    // Authenticate user
    const user = isPost 
      ? await authenticateFromHeader(authorization)
      : await authenticateFromQuery(authorization);
    req.user = user;

    // Find or create conversation
    const conversation = await findOrCreateConversation(conversationId, user.id, content);

    // Create user message
    const userMessage = await createUserMessage(content, conversation.id, user.id);

    // Set up Server-Sent Events
    setupSSEHeaders(res);

    // Send initial event
    sendStartEvent(res, userMessage, conversation);

    // Brief delay to ensure frontend is ready
    await addStreamDelay(100);

    // Get conversation history
    const conversationMessages = await getConversationMessages(conversation.id);
    const openaiMessages = formatMessagesForOpenAI(conversationMessages);

    let fullResponse = '';

    // Handle file upload vs text-only requests
    const shouldCheckFile = isPost ? hasFile : hasFile === 'true';
    
    if (shouldCheckFile && fileData && filename) {
      // Handle file upload using OpenAI Responses API
      try {
        fullResponse = await handleFileUploadRequest(openai, content, true, fileData, filename);
        
        // Simulate streaming for consistency
        await simulateStreamingFromText(fullResponse, async (chunk) => {
          sendChunkEvent(res, chunk);
        });
      } catch (openaiError) {
        const errorMessage = getErrorMessage(openaiError);
        sendErrorEvent(res, errorMessage);
        return;
      }
    } else {
      // Handle regular text streaming
      try {
        const stream = await handleStreamingRequest(openai, openaiMessages);
        fullResponse = await processStreamingResponse(stream, async (chunk) => {
          sendChunkEvent(res, chunk);
        });
      } catch (openaiError) {
        const errorMessage = getErrorMessage(openaiError);
        sendErrorEvent(res, errorMessage);
        return;
      }
    }

    // Save assistant response
    const assistantMessage = await createAssistantMessage(fullResponse, conversation.id, user.id);

    // Update conversation timestamp
    await updateConversationTimestamp(conversation.id);

    // Send completion event
    sendCompleteEvent(res, assistantMessage);
    res.end();

  } catch (error) {
    console.error('Stream message error:', error);
    
    // Handle authentication errors
    if (error.message.includes('Authorization required') || error.message.includes('Invalid token')) {
      return res.status(401).json({ error: error.message });
    }
    
    // Handle conversation errors
    if (error.message.includes('Conversation not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    // Handle validation errors
    if (error.message.includes('required') || error.message.includes('invalid')) {
      return res.status(400).json({ error: error.message });
    }
    
    // Generic error for streaming
    if (res.headersSent) {
      sendErrorEvent(res, 'Internal server error');
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

/**
 * GET /stream - EventSource streaming endpoint
 * Used by frontend EventSource for text-only messages
 */
router.get('/stream', async (req, res) => {
  await handleStreamingMessage(req, res, false);
});

/**
 * POST /stream - Fetch-based streaming endpoint  
 * Used for file uploads and messages via fetch API
 */
router.post('/stream', async (req, res) => {
  await handleStreamingMessage(req, res, true);
});

// Apply authentication middleware for non-streaming endpoints
router.use(authenticateToken);

/**
 * GET /:conversationId - Get all messages for a conversation
 */
router.get('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Validate conversation ownership and get messages
    const messages = await require('../utils/messageUtils').getMessagesForUser(conversationId, req.user.id);

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    
    if (error.message.includes('Conversation not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST / - Send message (non-streaming)
 * Legacy endpoint for non-streaming message sending
 */
router.post('/', async (req, res) => {
  try {
    const { conversationId, content } = req.body;

    // Validate content
    const contentValidation = validateMessageContent(content);
    if (!contentValidation.isValid) {
      return res.status(400).json({ error: contentValidation.errors[0] });
    }

    // Find or create conversation
    const conversation = await findOrCreateConversation(conversationId, req.user.id, content);

    // Create user message
    const userMessage = await createUserMessage(content, conversation.id, req.user.id);

    // Get conversation history and format for OpenAI
    const conversationMessages = await getConversationMessages(conversation.id);
    const openaiMessages = formatMessagesForOpenAI(conversationMessages);

    // Get AI response
    let aiResponse;
    try {
      aiResponse = await handleChatRequest(openai, openaiMessages);
    } catch (openaiError) {
      aiResponse = getErrorMessage(openaiError);
    }

    // Create assistant message
    const assistantMessage = await createAssistantMessage(aiResponse, conversation.id, req.user.id);

    // Update conversation timestamp
    await updateConversationTimestamp(conversation.id);

    res.json({
      userMessage,
      assistantMessage,
      conversationId: conversation.id
    });

  } catch (error) {
    console.error('Send message error:', error);
    
    if (error.message.includes('Conversation not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    if (error.message.includes('required') || error.message.includes('invalid')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;