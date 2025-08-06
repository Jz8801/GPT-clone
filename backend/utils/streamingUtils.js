/**
 * Server-Sent Events (SSE) utilities for real-time streaming
 */

/**
 * Set up Server-Sent Events headers
 * @param {Response} res - Express response object
 * @returns {void}
 */
const setupSSEHeaders = (res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });
};

/**
 * Send SSE event to client
 * @param {Response} res - Express response object
 * @param {string} type - Event type
 * @param {any} data - Event data (will be JSON stringified)
 * @returns {void}
 */
const sendSSEEvent = (res, type, data) => {
  const eventData = { type, ...data };
  res.write(`data: ${JSON.stringify(eventData)}\n\n`);
};

/**
 * Send start event for streaming
 * @param {Response} res - Express response object
 * @param {Object} userMessage - User message object
 * @param {Object} conversation - Conversation object
 * @returns {void}
 */
const sendStartEvent = (res, userMessage, conversation) => {
  sendSSEEvent(res, 'start', {
    userMessage,
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    }
  });
};

/**
 * Send chunk event for streaming content
 * @param {Response} res - Express response object
 * @param {string} content - Content chunk
 * @returns {void}
 */
const sendChunkEvent = (res, content) => {
  sendSSEEvent(res, 'chunk', { content });
};

/**
 * Send complete event when streaming is finished
 * @param {Response} res - Express response object
 * @param {Object} assistantMessage - Assistant message object
 * @returns {void}
 */
const sendCompleteEvent = (res, assistantMessage) => {
  sendSSEEvent(res, 'complete', { assistantMessage });
};

/**
 * Send error event and close stream
 * @param {Response} res - Express response object
 * @param {string|Error} error - Error message or Error object
 * @returns {void}
 */
const sendErrorEvent = (res, error) => {
  const errorMessage = error instanceof Error ? error.message : error;
  sendSSEEvent(res, 'error', { error: errorMessage });
  res.end();
};

/**
 * Handle streaming error and send appropriate response
 * @param {Response} res - Express response object
 * @param {Error} error - Error object
 * @param {string} fallbackMessage - Fallback error message
 * @returns {void}
 */
const handleStreamError = (res, error, fallbackMessage = 'Internal server error') => {
  console.error('Stream error:', error);
  sendErrorEvent(res, fallbackMessage);
};

/**
 * Add a small delay for frontend synchronization
 * @param {number} ms - Delay in milliseconds (default: 100)
 * @returns {Promise<void>}
 */
const addStreamDelay = (ms = 100) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Send heartbeat event to keep connection alive
 * @param {Response} res - Express response object
 * @returns {void}
 */
const sendHeartbeat = (res) => {
  res.write(': heartbeat\n\n');
};

/**
 * Set up heartbeat interval for long connections
 * @param {Response} res - Express response object
 * @param {number} interval - Interval in milliseconds (default: 30000)
 * @returns {NodeJS.Timer} - Interval ID for cleanup
 */
const setupHeartbeat = (res, interval = 30000) => {
  return setInterval(() => {
    sendHeartbeat(res);
  }, interval);
};

/**
 * Close SSE stream properly
 * @param {Response} res - Express response object
 * @param {NodeJS.Timer|null} heartbeatInterval - Heartbeat interval to clear
 * @returns {void}
 */
const closeStream = (res, heartbeatInterval = null) => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  res.end();
};

/**
 * Validate SSE event data
 * @param {string} type - Event type
 * @param {any} data - Event data
 * @returns {boolean} - True if valid
 */
const validateSSEEvent = (type, data) => {
  const validTypes = ['start', 'chunk', 'complete', 'error', 'heartbeat'];
  
  if (!validTypes.includes(type)) {
    console.warn(`Invalid SSE event type: ${type}`);
    return false;
  }
  
  if (type !== 'heartbeat' && data === undefined) {
    console.warn(`SSE event ${type} missing data`);
    return false;
  }
  
  return true;
};

/**
 * Create SSE event formatter function
 * @param {Response} res - Express response object
 * @returns {Function} - Event formatter function
 */
const createEventFormatter = (res) => {
  return (type, data) => {
    if (validateSSEEvent(type, data)) {
      sendSSEEvent(res, type, data);
    }
  };
};

/**
 * Handle client disconnect gracefully
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} cleanup - Cleanup function to call on disconnect
 * @returns {void}
 */
const handleClientDisconnect = (req, res, cleanup) => {
  const onDisconnect = () => {
    console.log('Client disconnected from SSE stream');
    if (cleanup) cleanup();
  };
  
  req.on('close', onDisconnect);
  req.on('aborted', onDisconnect);
  res.on('close', onDisconnect);
};

/**
 * Create complete streaming handler with error handling
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} streamHandler - Function that handles the actual streaming
 * @returns {Promise<void>}
 */
const createStreamingHandler = async (req, res, streamHandler) => {
  let heartbeatInterval = null;
  
  try {
    // Set up SSE
    setupSSEHeaders(res);
    
    // Set up heartbeat
    heartbeatInterval = setupHeartbeat(res);
    
    // Handle client disconnect
    handleClientDisconnect(req, res, () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    });
    
    // Execute the streaming logic
    await streamHandler(res);
    
  } catch (error) {
    handleStreamError(res, error);
  } finally {
    closeStream(res, heartbeatInterval);
  }
};

module.exports = {
  setupSSEHeaders,
  sendSSEEvent,
  sendStartEvent,
  sendChunkEvent,
  sendCompleteEvent,
  sendErrorEvent,
  handleStreamError,
  addStreamDelay,
  sendHeartbeat,
  setupHeartbeat,
  closeStream,
  validateSSEEvent,
  createEventFormatter,
  handleClientDisconnect,
  createStreamingHandler
};