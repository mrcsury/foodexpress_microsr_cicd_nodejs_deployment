// Shared helpers used by every page: header/footer, API calls, cart (saved in localStorage).
// Everything the server sends is inserted with textContent / el() - never innerHTML - to avoid XSS.
(function () {
  const CART_KEY = 'foodexpress_cart_v1'; // [{ productId, quantity }]
  const MAX_QTY = 10;
  const PLACEHOLDER_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#fff4e8"/>' +
    '<text x="200" y="165" font-size="64" text-anchor="middle">🍽️</text></svg>');

  // ----- tiny DOM helper: el('div', { class: 'x', onclick: fn }, 'text', childElement) -----
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'class') node.className = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === undefined || c === null || c === false) continue;
      node.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return node;
  }

  const formatPrice = (n) => '₹' + Number(n).toLocaleString('en-IN');

  // ----- API -----
  async function api(path, options = {}) {
    let res;
    try {
      res = await fetch(path, {
        method: options.method || 'GET',
        headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (e) {
      const err = new Error('Cannot reach the server. Check your connection and try again.');
      err.network = true;
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON response */ }
    if (!res.ok) {
      const info = (data && data.error) || {};
      const err = new Error(info.message || 'Something went wrong. Please try again.');
      err.status = res.status;
      err.code = info.code;
      err.details = info.details;
      throw err;
    }
    return data;
  }

  // ----- cart -----
  const Cart = {
    read() {
      try {
        const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
        return Array.isArray(raw)
          ? raw.filter((i) => Number.isInteger(i.productId) && Number.isInteger(i.quantity) && i.quantity > 0).map((i) => ({ productId: i.productId, quantity: Math.min(i.quantity, MAX_QTY) }))
          : [];
      } catch (e) { return []; }
    },
    write(items) {
      try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch (e) { /* storage blocked: cart just won't persist */ }
      document.dispatchEvent(new CustomEvent('cart:changed'));
    },
    add(productId) {
      const items = this.read();
      const found = items.find((i) => i.productId === productId);
      if (found) found.quantity = Math.min(found.quantity + 1, MAX_QTY); else items.push({ productId, quantity: 1 });
      this.write(items);
    },
    setQty(productId, quantity) {
      const items = this.read().filter((i) => i.productId !== productId || quantity > 0);
      const found = items.find((i) => i.productId === productId);
      if (found) found.quantity = Math.min(quantity, MAX_QTY);
      this.write(items);
    },
    remove(productId) { this.write(this.read().filter((i) => i.productId !== productId)); },
    clear() { this.write([]); },
    count() { return this.read().reduce((n, i) => n + i.quantity, 0); },
  };

  // ----- products (fetched once per page) -----
  let productsPromise;
  function loadProducts() {
    if (!productsPromise) productsPromise = api('/api/products').catch((e) => { productsPromise = null; throw e; });
    return productsPromise;
  }

  // Cart lines joined with product info. Items that no longer exist on the menu are dropped.
  function cartLines(products) {
    return Cart.read().map((i) => {
      const p = products.find((x) => x.id === i.productId);
      return p ? { product: p, quantity: i.quantity, lineTotal: p.price * i.quantity } : null;
    }).filter(Boolean);
  }

  function foodImage(product, className) {
    const img = el('img', { src: product.image, alt: product.name, loading: 'lazy', class: className });
    img.addEventListener('error', () => { img.src = PLACEHOLDER_IMG; }, { once: true });
    return img;
  }

  // ----- header & footer -----
  function renderChrome() {
    const page = document.body.dataset.page;
    const links = [
      ['home', 'Home', '/index.html'],
      ['menu', 'Menu', '/menu.html'],
      ['orders', 'My Orders', '/orders.html'],
      ['contact', 'Contact', '/index.html#contact'],
    ];
    const badge = el('span', { class: 'cart-badge', id: 'nav-cart-count', 'aria-label': 'items in cart' }, String(Cart.count()));
    const nav = el('ul', { class: 'nav-links' }, links.map(([key, label, href]) =>
      el('li', {}, el('a', { href, 'aria-current': key === page ? 'page' : false }, label, key === 'menu' ? badge : null))));

    document.getElementById('site-header').replaceWith(
      el('header', { class: 'site-header', id: 'site-header' },
        el('div', { class: 'container nav' },
          el('a', { class: 'brand', href: '/index.html', 'aria-label': 'FoodExpress home' }, 'Food', el('span', {}, 'Express')),
          el('nav', { 'aria-label': 'Main' }, nav))));

    document.getElementById('site-footer').replaceWith(
      el('footer', { class: 'site-footer', id: 'site-footer' },
        el('div', { class: 'container' },
          el('p', {}, '© FoodExpress - a teaching demo of a monolithic web application.'),
          el('p', {}, 'Demo only: no payment is collected and orders are kept in server memory (they disappear when the server restarts).'))));

    document.addEventListener('cart:changed', () => {
      const b = document.getElementById('nav-cart-count');
      if (b) b.textContent = String(Cart.count());
    });
  }

  function showMessage(container, kind, text) {
    container.replaceChildren();
    if (!text) return;
    container.append(el('div', { class: 'notice notice-' + kind, role: kind === 'error' ? 'alert' : 'status' }, text));
  }

  document.addEventListener('DOMContentLoaded', renderChrome);
  window.FE = { el, api, Cart, loadProducts, cartLines, foodImage, formatPrice, showMessage, MAX_QTY };
})();
