const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

/**
 * Authentication utilities for handling JWT tokens and user validation
 */

/**
 * Authenticate user from JWT token string
 * @param {string} token - JWT token string (without Bearer prefix)
 * @returns {Promise<Object>} - User object or throws error
 */
const authenticateFromToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Validate user exists in database (matching auth middleware behavior)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true }
    });

    if (!user) {
      throw new Error('Invalid token - user not found');
    }

    return user;
  } catch (jwtError) {
    throw new Error('Invalid token');
  }
};

/**
 * Authenticate user from Authorization header
 * @param {string} authHeader - Full Authorization header value
 * @returns {Promise<Object>} - User object or throws error
 */
const authenticateFromHeader = async (authHeader) => {
  if (!authHeader) {
    throw new Error('Authorization required');
  }

  const token = authHeader.replace('Bearer ', '');
  return await authenticateFromToken(token);
};

/**
 * Authenticate user from query parameter (for EventSource)
 * @param {string} authorization - Authorization query parameter
 * @returns {Promise<Object>} - User object or throws error
 */
const authenticateFromQuery = async (authorization) => {
  if (!authorization) {
    throw new Error('Authorization required');
  }

  const token = authorization.replace('Bearer ', '');
  return await authenticateFromToken(token);
};

/**
 * Generate JWT token for user
 * @param {string} userId - User ID
 * @param {string} expiresIn - Token expiration (default: '7d')
 * @returns {string} - JWT token
 */
const generateToken = (userId, expiresIn = '7d') => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @param {number} saltRounds - Salt rounds for bcrypt (default: 12)
 * @returns {Promise<string>} - Hashed password
 */
const hashPassword = async (password, saltRounds = 12) => {
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} - True if password matches
 */
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} - True if valid email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
const validatePassword = (password) => {
  const errors = [];
  
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Create user response object (without sensitive data)
 * @param {Object} user - User object from database
 * @returns {Object} - Safe user object for API responses
 */
const createUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

module.exports = {
  authenticateFromToken,
  authenticateFromHeader,
  authenticateFromQuery,
  generateToken,
  hashPassword,
  comparePassword,
  isValidEmail,
  validatePassword,
  createUserResponse
};