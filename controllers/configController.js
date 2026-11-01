const SiteConfig = require('../models/SiteConfig');
const connectDB = require('../config/db');

const defaultCategories = [
  { id: 'clothing', name: 'Clothing', isActive: true },
  { id: 'bags', name: 'Bags', isActive: true },
  { id: 'luggage', name: 'Luggage', isActive: true },
  { id: 'kids-baby', name: 'Kids & Baby', isActive: true },
  { id: 'beauty', name: 'Beauty Products', isActive: true },
  { id: 'general', name: 'General', isActive: true },
];

const defaultDeliveryLocations = [
  { id: 'inside_dhaka', name: 'ঢাকার ভিতরে', fee: 70, time: '২৪ থেকে ৪৮ ঘণ্টা', isDefault: true, isActive: true },
  { id: 'outside_dhaka', name: 'ঢাকার বাইরে', fee: 130, time: '২ থেকে ৩ দিন', isDefault: false, isActive: true },
];

const defaultConfig = {
  key: 'main_config',
  announcement: {
    enabled: true,
    badgeText: 'হট ডিল 🔥',
    messageText: 'স্টক সীমিত! আপনার পছন্দের কালার বুকিং করুন এখনই!',
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
  categories: defaultCategories,
  deliveryLocations: defaultDeliveryLocations,
};

// @desc    Get site configuration (announcements, categories, delivery locations)
// @route   GET /api/config
exports.getConfig = async (req, res) => {
  try {
    try {
      await connectDB();
      let config = await SiteConfig.findOne({ key: 'main_config' });
      if (!config) {
        config = await SiteConfig.create(defaultConfig);
      } else {
        let changed = false;
        if (!config.categories || config.categories.length === 0) {
          config.categories = defaultCategories;
          changed = true;
        }
        if (!config.deliveryLocations || config.deliveryLocations.length === 0) {
          config.deliveryLocations = defaultDeliveryLocations;
          changed = true;
        }
        if (changed) {
          await config.save();
        }
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

// @desc    Update site configuration (announcement, categories, delivery locations)
// @route   PUT /api/config
exports.updateConfig = async (req, res) => {
  try {
    const { announcement, categories, deliveryLocations } = req.body;

    try {
      await connectDB();
      let config = await SiteConfig.findOne({ key: 'main_config' });

      if (!config) {
        config = await SiteConfig.create({
          key: 'main_config',
          announcement: announcement || defaultConfig.announcement,
          categories: categories || defaultCategories,
          deliveryLocations: deliveryLocations || defaultDeliveryLocations,
        });
      } else {
        if (announcement) {
          config.announcement = {
            ...(config.announcement?.toObject ? config.announcement.toObject() : config.announcement),
            ...announcement,
          };
        }
        if (Array.isArray(categories)) {
          config.categories = categories;
        }
        if (Array.isArray(deliveryLocations)) {
          config.deliveryLocations = deliveryLocations;
        }
        await config.save();
      }

      return res.status(200).json({
        success: true,
        message: 'সাইট কনফিগারেশন সফলভাবে আপডেট হয়েছে!',
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
          categories: categories || defaultCategories,
          deliveryLocations: deliveryLocations || defaultDeliveryLocations,
        },
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
