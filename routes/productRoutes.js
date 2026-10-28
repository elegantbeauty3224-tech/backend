const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductByIdentifier,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
} = require('../controllers/productController');

router.route('/')
  .get(getProducts)
  .post(createProduct);

router.route('/:id/stock')
  .patch(updateProductStock);

router.route('/:id')
  .get(getProductByIdentifier)
  .put(updateProduct)
  .delete(deleteProduct);

module.exports = router;

