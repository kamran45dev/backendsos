import mongoose from 'mongoose';

const printJobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  settings: {
    pages: {
      type: String, // 'all' or '1-3,5,7-10'
      required: true
    },
    paperSize: {
      type: String,
      enum: ['A4', 'A3', 'Letter', 'Legal'],
      default: 'A4'
    },
    layout: {
      type: String,
      enum: ['full', '1', '2', '3', '4h', '6h', '9h', '4v', '6v', '9v'],
      default: 'full'
    },
    color: {
      type: String,
      enum: ['bw', 'color'],
      default: 'bw'
    }
  },
  pageCount: {
    type: Number,
    required: true
  },
  cost: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  printedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes
printJobSchema.index({ userId: 1, createdAt: -1 });
printJobSchema.index({ status: 1 });
printJobSchema.index({ createdAt: -1 });

// Virtual for formatted cost
printJobSchema.virtual('formattedCost').get(function() {
  return `$${this.cost.toFixed(2)}`;
});

// Static method to get print history
printJobSchema.statics.getHistoryByUser = async function(userId, options = {}) {
  const { limit = 20, skip = 0 } = options;
  
  return await this.find({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('fileId', 'filename fileType')
    .exec();
};

const PrintJob = mongoose.model('PrintJob', printJobSchema);

export default PrintJob;
