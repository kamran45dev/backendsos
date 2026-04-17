// File validation utilities

const ALLOWED_MIME_TYPES = {
  // PDF
  'application/pdf': 'pdf',
  
  // Microsoft Word
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  
  // Microsoft PowerPoint
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  
  // Images
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/webp': 'webp'
};

const ALLOWED_EXTENSIONS = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'docx',
  ppt: 'ppt',
  pptx: 'pptx',
  jpg: 'jpg',
  jpeg: 'jpg',
  png: 'png',
  gif: 'gif',
  bmp: 'bmp',
  webp: 'webp'
};

// Maximum file size (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export const validateFile = (file) => {
  const errors = [];
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum limit of 50MB`);
  }
  
  // Check MIME type
  const fileType = ALLOWED_MIME_TYPES[file.mimetype];
  if (!fileType) {
    errors.push(`File type "${file.mimetype}" is not allowed`);
  }
  
  // Check extension
  const extension = file.originalname.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS[extension]) {
    errors.push(`File extension ".${extension}" is not allowed`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    fileType: fileType || extension
  };
};

export const getFileType = (mimetype, filename) => {
  const type = ALLOWED_MIME_TYPES[mimetype];
  if (type) return type;
  
  const extension = filename.split('.').pop().toLowerCase();
  return ALLOWED_EXTENSIONS[extension] || 'unknown';
};

export const isPreviewable = (fileType) => {
  const previewableTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
  return previewableTypes.includes(fileType);
};

export const needsConversion = (fileType) => {
  const convertibleTypes = ['doc', 'docx', 'ppt', 'pptx'];
  return convertibleTypes.includes(fileType);
};

export { MAX_FILE_SIZE, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS };
