const mongoose = require('mongoose');

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
      badgeText: { type: String, default: 'LIMITED OFFER' },
      messageText: { type: String, default: 'সীমিত সময়ের জন্য FLAT 50% DISCOUNT!' },
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
  },
  { timestamps: true }
);

module.exports = mongoose.models.SiteConfig || mongoose.model('SiteConfig', SiteConfigSchema);

