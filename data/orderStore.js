// In-memory order storage. Everything here is LOST when the server restarts.
// (A real application would use a database such as PostgreSQL or DynamoDB.)
const crypto = require('crypto');
const config = require('../config');

const orders = new Map(); // Map keeps insertion order, so the oldest order is first.

// No look-alike characters (0/O, 1/I/L) so IDs are easy to read out loud.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ORDER_ID_PATTERN = /^FE-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

function generateOrderId() {
  let id;
  do {
    const bytes = crypto.randomBytes(8);
    let suffix = '';
    for (const b of bytes) suffix += ALPHABET[b % ALPHABET.length];
    id = `FE-${suffix}`;
  } while (orders.has(id));
  return id;
}

function save(order) {
  orders.set(order.id, order);
  // Protect server memory: forget the oldest orders once the limit is reached.
  while (orders.size > config.limits.maxStoredOrders) {
    orders.delete(orders.keys().next().value);
  }
  return order;
}

const findById = (id) => orders.get(id);
const isValidOrderId = (id) => typeof id === 'string' && ORDER_ID_PATTERN.test(id);
const clear = () => orders.clear(); // used by tests

module.exports = { generateOrderId, save, findById, isValidOrderId, clear };
