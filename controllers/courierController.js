const mongoose = require('mongoose');
const Order = require('../models/Order');
const connectDB = require('../config/db');

// Helper to clean and format Bangladeshi mobile numbers (must be 11 digits starting with 01)
function sanitizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('8801')) {
    return digits.slice(2);
  }
  if (digits.startsWith('88') && digits.length === 13) {
    return digits.slice(2);
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return digits;
  }
  if (digits.length === 10 && digits.startsWith('1')) {
    return `0${digits}`;
  }
  return digits;
}

// @desc    Dispatch single order to Steadfast (Street Fast) Courier
// @route   POST /api/courier/send/:orderId
exports.sendOrderToSteadfast = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { force } = req.query;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'অর্ডার আইডি প্রদান করা হয়নি।' });
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
      return res.status(404).json({ success: false, message: 'অর্ডারটি খুঁজে পাওয়া যায়নি।' });
    }

    // Check if already dispatched to Steadfast
    if (order.courier && order.courier.consignmentId && force !== 'true') {
      return res.status(400).json({
        success: false,
        message: `এই অর্ডারটি ইতিমধ্যে Steadfast কুরিয়ারে বুকিং করা হয়েছে (ট্র্যাকিং: ${order.courier.trackingCode || order.courier.consignmentId})। পুনরায় পাঠাতে force=true ব্যবহার করুন।`,
        data: order
      });
    }

    const cleanPhone = sanitizePhone(order.phoneNumber);
    if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
      return res.status(400).json({
        success: false,
        message: `গ্রাহকের ফোন নম্বর "${order.phoneNumber}" সঠিক নয়। Steadfast কুরিয়ারের জন্য ১১ ডিজিটের ভ্যালিড ফোন নম্বর (যেমন 017XXXXXXXX) আবশ্যক।`
      });
    }

    if (!order.deliveryAddress || order.deliveryAddress.trim().length < 12) {
      return res.status(400).json({
        success: false,
        message: 'গ্রাহকের সম্পূর্ণ বিস্তারিত ঠিকানা প্রয়োজন (বাসা/রোড নম্বর, এলাকা, থানা ও জেলা)।'
      });
    }

    const apiUrl = (process.env.STEADFAST_API_URL || 'https://portal.packzy.com/api/v1').replace(/\/+$/, '');
    const apiKey = process.env.STEADFAST_API_KEY || '6ibojlrmcwciwzh3olsvcqazz1dfg2n3';
    const secretKey = process.env.STEADFAST_SECRET_KEY || 'jnmvuiqf9ek8odozxs8hzuc8';

    // Total lot count (total items)
    const totalLot = (order.items || []).reduce((acc, item) => acc + (Number(item.quantity) || 1), 0) || 1;

    // Formatted product details strictly for item_description
    const itemDescription = (order.items || [])
      .map(i => `${i.productTitle || 'পণ্য'}${i.variantName ? ` (${i.variantName})` : ''}${i.size ? ` [${i.size}]` : ''} x${i.quantity || 1}`)
      .join(', ')
      .substring(0, 400);

    // Note field reserved strictly for customer's actual delivery instructions (or empty string "")
    // Strip any residual placeholder/dummy text if present
    const cleanCustomerNote = (order.notes || '')
      .replace(/^Nostrum\s+veniam\s+cons\s*\|\s*/i, '')
      .trim();

    const customerEmail = (order.email || order.customerEmail || '').trim();

    const payload = {
      invoice: order.orderNumber,
      recipient_name: order.customerName,
      recipient_phone: cleanPhone,
      recipient_address: order.deliveryAddress,
      cod_amount: Math.round(Number(order.totalAmount) || 0),
      note: cleanCustomerNote, // STRICTLY customer instructions or ""
      item_description: itemDescription, // formatted product details
      total_lot: totalLot, // total item count
    };

    if (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      payload.recipient_email = customerEmail;
    }

    console.log(`📡 Dispatching order ${order.orderNumber} to Steadfast Courier...`);

    const response = await fetch(`${apiUrl}/create_order`, {
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

      order.courier = {
        provider: 'Steadfast',
        consignmentId: String(consignment.consignment_id || consignment.id || ''),
        trackingCode: consignment.tracking_code || '',
        status: consignment.status || 'in_review',
        sentAt: new Date(),
        responseRaw: consignment,
      };

      // Automatically move status to Shipped if currently Pending/Confirmed/Processing
      if (['Pending', 'Confirmed', 'Processing'].includes(order.orderStatus)) {
        order.orderStatus = 'Shipped';
      }

      order.statusHistory.push({
        status: order.orderStatus,
        note: `Steadfast কুরিয়ারে বুকিং সফল হয়েছে। ট্র্যাকিং কোড: ${consignment.tracking_code || 'N/A'}, কনসাইনমেন্ট আইডি: ${consignment.consignment_id || 'N/A'}`,
        timestamp: new Date(),
      });

      await order.save();

      return res.status(200).json({
        success: true,
        message: `অর্ডার ${order.orderNumber} সফলভাবে Steadfast কুরিয়ারে বুকিং করা হয়েছে!`,
        data: order,
        consignment,
      });
    } else {
      const errorMsg =
        result.message ||
        (result.errors ? JSON.stringify(result.errors) : 'Steadfast API অর্ডার গ্রহণ করতে পারেনি।');
      return res.status(400).json({
        success: false,
        message: `Steadfast কুরিয়ার বুকিং ব্যর্থ: ${errorMsg}`,
        details: result,
      });
    }
  } catch (error) {
    console.error('Steadfast dispatch error:', error);
    return res.status(500).json({
      success: false,
      message: 'সার্ভার থেকে Steadfast কুরিয়ার এপিআই-তে সংযোগ করা যায়নি: ' + error.message,
    });
  }
};

// @desc    Track order directly from Steadfast Courier API
// @route   GET /api/courier/tracking/:orderId
exports.trackSteadfastOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    await connectDB();

    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderNumber: orderId });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'অর্ডারটি খুঁজে পাওয়া যায়নি।' });
    }

    const consignmentId = order.courier?.consignmentId;
    const trackingCode = order.courier?.trackingCode;
    const invoice = order.orderNumber;

    if (!consignmentId && !trackingCode && !invoice) {
      return res.status(400).json({
        success: false,
        message: 'এই অর্ডারটি এখনও কুরিয়ারে বুকিং করা হয়নি।',
      });
    }

    const apiUrl = (process.env.STEADFAST_API_URL || 'https://portal.packzy.com/api/v1').replace(/\/+$/, '');
    const apiKey = process.env.STEADFAST_API_KEY || '6ibojlrmcwciwzh3olsvcqazz1dfg2n3';
    const secretKey = process.env.STEADFAST_SECRET_KEY || 'jnmvuiqf9ek8odozxs8hzuc8';

    // Prioritize tracking by consignment ID, then tracking code, then invoice
    let endpoint = '';
    if (consignmentId) {
      endpoint = `${apiUrl}/status_by_cid/${consignmentId}`;
    } else if (trackingCode) {
      endpoint = `${apiUrl}/status_by_trackingcode/${trackingCode}`;
    } else {
      endpoint = `${apiUrl}/status_by_invoice/${invoice}`;
    }

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (result.status === 200) {
      const courierStatus = result.delivery_status || result.status || 'unknown';

      // Sync status to database
      if (!order.courier) {
        order.courier = { provider: 'Steadfast' };
      }
      order.courier.status = courierStatus;

      // Map Steadfast delivery statuses to store order statuses
      if (['delivered', 'partial_delivered'].includes(courierStatus.toLowerCase())) {
        if (order.orderStatus !== 'Delivered') {
          order.orderStatus = 'Delivered';
          order.statusHistory.push({
            status: 'Delivered',
            note: `কুরিয়ার ট্র্যাকিং অনুযায়ী পণ্য ডেলিভারি সম্পন্ন হয়েছে (${courierStatus})`,
            timestamp: new Date(),
          });
        }
      } else if (['cancelled', 'cancelled_by_recipient'].includes(courierStatus.toLowerCase())) {
        if (order.orderStatus !== 'Cancelled') {
          order.orderStatus = 'Cancelled';
          order.statusHistory.push({
            status: 'Cancelled',
            note: `কুরিয়ার ট্র্যাকিং অনুযায়ী ডেলিভারি বাতিল হয়েছে (${courierStatus})`,
            timestamp: new Date(),
          });
        }
      }

      await order.save();

      return res.status(200).json({
        success: true,
        data: {
          courierStatus,
          orderStatus: order.orderStatus,
          trackingCode: order.courier.trackingCode,
          consignmentId: order.courier.consignmentId,
          raw: result,
        },
      });
    } else {
      return res.status(404).json({
        success: false,
        message: result.message || 'কুরিয়ারে ট্র্যাকিং তথ্য পাওয়া যায়নি।',
        details: result,
      });
    }
  } catch (error) {
    console.error('Steadfast tracking error:', error);
    return res.status(500).json({
      success: false,
      message: 'ট্র্যাকিং তথ্য সংগ্রহে সমস্যা হয়েছে: ' + error.message,
    });
  }
};

// @desc    Get Steadfast Courier account current balance
// @route   GET /api/courier/balance
exports.getSteadfastBalance = async (req, res) => {
  try {
    const apiUrl = (process.env.STEADFAST_API_URL || 'https://portal.packzy.com/api/v1').replace(/\/+$/, '');
    const apiKey = process.env.STEADFAST_API_KEY || '6ibojlrmcwciwzh3olsvcqazz1dfg2n3';
    const secretKey = process.env.STEADFAST_SECRET_KEY || 'jnmvuiqf9ek8odozxs8hzuc8';

    const response = await fetch(`${apiUrl}/get_balance`, {
      method: 'GET',
      headers: {
        'Api-Key': apiKey,
        'Secret-Key': secretKey,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (result.status === 200) {
      return res.status(200).json({
        success: true,
        balance: result.current_balance !== undefined ? result.current_balance : 0,
        provider: 'Steadfast Courier',
        portalUrl: 'https://portal.packzy.com',
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Steadfast ব্যালেন্স ফেচ করা যায়নি। API Key যাচাই করুন।',
      });
    }
  } catch (error) {
    console.error('Steadfast balance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Steadfast সার্ভারের সাথে যোগাযোগ করা যায়নি: ' + error.message,
    });
  }
};

// @desc    Bulk dispatch multiple orders to Steadfast
// @route   POST /api/courier/send-bulk
exports.sendBulkOrdersToSteadfast = async (req, res) => {
  try {
    const { orderIds } = req.body;
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'অনুগ্রহ করে অন্তত একটি অর্ডার সিলেক্ট করুন।',
      });
    }

    await connectDB();
    const results = {
      total: orderIds.length,
      successCount: 0,
      failedCount: 0,
      successful: [],
      failed: [],
    };

    const apiUrl = (process.env.STEADFAST_API_URL || 'https://portal.packzy.com/api/v1').replace(/\/+$/, '');
    const apiKey = process.env.STEADFAST_API_KEY || '6ibojlrmcwciwzh3olsvcqazz1dfg2n3';
    const secretKey = process.env.STEADFAST_SECRET_KEY || 'jnmvuiqf9ek8odozxs8hzuc8';

    for (const id of orderIds) {
      try {
        let order = null;
        if (mongoose.Types.ObjectId.isValid(id)) {
          order = await Order.findById(id);
        }
        if (!order) {
          order = await Order.findOne({ orderNumber: id });
        }

        if (!order) {
          results.failedCount++;
          results.failed.push({ id, reason: 'অর্ডার পাওয়া যায়নি' });
          continue;
        }

        if (order.courier?.consignmentId) {
          results.failedCount++;
          results.failed.push({
            id: order.orderNumber,
            reason: 'ইতিমধ্যে বুকিং করা হয়েছে',
            trackingCode: order.courier.trackingCode,
          });
          continue;
        }

        const cleanPhone = sanitizePhone(order.phoneNumber);
        if (!cleanPhone || cleanPhone.length !== 11 || !cleanPhone.startsWith('01')) {
          results.failedCount++;
          results.failed.push({ id: order.orderNumber, reason: 'ফোন নম্বর সঠিক নয়' });
          continue;
        }

        const totalLot = (order.items || []).reduce((acc, item) => acc + (Number(item.quantity) || 1), 0) || 1;

        const itemDescription = (order.items || [])
          .map(i => `${i.productTitle || 'পণ্য'}${i.variantName ? ` (${i.variantName})` : ''}${i.size ? ` [${i.size}]` : ''} x${i.quantity || 1}`)
          .join(', ')
          .substring(0, 400);

        const cleanCustomerNote = (order.notes || '')
          .replace(/^Nostrum\s+veniam\s+cons\s*\|\s*/i, '')
          .trim();

        const customerEmail = (order.email || order.customerEmail || '').trim();

        const payload = {
          invoice: order.orderNumber,
          recipient_name: order.customerName,
          recipient_phone: cleanPhone,
          recipient_address: order.deliveryAddress,
          cod_amount: Math.round(Number(order.totalAmount) || 0),
          note: cleanCustomerNote, // STRICTLY customer instructions or ""
          item_description: itemDescription, // formatted product details
          total_lot: totalLot, // total item count
        };

        if (customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
          payload.recipient_email = customerEmail;
        }

        const response = await fetch(`${apiUrl}/create_order`, {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Secret-Key': secretKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (result.status === 200 && result.consignment) {
          order.courier = {
            provider: 'Steadfast',
            consignmentId: String(result.consignment.consignment_id || result.consignment.id || ''),
            trackingCode: result.consignment.tracking_code || '',
            status: result.consignment.status || 'in_review',
            sentAt: new Date(),
            responseRaw: result.consignment,
          };

          if (['Pending', 'Confirmed', 'Processing'].includes(order.orderStatus)) {
            order.orderStatus = 'Shipped';
          }

          order.statusHistory.push({
            status: order.orderStatus,
            note: `Steadfast কুরিয়ারে বুকিং সফল। ট্র্যাকিং: ${result.consignment.tracking_code || 'N/A'}`,
            timestamp: new Date(),
          });

          await order.save();
          results.successCount++;
          results.successful.push({
            orderNumber: order.orderNumber,
            trackingCode: result.consignment.tracking_code,
            consignmentId: result.consignment.consignment_id,
          });
        } else {
          results.failedCount++;
          results.failed.push({
            id: order.orderNumber,
            reason: result.message || 'Steadfast এপিআই রিজেক্ট করেছে',
          });
        }
      } catch (err) {
        results.failedCount++;
        results.failed.push({ id, reason: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `${results.successCount}টি অর্ডার সফলভাবে Steadfast কুরিয়ারে বুকিং সম্পন্ন হয়েছে!`,
      data: results,
    });
  } catch (error) {
    console.error('Steadfast bulk dispatch error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

