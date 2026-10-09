// Order business logic: pricing, creating orders and email retries.
const config = require('../config');
const { products } = require('../data/products');
const orderStore = require('../data/orderStore');
const emailService = require('./emailService');
const { validateOrderInput } = require('./validation');

const findProduct = (id) => products.find((p) => p.id === id);

class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const EMAIL_MESSAGES = {
  SENT: 'A confirmation email has been sent to your email address.',
  PREVIEW_LOGGED: 'Email is not configured on this server (development mode). No real email was sent - a preview was printed to the server console.',
  NOT_CONFIGURED: 'Your order is booked, but the confirmation email could not be sent because email is not configured on this server.',
  FAILED: 'Your order is booked, but the confirmation email could not be sent. You can try sending it again.',
};

const maskEmail = (email) => {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}***@${domain}`;
};
const maskPhone = (phone) => {
  const digits = phone.replace(/\D/g, '');
  return `${'*'.repeat(Math.max(digits.length - 3, 0))}${digits.slice(-3)}`;
};

// What we are willing to send back to the browser. The delivery address and the full
// email/phone are NOT returned by lookups, so knowing an order ID does not leak personal details.
function toPublicOrder(order) {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    customer: { name: order.customer.name, email: maskEmail(order.customer.email), phone: maskPhone(order.customer.phone) },
    items: order.items,
    total: order.total,
    email: {
      status: order.email.status,
      message: EMAIL_MESSAGES[order.email.status],
      canResend: order.email.status !== 'SENT' && order.email.attempts < config.limits.emailMaxAttempts,
    },
  };
}

async function attemptEmail(order) {
  order.email.sending = true;
  order.email.attempts += 1;
  order.email.lastAttemptAt = Date.now();
  try {
    const result = await emailService.sendOrderConfirmation(order);
    order.email.status = result.status;
  } finally {
    order.email.sending = false;
  }
}

async function createOrder(body) {
  const { errors, value } = validateOrderInput(body, findProduct);
  if (Object.keys(errors).length) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Please fix the highlighted problems and try again.', errors);
  }

  // Trusted, server-side pricing.
  const items = value.items.map(({ productId, quantity }) => {
    const product = findProduct(productId);
    return { productId, name: product.name, quantity, unitPrice: product.price, lineTotal: product.price * quantity };
  });
  const total = items.reduce((sum, i) => sum + i.lineTotal, 0);

  const order = orderStore.save({
    id: orderStore.generateOrderId(),
    status: 'BOOKED',
    createdAt: new Date().toISOString(),
    customer: value.customer,
    items,
    total,
    email: { status: 'FAILED', attempts: 0, lastAttemptAt: 0, sending: false },
  });

  // The order already exists at this point. An email problem must never undo it.
  await attemptEmail(order);
  return toPublicOrder(order);
}

function getOrder(id) {
  const order = orderStore.isValidOrderId(id) ? orderStore.findById(id) : undefined;
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'We could not find an order with that ID. Orders are kept in memory only and disappear when the server restarts.');
  return order;
}

// Retry the email for an EXISTING order. It never creates a new order.
async function resendEmail(id) {
  const order = getOrder(id);
  if (order.email.status === 'SENT') {
    throw new HttpError(409, 'EMAIL_ALREADY_SENT', 'The confirmation email for this order was already sent.');
  }
  if (order.email.sending) {
    throw new HttpError(409, 'EMAIL_IN_PROGRESS', 'An email is already being sent for this order.');
  }
  if (order.email.attempts >= config.limits.emailMaxAttempts) {
    throw new HttpError(429, 'EMAIL_RETRY_LIMIT', 'Too many email attempts for this order.');
  }
  const waitMs = order.email.lastAttemptAt + config.limits.emailResendCooldownMs - Date.now();
  if (waitMs > 0) {
    throw new HttpError(429, 'EMAIL_COOLDOWN', `Please wait ${Math.ceil(waitMs / 1000)} seconds before trying again.`);
  }
  await attemptEmail(order);
  return toPublicOrder(order);
}

module.exports = { createOrder, getOrder, resendEmail, toPublicOrder, findProduct, HttpError };
