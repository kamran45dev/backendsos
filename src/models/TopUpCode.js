import mongoose from 'mongoose';
import crypto from 'crypto';

const topUpCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Code is required'],
    unique: true,
    index: true
  },
  value: {
    type: Number,
    required: [true, 'Value is required'],
    min: [0.01, 'Value must be at least $0.01']
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  usedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes
// topUpCodeSchema.index({ code: 1 });
topUpCodeSchema.index({ isUsed: 1 });
topUpCodeSchema.index({ expiresAt: 1 });

// Virtual to check if code is expired
// topUpCodeSchema.virtual('isExpired').get(function() {
//   if (!this.expiresAt) return false;
//   return new Date() > this.expiresAt;
// });

// Virtual for formatted value
topUpCodeSchema.virtual('formattedValue').get(function() {
  return `$${this.value.toFixed(2)}`;
});

// Method to mark as used
topUpCodeSchema.methods.markAsUsed = async function(userId) {
  this.isUsed = true;
  this.usedBy = userId;
  this.usedAt = new Date();
  return await this.save();
};

// Static method to generate a new code
topUpCodeSchema.statics.generateCode = async function(value, createdBy, expiresAt = null) {
  // Generate a random 16-character code (alphanumeric)
  const code = crypto.randomBytes(8).toString('hex').toUpperCase();
  
  const topUpCode = new this({
    code,
    value,
    createdBy,
    expiresAt
  });
  
  return await topUpCode.save();
};

// Static method to validate and redeem a code
topUpCodeSchema.statics.redeemCode = async function(code, userId) {
  const topUpCode = await this.findOne({ code: code.toUpperCase() });
  
  if (!topUpCode) {
    throw new Error('Invalid code');
  }
  
  if (topUpCode.isUsed) {
    throw new Error('Code has already been used');
  }
  
  if (topUpCode.expiresAt && new Date() > topUpCode.expiresAt) {
    throw new Error('Code has expired');
  }
  
  await topUpCode.markAsUsed(userId);
  
  return topUpCode;
};

// Static method to get available codes
topUpCodeSchema.statics.getAvailableCodes = async function() {
  return await this.find({
    isUsed: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ createdAt: -1 });
};

const TopUpCode = mongoose.model('TopUpCode', topUpCodeSchema);

export default TopUpCode;
