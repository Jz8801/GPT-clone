/**
 * File handling utilities for the GPT clone application
 * Handles file validation, processing, and OpenAI API interactions
 */

const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Supported file types and their configurations
 */
const SUPPORTED_FILE_TYPES = {
  'application/pdf': { extension: '.pdf', name: 'PDF' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: '.docx', name: 'Word Document' },
  'application/msword': { extension: '.doc', name: 'Word Document (Legacy)' },
  'text/plain': { extension: '.txt', name: 'Plain Text' },
  'text/csv': { extension: '.csv', name: 'CSV' },
  'application/json': { extension: '.json', name: 'JSON' }
};

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Validates if a file type is supported
 * @param {string} mimetype - The MIME type of the file
 * @returns {boolean} - Whether the file type is supported
 */
function isFileTypeSupported(mimetype) {
  return Object.keys(SUPPORTED_FILE_TYPES).includes(mimetype);
}

/**
 * Validates file size
 * @param {number} size - File size in bytes
 * @returns {boolean} - Whether the file size is within limits
 */
function isFileSizeValid(size) {
  return size <= MAX_FILE_SIZE;
}

/**
 * Creates a user-friendly error message for file validation errors
 * @param {string} type - Error type ('size', 'type', 'missing')
 * @param {object} fileInfo - File information
 * @returns {string} - Error message
 */
function createFileValidationError(type, fileInfo = {}) {
  switch (type) {
    case 'size':
      return `File "${fileInfo.filename}" is too large. Maximum size is 10MB.`;
    case 'type':
      return `File type "${fileInfo.mimetype}" is not supported. Supported types: PDF, Word documents, Text files, CSV, JSON.`;
    case 'missing':
      return 'File data is missing or corrupted.';
    default:
      return 'File validation failed.';
  }
}

/**
 * Processes a file upload with OpenAI Responses API
 * @param {object} fileData - File data object
 * @param {string} fileData.filename - Name of the file
 * @param {string} fileData.mimetype - MIME type of the file
 * @param {string} fileData.base64Data - Base64 encoded file data
 * @param {string} textContent - Additional text content from user
 * @returns {Promise<string>} - OpenAI response text
 */
async function processFileWithOpenAI(fileData, textContent = '') {
  const { filename, mimetype, base64Data } = fileData;

  // Validate file type
  if (!isFileTypeSupported(mimetype)) {
    throw new Error(createFileValidationError('type', { mimetype }));
  }

  // Validate file data presence
  if (!base64Data) {
    throw new Error(createFileValidationError('missing'));
  }

  try {
    const response = await openai.responses.create({
      model: "gpt-4o",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: filename,
              file_data: base64Data
            },
            {
              type: "input_text",
              text: textContent || "Please analyze this file."
            }
          ]
        }
      ]
    });

    return response.output_text;
  } catch (error) {
    // Re-throw with more context
    if (error.message.includes('rate_limit_exceeded')) {
      throw new Error('OpenAI rate limit exceeded. Please try again in a few minutes.');
    } else if (error.message.includes('Request too large')) {
      throw new Error('File is too large for processing. Please try with a smaller file.');
    } else {
      throw new Error(`File processing failed: ${error.message}`);
    }
  }
}

/**
 * Gets supported file types information
 * @returns {object} - Supported file types configuration
 */
function getSupportedFileTypes() {
  return {
    supportedTypes: Object.entries(SUPPORTED_FILE_TYPES).map(([mimetype, info]) => ({
      type: info.name,
      mimetype,
      extension: info.extension
    })),
    maxFileSize: '10MB'
  };
}

module.exports = {
  isFileTypeSupported,
  isFileSizeValid,
  createFileValidationError,
  processFileWithOpenAI,
  getSupportedFileTypes,
  SUPPORTED_FILE_TYPES,
  MAX_FILE_SIZE
};