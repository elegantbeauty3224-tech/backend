const mongoose = require('mongoose');
const Product = require('../models/Product');
const connectDB = require('../config/db');

// Multi-category sample products matching the banner info


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

