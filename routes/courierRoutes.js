const express = require('express');
const router = express.Router();
const {
  sendOrderToSteadfast,
  trackSteadfastOrder,
  getSteadfastBalance,
  sendBulkOrdersToSteadfast,
} = require('../controllers/courierController');

// Balance check
router.get('/balance', getSteadfastBalance);

// Bulk dispatch
router.post('/send-bulk', sendBulkOrdersToSteadfast);

// Track order
router.get('/tracking/:orderId', trackSteadfastOrder);

// Dispatch single order
router.post('/send/:orderId', sendOrderToSteadfast);

module.exports = router;

