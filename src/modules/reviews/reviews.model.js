const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true // One review per booking
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: {
    type: String,
    maxlength: [1000, 'Review comment cannot exceed 1000 characters'],
    trim: true
  },
  isVisible: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

reviewSchema.index({ provider: 1 });
reviewSchema.index({ service: 1 });
reviewSchema.index({ customer: 1 });

/**
 * After saving a review, update provider's average rating
 */
reviewSchema.post('save', async function () {
  const User = mongoose.model('User');
  const stats = await mongoose.model('Review').aggregate([
    { $match: { provider: this.provider, isVisible: true } },
    {
      $group: {
        _id: '$provider',
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]);

  if (stats.length > 0) {
    await User.findByIdAndUpdate(this.provider, {
      'providerProfile.averageRating': Math.round(stats[0].avgRating * 10) / 10,
      'providerProfile.totalReviews': stats[0].count
    });
  }
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
