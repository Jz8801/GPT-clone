/**
 * File download utility for client-side file downloads
 * Handles different file formats and provides user feedback
 */

/**
 * Download a file from a URL (typically an API endpoint)
 * @param {string} url - The URL to download from
 * @param {string} filename - The desired filename for the download
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} - Success status
 */
export const downloadFromUrl = async (url, filename, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    downloadBlob(blob, filename);
    
    return true;
  } catch (error) {
    console.error('Download failed:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }
};

/**
 * Download a Blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename for the download
 */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Download text content as a file
 * @param {string} content - The text content to download
 * @param {string} filename - The filename for the download
 * @param {string} mimeType - The MIME type (default: text/plain)
 */
export const downloadTextContent = (content, filename, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
};

/**
 * Download JSON data as a file
 * @param {Object} data - The data to download as JSON
 * @param {string} filename - The filename for the download
 */
export const downloadJson = (data, filename) => {
  const content = JSON.stringify(data, null, 2);
  downloadTextContent(content, filename, 'application/json');
};

/**
 * Get appropriate file extension and MIME type for format
 * @param {string} format - The export format (json, txt, md)
 * @returns {Object} - Object with extension and mimeType
 */
export const getFileInfo = (format) => {
  const formatMap = {
    json: { extension: 'json', mimeType: 'application/json' },
    txt: { extension: 'txt', mimeType: 'text/plain' },
    md: { extension: 'md', mimeType: 'text/markdown' },
    markdown: { extension: 'md', mimeType: 'text/markdown' }
  };
  
  return formatMap[format.toLowerCase()] || formatMap.txt;
};

/**
 * Generate a safe filename for export
 * @param {string} title - The conversation title
 * @param {string} format - The export format
 * @returns {string} - Safe filename
 */
export const generateSafeFilename = (title, format) => {
  const { extension } = getFileInfo(format);
  const safeTitle = (title || 'conversation')
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
  
  const date = new Date().toISOString().split('T')[0];
  return `${safeTitle}_${date}.${extension}`;
};

/**
 * Show success notification for download
 * @param {string} filename - The downloaded filename
 */
export const showDownloadSuccess = (filename) => {
  // Simple notification - could be replaced with a toast library
  const notification = document.createElement('div');
  notification.textContent = `Downloaded: ${filename}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
};

/**
 * Show error notification for failed download
 * @param {string} error - The error message
 */
export const showDownloadError = (error) => {
  const notification = document.createElement('div');
  notification.textContent = `Download failed: ${error}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f44336;
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 5000);
};