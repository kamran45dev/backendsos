import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  passwordHash: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  pagesPrinted: {
    type: Number,
    default: 0
  },
  pagesPrintedThisMonth: {
    type: Number,
    default: 0
  },
  lastPrintReset: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ username: 1 });
userSchema.index({ role: 1 });

// Virtual for formatted balance
userSchema.virtual('formattedBalance').get(function() {
  return `RM${this.balance.toFixed(2)}`;
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static method to hash password
userSchema.statics.hashPassword = async function(password) {
  const salt = await bcrypt.genSalt(12);
  return await bcrypt.hash(password, salt);
};

// Method to add balance
userSchema.methods.addBalance = async function(amount) {
  this.balance += amount;
  return await this.save();
};

// Method to deduct balance
userSchema.methods.deductBalance = async function(amount) {
  if (this.balance < amount) {
    throw new Error('Insufficient balance');
  }
  this.balance -= amount;
  return await this.save();
};

// Method to increment pages printed
userSchema.methods.incrementPagesPrinted = async function(pages) {
  this.pagesPrinted += pages;
  this.pagesPrintedThisMonth += pages;
  return await this.save();
};

// Reset monthly counter if needed
userSchema.methods.checkMonthlyReset = async function() {
  const now = new Date();
  const lastReset = new Date(this.lastPrintReset);
  
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.pagesPrintedThisMonth = 0;
    this.lastPrintReset = now;
    return await this.save();
  }
};

const User = mongoose.model('User', userSchema);

export default User;