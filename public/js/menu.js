(function () {
  const { el, Cart, loadProducts, cartLines, foodCard, formatPrice, showMessage, MAX_QTY } = window.FE;
  const CATEGORIES = ['All', 'Pizza', 'Burgers', 'Indian', 'Chinese', 'Desserts'];

  const grid = document.getElementById('menu-grid');
  const status = document.getElementById('menu-status');
  const searchInput = document.getElementById('search');
  const chips = document.getElementById('chips');

  let products = [];
  let category = 'All';

  // ----- menu -----
  function renderMenu() {
    const q = searchInput.value.trim().toLowerCase();
    const matches = products.filter((p) =>
      (category === 'All' || p.category === category) &&
      (!q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)));
    grid.replaceChildren(...matches.map(foodCard));
    showMessage(status, 'info', matches.length ? '' : 'No food items match your search. Try another word or category.');
  }

  function renderChips() {
    chips.replaceChildren(...CATEGORIES.map((c) => el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(c === category),
      onclick: () => { category = c; renderChips(); renderMenu(); },
    }, c)));
  }

  // ----- cart -----
  function renderCart() {
    const lines = cartLines(products);
    const list = document.getElementById('cart-list');
    const totals = document.getElementById('cart-totals');
    const checkout = document.getElementById('checkout-link');
    document.getElementById('fab-count').textContent = String(Cart.count());

    if (!lines.length) {
      list.replaceChildren(el('li', { class: 'empty' }, 'Your cart is empty. Add something tasty!'));
      totals.replaceChildren();
      checkout.setAttribute('aria-disabled', 'true');
      checkout.style.pointerEvents = 'none';
      checkout.style.opacity = '.55';
      document.getElementById('clear-cart').hidden = true;
      return;
    }
    checkout.removeAttribute('aria-disabled');
    checkout.style.pointerEvents = '';
    checkout.style.opacity = '';
    document.getElementById('clear-cart').hidden = false;

    list.replaceChildren(...lines.map(({ product, quantity, lineTotal }) => el('li', { class: 'cart-item' },
      el('div', {},
        el('div', { class: 'name' }, product.name),
        el('div', { class: 'muted' }, formatPrice(product.price) + ' each'),
        el('div', { class: 'qty', role: 'group', 'aria-label': 'Quantity of ' + product.name },
          el('button', { type: 'button', 'aria-label': 'Decrease quantity of ' + product.name, onclick: () => Cart.setQty(product.id, quantity - 1) }, '−'),
          el('strong', { 'aria-live': 'polite' }, String(quantity)),
          el('button', { type: 'button', 'aria-label': 'Increase quantity of ' + product.name, disabled: quantity >= MAX_QTY, onclick: () => Cart.setQty(product.id, quantity + 1) }, '+'))),
      el('div', { class: 'line' }, formatPrice(lineTotal),
        el('div', {}, el('button', { class: 'link-btn', type: 'button', 'aria-label': 'Remove ' + product.name + ' from cart', onclick: () => Cart.remove(product.id) }, 'Remove'))))));

    const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
    totals.replaceChildren(
      el('div', {}, el('span', {}, 'Subtotal'), el('span', {}, formatPrice(subtotal))),
      el('div', { class: 'grand' }, el('span', {}, 'Total'), el('span', {}, formatPrice(subtotal))));
  }

  document.getElementById('clear-cart').addEventListener('click', () => Cart.clear());
  document.addEventListener('cart:changed', () => { if (products.length) renderCart(); });
  searchInput.addEventListener('input', renderMenu);
  document.getElementById('search-form').addEventListener('submit', (e) => e.preventDefault());

  // Support /menu.html?q=pizza&category=Burgers (used by the home page search).
  const params = new URLSearchParams(location.search);
  searchInput.value = (params.get('q') || '').slice(0, 60);
  if (CATEGORIES.includes(params.get('category'))) category = params.get('category');

  renderChips();
  showMessage(status, 'info', 'Loading menu...');
  loadProducts()
    .then((data) => { products = data.products; renderMenu(); renderCart(); })
    .catch((err) => { showMessage(status, 'error', err.message); renderCart(); });
})();
