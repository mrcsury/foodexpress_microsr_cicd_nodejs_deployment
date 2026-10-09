(function () {
  const { el, api, Cart, loadProducts, cartLines, formatPrice, showMessage } = window.FE;

  const form = document.getElementById('checkout-form');
  const message = document.getElementById('form-message');
  const submit = document.getElementById('place-order');
  const FIELDS = ['name', 'email', 'phone', 'address'];

  // Same rules as the server (the server re-checks everything, this is just for quick feedback).
  const rules = {
    name: (v) => (v.length < 2 || v.length > 80 ? 'Please enter your name (2-80 characters).' : ''),
    email: (v) => (!v ? 'Please enter your email address.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Please enter a valid email address, e.g. name@example.com.' : ''),
    phone: (v) => {
      const digits = v.replace(/\D/g, '');
      return !v ? 'Please enter your phone number.' : (!/^\+?[0-9 ()-]+$/.test(v) || digits.length < 7 || digits.length > 15) ? 'Please enter a valid phone number (7-15 digits).' : '';
    },
    address: (v) => (v.length < 10 || v.length > 250 ? 'Please enter your full delivery address (at least 10 characters).' : ''),
  };

  function setError(field, text) {
    const input = document.getElementById(field);
    document.getElementById(field + '-error').textContent = text || '';
    if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  }

  const value = (f) => document.getElementById(f).value.trim().replace(/\s+/g, ' ');

  FIELDS.forEach((f) => document.getElementById(f).addEventListener('blur', () => setError(f, rules[f](value(f)))));

  function renderSummary(lines) {
    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    document.getElementById('summary-list').replaceChildren(...lines.map((l) => el('li', { class: 'cart-item' },
      el('div', {}, el('div', { class: 'name' }, l.product.name), el('div', { class: 'muted' }, l.quantity + ' × ' + formatPrice(l.product.price))),
      el('div', { class: 'line' }, formatPrice(l.lineTotal)))));
    document.getElementById('summary-totals').replaceChildren(
      el('div', {}, el('span', {}, 'Subtotal'), el('span', {}, formatPrice(subtotal))),
      el('div', { class: 'grand' }, el('span', {}, 'Total'), el('span', {}, formatPrice(subtotal))));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage(message, 'error', '');

    let firstBad = null;
    FIELDS.forEach((f) => {
      const err = rules[f](value(f));
      setError(f, err);
      if (err && !firstBad) firstBad = f;
    });
    if (firstBad) { document.getElementById(firstBad).focus(); return; }

    submit.disabled = true;
    submit.textContent = 'Placing your order...';
    try {
      // Only product IDs and quantities are sent. The server looks up the prices itself.
      const data = await api('/api/orders', {
        method: 'POST',
        body: {
          customer: { name: value('name'), email: value('email'), phone: value('phone'), address: value('address') },
          items: Cart.read(),
        },
      });
      // The backend confirmed the order exists - only now do we empty the cart and show the confirmation.
      Cart.clear();
      location.href = '/order-success.html?id=' + encodeURIComponent(data.order.id);
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        FIELDS.forEach((f) => setError(f, err.details[f]));
        const first = FIELDS.find((f) => err.details[f]);
        if (first) document.getElementById(first).focus();
        if (err.details.items) err.message = err.details.items;
      }
      showMessage(message, 'error', 'Your order was NOT placed. ' + err.message);
      submit.disabled = false;
      submit.textContent = 'Place Order (no payment)';
    }
  });

  loadProducts()
    .then((data) => {
      const lines = cartLines(data.products);
      if (!lines.length) { document.getElementById('empty-cart').hidden = false; return; }
      document.getElementById('checkout-content').hidden = false;
      renderSummary(lines);
    })
    .catch((err) => {
      document.getElementById('empty-cart').hidden = false;
      showMessage(document.getElementById('empty-cart'), 'error', err.message);
    });
})();
