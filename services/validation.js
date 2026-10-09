// Input validation + cleaning for new orders. Returns { errors, value }.
// `errors` is an object like { email: 'Please enter a valid email.' } (empty when everything is fine).
const config = require('../config');

// Remove control characters (including newlines) and trim spaces.
const cleanLine = (v) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
// For multi-line text (address) keep it on one line as well - simple and safe for emails.
const cleanText = cleanLine;

const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
const PHONE_PATTERN = /^\+?[0-9 ()-]+$/;

function validateOrderInput(body, findProduct) {
  const errors = {};
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const customerIn = input.customer && typeof input.customer === 'object' ? input.customer : {};

  // ----- customer -----
  const name = cleanLine(customerIn.name);
  if (name.length < 2 || name.length > 80) errors.name = 'Please enter your name (2-80 characters).';
  else if (!NAME_PATTERN.test(name)) errors.name = 'Name can only contain letters, spaces, dots, apostrophes and hyphens.';

  const email = cleanLine(customerIn.email).toLowerCase();
  if (!email) errors.email = 'Please enter your email address.';
  else if (email.length > 254 || !EMAIL_PATTERN.test(email)) errors.email = 'Please enter a valid email address, e.g. name@example.com.';

  const phone = cleanLine(customerIn.phone);
  const phoneDigits = phone.replace(/\D/g, '');
  if (!phone) errors.phone = 'Please enter your phone number.';
  else if (!PHONE_PATTERN.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = 'Please enter a valid phone number (7-15 digits).';
  }

  const address = cleanText(customerIn.address);
  if (address.length < 10 || address.length > 250) errors.address = 'Please enter your full delivery address (10-250 characters).';

  // ----- items -----
  const items = [];
  const itemErrors = [];
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.items = 'Your cart is empty. Add at least one item.';
  } else if (input.items.length > config.limits.maxLineItems) {
    errors.items = `You can order at most ${config.limits.maxLineItems} different items at once.`;
  } else {
    const seen = new Set();
    input.items.forEach((raw, index) => {
      const productId = raw && raw.productId;
      const quantity = raw && raw.quantity;
      if (!Number.isInteger(productId) || !findProduct(productId)) {
        itemErrors.push(`Item ${index + 1}: unknown product.`);
      } else if (seen.has(productId)) {
        itemErrors.push(`Item ${index + 1}: product listed twice. Combine the quantities instead.`);
      } else if (!Number.isInteger(quantity) || quantity < 1 || quantity > config.limits.maxQuantityPerItem) {
        itemErrors.push(`Item ${index + 1}: quantity must be a whole number from 1 to ${config.limits.maxQuantityPerItem}.`);
      } else {
        seen.add(productId);
        items.push({ productId, quantity }); // NOTE: any price sent by the browser is ignored
      }
    });
    if (itemErrors.length) errors.items = itemErrors.join(' ');
  }

  return { errors, value: { customer: { name, email, phone, address }, items } };
}

module.exports = { validateOrderInput };
