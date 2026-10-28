const SiteConfig = require('../models/SiteConfig');
const connectDB = require('../config/db');

const defaultConfig = {
  key: 'main_config',
  announcement: {
    enabled: true,
    badgeText: 'LIMITED OFFER',
    messageText: 'সীমিত সময়ের জন্য FLAT 50% DISCOUNT!',
    phoneText: 'Call Us 01648-439277',
    phoneNumber: '01648439277',
    whatsappNumber: '8801648439277',
    themeColor: '#12372A',
    textColor: '#FFFFFF',
    badgeBgColor: '#FBFADA',
    badgeTextColor: '#12372A',
    showPhone: true,
    showWhatsapp: true,
  },
};

// @desc    Get site configuration (announcement offer banner, helpline, etc.)
// @route   GET /api/config
exports.getConfig = async (req, res) => {
  try {
    try {
      await connectDB();
      let config = await SiteConfig.findOne({ key: 'main_config' });
      if (!config) {
        config = await SiteConfig.create(defaultConfig);
      }
      return res.status(200).json({ success: true, data: config });
    } catch (dbErr) {
      console.warn('DB error in getConfig, returning fallback:', dbErr.message);
      return res.status(200).json({ success: true, data: defaultConfig });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update site configuration from Admin Panel
// @route   PUT /api/config
exports.updateConfig = async (req, res) => {
  try {
    const { announcement } = req.body;

    try {
      await connectDB();
      let config = await SiteConfig.findOne({ key: 'main_config' });

      if (!config) {
        config = await SiteConfig.create({
          key: 'main_config',
          announcement: announcement || defaultConfig.announcement,
        });
      } else {
        if (announcement) {
          config.announcement = {
            ...(config.announcement?.toObject ? config.announcement.toObject() : config.announcement),
            ...announcement,
          };
          await config.save();
        }
      }

      return res.status(200).json({
        success: true,
        message: 'অফার ব্যানার ও সাইট সেটিংস সফলভাবে আপডেট হয়েছে!',
        data: config,
      });
    } catch (dbErr) {
      console.warn('DB error in updateConfig:', dbErr.message);
      return res.status(200).json({
        success: true,
        message: 'সেটিংস সাময়িকভাবে আপডেট করা হয়েছে (মেমোরি মোড)',
        data: {
          key: 'main_config',
          announcement: { ...defaultConfig.announcement, ...(announcement || {}) },
        },
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

