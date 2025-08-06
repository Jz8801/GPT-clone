/**
 * Error handling utilities for the GPT clone application
 * Provides standardized error handling and user-friendly error messages
 */

/**
 * Error types that can occur in the application
 */
const ERROR_TYPES = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  OPENAI_API: 'openai_api',
  FILE_PROCESSING: 'file_processing',
  DATABASE: 'database',
  INTERNAL: 'internal'
};

/**
 * HTTP status codes for different error types
 */
const ERROR_STATUS_CODES = {
  [ERROR_TYPES.VALIDATION]: 400,
  [ERROR_TYPES.AUTHENTICATION]: 401,
  [ERROR_TYPES.AUTHORIZATION]: 403,
  [ERROR_TYPES.NOT_FOUND]: 404,
  [ERROR_TYPES.OPENAI_API]: 429, // Rate limit or API error
  [ERROR_TYPES.FILE_PROCESSING]: 422,
  [ERROR_TYPES.DATABASE]: 500,
  [ERROR_TYPES.INTERNAL]: 500
};

/**
 * Creates a standardized error object
 * @param {string} type - Error type from ERROR_TYPES
 * @param {string} message - Error message
 * @param {object} details - Additional error details
 * @returns {object} - Standardized error object
 */
function createError(type, message, details = {}) {
  return {
    type,
    message,
    statusCode: ERROR_STATUS_CODES[type] || 500,
    details,
    timestamp: new Date().toISOString()
  };
}

/**
 * Handles OpenAI API errors and converts them to user-friendly messages
 * @param {object} openaiError - OpenAI API error object
 * @returns {object} - Standardized error object
 */
function handleOpenAIError(openaiError) {
  const errorMessage = openaiError.message || 'OpenAI API error occurred';
  
  if (errorMessage.includes('rate_limit_exceeded')) {
    return createError(
      ERROR_TYPES.OPENAI_API,
      'I\'m currently experiencing high demand. Please try again in a few minutes.',
      { originalError: errorMessage }
    );
  }
  
  if (errorMessage.includes('Request too large') || errorMessage.includes('tokens per min')) {
    return createError(
      ERROR_TYPES.OPENAI_API,
      'The file is too large or I\'m currently experiencing high demand. Please try with a smaller file or try again in a few minutes.',
      { originalError: errorMessage }
    );
  }
  
  if (errorMessage.includes('Invalid API key')) {
    return createError(
      ERROR_TYPES.OPENAI_API,
      'API configuration error. Please contact support.',
      { originalError: errorMessage }
    );
  }
  
  return createError(
    ERROR_TYPES.OPENAI_API,
    'I encountered an issue processing your request. Please try again.',
    { originalError: errorMessage }
  );
}

/**
 * Handles JWT authentication errors
 * @param {object} jwtError - JWT error object
 * @returns {object} - Standardized error object
 */
function handleJWTError(jwtError) {
  if (jwtError.name === 'TokenExpiredError') {
    return createError(
      ERROR_TYPES.AUTHENTICATION,
      'Your session has expired. Please log in again.',
      { originalError: jwtError.message }
    );
  }
  
  if (jwtError.name === 'JsonWebTokenError') {
    return createError(
      ERROR_TYPES.AUTHENTICATION,
      'Invalid authentication token. Please log in again.',
      { originalError: jwtError.message }
    );
  }
  
  return createError(
    ERROR_TYPES.AUTHENTICATION,
    'Authentication failed. Please log in again.',
    { originalError: jwtError.message }
  );
}

/**
 * Handles database errors
 * @param {object} dbError - Database error object
 * @returns {object} - Standardized error object
 */
function handleDatabaseError(dbError) {
  if (dbError.code === 'P2002') { // Unique constraint violation
    return createError(
      ERROR_TYPES.VALIDATION,
      'A record with this information already exists.',
      { originalError: dbError.message }
    );
  }
  
  if (dbError.code === 'P2025') { // Record not found
    return createError(
      ERROR_TYPES.NOT_FOUND,
      'The requested resource was not found.',
      { originalError: dbError.message }
    );
  }
  
  return createError(
    ERROR_TYPES.DATABASE,
    'A database error occurred. Please try again.',
    { originalError: dbError.message }
  );
}

/**
 * Logs an error with appropriate severity
 * @param {object} error - Error object
 * @param {string} context - Context where the error occurred
 */
function logError(error, context = '') {
  const logData = {
    context,
    type: error.type || 'unknown',
    message: error.message,
    statusCode: error.statusCode,
    timestamp: error.timestamp || new Date().toISOString(),
    details: error.details
  };
  
  // In production, you might want to use a proper logging service
  console.error(`[${logData.timestamp}] ${logData.type.toUpperCase()} in ${context}:`, logData);
}

/**
 * Sends a standardized error response
 * @param {object} res - Express response object
 * @param {object} error - Standardized error object
 * @param {string} context - Context for logging
 */
function sendErrorResponse(res, error, context = '') {
  logError(error, context);
  
  // Don't expose internal error details in production
  const response = {
    error: error.message,
    type: error.type,
    timestamp: error.timestamp
  };
  
  // Only include details in development
  if (process.env.NODE_ENV === 'development') {
    response.details = error.details;
  }
  
  res.status(error.statusCode).json(response);
}

/**
 * Wraps an async function to handle errors automatically
 * @param {function} fn - Async function to wrap
 * @returns {function} - Wrapped function
 */
function asyncErrorHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  ERROR_TYPES,
  ERROR_STATUS_CODES,
  createError,
  handleOpenAIError,
  handleJWTError,
  handleDatabaseError,
  logError,
  sendErrorResponse,
  asyncErrorHandler
};