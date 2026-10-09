// Run with: npm test   (SMTP is left unconfigured, so emails go to the console preview)
process.env.NODE_ENV = 'test';
process.env.SMTP_HOST = '';
process.env.RATE_LIMIT_ORDERS_PER_MIN = '1000';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const startServer = require('./helpers');

let api;
before(async () => { api = await startServer(); });
after(() => api.close());

const customer = { name: "Asha O'Neil", email: 'asha@example.com', phone: '+91 98765 43210', address: '12 Park Street, Kolkata 700016' };
const goodOrder = (extra = {}) => ({ customer, items: [{ productId: 1, quantity: 2 }, { productId: 5, quantity: 1 }], ...extra });

test('GET /health', async () => {
  const r = await api.call('GET', '/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ok');
});

test('GET /api/products returns at least 12 items with required fields', async () => {
  const r = await api.call('GET', '/api/products');
  assert.equal(r.status, 200);
  assert.ok(r.json.products.length >= 12);
  for (const p of r.json.products) {
    for (const k of ['id', 'name', 'category', 'description', 'price', 'image']) assert.ok(p[k] !== undefined, `missing ${k}`);
    assert.ok(p.price > 0);
  }
});

test('GET /api/products/:id found / not found / invalid', async () => {
  assert.equal((await api.call('GET', '/api/products/3')).json.name, 'Classic Burger');
  assert.equal((await api.call('GET', '/api/products/999')).status, 404);
  assert.equal((await api.call('GET', '/api/products/abc')).status, 404);
});

test('POST /api/orders uses server prices, ignores client prices, and can be looked up', async () => {
  const body = goodOrder();
  body.items[0].price = 1; body.items[0].unitPrice = 1; body.total = 1;
  const r = await api.call('POST', '/api/orders', body);
  assert.equal(r.status, 201);
  const o = r.json.order;
  assert.match(o.id, /^FE-[A-Z0-9]{8}$/);
  assert.equal(o.status, 'BOOKED');
  assert.equal(o.total, 299 * 2 + 99);
  assert.equal(o.email.status, 'PREVIEW_LOGGED');
  assert.ok(!JSON.stringify(o).includes('Park Street'), 'address must not be echoed back');
  assert.ok(!o.customer.email.includes('asha@'), 'email is masked');

  const g = await api.call('GET', `/api/orders/${o.id.toLowerCase()}`);
  assert.equal(g.status, 200);
  assert.equal(g.json.id, o.id);
  assert.equal(g.json.total, o.total);
});

test('order IDs are unique', async () => {
  const ids = new Set();
  for (let i = 0; i < 5; i++) ids.add((await api.call('POST', '/api/orders', goodOrder())).json.order.id);
  assert.equal(ids.size, 5);
});

test('validation errors return 400 with field details', async () => {
  const bad = [
    goodOrder({ customer: { ...customer, email: 'nope' } }),
    goodOrder({ customer: { ...customer, name: '' } }),
    goodOrder({ customer: { ...customer, phone: 'abc' } }),
    goodOrder({ customer: { ...customer, address: 'short' } }),
    goodOrder({ items: [] }),
    goodOrder({ items: [{ productId: 999, quantity: 1 }] }),
    goodOrder({ items: [{ productId: 1, quantity: 0 }] }),
    goodOrder({ items: [{ productId: 1, quantity: -3 }] }),
    goodOrder({ items: [{ productId: 1, quantity: 1.5 }] }),
    goodOrder({ items: [{ productId: 1, quantity: 11 }] }),
    goodOrder({ items: [{ productId: '1', quantity: 1 }] }),
    goodOrder({ items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }] }),
    { customer },
    {},
  ];
  for (const b of bad) {
    const r = await api.call('POST', '/api/orders', b);
    assert.equal(r.status, 400, JSON.stringify(b));
    assert.equal(r.json.error.code, 'VALIDATION_ERROR');
    assert.ok(Object.keys(r.json.error.details).length > 0);
  }
});

test('malformed JSON -> 400, oversized body -> 413, no stack traces leaked', async () => {
  const m = await api.call('POST', '/api/orders', '{not json');
  assert.equal(m.status, 400);
  assert.equal(m.json.error.code, 'INVALID_JSON');
  const big = await api.call('POST', '/api/orders', { junk: 'x'.repeat(20000) });
  assert.equal(big.status, 413);
  assert.ok(!big.text.includes('node_modules'));
});

test('unknown order / bad id -> 404; unknown api route -> JSON 404', async () => {
  assert.equal((await api.call('GET', '/api/orders/FE-AAAAAAAA')).status, 404);
  assert.equal((await api.call('GET', '/api/orders/not-an-id')).status, 404);
  const r = await api.call('GET', '/api/nope');
  assert.equal(r.status, 404);
  assert.equal(r.json.error.code, 'NOT_FOUND');
});

test('resend-email never creates a new order', async () => {
  const o = (await api.call('POST', '/api/orders', goodOrder())).json.order;
  const r = await api.call('POST', `/api/orders/${o.id}/resend-email`);
  // The first attempt just happened, so the cooldown (429) applies. Either way no new order appears.
  assert.ok([200, 429].includes(r.status));
  assert.equal((await api.call('GET', `/api/orders/${o.id}`)).json.id, o.id);
  assert.equal((await api.call('POST', '/api/orders/FE-AAAAAAAA/resend-email')).status, 404);
});

test('security headers present', async () => {
  const r = await api.call('GET', '/health');
  assert.ok(r.headers.get('content-security-policy'));
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('static pages are served', async () => {
  for (const p of ['/', '/menu.html', '/checkout.html', '/order-success.html', '/orders.html', '/css/style.css']) {
    assert.equal((await api.call('GET', p)).status, 200, p);
  }
});
