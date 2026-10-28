const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  purgeCancelledOrders,
  streamOrders,
  getUserOrders,
  trackOrder,
  sendSteadfastOrder,
} = require('../controllers/orderController');

router.post('/send-steadfast', sendSteadfastOrder);
router.get('/stream', streamOrders);
router.get('/user/:identifier', getUserOrders);
router.get('/track/:query', trackOrder);

router.route('/')
  .post(createOrder)
  .get(getOrders);

router.delete('/actions/purge-cancelled', purgeCancelledOrders);

router.route('/:id/status')
  .patch(updateOrderStatus);

router.route('/:id')
  .get(getOrderById)
  .delete(deleteOrder);

module.exports = router;
