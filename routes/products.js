const express = require('express');
const { products, categories } = require('../data/products');
const { HttpError } = require('../services/orderService');

const router = express.Router();

// GET /api/products  -> the whole menu
router.get('/', (req, res) => {
  res.json({ categories, products });
});

// GET /api/products/:id  -> one food item
router.get('/:id', (req, res, next) => {
  const product = /^\d+$/.test(req.params.id) ? products.find((p) => p.id === Number(req.params.id)) : undefined;
  if (!product) return next(new HttpError(404, 'PRODUCT_NOT_FOUND', 'That food item does not exist.'));
  res.json(product);
});

module.exports = router;
