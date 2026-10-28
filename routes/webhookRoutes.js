const express = require('express');
const router = express.Router();
const { handleSteadfastWebhook } = require('../controllers/webhookController');

// Steadfast Webhook endpoint
router.post('/steadfast', handleSteadfastWebhook);

module.exports = router;

