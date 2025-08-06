/**
 * OpenAI API utilities with retry logic and file handling
 */

/**
 * Call OpenAI API with retry logic and exponential backoff
 * @param {Function} openaiCall - Function that returns OpenAI API call promise
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<any>} - OpenAI API response
 */
const callOpenAIWithRetry = async (openaiCall, maxRetries = 3) => {
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      return await openaiCall();
    } catch (openaiError) {
      console.error(`OpenAI API error (attempt ${retryCount + 1}):`, openaiError);
      retryCount++;
      
      if (retryCount === maxRetries) {
        // Re-throw the error after all retries exhausted
        throw openaiError;
      } else {
        // Exponential backoff: wait longer between each retry attempt
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
  }
};

/**
 * Handle file upload request using OpenAI Responses API
 * @param {OpenAI} openai - OpenAI client instance
 * @param {string} content - Text content from user
 * @param {boolean} hasFile - Whether file is present
 * @param {string} fileData - Base64 file data
 * @param {string} filename - Original filename
 * @returns {Promise<string>} - Complete response text
 */
const handleFileUploadRequest = async (openai, content, hasFile, fileData, filename) => {
  if (!hasFile || !fileData || !filename) {
    throw new Error('File data is required for file upload requests');
  }

  const openaiCall = () => openai.responses.create({
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

  const response = await callOpenAIWithRetry(openaiCall);
  return response.output_text;
};

/**
 * Handle streaming chat request
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Array} messages - Array of messages formatted for OpenAI
 * @param {Object} options - Chat options (model, max_tokens, temperature, etc.)
 * @returns {Promise<AsyncIterable>} - Streaming response
 */
const handleStreamingRequest = async (openai, messages, options = {}) => {
  const defaultOptions = {
    model: "gpt-3.5-turbo",
    max_tokens: 500,
    temperature: 0.7,
    stream: true
  };

  const openaiCall = () => openai.chat.completions.create({
    ...defaultOptions,
    ...options,
    messages
  });

  return await callOpenAIWithRetry(openaiCall);
};

/**
 * Handle non-streaming chat request
 * @param {OpenAI} openai - OpenAI client instance
 * @param {Array} messages - Array of messages formatted for OpenAI
 * @param {Object} options - Chat options (model, max_tokens, temperature, etc.)
 * @returns {Promise<string>} - Complete response text
 */
const handleChatRequest = async (openai, messages, options = {}) => {
  const defaultOptions = {
    model: "gpt-3.5-turbo",
    max_tokens: 500,
    temperature: 0.7,
    stream: false
  };

  const openaiCall = () => openai.chat.completions.create({
    ...defaultOptions,
    ...options,
    messages
  });

  const completion = await callOpenAIWithRetry(openaiCall);
  return completion.choices[0].message.content;
};

/**
 * Simulate streaming response from complete text (for file responses)
 * @param {string} text - Complete response text
 * @param {Function} onChunk - Callback for each chunk (chunk) => void
 * @param {number} delay - Delay between chunks in ms (default: 50)
 * @returns {Promise<void>}
 */
const simulateStreamingFromText = async (text, onChunk, delay = 50) => {
  const words = text.split(' ');
  
  for (let i = 0; i < words.length; i++) {
    const chunk = (i === 0 ? words[i] : ' ' + words[i]);
    await onChunk(chunk);
    
    // Small delay to simulate real streaming experience
    if (i < words.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

/**
 * Process streaming chunks and accumulate full response
 * @param {AsyncIterable} stream - OpenAI streaming response
 * @param {Function} onChunk - Callback for each chunk (chunk) => void
 * @returns {Promise<string>} - Complete accumulated response
 */
const processStreamingResponse = async (stream, onChunk) => {
  let fullResponse = '';
  
  for await (const chunk of stream) {
    const chunkContent = chunk.choices[0]?.delta?.content || '';
    if (chunkContent) {
      fullResponse += chunkContent;
      await onChunk(chunkContent);
    }
  }
  
  return fullResponse;
};

/**
 * Get default error message for failed API calls
 * @param {Error} error - OpenAI API error
 * @returns {string} - User-friendly error message
 */
const getErrorMessage = (error) => {
  // Check for specific error types and return appropriate messages
  if (error.message?.includes('rate_limit_exceeded')) {
    return "I'm currently experiencing high demand. Please try again in a few minutes.";
  }
  
  if (error.message?.includes('insufficient_quota')) {
    return "API quota exceeded. Please contact support.";
  }
  
  if (error.message?.includes('invalid_request_error')) {
    return "Invalid request. Please check your message and try again.";
  }
  
  if (error.message?.includes('timeout')) {
    return "Request timed out. Please try again.";
  }
  
  // Default fallback message
  return "I'm sorry, I'm experiencing technical difficulties. Please try again later.";
};

/**
 * Validate OpenAI API configuration
 * @returns {boolean} - True if API key is configured
 */
const isOpenAIConfigured = () => {
  return Boolean(process.env.OPENAI_API_KEY);
};

/**
 * Get OpenAI models configuration
 * @returns {Object} - Model configuration object
 */
const getModelConfig = () => ({
  textOnly: "gpt-3.5-turbo",
  fileUpload: "gpt-4o",
  maxTokens: 500,
  temperature: 0.7
});

module.exports = {
  callOpenAIWithRetry,
  handleFileUploadRequest,
  handleStreamingRequest,
  handleChatRequest,
  simulateStreamingFromText,
  processStreamingResponse,
  getErrorMessage,
  isOpenAIConfigured,
  getModelConfig
};