const express = require('express');
const authenticateToken = require('../middleware/auth');
const { exportConversation, getFormatInfo, generateFilename } = require('../utils/exportFormatters');

// Import utilities
const {
  getUserConversations,
  createConversation,
  updateConversationTitle,
  deleteConversation,
  getConversationWithMessages
} = require('../utils/conversationUtils');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET / - Get all conversations for the authenticated user
 */
router.get('/', async (req, res) => {
  try {
    const conversations = await getUserConversations(req.user.id);
    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST / - Create a new conversation
 */
router.post('/', async (req, res) => {
  try {
    const { title } = req.body;

    const conversation = await createConversation(req.user.id, title);
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /:id - Update conversation title
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const updatedConversation = await updateConversationTitle(id, req.user.id, title);
    res.json(updatedConversation);
  } catch (error) {
    console.error('Update conversation error:', error);
    
    if (error.message.includes('Conversation not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /:id - Delete conversation and all its messages
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await deleteConversation(id, req.user.id);
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    
    if (error.message.includes('Conversation not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /:id/export - Export conversation in specified format
 * Supports query parameter: ?format=json|txt|md
 */
router.get('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const format = req.query.format || 'json';

    // Validate format
    const supportedFormats = ['json', 'txt', 'md', 'markdown'];
    if (!supportedFormats.includes(format.toLowerCase())) {
      return res.status(400).json({ 
        error: 'Invalid export format', 
        supportedFormats 
      });
    }

    // Get conversation with messages (validates ownership)
    const { conversation, messages } = await getConversationWithMessages(id, req.user.id);

    // Format the conversation data
    const exportedData = exportConversation(conversation, messages, format);
    const { mimeType } = getFormatInfo(format);
    const filename = generateFilename(conversation, format);

    // Set appropriate headers for file download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Send the formatted data
    if (format.toLowerCase() === 'json') {
      res.json(exportedData);
    } else {
      res.send(exportedData);
    }

  } catch (error) {
    console.error('Export conversation error:', error);
    
    if (error.message.includes('Conversation not found')) {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;