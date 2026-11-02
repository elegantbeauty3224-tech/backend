const mongoose = require('mongoose');

const SalesReportItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.Mixed },
  productTitle: { type: String, required: true },
  variantName: { type: String, default: 'Default' },
  colorCode: { type: String, default: '' },
  size: { type: String, default: '' },
  quantity: { type: Number, required: true, min: 1, default: 1 },
  unitPrice: { type: Number, required: true, default: 0 },
  totalPrice: { type: Number, required: true, default: 0 },
  image: { type: String, default: '/banner.jpeg' },
});

const SalesReportSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true,
    },
    deliveryAddress: {
      type: String,
      default: '',
      trim: true,
    },
    deliveryArea: {
      type: String,
      default: 'inside_dhaka',
    },
    deliveryFee: {
      type: Number,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    paymentMethod: {
      type: String,
      default: 'Cash on Delivery (COD)',
    },
    deliveredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    items: [SalesReportItemSchema],
    month: {
      type: Number,
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    monthYear: {
      type: String,
      required: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.SalesReport || mongoose.model('SalesReport', SalesReportSchema);

