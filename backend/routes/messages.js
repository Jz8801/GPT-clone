const express = require('express');
const OpenAI = require('openai');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const authenticateToken = require('../middleware/auth');
const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Streaming endpoint (before auth middleware to handle custom auth)
router.get('/stream', async (req, res) => {
  try {
    const { conversationId, content, authorization, hasFile, filename, mimetype, fileData } = req.query;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Handle authentication for EventSource
    if (!authorization) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authorization.replace('Bearer ', '');
    
    let user;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Validate user exists in database (matching auth middleware)
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;

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
      const generatedTitle = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      
      conversation = await prisma.conversation.create({
        data: {
          userId: req.user.id,
          title: generatedTitle
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

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial data
    res.write(`data: ${JSON.stringify({
      type: 'start',
      userMessage,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    })}\n\n`);

    // Small delay to ensure frontend is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    const conversationMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' }
    });

    const openaiMessages = conversationMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    let fullResponse = '';
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        if (hasFile === 'true' && fileData && filename) {
          // Use OpenAI Responses API for file + text
          const response = await openai.responses.create({
            model: "gpt-4o",
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_file",
                    filename: filename,
                    file_data: fileData
                  },
                  {
                    type: "input_text",
                    text: content || "Please analyze this file."
                  }
                ]
              }
            ]
          });

          fullResponse = response.output_text;
          
          // Send the complete response as chunks for consistency with streaming
          const words = fullResponse.split(' ');
          for (let i = 0; i < words.length; i++) {
            const chunk = (i === 0 ? words[i] : ' ' + words[i]);
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: chunk
            })}\n\n`);
            // Small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } else {
          // Use regular chat completions for text-only messages
          const stream = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: openaiMessages,
            max_tokens: 500,
            temperature: 0.7,
            stream: true,
          });

          for await (const chunk of stream) {
            const chunkContent = chunk.choices[0]?.delta?.content || '';
            if (chunkContent) {
              fullResponse += chunkContent;
              res.write(`data: ${JSON.stringify({
                type: 'chunk',
                content: chunkContent
              })}\n\n`);
            }
          }
        }
        break;
      } catch (openaiError) {
        console.error(`OpenAI API error (attempt ${retryCount + 1}):`, openaiError);
        retryCount++;
        
        if (retryCount === maxRetries) {
          fullResponse = "I'm sorry, I'm experiencing technical difficulties. Please try again later.";
          res.write(`data: ${JSON.stringify({
            type: 'chunk',
            content: fullResponse
          })}\n\n`);
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    // Save the complete response to database
    const assistantMessage = await prisma.message.create({
      data: {
        content: fullResponse,
        role: 'assistant',
        conversationId: conversation.id,
        userId: req.user.id
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });

    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      assistantMessage
    })}\n\n`);

    res.end();
  } catch (error) {
    console.error('Stream message error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Internal server error'
    })}\n\n`);
    res.end();
  }
});

// POST endpoint for file uploads with streaming
router.post('/stream', async (req, res) => {
  try {
    const { conversationId, content, hasFile, filename, mimetype, fileData } = req.body;

    if ((!content || !content.trim()) && !hasFile) {
      return res.status(400).json({ error: 'Message content or file is required' });
    }

    // Handle authentication for POST requests
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    let user;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Validate user exists in database (matching auth middleware)
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;

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
      const generatedTitle = content.substring(0, 50) + (content.length > 50 ? '...' : '');
      
      conversation = await prisma.conversation.create({
        data: {
          userId: req.user.id,
          title: generatedTitle
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

    // Set up Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Send initial data
    res.write(`data: ${JSON.stringify({
      type: 'start',
      userMessage,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    })}\n\n`);

    // Small delay to ensure frontend is ready
    await new Promise(resolve => setTimeout(resolve, 100));

    const conversationMessages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' }
    });

    const openaiMessages = conversationMessages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    let fullResponse = '';
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        if (hasFile && fileData && filename) {
          // Use OpenAI Responses API for file + text
          const response = await openai.responses.create({
            model: "gpt-4o",
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_file",
                    filename: filename,
                    file_data: fileData
                  },
                  {
                    type: "input_text",
                    text: content || "Please analyze this file."
                  }
                ]
              }
            ]
          });

          fullResponse = response.output_text;
          
          // Send the complete response as chunks for consistency with streaming
          const words = fullResponse.split(' ');
          for (let i = 0; i < words.length; i++) {
            const chunk = (i === 0 ? words[i] : ' ' + words[i]);
            res.write(`data: ${JSON.stringify({
              type: 'chunk',
              content: chunk
            })}\n\n`);
            // Small delay to simulate streaming
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } else {
          // Use regular chat completions for text-only messages
          const stream = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: openaiMessages,
            max_tokens: 500,
            temperature: 0.7,
            stream: true,
          });

          for await (const chunk of stream) {
            const chunkContent = chunk.choices[0]?.delta?.content || '';
            if (chunkContent) {
              fullResponse += chunkContent;
              res.write(`data: ${JSON.stringify({
                type: 'chunk',
                content: chunkContent
              })}\n\n`);
            }
          }
        }
        break;
      } catch (openaiError) {
        console.error(`OpenAI API error (attempt ${retryCount + 1}):`, openaiError);
        retryCount++;
        
        if (retryCount === maxRetries) {
          // Send error event to frontend instead of trying to continue
          res.write(`data: ${JSON.stringify({
            type: 'error',
            error: openaiError.message || 'OpenAI API error occurred'
          })}\n\n`);
          res.end();
          return;
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
    }

    // Save the complete response to database
    const assistantMessage = await prisma.message.create({
      data: {
        content: fullResponse,
        role: 'assistant',
        conversationId: conversation.id,
        userId: req.user.id
      }
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() }
    });

    // Send completion event
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      assistantMessage
    })}\n\n`);

    res.end();
  } catch (error) {
    console.error('Stream message error:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Internal server error'
    })}\n\n`);
    res.end();
  }
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