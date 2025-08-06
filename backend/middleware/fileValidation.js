const path = require('path');
const crypto = require('crypto');

const ALLOWED_MIMETYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
  'application/json'
];

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.doc',
  '.txt',
  '.csv',
  '.json'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const validateFileType = (file) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;
  
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    throw new Error(`File extension '${fileExtension}' is not allowed`);
  }
  
  if (!ALLOWED_MIMETYPES.includes(mimeType)) {
    throw new Error(`File type '${mimeType}' is not allowed`);
  }
  
  const expectedMimeTypes = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json'
  };
  
  if (expectedMimeTypes[fileExtension] !== mimeType) {
    throw new Error('File extension and MIME type do not match');
  }
  
  return true;
};

const validateFileSize = (file) => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
  }
  return true;
};

const sanitizeFilename = (originalName) => {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);
  
  const sanitizedBaseName = baseName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 50);
  
  return `${sanitizedBaseName}_${timestamp}_${randomBytes}${extension}`;
};

const validateFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }
  
  try {
    validateFileType(req.file);
    validateFileSize(req.file);
    
    req.file.sanitizedName = sanitizeFilename(req.file.originalname);
    
    next();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

module.exports = {
  validateFile,
  validateFileType,
  validateFileSize,
  sanitizeFilename,
  ALLOWED_MIMETYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE
};