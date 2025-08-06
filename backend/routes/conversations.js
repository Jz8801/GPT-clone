const express = require('express');
const prisma = require('../lib/prisma');
const authenticateToken = require('../middleware/auth');
const { exportConversation, getFormatInfo, generateFilename } = require('../utils/exportFormatters');
const router = express.Router();

router.use(authenticateToken);

router.get('/', async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title } = req.body;

    const conversation = await prisma.conversation.create({
      data: {
        title: title || null,
        userId: req.user.id
      }
    });

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    const conversation = await prisma.conversation.findFirst({
      where: { 
        id: id,
        userId: req.user.id 
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id: id },
      data: { title }
    });

    res.json(updatedConversation);
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: { 
        id: id,
        userId: req.user.id 
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await prisma.conversation.delete({
      where: { id: id }
    });

    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Export conversation in specified format
 * GET /api/conversations/:id/export?format=json|txt|md
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

    // Find conversation and verify ownership
    const conversation = await prisma.conversation.findFirst({
      where: { 
        id: id,
        userId: req.user.id 
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get all messages for this conversation
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        role: true,
        createdAt: true
      }
    });

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
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;