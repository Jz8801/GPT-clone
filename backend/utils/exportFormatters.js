/**
 * Export formatters for conversation data
 * Supports JSON, TXT, and Markdown formats
 */

const formatDate = (date) => {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
};

/**
 * Export conversation as JSON format
 * Complete structured data with metadata
 */
const formatAsJson = (conversation, messages) => {
  return {
    conversation: {
      id: conversation.id,
      title: conversation.title || 'Untitled Conversation',
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      exportedAt: new Date().toISOString(),
      messageCount: messages.length
    },
    messages: messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt
    }))
  };
};

/**
 * Export conversation as plain text format
 * Human-readable with timestamps
 */
const formatAsText = (conversation, messages) => {
  const title = conversation.title || 'Untitled Conversation';
  const exportDate = formatDate(new Date());
  const createdDate = formatDate(conversation.createdAt);
  
  let output = `Conversation: ${title}\n`;
  output += `Created: ${createdDate}\n`;
  output += `Exported: ${exportDate}\n`;
  output += `Messages: ${messages.length}\n`;
  output += `${'='.repeat(50)}\n\n`;
  
  messages.forEach((msg, index) => {
    const timestamp = formatDate(msg.createdAt);
    const role = msg.role === 'user' ? 'You' : 'Assistant';
    
    output += `[${role} - ${timestamp}]\n`;
    output += `${msg.content}\n\n`;
    
    // Add separator between messages (except last one)
    if (index < messages.length - 1) {
      output += `${'-'.repeat(30)}\n\n`;
    }
  });
  
  return output;
};

/**
 * Export conversation as Markdown format
 * Structured with proper headings and formatting
 */
const formatAsMarkdown = (conversation, messages) => {
  const title = conversation.title || 'Untitled Conversation';
  const exportDate = formatDate(new Date());
  const createdDate = formatDate(conversation.createdAt);
  
  let output = `# ${title}\n\n`;
  output += `**Created:** ${createdDate}  \n`;
  output += `**Exported:** ${exportDate}  \n`;
  output += `**Messages:** ${messages.length}  \n\n`;
  output += `---\n\n`;
  
  messages.forEach((msg, index) => {
    const timestamp = formatDate(msg.createdAt);
    const role = msg.role === 'user' ? '👤 **You**' : '🤖 **Assistant**';
    
    output += `## ${role}\n`;
    output += `*${timestamp}*\n\n`;
    output += `${msg.content}\n\n`;
    
    // Add horizontal rule between messages (except last one)
    if (index < messages.length - 1) {
      output += `---\n\n`;
    }
  });
  
  return output;
};

/**
 * Main export function - formats conversation based on requested format
 */
const exportConversation = (conversation, messages, format = 'json') => {
  const formatters = {
    json: formatAsJson,
    txt: formatAsText,
    md: formatAsMarkdown,
    markdown: formatAsMarkdown // alias
  };
  
  const formatter = formatters[format.toLowerCase()];
  if (!formatter) {
    throw new Error(`Unsupported export format: ${format}. Supported formats: json, txt, md`);
  }
  
  return formatter(conversation, messages);
};

/**
 * Get appropriate MIME type and file extension for format
 */
const getFormatInfo = (format) => {
  const formatInfo = {
    json: {
      mimeType: 'application/json',
      extension: 'json',
      name: 'JSON'
    },
    txt: {
      mimeType: 'text/plain',
      extension: 'txt', 
      name: 'Plain Text'
    },
    md: {
      mimeType: 'text/markdown',
      extension: 'md',
      name: 'Markdown'
    },
    markdown: {
      mimeType: 'text/markdown',
      extension: 'md',
      name: 'Markdown'
    }
  };
  
  return formatInfo[format.toLowerCase()] || formatInfo.json;
};

/**
 * Generate filename for exported conversation
 */
const generateFilename = (conversation, format) => {
  const { extension } = getFormatInfo(format);
  const title = conversation.title || 'conversation';
  
  // Sanitize title for filename
  const sanitizedTitle = title
    .replace(/[^a-z0-9]/gi, '_')  // Replace non-alphanumeric with underscore
    .replace(/_+/g, '_')          // Replace multiple underscores with single
    .replace(/^_|_$/g, '')        // Remove leading/trailing underscores
    .toLowerCase();
  
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  return `${sanitizedTitle}_${date}.${extension}`;
};

module.exports = {
  exportConversation,
  getFormatInfo,
  generateFilename,
  formatAsJson,
  formatAsText,
  formatAsMarkdown
};