const express = require('express');
const router = express.Router();
const { uploadToImgBB, uploadLocal } = require('../controllers/uploadController');

router.post('/imgbb', uploadToImgBB);
router.post('/local', uploadLocal);

module.exports = router;

