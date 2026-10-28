const express = require('express');
const router = express.Router();
const { getDashboardAnalytics } = require('../controllers/analyticsController');

router.get('/dashboard', getDashboardAnalytics);

module.exports = router;

