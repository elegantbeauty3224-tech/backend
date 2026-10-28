const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.Mixed },
  productTitle: { type: String, required: true },
  variantName: { type: String, default: 'Default' },
  colorCode: { type: String, default: '' },
  size: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  image: { type: String, default: '/banner.jpeg' },
});

const OrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    deliveryAddress: {
      type: String,
      required: [true, 'Delivery address is required'],
      trim: true,
    },
    deliveryArea: {
      type: String,
      enum: ['inside_dhaka', 'outside_dhaka'],
      default: 'inside_dhaka',
    },
    deliveryFee: {
      type: Number,
      required: true,
      default: 70,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    // Authenticated User Tracking (Firebase Google Auth)
    userId: {
      type: String,
      default: null,
      index: true,
    },
    userEmail: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    isVerifiedUser: {
      type: Boolean,
      default: false,
    },
    customerPhoto: {
      type: String,
      default: '',
    },
    // User & Device Tracking Info
    ipAddress: {
      type: String,
      default: 'Unknown',
    },
    userAgent: {
      type: String,
      default: '',
    },
    deviceType: {
      type: String,
      enum: ['Mobile', 'Tablet', 'Desktop', 'Unknown'],
      default: 'Desktop',
    },
    referrer: {
      type: String,
      default: '',
    },
    items: [OrderItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMethod: {
      type: String,
      default: 'Cash on Delivery (COD)',
    },
    paymentStatus: {
      type: String,
      default: 'unpaid',
      index: true,
    },
    orderStatus: {
      type: String,
      default: 'Pending',
      index: true,
    },
    source: {
      type: String,
      default: 'Facebook Ad Landing Page',
    },
    // Courier (Steadfast Courier) Dispatch Tracking
    courier: {
      name: { type: String, default: 'Steadfast' },
      provider: { type: String, default: 'Steadfast' },
      consignmentId: { type: Number },
      trackingCode: { type: String },
      status: { type: String, default: 'pending' },
      sentAt: { type: Date, default: null },
      responseRaw: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    statusHistory: [
      {
        status: { type: String },
        note: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Auto-generate order number before validation (Mongoose 8+ compatible)
OrderSchema.pre('validate', function () {
  if (!this.orderNumber) {
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.orderNumber = `EB-${datePrefix}-${randomDigits}${suffix}`;
  }
});

module.exports = mongoose.models.Order || mongoose.model('Order', OrderSchema);
