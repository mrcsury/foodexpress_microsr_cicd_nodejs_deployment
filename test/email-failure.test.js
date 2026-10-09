// SMTP is configured but unreachable: the order must survive and the email must be reported as FAILED.
process.env.NODE_ENV = 'test';
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1'; // nothing listens here -> connection refused
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const startServer = require('./helpers');

let api;
before(async () => { api = await startServer(); });
after(() => api.close());

test('order is kept when the email fails; retry reuses the same order', async () => {
  const r = await api.call('POST', '/api/orders', {
    customer: { name: 'Ravi Kumar', email: 'ravi@example.com', phone: '9876543210', address: '5 MG Road, Bengaluru 560001' },
    items: [{ productId: 6, quantity: 1 }],
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.order.status, 'BOOKED');
  assert.equal(r.json.order.email.status, 'FAILED');
  assert.match(r.json.order.email.message, /booked, but the confirmation email could not be sent/);

  const id = r.json.order.id;
  const retry = await api.call('POST', `/api/orders/${id}/resend-email`);
  assert.equal(retry.status, 429); // cooldown protects against spamming
  assert.equal(retry.json.error.code, 'EMAIL_COOLDOWN');

  const g = await api.call('GET', `/api/orders/${id}`);
  assert.equal(g.status, 200);
  assert.equal(g.json.status, 'BOOKED');
});
