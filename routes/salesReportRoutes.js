const express = require('express');
const router = express.Router();
const salesReportController = require('../controllers/salesReportController');

router.get('/', salesReportController.getSalesReports);
router.delete('/:id', salesReportController.deleteSalesReport);
router.post('/clear', salesReportController.clearSalesReports);
router.post('/sync', salesReportController.manualSync);

module.exports = router;
