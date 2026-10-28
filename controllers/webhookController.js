const Order = require('../models/Order');
const connectDB = require('../config/db');

// @desc    Handle Steadfast Courier automated Webhook updates
// @route   POST /api/webhooks/steadfast
exports.handleSteadfastWebhook = async (req, res) => {
  try {
    await connectDB();
    console.log('📥 Steadfast Webhook received payload:', JSON.stringify(req.body));

    const consignment_id = req.body.consignment_id || req.body.consignmentId || req.body.id;
    const tracking_code = req.body.tracking_code || req.body.trackingCode;
    const status = (req.body.status || req.body.delivery_status || '').toLowerCase().trim();

    if (!consignment_id && !tracking_code && !req.body.invoice) {
      console.warn('⚠️ Steadfast Webhook missing identifier:', req.body);
      return res.status(200).json({ success: true, message: 'No identifier found in payload' });
    }

    const query = [];
    if (consignment_id) {
      const numId = Number(consignment_id);
      if (!isNaN(numId)) query.push({ 'courier.consignmentId': numId });
      query.push({ 'courier.consignmentId': consignment_id });
    }
    if (tracking_code) {
      query.push({ 'courier.trackingCode': tracking_code });
    }
    if (req.body.invoice) {
      query.push({ orderNumber: req.body.invoice });
    }

    const order = await Order.findOne({ $or: query });

    if (!order) {
      console.warn(`⚠️ Order not found for Steadfast Webhook: consignment_id=${consignment_id}, tracking_code=${tracking_code}`);
      return res.status(200).json({ success: true, message: 'Order not found, acknowledged' });
    }

    // Map Steadfast statuses to internal order states
    if (status === 'delivered') {
      order.orderStatus = 'delivered';
      order.paymentStatus = 'paid';
    } else if (status === 'cancelled' || status === 'cancelled_by_recipient') {
      order.orderStatus = 'cancelled';
    } else if (status === 'partial_delivered') {
      order.orderStatus = 'partial_delivered';
    } else if (['in_review', 'pending'].includes(status)) {
      order.orderStatus = 'shipped';
    } else if (status === 'returned') {
      order.orderStatus = 'cancelled';
    }

    // Update courier status
    if (!order.courier) {
      order.courier = { name: 'Steadfast', provider: 'Steadfast' };
    }
    order.courier.status = status || order.courier.status;

    order.statusHistory.push({
      status: order.orderStatus,
      note: `Steadfast Webhook আপডেট: ${status}`,
      timestamp: new Date(),
    });

    await order.save();
    console.log(`✅ Order ${order.orderNumber} updated via Steadfast Webhook to ${order.orderStatus}`);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Steadfast Webhook error:', error);
    return res.status(200).json({ success: true, error: error.message });
  }
};

