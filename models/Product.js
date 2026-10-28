const mongoose = require('mongoose');

const VariantSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., 'রয়েল ব্লু (Royal Blue)'
  colorCode: { type: String, default: '#000000' }, // e.g., '#1E3A8A'
  image: { type: String, default: '' },
  stock: { type: Number, default: 20 },
  extraPrice: { type: Number, default: 0 },
});

const ProductSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    englishTitle: { type: String, trim: true },
    slug: { type: String, unique: true, index: true },
    category: {
      type: String,
      default: 'Clothing',
      enum: ['Clothing', 'Bags', 'Luggage', 'Kids & Baby', 'Beauty Products', 'General'],
    },
    description: { type: String, required: true },
    shortDescription: { type: String },
    features: [{ type: String }],
    specifications: [
      {
        key: { type: String },
        value: { type: String },
      },
    ],
    regularPrice: { type: Number, required: true },
    salePrice: { type: Number, required: true },
    discountPercent: { type: Number, default: 0 },
    inStock: { type: Boolean, default: true },
    stockQuantity: { type: Number, default: 100 },
    images: [{ type: String }],
    variants: [VariantSchema],
    sizes: [{ type: String }],
    deliveryInfo: {
      insideDhakaFee: { type: Number, default: 70 },
      outsideDhakaFee: { type: Number, default: 130 },
      deliveryTimeInsideDhaka: { type: String, default: '২৪ থেকে ৪৮ ঘণ্টার মধ্যে' },
      deliveryTimeOutsideDhaka: { type: String, default: '২ থেকে ৩ দিনের মধ্যে' },
    },
    rating: { type: Number, default: 4.9 },
    reviewCount: { type: Number, default: 142 },
    isFeatured: { type: Boolean, default: true },
    badges: [{ type: String }], // e.g. 'হট ডিল', '৫০% ছাড়'
    warrantyNotice: { type: String, default: 'পণ্য হাতে পেয়ে চেক করে নেওয়ার সুবিধা।' },
  },
  {
    timestamps: true,
  }
);

// Auto-calculate discount percentage and slug before validation
ProductSchema.pre('validate', function () {
  if (this.regularPrice > 0 && this.salePrice > 0 && (this.discountPercent === undefined || this.discountPercent === 0)) {
    this.discountPercent = Math.round(
      ((this.regularPrice - this.salePrice) / this.regularPrice) * 100
    );
  }
  if (!this.slug || (typeof this.slug === 'string' && this.slug.trim() === '')) {
    const raw = (this.englishTitle || this.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    this.slug = raw ? `${raw}-${uniqueSuffix}` : `product-${uniqueSuffix}`;
  }
});

module.exports = mongoose.models.Product || mongoose.model('Product', ProductSchema);

