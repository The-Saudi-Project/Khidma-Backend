const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Address sub-schema for customers
 */
const addressSchema = new mongoose.Schema({
  label: { type: String, default: 'Home' }, // Home, Work, Other
  fullAddress: { type: String, required: true },
  city: { type: String, required: true },
  district: String,
  landmark: String,
  coordinates: {
    lat: Number,
    lng: Number
  },
  isDefault: { type: Boolean, default: false }
}, { _id: true, timestamps: true });

/**
 * Main User schema
 * Unified model for customer / provider / admin roles
 */
const userSchema = new mongoose.Schema({
  // Identity
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[\d\s\-\(\)]{7,15}$/, 'Please provide a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Never return in queries by default
  },

  // Role
  role: {
    type: String,
    enum: ['customer', 'provider', 'admin'],
    default: 'customer'
  },

  // Profile
  avatar: String,
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },

  // Customer-specific
  addresses: [addressSchema],

  accessTokenVersion: { type: Number, default: 0 },
  mustChangePassword: { type: Boolean, default: false },

  // Provider-specific
  providerProfile: {
    skills: [String],
    serviceCity: { type: String, trim: true },
    serviceCategories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
    isAvailable: { type: Boolean, default: true },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    lastJobAt: { type: Date, default: null },
    // Earnings tracking
    totalEarned: { type: Number, default: 0 },
    pendingEarnings: { type: Number, default: 0 },
    totalPaidOut: { type: Number, default: 0 }
  },

  // Account status
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },

  // Password reset
  passwordResetToken: String,
  passwordResetExpires: Date,
  passwordChangedAt: Date,

  // Metadata
  lastLoginAt: Date,
  deletedAt: Date // Soft delete
}, {
  timestamps: true,
  toJSON: {
    transform: (doc, ret) => {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      return ret;
    }
  }
});

// Indexes
userSchema.index({ email: 1 }, { unique: true })
userSchema.index({ role: 1 })
userSchema.index({ isActive: 1 })
userSchema.index({ 'providerProfile.isAvailable': 1 })

/**
 * Hash password before saving
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12
  this.password = await bcrypt.hash(this.password, rounds);
  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000); // 1s grace period
  }
  next();
});

/**
 * Compare entered password with hashed password
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check if password was changed after JWT was issued
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

/**
 * Generate password reset token
 */
userSchema.methods.createPasswordResetToken = function () {
  const { v4: uuidv4 } = require('uuid');
  const resetToken = uuidv4();
  // In production, hash this before storing
  this.passwordResetToken = resetToken;
  this.passwordResetExpires = Date.now() + 30 * 60 * 1000; // 30 minutes
  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
