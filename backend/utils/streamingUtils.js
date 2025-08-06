/**
 * Server-Sent Events (SSE) streaming utilities
 * Handles streaming responses for real-time communication with the frontend
 */

/**
 * Sets up SSE headers for a response
 * @param {object} res - Express response object
 */
function setupSSEHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
}

/**
 * Sends an SSE event to the client
 * @param {object} res - Express response object
 * @param {string} type - Event type ('start', 'chunk', 'complete', 'error')
 * @param {object} data - Event data
 */
function sendSSEEvent(res, type, data) {
  const eventData = JSON.stringify({ type, ...data });
  res.write(`data: ${eventData}\n\n`);
}

/**
 * Sends the initial start event with conversation and user message info
 * @param {object} res - Express response object
 * @param {object} userMessage - Created user message
 * @param {object} conversation - Conversation object
 */
function sendStartEvent(res, userMessage, conversation) {
  sendSSEEvent(res, 'start', {
    userMessage,
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    }
  });
}

/**
 * Sends a content chunk event
 * @param {object} res - Express response object
 * @param {string} content - Content chunk
 */
function sendChunkEvent(res, content) {
  sendSSEEvent(res, 'chunk', { content });
}

/**
 * Sends the completion event with the final assistant message
 * @param {object} res - Express response object
 * @param {object} assistantMessage - Final assistant message from database
 */
function sendCompleteEvent(res, assistantMessage) {
  sendSSEEvent(res, 'complete', { assistantMessage });
}

/**
 * Sends an error event
 * @param {object} res - Express response object
 * @param {string} errorMessage - Error message to send
 */
function sendErrorEvent(res, errorMessage) {
  sendSSEEvent(res, 'error', { error: errorMessage });
}

/**
 * Simulates streaming by breaking text into chunks
 * @param {object} res - Express response object
 * @param {string} text - Full text to stream
 * @param {number} delayMs - Delay between chunks in milliseconds (default: 50)
 */
async function simulateTextStreaming(res, text, delayMs = 50) {
  const words = text.split(' ');
  
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? words[i] : ' ' + words[i]);
    sendChunkEvent(res, chunk);
    
    // Add delay to simulate streaming
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

/**
 * Handles OpenAI streaming response
 * @param {object} res - Express response object
 * @param {object} stream - OpenAI stream object
 * @returns {Promise<string>} - Full response text
 */
async function handleOpenAIStream(res, stream) {
  let fullResponse = '';

  for await (const chunk of stream) {
    const chunkContent = chunk.choices[0]?.delta?.content || '';
    if (chunkContent) {
      fullResponse += chunkContent;
      sendChunkEvent(res, chunkContent);
    }
  }

  return fullResponse;
}

/**
 * Safely ends an SSE stream
 * @param {object} res - Express response object
 */
function endSSEStream(res) {
  try {
    res.end();
  } catch (error) {
    // Stream may have already been closed
    console.warn('Failed to end SSE stream:', error.message);
  }
}

module.exports = {
  setupSSEHeaders,
  sendSSEEvent,
  sendStartEvent,
  sendChunkEvent,
  sendCompleteEvent,
  sendErrorEvent,
  simulateTextStreaming,
  handleOpenAIStream,
  endSSEStream
};