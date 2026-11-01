const mongoose = require('mongoose');

const DeliveryLocationSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  fee: { type: Number, required: true, default: 70 },
  time: { type: String, default: '২৪ থেকে ৪৮ ঘণ্টা' },
  isDefault: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
});

const CategorySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  isActive: { type: Boolean, default: true },
});

const SiteConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'main_config',
      unique: true,
      index: true,
    },
    announcement: {
      enabled: { type: Boolean, default: true },
      badgeText: { type: String, default: 'হট ডিল 🔥' },
      messageText: { type: String, default: 'স্টক সীমিত! আপনার পছন্দের কালার বুকিং করুন এখনই!' },
      phoneText: { type: String, default: 'Call Us 01648-439277' },
      phoneNumber: { type: String, default: '01648439277' },
      whatsappNumber: { type: String, default: '8801648439277' },
      themeColor: { type: String, default: '#12372A' },
      textColor: { type: String, default: '#FFFFFF' },
      badgeBgColor: { type: String, default: '#FBFADA' },
      badgeTextColor: { type: String, default: '#12372A' },
      showPhone: { type: Boolean, default: true },
      showWhatsapp: { type: Boolean, default: true },
    },
    categories: {
      type: [CategorySchema],
      default: [
        { id: 'clothing', name: 'Clothing', isActive: true },
        { id: 'bags', name: 'Bags', isActive: true },
        { id: 'luggage', name: 'Luggage', isActive: true },
        { id: 'kids-baby', name: 'Kids & Baby', isActive: true },
        { id: 'beauty', name: 'Beauty Products', isActive: true },
        { id: 'general', name: 'General', isActive: true },
      ],
    },
    deliveryLocations: {
      type: [DeliveryLocationSchema],
      default: [
        { id: 'inside_dhaka', name: 'ঢাকার ভিতরে', fee: 70, time: '২৪ থেকে ৪৮ ঘণ্টা', isDefault: true, isActive: true },
        { id: 'outside_dhaka', name: 'ঢাকার বাইরে', fee: 130, time: '২ থেকে ৩ দিন', isDefault: false, isActive: true },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.SiteConfig || mongoose.model('SiteConfig', SiteConfigSchema);
