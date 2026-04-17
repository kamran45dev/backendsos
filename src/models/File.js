import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: [true, 'File type is required'],
    enum: ['pdf', 'docx', 'pptx', 'doc', 'ppt', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: [true, 'File size is required'],
    min: [0, 'File size cannot be negative']
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required']
  },
  thumbnailUrl: {
    type: String,
    default: null
  },
  pageCount: {
    type: Number,
    default: 1,
    min: [1, 'Page count must be at least 1']
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  printCount: {
    type: Number,
    default: 0
  },
  lastPrintedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
fileSchema.index({ userId: 1, createdAt: -1 });
fileSchema.index({ fileType: 1 });
fileSchema.index({ isDeleted: 1 });

// Virtual for formatted file size
fileSchema.virtual('formattedSize').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for file icon based on type
fileSchema.virtual('iconType').get(function() {
  const iconMap = {
    pdf: 'file-text',
    docx: 'file-text',
    doc: 'file-text',
    pptx: 'presentation',
    ppt: 'presentation',
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    bmp: 'image',
    webp: 'image'
  };
  return iconMap[this.fileType] || 'file';
});

// Method to increment print count
fileSchema.methods.incrementPrintCount = async function() {
  this.printCount += 1;
  this.lastPrintedAt = new Date();
  return await this.save();
};

// Static method to get files by user
fileSchema.statics.getByUser = async function(userId, options = {}) {
  const { fileType, search, limit = 20, skip = 0 } = options;
  
  const query = { userId, isDeleted: false };
  
  if (fileType && fileType !== 'all') {
    query.fileType = fileType;
  }
  
  if (search) {
    query.filename = { $regex: search, $options: 'i' };
  }
  
  return await this.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .exec();
};

const File = mongoose.model('File', fileSchema);

export default File;
