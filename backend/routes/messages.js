const express = require('express');
const OpenAI = require('openai');
const prisma = require('../lib/prisma');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.use(authenticateToken);

router.get('/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const conversation = await prisma.conversation.findFirst({
      where: { 
        id: conversationId,
        userId: req.user.id 
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: conversationId },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { conversationId, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    let conversation;
    if (conversationId) {
      conversation = await prisma.conversation.findFirst({
        where: { 
          id: conversationId,
          userId: req.user.id 
        }
      });

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    } else {
      conversation = await prisma.conversation.create({
        data: {
          userId: req.user.id,
          title: content.substring(0, 50) + (content.length > 50 ? '...' : '')
        }
      });
    }

    const userMessage = await prisma.message.create({
      data: {
        content: content.trim(),
        role: 'user',
        conversationId: conversation.id,
        userId: req.user.id
      }
    });

    const conversationMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' }
    });

    const openaiMessages = conversationMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    let aiResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: openaiMessages,
          max_tokens: 500,
          temperature: 0.7,
        });

        aiResponse = completion.choices[0].message.content;
        break;
      } catch (openaiError) {
        console.error(`OpenAI API error (attempt ${retryCount + 1}):`, openaiError);
        retryCount++;
        
        if (retryCount === maxRetries) {
          aiResponse = "I'm sorry, I'm experiencing technical difficulties. Please try again later.";
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    const assistantMessage = await prisma.message.create({
      data: {
        content: aiResponse,
        role: 'assistant',
        conversationId: conversation.id,
        userId: req.user.id
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });

    res.json({
      userMessage,
      assistantMessage,
      conversationId: conversation.id
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;