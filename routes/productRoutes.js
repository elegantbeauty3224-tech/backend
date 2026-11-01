const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProductByIdentifier,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStock,
  addProductReview,
  getProductReviews,
  deleteProductReview,
} = require('../controllers/productController');

router.route('/')
  .get(getProducts)
  .post(createProduct);

router.route('/:id/reviews')
  .get(getProductReviews)
  .post(addProductReview);

router.route('/:id/reviews/:reviewId')
  .delete(deleteProductReview);

router.route('/:id/stock')
  .patch(updateProductStock);

router.route('/:id')
  .get(getProductByIdentifier)
  .put(updateProduct)
  .delete(deleteProduct);

module.exports = router;

