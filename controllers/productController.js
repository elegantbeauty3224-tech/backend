const mongoose = require('mongoose');
const Product = require('../models/Product');
const connectDB = require('../config/db');

// Multi-category sample products matching the banner info
const sampleProducts = [
  {
    _id: '652f1b0a8e1234567890abc1',
    title: 'প্রিমিয়াম এক্সক্লুসিভ জর্জেট পার্টি থ্রি-পিস কালেকশন',
    englishTitle: 'Premium Exclusive Party Three-Piece Collection',
    slug: 'party-three-piece',
    category: 'Clothing',
    description: `উন্নত মানের সফট জর্জেট ও পিওর বাটার সিল্ক ইনারের সমন্বয়ে তৈরি এক্সক্লুসিভ পার্টি থ্রি-পিস। নিখুঁত সুতো, জরি ও সিকোয়েন্সের দৃষ্টিনন্দন কারচুপি কাজ আপনার যেকোনো উৎসবকে করবে স্মরণীয়।`,
    shortDescription: 'উন্নত জর্জেট ও নিখুঁত কারচুপির কাজ করা এক্সক্লুসিভ পার্টি ড্রেস।',
    features: [
      '১০০% পিওর লাক্সারি জর্জেট ফেব্রিক',
      'নিখুঁত সুতো, জরি ও সিকোয়েন্স কারচুপি ওয়ার্ক',
      'প্রিমিয়াম বাটার সিল্ক ইনার এবং প্যান্ট সহ ফুল সেট',
      '৪ সাইড লেইস লাগানো ৫ হাত লম্বা জর্জেট ওড়না'
    ],
    regularPrice: 2850,
    salePrice: 1850,
    discountPercent: 35,
    inStock: true,
    stockQuantity: 45,
    images: ['/banner.jpeg', '/logo-dark.jpeg', '/logo-light.jpeg'],
    variants: [
      { name: 'রয়েল ব্লু (Royal Blue)', colorCode: '#1E3A8A', image: '/banner.jpeg', stock: 15, extraPrice: 0 },
      { name: 'মেরুন রেড (Maroon Red)', colorCode: '#831843', image: '/banner.jpeg', stock: 12, extraPrice: 0 },
      { name: 'এমারেল্ড গ্রিন (Emerald Green)', colorCode: '#065F46', image: '/banner.jpeg', stock: 10, extraPrice: 0 },
      { name: 'পার্পল ভায়োলেট (Purple Violet)', colorCode: '#581C87', image: '/banner.jpeg', stock: 8, extraPrice: 0 }
    ],
    sizes: ['Free Size (আনস্টিচড)', 'M (38)', 'L (40)', 'XL (42)', 'XXL (44)'],
    rating: 4.9,
    reviewCount: 168,
    isFeatured: true,
    badges: ['হট ডিল', '৩৫% ছাড়']
  },
  {
    _id: '652f1b0a8e1234567890abc2',
    title: 'লাক্সারি উইমেন্স গর্জিয়াস হ্যান্ডব্যাগ ও শোল্ডার ব্যাগ',
    englishTitle: 'Luxury Womens Classic Handbag & Shoulder Bag',
    slug: 'luxury-womens-handbag',
    category: 'Bags',
    description: 'উন্নত মানের ওয়াটারপ্রুফ পিইউ লেদারে তৈরি আকর্ষণীয় লেডিস হ্যান্ডব্যাগ। অফিস, পার্টি ও রেগুলার ব্যবহারের জন্য অত্যন্ত স্টাইলিশ ও দীর্ঘস্থায়ী।',
    shortDescription: 'প্রিমিয়াম পিইউ লেদার ফিনিশিং গর্জিয়াস হ্যান্ডব্যাগ।',
    features: ['ওয়াটারপ্রুফ প্রিমিয়াম পিইউ লেদার', 'স্ট্রং গোল্ডেন মেটাল অ্যাকসেন্ট', 'অ্যাডজাস্টেবল লং স্ট্র্যাপ'],
    regularPrice: 2400,
    salePrice: 1450,
    discountPercent: 40,
    inStock: true,
    stockQuantity: 30,
    images: ['/banner.jpeg', '/logo-light.jpeg'],
    variants: [
      { name: 'ক্লাসিক ব্লাশ পিঙ্ক', colorCode: '#F472B6', image: '/banner.jpeg', stock: 10, extraPrice: 0 },
      { name: 'ম্যাট ব্ল্যাক', colorCode: '#18181B', image: '/banner.jpeg', stock: 12, extraPrice: 0 },
      { name: 'আইভরি হোয়াইট', colorCode: '#FEF3C7', image: '/banner.jpeg', stock: 8, extraPrice: 0 }
    ],
    sizes: ['Medium Standard (10x8 inch)'],
    rating: 4.8,
    reviewCount: 94,
    isFeatured: true,
    badges: ['বেস্ট সেলার', '৪০% ছাড়']
  },
  {
    _id: '652f1b0a8e1234567890abc3',
    title: '18-Inch Cabin Luggage / Hand Luggage',
    englishTitle: '18-Inch Cabin Luggage / Hand Luggage',
    slug: '18-inch-cabin-luggage',
    category: 'Luggage',
    description: 'ভ্রমণের জন্য ছোট, হালকা ও ব্যবহার উপযোগী লাগেজ খুঁজছেন? আমাদের 18-Inch Cabin Luggage হতে পারে আপনার জন্য উপযুক্ত পছন্দ। বিমানে ভ্রমণের সময় কেবিন লাগেজ হিসেবে ব্যবহার অথবা একক ব্যক্তির স্বল্প সময়ের ভ্রমণে প্রয়োজনীয় পোশাক ও জিনিসপত্র বহনের জন্য এটি একটি সুবিধাজনক অপশন।',
    shortDescription: 'বিমানে ভ্রমণের পারফেক্ট 18-Inch কেবিন লাগেজ।',
    specifications: [
      { key: 'Size', value: '18 Inches' },
      { key: 'Weight', value: 'Approximately 2 kg' },
      { key: 'Capacity', value: 'Up to 7 kg of belongings' },
      { key: 'Warranty', value: '2 Years' },
      { key: 'Color Options', value: '6 Attractive Colors' },
      { key: 'Lock System', value: 'Built-in Number Lock' },
      { key: 'Wheels', value: '360° Spinner Wheels' },
      { key: 'Quality', value: 'Premium Quality' },
    ],
    features: [
      'Compact design for convenient travel.',
      'Lightweight body for easy handling.',
      '360° spinner wheels for smooth movement.',
      'Built-in number lock for added convenience.',
      'Suitable for solo travelers and short trips.',
      'Available in 6 attractive colors to match your style.',
    ],
    regularPrice: 4500,
    salePrice: 2950,
    discountPercent: 34,
    inStock: true,
    stockQuantity: 25,
    images: ['/banner.jpeg'],
    variants: [
      { name: 'নেভি ব্লু (Navy Blue)', colorCode: '#1E3A8A', image: '/banner.jpeg', stock: 8, extraPrice: 0 },
      { name: 'রোজ পিঙ্ক (Rose Pink)', colorCode: '#FB7185', image: '/banner.jpeg', stock: 7, extraPrice: 0 },
      { name: 'ক্লাসিক ব্ল্যাক (Classic Black)', colorCode: '#09090B', image: '/banner.jpeg', stock: 5, extraPrice: 0 },
      { name: 'সিলভার গ্রে (Silver Grey)', colorCode: '#94A3B8', image: '/banner.jpeg', stock: 5, extraPrice: 0 }
    ],
    sizes: ['18 Inches (কেবিন স্ট্যান্ডার্ড)'],
    rating: 5.0,
    reviewCount: 2,
    reviews: [
      {
        userName: 'আরিফুল ইসলাম',
        userEmail: 'ariful@gmail.com',
        rating: 5,
        comment: 'খুবই হালকা এবং ৩৬০ ডিগ্রি হুইলগুলো একদম স্মুথ চলে। বিমানে কেবিন লাগেজ হিসেবে দারুণ পারফেক্ট!',
        isVerifiedBuyer: true,
        createdAt: new Date(),
      },
      {
        userName: 'নাবিলা রহমান',
        userEmail: 'nabila@gmail.com',
        rating: 5,
        comment: 'কালারটা অত্যন্ত সুন্দর আর লক সিস্টেম থাকায় নিরাপদে ট্রাভেল করতে পেরেছি। ২ বছরের ওয়ারেন্টি থাকায় নিশ্চিন্তে নেওয়া যায়।',
        isVerifiedBuyer: true,
        createdAt: new Date(),
      }
    ],
    isFeatured: true,
    badges: ['হট ডিল', '২ বছরের ওয়ারেন্টি']
  },
  {
    _id: '652f1b0a8e1234567890abc4',
    title: 'কিউট টেডি বেয়ার ও বেবি কেয়ার এসেনশিয়াল কম্বো সেট',
    englishTitle: 'Cute Teddy Bear & Baby Care Essential Gift Combo',
    slug: 'baby-care-essential-combo',
    category: 'Kids & Baby',
    description: 'নবজাতক ও শিশুদের কোমল ত্বকের জন্য সম্পূর্ণ নিরাপদ ও ক্ষতিকর রাসায়নিক মুক্ত প্রিমিয়াম বেবি কেয়ার কিট সাথে আকর্ষণীয় সফট টেডি বেয়ার ও বেবি ফিডার।',
    shortDescription: 'শিশুদের সম্পূর্ণ নিরাপদ ও কোমল বেবি এসেনশিয়াল গিফট সেট।',
    features: ['১০০% টক্সিন মুক্ত ও হাইপোঅ্যালার্জেনিক', 'সুপার সফট নন-টক্সিক টেডি বেয়ার', 'বিপিএ ফ্রি বেবি ফিডার ও এক্সেসরিজ'],
    regularPrice: 2200,
    salePrice: 1350,
    discountPercent: 38,
    inStock: true,
    stockQuantity: 35,
    images: ['/banner.jpeg'],
    variants: [
      { name: 'বেবি ব্লু কম্বো', colorCode: '#60A5FA', image: '/banner.jpeg', stock: 15, extraPrice: 0 },
      { name: 'বেবি পিঙ্ক কম্বো', colorCode: '#F472B6', image: '/banner.jpeg', stock: 12, extraPrice: 0 },
      { name: 'গোল্ডেন ইয়েলো', colorCode: '#FBBF24', image: '/banner.jpeg', stock: 8, extraPrice: 0 }
    ],
    sizes: ['Full Set Gift Box'],
    rating: 4.9,
    reviewCount: 88,
    isFeatured: false,
    badges: ['বেবি ফ্রেন্ডলি', '৩৮% ছাড়']
  },
  {
    _id: '652f1b0a8e1234567890abc5',
    title: 'অর্গানিক স্কিন গ্লো অ্যান্ড ব্রাইটেনিং বিউটি কেয়ার কম্বো',
    englishTitle: 'Organic Skin Glow & Brightening Beauty Care Combo',
    slug: 'skin-glow-beauty-combo',
    category: 'Beauty Products',
    description: 'ন্যাচারাল ফ্রুট এক্সট্রাক্টস ও ভিটামিন সি সমৃদ্ধ প্রিমিয়াম ফেস সিরাম, টোনার এবং হোয়াইটেনিং ক্রিম সেট। ত্বকের দাগ দূর করে দেয় প্রাকৃতিক উজ্জ্বলতা ও লাবণ্য।',
    shortDescription: 'প্রাকৃতিক উপাদান সমৃদ্ধ সম্পূর্ণ ত্বকের যত্নের ৫-পিস কম্বো।',
    features: ['ভিটামিন সি ও হায়ালুরোনিক অ্যাসিড যুক্ত', 'কোনো ক্ষতিকর স্টেরয়েড বা পারদ নেই', 'সব ধরনের ত্বকের জন্য উপযোগী'],
    regularPrice: 3200,
    salePrice: 1950,
    discountPercent: 39,
    inStock: true,
    stockQuantity: 50,
    images: ['/banner.jpeg'],
    variants: [
      { name: 'রেডিয়েন্ট গ্লো কম্বো', colorCode: '#F59E0B', image: '/banner.jpeg', stock: 25, extraPrice: 0 },
      { name: 'অ্যাকনি ফেড কম্বো', colorCode: '#10B981', image: '/banner.jpeg', stock: 25, extraPrice: 0 }
    ],
    sizes: ['Standard 5-in-1 Kit'],
    rating: 4.9,
    reviewCount: 215,
    isFeatured: true,
    badges: ['ন্যাচারাল গ্লো', '৩৯% ছাড়']
  },
  {
    _id: '652f1b0a8e1234567890abc6',
    title: 'এক্সক্লুসিভ কাতান বেনারসি সিল্ক শাড়ি কালেকশন',
    englishTitle: 'Exclusive Katan Benaroshi Silk Saree Collection',
    slug: 'katan-benaroshi-silk-saree',
    category: 'Clothing',
    description: 'ঐতিহ্যবাহী বেনারসি উইভিং আর্টের ছোঁয়ায় তৈরি লাক্সারি কাতান সিল্ক শাড়ি। বিয়ের অনুষ্ঠান কিংবা পার্টির জন্য আভিজাত্যের প্রতীক।',
    shortDescription: 'আভিজাত্যপূর্ণ রেশম কাতান বেনারসি পার্টি শাড়ি।',
    features: ['পিওর রেশম কাতান সিল্ক', 'নিখুঁত অল-ওভার গোল্ডেন জরি মিনা কাজ', 'ম্যাচিং ব্লাউজ পিস অন্তর্ভুক্ত'],
    regularPrice: 4500,
    salePrice: 2850,
    discountPercent: 36,
    inStock: true,
    stockQuantity: 28,
    images: ['/banner.jpeg'],
    variants: [
      { name: 'রক্তিম লাল (Crimson Red)', colorCode: '#991B1B', image: '/banner.jpeg', stock: 10, extraPrice: 0 },
      { name: 'রয়েল ব্লু (Royal Blue)', colorCode: '#1E3A8A', image: '/banner.jpeg', stock: 10, extraPrice: 0 },
      { name: 'রানি গোলাপি (Magenta)', colorCode: '#BE185D', image: '/banner.jpeg', stock: 8, extraPrice: 0 }
    ],
    sizes: ['১২ হাত সাথে ব্লাউজ পিস'],
    rating: 4.8,
    reviewCount: 112,
    isFeatured: false,
    badges: ['টপ রেটেড']
  },
  {
    _id: '652f1b0a8e1234567890abc7',
    title: 'লেডিস ট্রেন্ডি ক্রসবডি স্লিং ব্যাগ ও ফ্যাশন পার্স',
    englishTitle: 'Ladies Trendy Crossbody Sling Bag & Fashion Purse',
    slug: 'ladies-crossbody-sling-bag',
    category: 'Bags',
    description: 'কমপ্যাক্ট ও মডার্ন ডিজাইনের স্লিং ব্যাগ। মোবাইল, কার্ড, টাকা ও টুকিটাকি প্রসাধন বহনের জন্য আরামদায়ক ও নিখুঁত ফিনিশিং।',
    shortDescription: 'লাইটওয়েট ও ওয়াটার রেসিস্ট্যান্ট ট্রেন্ডি স্লিং ব্যাগ।',
    features: ['প্রিমিয়াম সফ্ট টেক্সচার লেদার', 'গোল্ড চেইন ও লেদার স্ট্র্যাপ কম্বিনেশন', 'স্মার্ট সিকিউর জিপার'],
    regularPrice: 1600,
    salePrice: 950,
    discountPercent: 40,
    inStock: true,
    stockQuantity: 40,
    images: ['/banner.jpeg'],
    variants: [
      { name: 'কফি ব্রাউন', colorCode: '#78350F', image: '/banner.jpeg', stock: 15, extraPrice: 0 },
      { name: 'ক্লাসিক ব্ল্যাক', colorCode: '#18181B', image: '/banner.jpeg', stock: 15, extraPrice: 0 },
      { name: 'পেস্টেল গ্রিন', colorCode: '#6EE7B7', image: '/banner.jpeg', stock: 10, extraPrice: 0 }
    ],
    sizes: ['Compact (8x6 inch)'],
    rating: 4.7,
    reviewCount: 79,
    isFeatured: false,
    badges: ['বাজেট ফ্রেন্ডলি']
  },
  {
    _id: '652f1b0a8e1234567890abc8',
    title: 'হাইড্রা-ময়েশ্চার স্কিন রিপেয়ারিং নাইট সিরাম',
    englishTitle: 'Hydra Moisture Skin Repairing Night Serum',
    slug: 'hydra-night-serum',
    category: 'Beauty Products',
    description: 'রাতের বেলা ত্বকের ক্ষতিগ্রস্ত কোষ পুনরুজ্জীবিত করতে কার্যকর। ফাইন লাইন দূর করে এবং ত্বককে করে টানটান ও প্রাণবন্ত।',
    shortDescription: 'ত্বকের ভেতর থেকে ময়েশ্চার ও উজ্জ্বলতা বাড়ানোর সিরাম।',
    features: ['১০০% ন্যাচারাল নির্যাস', 'দ্রুত শোষণকারী নন-স্টিকি ফর্মুলা', 'চর্মরোগ বিশেষজ্ঞ পরীক্ষিত'],
    regularPrice: 1800,
    salePrice: 1150,
    discountPercent: 36,
    inStock: true,
    stockQuantity: 45,
    images: ['/banner.jpeg'],
    variants: [
      { name: '৩০ মিলি ড্রপার বোতল', colorCode: '#3B82F6', image: '/banner.jpeg', stock: 45, extraPrice: 0 }
    ],
    sizes: ['30ml'],
    rating: 4.8,
    reviewCount: 96,
    isFeatured: false,
    badges: ['ন্যাচারাল স্কিনকেয়ার']
  }
];

// @desc    Get all products with search, category filtering & pagination
// @route   GET /api/products
exports.getProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 100);
    const skip = (page - 1) * limit;
    const { category, search, featured } = req.query;

    await connectDB();

    let query = {};
    if (category && category !== 'All' && category !== 'all') {
      query.category = new RegExp(`^${category}$`, 'i');
    }
    if (featured === 'true') {
      query.isFeatured = true;
    }
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { title: { $regex: s, $options: 'i' } },
        { englishTitle: { $regex: s, $options: 'i' } },
        { description: { $regex: s, $options: 'i' } },
      ];
    }

    let totalCount = await Product.countDocuments(query);
    if (totalCount === 0 && Object.keys(query).length === 0) {
      try {
        const overallCount = await Product.countDocuments();
        if (overallCount === 0) {
          console.log('Seeding initial products into MongoDB...');
          await Product.insertMany(sampleProducts);
          totalCount = await Product.countDocuments(query);
        }
      } catch (seedErr) {
        console.warn('Auto-seed note:', seedErr.message);
      }
    }
    const products = await Product.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      currentPage: page,
      data: products,
    });
  } catch (error) {
    console.error('getProducts error:', error.message);
    return res.status(500).json({ success: false, message: error.message, data: [] });
  }
};

// @desc    Get single product by id or slug
// @route   GET /api/products/:id
exports.getProductByIdentifier = async (req, res) => {
  try {
    const identifier = req.params.id || req.params.identifier || '';
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'পণ্য আইডি প্রয়োজন (Product ID required)' });
    }

    await connectDB();
    let product = null;

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      product = await Product.findById(identifier);
    }
    if (!product) {
      product = await Product.findOne({ slug: identifier });
    }

    if (product) {
      return res.status(200).json({ success: true, data: product });
    }

    return res.status(404).json({ success: false, message: 'পণ্যটি খুঁজে পাওয়া যায়নি (Product not found)' });
  } catch (error) {
    console.error('Get product error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create product
// @route   POST /api/products
exports.createProduct = async (req, res) => {
  try {
    await connectDB();
    const productData = { ...req.body };

    // Clean empty or whitespace-only slug so Mongoose pre-validate hook auto-generates
    if (!productData.slug || typeof productData.slug !== 'string' || productData.slug.trim() === '') {
      delete productData.slug;
    }

    // Parse numeric fields safely
    if (productData.regularPrice !== undefined) productData.regularPrice = Number(productData.regularPrice) || 0;
    if (productData.salePrice !== undefined) productData.salePrice = Number(productData.salePrice) || 0;
    if (productData.stockQuantity !== undefined) productData.stockQuantity = Number(productData.stockQuantity) || 0;

    // Calculate discount percent
    if (productData.regularPrice > 0 && productData.salePrice > 0) {
      productData.discountPercent = Math.round(
        ((productData.regularPrice - productData.salePrice) / productData.regularPrice) * 100
      );
    }

    if (!productData.description || !productData.description.trim()) {
      productData.description = productData.shortDescription || productData.title || 'প্রিমিয়াম কোয়ালিটি পণ্য';
    }

    // Ensure specifications & features are clean
    if (productData.specifications && Array.isArray(productData.specifications)) {
      productData.specifications = productData.specifications.filter((s) => s && s.key && s.value);
    }
    if (productData.features && Array.isArray(productData.features)) {
      productData.features = productData.features.filter(Boolean);
    }

    // Parse sizes safely from comma-separated string or array
    if (typeof productData.sizes === 'string') {
      productData.sizes = productData.sizes.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(productData.sizes)) {
      productData.sizes = productData.sizes.map((s) => (typeof s === 'string' ? s.trim() : String(s))).filter(Boolean);
    }

    // Ensure authentic reviews: newly added products default to 0 reviews & 0 rating
    if (!productData.reviews || !Array.isArray(productData.reviews) || productData.reviews.length === 0) {
      productData.reviews = [];
      productData.reviewCount = 0;
      productData.rating = 0;
    } else {
      productData.reviewCount = productData.reviews.length;
      const totalRatingSum = productData.reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
      productData.rating = Number((totalRatingSum / productData.reviews.length).toFixed(1));
    }

    const product = await Product.create(productData);
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Create product error:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const id = req.params.id || req.params.identifier || '';
    if (!id) {
      return res.status(400).json({ success: false, message: 'পণ্য আইডি প্রয়োজন (Product ID required)' });
    }

    await connectDB();

    const updatePayload = { ...req.body };
    if (updatePayload.regularPrice !== undefined && updatePayload.salePrice !== undefined) {
      const reg = Number(updatePayload.regularPrice) || 0;
      const sale = Number(updatePayload.salePrice) || 0;
      if (reg > 0 && sale > 0) {
        updatePayload.discountPercent = Math.round(((reg - sale) / reg) * 100);
      }
    }

    if (updatePayload.sizes !== undefined) {
      if (typeof updatePayload.sizes === 'string') {
        updatePayload.sizes = updatePayload.sizes.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (Array.isArray(updatePayload.sizes)) {
        updatePayload.sizes = updatePayload.sizes.map((s) => (typeof s === 'string' ? s.trim() : String(s))).filter(Boolean);
      }
    }

    let product = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findByIdAndUpdate(id, updatePayload, {
        new: true,
        runValidators: true,
      });
    }
    if (!product) {
      product = await Product.findOneAndUpdate({ slug: id }, updatePayload, {
        new: true,
        runValidators: true,
      });
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'আপডেট করার জন্য পণ্যটি খুঁজে পাওয়া যায়নি (Product not found)' });
    }

    return res.status(200).json({
      success: true,
      message: 'পণ্য সফলভাবে আপডেট করা হয়েছে!',
      data: product
    });
  } catch (error) {
    console.error('Update product error:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    const id = req.params.id || req.params.identifier || '';
    if (!id) {
      return res.status(400).json({ success: false, message: 'পণ্য আইডি প্রদান করা হয়নি (Product ID required)' });
    }

    await connectDB();
    let product = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findByIdAndDelete(id);
    }
    if (!product) {
      product = await Product.findOneAndDelete({ slug: id });
    }
    if (!product) {
      product = await Product.findOneAndDelete({ _id: id });
    }
    if (!product) {
      product = await Product.findOneAndDelete({ title: id });
    }

    if (!product) {
      return res.status(200).json({
        success: true,
        message: 'পণ্যটি ইতিমধ্যে ডাটাবেজ থেকে মুছে ফেলা হয়েছে বা ডাটাবেজে নেই।',
        data: { id }
      });
    }

    return res.status(200).json({
      success: true,
      message: `পণ্য "${product.title}" সফলভাবে ডিলিট করা হয়েছে!`,
      data: { id: product._id, title: product.title }
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update product stock & availability
// @route   PATCH /api/products/:id/stock
exports.updateProductStock = async (req, res) => {
  try {
    const id = req.params.id || req.params.identifier || '';
    if (!id) {
      return res.status(400).json({ success: false, message: 'পণ্য আইডি প্রদান করা হয়নি (Product ID required)' });
    }

    await connectDB();
    const { inStock, stockQuantity, variants } = req.body;
    const updateData = {};
    if (typeof inStock === 'boolean') updateData.inStock = inStock;
    if (typeof stockQuantity === 'number') updateData.stockQuantity = stockQuantity;
    if (variants && Array.isArray(variants)) updateData.variants = variants;

    let product = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findByIdAndUpdate(id, { $set: updateData }, {
        new: true,
        runValidators: true,
      });
    }
    if (!product) {
      product = await Product.findOneAndUpdate({ slug: id }, { $set: updateData }, {
        new: true,
        runValidators: true,
      });
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'স্টক আপডেট করার জন্য পণ্য খুঁজে পাওয়া যায়নি (Product not found)' });
    }

    return res.status(200).json({
      success: true,
      message: 'স্টক সফলভাবে আপডেট হয়েছে',
      data: product
    });
  } catch (error) {
    console.error('Update stock error:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Add review to product
// @route   POST /api/products/:id/reviews
exports.addProductReview = async (req, res) => {
  try {
    const identifier = req.params.id || '';
    const { userName, userEmail, userPhoto, rating, comment, isVerifiedBuyer } = req.body;

    if (!rating || Number(rating) < 1 || Number(rating) > 5) {
      return res.status(400).json({ success: false, message: 'অনুগ্রহ করে ১ থেকে ৫ এর মধ্যে রেটিং দিন (Valid rating 1-5 required)' });
    }
    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'অনুগ্রহ করে আপনার মূল্যবান রিভিউটি লিখুন (Review comment required)' });
    }

    await connectDB();
    let product = null;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      product = await Product.findById(identifier);
    }
    if (!product) {
      product = await Product.findOne({ slug: identifier });
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'পণ্যটি খুঁজে পাওয়া যায়নি (Product not found)' });
    }

    const reviewObj = {
      userName: (userName || 'সম্মানিত ক্রেতা').trim(),
      userEmail: (userEmail || '').trim(),
      userPhoto: userPhoto || '',
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment: comment.trim(),
      isVerifiedBuyer: Boolean(isVerifiedBuyer),
      createdAt: new Date(),
    };

    if (!Array.isArray(product.reviews)) {
      product.reviews = [];
    }

    product.reviews.unshift(reviewObj);

    // Recalculate average rating & reviewCount
    const totalRatingSum = product.reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
    product.rating = Number((totalRatingSum / product.reviews.length).toFixed(1));
    product.reviewCount = product.reviews.length;

    await product.save();

    return res.status(201).json({
      success: true,
      message: 'আপনার রিভিউ সফলভাবে প্রকাশ করা হয়েছে! ধন্যবাদ।',
      data: reviewObj,
      rating: product.rating,
      reviewCount: product.reviewCount,
      reviews: product.reviews,
    });
  } catch (error) {
    console.error('Add review error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all reviews for a product
// @route   GET /api/products/:id/reviews
exports.getProductReviews = async (req, res) => {
  try {
    const identifier = req.params.id || '';
    await connectDB();
    let product = null;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      product = await Product.findById(identifier, 'reviews rating reviewCount title');
    }
    if (!product) {
      product = await Product.findOne({ slug: identifier }, 'reviews rating reviewCount title');
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'পণ্যটি পাওয়া যায়নি' });
    }

    return res.status(200).json({
      success: true,
      rating: product.rating !== undefined ? product.rating : 0,
      reviewCount: product.reviewCount || 0,
      data: product.reviews || [],
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete review from product
// @route   DELETE /api/products/:id/reviews/:reviewId
exports.deleteProductReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    await connectDB();
    let product = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      product = await Product.findById(id);
    }
    if (!product) {
      product = await Product.findOne({ slug: id });
    }

    if (!product) {
      return res.status(404).json({ success: false, message: 'পণ্যটি পাওয়া যায়নি' });
    }

    product.reviews = (product.reviews || []).filter(
      (r) => String(r._id) !== String(reviewId)
    );

    if (product.reviews.length > 0) {
      const totalRatingSum = product.reviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0);
      product.rating = Number((totalRatingSum / product.reviews.length).toFixed(1));
      product.reviewCount = product.reviews.length;
    } else {
      product.rating = 0;
      product.reviewCount = 0;
    }

    await product.save();

    return res.status(200).json({
      success: true,
      message: 'রিভিউটি সফলভাবে মুছে ফেলা হয়েছে',
      rating: product.rating,
      reviewCount: product.reviewCount,
      reviews: product.reviews,
    });
  } catch (error) {
    console.error('Delete review error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

