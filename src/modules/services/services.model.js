const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Service name is required'],
    trim: true,
    maxlength: [150, 'Service name cannot exceed 150 characters']
  },
  nameAr: {
    type: String,
    trim: true,
    maxlength: [150, 'Arabic service name cannot exceed 150 characters']
  },
  slug: {
    type: String,
    lowercase: true,
    trim: true,

  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  descriptionAr: {
    type: String,
    maxlength: [2000, 'Arabic description cannot exceed 2000 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  categoryAr: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  priceType: {
    type: String,
    enum: ['fixed', 'hourly', 'starting_from'],
    default: 'fixed'
  },
  duration: {
    type: Number, // in minutes
    default: 60
  },
  image: {
    type: String,
    default: null
  },
  features: [String],
  sector: {
    type: String,
    enum: ['residential', 'commercial', 'industrial'],
    default: 'residential'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  // Stats
  totalBookings: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Auto-generate slug from name
serviceSchema.pre('save', function (next) {
  if (this.isModified('name') || !this.slug) {
    const base = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')   // strip non-alphanumeric
      .trim()
      .replace(/\s+/g, '-')            // spaces → hyphens
      .replace(/-+/g, '-')             // collapse multiple hyphens
      .substring(0, 80)

    // If name is purely non-latin (e.g. Arabic), base will be empty — use a timestamp fallback
    this.slug = base || `service-${Date.now()}`
  }
  next()
})

serviceSchema.index({ category: 1, isActive: 1 })
serviceSchema.index({ slug: 1 }, { unique: true, sparse: true })
serviceSchema.index({ name: 'text', description: 'text' })

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
