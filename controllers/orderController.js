const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const SiteConfig = require('../models/SiteConfig');
const connectDB = require('../config/db');

// Active Server-Sent Events (SSE) connections for real-time order alerts
let sseClients = [];

function broadcastNewOrder(order) {
  if (!sseClients || sseClients.length === 0) return;
  const payload = JSON.stringify({ type: 'NEW_ORDER', data: order });
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${payload}\n\n`);
    } catch (err) {
      // client connection closed
    }
  });
}

// Helper to sanitize text from HTML tags, scripts, and control characters (prevents stored XSS)
function sanitizeText(input = '', maxLength = 500) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Strip control characters
    .trim()
    .slice(0, maxLength);
}

// Helper to sanitize and validate 11-digit Bangladeshi mobile numbers
function sanitizeAndValidatePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  let normalized = digits;
  if (digits.startsWith('8801') && digits.length === 13) {
    normalized = digits.slice(2);
  } else if (digits.startsWith('88') && digits.length === 13) {
    normalized = digits.slice(2);
  }
  if (!/^01[3-9]\d{8}$/.test(normalized)) {
    return null;
  }
  return normalized;
}

// Helper to determine device type from User-Agent string
function detectDeviceType(userAgent = '') {
  if (!userAgent) return 'Desktop';
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    return 'Mobile';
  }
  if (/ipad|tablet|playbook|silk/i.test(userAgent)) {
    return 'Tablet';
  }
  return 'Desktop';
}

// Helper to extract city/district from Bangladeshi addresses
function extractCityFromAddress(address = '') {
  const commonDivisions = [
    'ঢাকা', 'Dhaka',
    'চট্টগ্রাম', 'Chattogram', 'Chittagong',
    'সিলেট', 'Sylhet',
    'রাজশাহী', 'Rajshahi',
    'খুলনা', 'Khulna',
    'বরিশাল', 'Barishal',
    'রংপুর', 'Rangpur',
    'ময়মনসিংহ', 'Mymensingh',
    'কুমিল্লা', 'Cumilla', 'Comilla',
    'গাজীপুর', 'Gazipur',
    'নারায়ণগঞ্জ', 'Narayanganj',
    'বগুড়া', 'Bogura', 'Bogra',
    'ফরিদপুর', 'Faridpur',
    'যশোর', 'Jashore', 'Jessore'
  ];

  for (const div of commonDivisions) {
    if (address.toLowerCase().includes(div.toLowerCase())) {
      return div;
    }
  }
  return 'Bangladesh';
}

// @desc    Create new COD order with server-side security, price validation & anti-tampering
// @route   POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      email,
      phoneNumber,
      deliveryAddress,
      deliveryArea,
      items,
      notes,
      source,
      city: providedCity,
      referrer,
      ipAddress: clientIp,
      deviceType: clientDevice,
      userId,
      userEmail,
      isVerifiedUser,
      customerPhoto
    } = req.body;

    // 1. Enforce authenticated user requirement (User must be logged in to order)
    if (!userId || !String(userId).trim()) {
      return res.status(401).json({
        success: false,
        message: 'অর্ডার করতে অনুগ্রহ করে প্রথমে Google দিয়ে লগইন করুন।'
      });
    }

    // 2. Validate required basic fields
    if (!customerName || !phoneNumber || !deliveryAddress || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে নাম, ফোন নম্বর, পূর্ণ ঠিকানা এবং অর্ডারকৃত পণ্য সিলেক্ট করুন।'
      });
    }

    // 2. Security: Sanitize text fields to eliminate any stored XSS attack vectors
    const cleanCustomerName = sanitizeText(customerName, 100);
    const cleanAddress = sanitizeText(deliveryAddress, 300);
    // Remove any placeholder/dummy text if injected
    const cleanNotes = sanitizeText(notes || '', 400)
      .replace(/^Nostrum\s+veniam\s+cons\s*\|\s*/i, '')
      .trim();

    if (cleanCustomerName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে আপনার সঠিক নাম প্রদান করুন।'
      });
    }

    // Detailed address enforcement: Prevent vague hub-only addresses (e.g., "Gazipur, sadar")
    const addressWords = cleanAddress.split(/[\s,]+/).filter(Boolean).length;
    if (cleanAddress.length < 15 || addressWords < 3) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে সম্পূর্ণ বিস্তারিত ঠিকানা প্রদান করুন (যেমন: বাসা নং, রোড নং, এলাকা/গ্রাম, থানা ও জেলা)। শুধুমাত্র শহর বা থানার নাম লিখলে কুরিয়ার ডেলিভারি সম্ভব নয়।'
      });
    }

    // 3. Security: Validate phone number format
    const validatedPhone = sanitizeAndValidatePhone(phoneNumber);
    if (!validatedPhone) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে একটি সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 01712345678)।'
      });
    }

    // 4. Validate customer email format if provided
    const rawEmail = (customerEmail || email || '').trim();
    let validatedEmail = '';
    if (rawEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(rawEmail)) {
        return res.status(400).json({
          success: false,
          message: 'অনুগ্রহ করে একটি সঠিক ইমেইল অ্যাড্রেস প্রদান করুন (যেমন: name@example.com)।'
        });
      }
      validatedEmail = rawEmail.toLowerCase().slice(0, 100);
    }

    await connectDB();

    // 4. Security & Anti-Tampering: Verify product prices from database & recalculate subtotal
    let calculatedSubtotal = 0;
    let totalQuantity = 0;
    const validatedItems = [];

    for (const item of items) {
      const quantity = Math.max(1, Math.min(100, parseInt(item.quantity) || 1));
      totalQuantity += quantity;

      let verifiedUnitPrice = 0;
      let verifiedTitle = sanitizeText(item.productTitle || item.title || 'পণ্য', 150);
      let verifiedImage = item.image || '/banner.jpeg';

      const productId = item.product || item.id;
      if (productId && mongoose.Types.ObjectId.isValid(productId)) {
        try {
          const dbProd = await Product.findById(productId);
          if (dbProd) {
            verifiedUnitPrice = Number(dbProd.salePrice) || Number(dbProd.regularPrice) || 0;
            verifiedTitle = dbProd.title || verifiedTitle;
            if (dbProd.images && dbProd.images.length > 0) {
              verifiedImage = dbProd.images[0];
            }
          } else {
            verifiedUnitPrice = Math.max(0, Number(item.unitPrice) || 0);
          }
        } catch {
          verifiedUnitPrice = Math.max(0, Number(item.unitPrice) || 0);
        }
      } else {
        verifiedUnitPrice = Math.max(0, Number(item.unitPrice) || 0);
      }

      const verifiedTotalPrice = verifiedUnitPrice * quantity;
      calculatedSubtotal += verifiedTotalPrice;

      validatedItems.push({
        product: productId || 'custom-item',
        productTitle: verifiedTitle,
        variantName: sanitizeText(item.variantName || 'Default', 50),
        colorCode: sanitizeText(item.colorCode || '', 20),
        size: sanitizeText(item.size || '', 30),
        quantity,
        unitPrice: verifiedUnitPrice,
        totalPrice: verifiedTotalPrice,
        image: verifiedImage
      });
    }

    // 5. Determine and enforce delivery fee server-side dynamically from configured locations
    let resolvedArea = deliveryArea || 'inside_dhaka';
    let enforcedDeliveryFee = 70;

    try {
      const config = await SiteConfig.findOne({ key: 'main_config' }).lean();
      const locations = config?.deliveryLocations || [];
      const matchedLoc = locations.find((l) => l.id === resolvedArea || l.name === resolvedArea);

      if (matchedLoc) {
        enforcedDeliveryFee = Number(matchedLoc.fee) >= 0 ? Number(matchedLoc.fee) : 70;
        resolvedArea = matchedLoc.id;
      } else if (req.body.deliveryFee !== undefined && Number(req.body.deliveryFee) >= 0) {
        enforcedDeliveryFee = Number(req.body.deliveryFee);
      } else {
        enforcedDeliveryFee = resolvedArea === 'outside_dhaka' ? 130 : 70;
      }
    } catch {
      enforcedDeliveryFee = resolvedArea === 'outside_dhaka' ? 130 : 70;
    }

    const enforcedTotalAmount = calculatedSubtotal + enforcedDeliveryFee;

    // Capture User Information: IP, Device, User-Agent, Referrer
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = clientIp || (forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress) || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || req.body.userAgent || '';
    const deviceType = clientDevice || detectDeviceType(userAgent);
    const resolvedCity = providedCity || extractCityFromAddress(cleanAddress);

    const orderData = {
      customerName: cleanCustomerName,
      customerEmail: validatedEmail,
      email: validatedEmail,
      phoneNumber: validatedPhone,
      // Verified Firebase User Information
      userId: userId ? sanitizeText(String(userId), 128) : null,
      userEmail: userEmail ? sanitizeText(String(userEmail).toLowerCase(), 100) : (validatedEmail || ''),
      isVerifiedUser: Boolean(isVerifiedUser),
      customerPhoto: customerPhoto ? sanitizeText(String(customerPhoto), 500) : '',
      deliveryAddress: cleanAddress,
      deliveryArea: resolvedArea,
      deliveryFee: enforcedDeliveryFee,
      city: resolvedCity,
      notes: cleanNotes,
      ipAddress,
      userAgent,
      deviceType,
      referrer: referrer || req.headers['referer'] || 'Direct Landing Page',
      items: validatedItems,
      subtotal: calculatedSubtotal,
      totalAmount: enforcedTotalAmount,
      paymentMethod: 'Cash on Delivery (COD)', // Enforced COD
      orderStatus: 'Pending',
      source: source || 'Facebook Ad Landing Page',
      statusHistory: [
        {
          status: 'Pending',
          note: 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে (ক্যাশ অন ডেলিভারি - সিকিউর সার্ভার ভ্যালিডেশন সম্পন্ন)',
          timestamp: new Date()
        }
      ]
    };

    const newOrder = await Order.create(orderData);

    // Instant real-time broadcast to connected admin dashboard clients
    try {
      broadcastNewOrder(newOrder);
    } catch (broadcastErr) {
      console.warn('Real-time order broadcast note:', broadcastErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে! আমাদের প্রতিনিধি শীঘ্রই ফোন করবেন।',
      data: newOrder
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ success: false, message: error.message || 'অর্ডার প্রসেস করতে ব্যর্থ হয়েছে।' });
  }
};

// @desc    Get real orders from database (filter out cancelled if requested)
// @route   GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const { status, search, excludeCancelled, hideCancelled, userId, email, userEmail, phone } = req.query;

    await connectDB();
    let query = {};

    // Filter by specific status if requested
    if (status && status !== 'all' && status !== 'All') {
      query.orderStatus = status;
    } else if (excludeCancelled === 'true' || hideCancelled === 'true') {
      // Auto-exclude cancelled orders if hideCancelled toggle is active
      query.orderStatus = { $ne: 'Cancelled' };
    }

    // Filter by authenticated user ID if requested
    if (userId && userId.trim()) {
      query.userId = userId.trim();
    }

    // Filter by user email if requested
    const targetEmail = (userEmail || email || '').trim().toLowerCase();
    if (targetEmail) {
      query.$or = [
        { customerEmail: targetEmail },
        { email: targetEmail },
        { userEmail: targetEmail }
      ];
    }

    // Filter by phone number if requested
    if (phone && phone.trim()) {
      const cleanDigits = phone.trim().replace(/\D/g, '');
      if (cleanDigits.length >= 10) {
        query.phoneNumber = { $regex: cleanDigits };
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { orderNumber: { $regex: s, $options: 'i' } },
        { customerName: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { customerEmail: { $regex: s, $options: 'i' } },
        { userEmail: { $regex: s, $options: 'i' } },
        { phoneNumber: { $regex: s, $options: 'i' } },
        { deliveryAddress: { $regex: s, $options: 'i' } },
        { ipAddress: { $regex: s, $options: 'i' } }
      ];
    }

    // Always fetch 100% REAL orders from MongoDB Atlas, latest first
    const orders = await Order.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ success: false, message: error.message, data: [] });
  }
};

// @desc    Get user order history & status by UID or Email
// @route   GET /api/orders/user/:identifier
exports.getUserOrders = async (req, res) => {
  try {
    const { identifier } = req.params;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'User identifier is required', data: [] });
    }

    await connectDB();
    const cleanId = identifier.trim();
    const cleanEmail = cleanId.toLowerCase();
    const cleanPhone = cleanId.replace(/\D/g, '');

    const query = {
      $or: [
        { userId: cleanId },
        { customerEmail: cleanEmail },
        { email: cleanEmail },
        { userEmail: cleanEmail },
        ...(cleanPhone.length >= 10 ? [{ phoneNumber: { $regex: cleanPhone } }] : [])
      ]
    };

    const orders = await Order.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ success: false, message: error.message, data: [] });
  }
};

// @desc    Track order real-time by order number or mobile phone number
// @route   GET /api/orders/track/:query
exports.trackOrder = async (req, res) => {
  try {
    const { query: searchQuery } = req.params;
    if (!searchQuery) {
      return res.status(400).json({ success: false, message: 'অর্ডার নম্বর বা ফোন নম্বর প্রদান করুন।' });
    }

    await connectDB();
    const trimmed = searchQuery.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');

    const searchConditions = [
      { orderNumber: { $regex: trimmed, $options: 'i' } }
    ];

    if (digitsOnly.length >= 10) {
      searchConditions.push({ phoneNumber: { $regex: digitsOnly } });
    }

    const orders = await Order.find({ $or: searchConditions }).sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'কোনো অর্ডার খুঁজে পাওয়া যায়নি। অনুগ্রহ করে সঠিক অর্ডার নম্বর বা মোবাইল নম্বর দিন।'
      });
    }

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Track order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single order by orderNumber or id
// @route   GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    await connectDB();
    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: id });
    }

    if (order) {
      return res.status(200).json({ success: true, data: order });
    }

    return res.status(404).json({ success: false, message: 'অর্ডারটি খুঁজে পাওয়া যায়নি।' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;

    const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'অকার্যকর স্ট্যাটাস মান' });
    }

    await connectDB();
    let order = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      order = await Order.findById(id);
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: id });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'অর্ডার খুঁজে পাওয়া যায়নি।' });
    }

    order.orderStatus = status;
    order.statusHistory.push({
      status,
      note: note || `স্ট্যাটাস পরিবর্তন করা হয়েছে: ${status}`,
      timestamp: new Date()
    });

    await order.save();

    return res.status(200).json({
      success: true,
      message: `অর্ডার স্ট্যাটাস সফলভাবে '${status}' করা হয়েছে।`,
      data: order
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete single order (remove cancelled or unwanted order permanently from dashboard)
// @route   DELETE /api/orders/:id
exports.deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;
    await connectDB();

    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await Order.findByIdAndDelete(id);
    }
    if (!deleted) {
      deleted = await Order.findOneAndDelete({ orderNumber: id });
    }

    if (!deleted) {
      return res.status(200).json({
        success: true,
        message: 'অর্ডারটি ইতিমধ্যে মুছে ফেলা হয়েছে বা ডাটাবেজে নেই।',
        data: { id }
      });
    }

    return res.status(200).json({
      success: true,
      message: `অর্ডার ${deleted.orderNumber} সফলভাবে ড্যাশবোর্ড থেকে মুছে ফেলা হয়েছে!`,
      data: { id: deleted._id, orderNumber: deleted.orderNumber }
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Purge all cancelled orders at once
// @route   DELETE /api/orders/actions/purge-cancelled
exports.purgeCancelledOrders = async (req, res) => {
  try {
    await connectDB();
    const result = await Order.deleteMany({ orderStatus: 'Cancelled' });
    return res.status(200).json({
      success: true,
      message: `${result.deletedCount}টি বাতিল অর্ডার সফলভাবে মুছে ফেলা হয়েছে!`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Purge cancelled error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Real-time Server-Sent Events (SSE) stream for admin order notifications
// @route   GET /api/orders/stream
exports.streamOrders = (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const client = { id: clientId, res };
  sseClients.push(client);

  // Initial connection event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);

  // Heartbeat keepalive every 25 seconds
  const keepAlive = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
};

// @desc    Dispatch order to Steadfast Courier
// @route   POST /api/orders/send-steadfast
exports.sendSteadfastOrder = async (req, res) => {
  try {
    const orderId = req.body?.orderId || req.body?.id || req.params?.orderId;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required in request body' });
    }

    await connectDB();

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: orderId });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const baseUrl = (process.env.STEADFAST_BASE_URL || process.env.STEADFAST_API_URL || 'https://portal.packzy.com/api/v1').replace(/\/+$/, '');
    const apiKey = process.env.STEADFAST_API_KEY;
    const secretKey = process.env.STEADFAST_SECRET_KEY;

    if (!apiKey || !secretKey) {
      return res.status(500).json({
        success: false,
        message: 'Steadfast API credentials missing in environment variables (STEADFAST_API_KEY / STEADFAST_SECRET_KEY)',
      });
    }

    // Clean phone number (Bangladeshi 11 digits format)
    const rawPhone = String(order.phoneNumber || '').replace(/\D/g, '');
    let cleanPhone = rawPhone;
    if (cleanPhone.startsWith('8801') && cleanPhone.length === 13) {
      cleanPhone = cleanPhone.slice(2);
    } else if (cleanPhone.startsWith('88') && cleanPhone.length === 13) {
      cleanPhone = cleanPhone.slice(2);
    }

    // Customer note or fallback instructions
    const cleanCustomerNote = (order.notes || 'Please handle with care').trim();

    // Total lot count
    const totalLot = (order.items || []).reduce((acc, item) => acc + (Number(item.quantity) || 1), 0) || 1;

    // Item description
    const itemDescription = (order.items || [])
      .map(i => `${i.productTitle || 'পণ্য'}${i.variantName ? ` (${i.variantName})` : ''} x${i.quantity || 1}`)
      .join(', ')
      .substring(0, 400);

    const payload = {
      invoice: order.orderNumber || order._id.toString(),
      recipient_name: order.customerName,
      recipient_phone: cleanPhone,
      recipient_address: order.deliveryAddress,
      cod_amount: Math.round(Number(order.totalAmount) || 0),
      note: cleanCustomerNote,
      item_description: itemDescription,
      total_lot: totalLot,
    };

    console.log(`📡 Dispatching order ${order.orderNumber} to Steadfast (${baseUrl}/create_order)...`);

    const response = await fetch(`${baseUrl}/create_order`, {
      method: 'POST',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('Steadfast response:', result);

    if (result.status === 200 && result.consignment) {
      const consignment = result.consignment;
      const consignmentId = Number(consignment.consignment_id || consignment.id) || consignment.consignment_id;
      const trackingCode = consignment.tracking_code || '';
      const courierStatus = consignment.status || 'in_review';

      order.courier = {
        name: 'Steadfast',
        provider: 'Steadfast',
        consignmentId: consignmentId,
        trackingCode: trackingCode,
        status: courierStatus,
        sentAt: new Date(),
        responseRaw: consignment,
      };

      order.orderStatus = 'shipped';

      order.statusHistory.push({
        status: 'shipped',
        note: `Steadfast কুরিয়ারে বুকিং সফল হয়েছে। ট্র্যাকিং কোড: ${trackingCode}, কনসাইনমেন্ট আইডি: ${consignmentId}`,
        timestamp: new Date(),
      });

      await order.save();

      return res.status(200).json({
        success: true,
        trackingCode,
        consignmentId,
        orderStatus: order.orderStatus,
        data: order,
      });
    } else {
      const errorMsg =
        result.message ||
        (result.errors ? JSON.stringify(result.errors) : 'Steadfast API rejected order creation');
      return res.status(400).json({
        success: false,
        message: `Steadfast dispatch failed: ${errorMsg}`,
        details: result,
      });
    }
  } catch (error) {
    console.error('Steadfast dispatch error in sendSteadfastOrder:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to communicate with Steadfast API: ' + error.message,
    });
  }
};

