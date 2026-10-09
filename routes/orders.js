const express = require('express');
const orderService = require('../services/orderService');
const config = require('../config');
const rateLimit = require('../middleware/rateLimit');

const router = express.Router();

// POST /api/orders  -> validate, price and create an order, then try to email the customer
router.post('/', rateLimit({ windowMs: 60 * 1000, max: config.limits.ordersPerMinute }), async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.body);
    res.status(201).json({ message: 'Order booked successfully.', order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:id  -> look up an order
router.get('/:id', rateLimit({ windowMs: 60 * 1000, max: 60 }), (req, res, next) => {
  try {
    res.json(orderService.toPublicOrder(orderService.getOrder(String(req.params.id).trim().toUpperCase())));
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/:id/resend-email  -> retry the confirmation email (never creates a new order)
router.post('/:id/resend-email', rateLimit({ windowMs: 60 * 1000, max: 10 }), async (req, res, next) => {
  try {
    const order = await orderService.resendEmail(String(req.params.id).trim().toUpperCase());
    res.json({ order });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
