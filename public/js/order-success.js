// The confirmation is only shown after the backend returns the order - we never assume success.
(function () {
  const { el, api } = window.FE;
  const result = document.getElementById('result');
  const id = new URLSearchParams(location.search).get('id') || '';

  function checkIcon() {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M5 13l4 4L19 7');
    svg.append(path);
    return el('div', { class: 'success-icon' }, svg);
  }

  function showProblem(text) {
    result.replaceChildren(
      el('h1', {}, 'We could not show this order'),
      el('p', {}, text),
      el('p', {}, el('a', { class: 'btn', href: '/menu.html' }, 'Back to the menu'), ' ', el('a', { class: 'btn btn-outline', href: '/orders.html' }, 'Find an order')));
  }

  if (!id) { showProblem('No order ID was provided.'); return; }

  api('/api/orders/' + encodeURIComponent(id))
    .then((order) => {
      document.title = 'Order Booked - FoodExpress';
      result.replaceChildren(
        checkIcon(),
        el('h1', {}, 'Order Booked Successfully!'),
        el('p', {}, 'Thank you for ordering with FoodExpress. Your delicious food is on its way to being prepared.'),
        el('p', {}, 'Your order ID'),
        el('p', {}, el('span', { class: 'order-id' }, order.id)),
        el('p', {}, 'Status: ', el('span', { class: 'badge' }, order.status)),
        window.FE.orderView.itemsTable(order),
        el('div', { class: 'left mt-1' }, window.FE.orderView.emailStatus(order)),
        el('p', { class: 'muted small' }, 'Demo only: no payment was collected. Orders are kept in server memory and are lost when the server restarts, so save your order ID.'),
        el('p', {}, el('a', { class: 'btn', href: '/menu.html' }, 'Order more'), ' ', el('a', { class: 'btn btn-outline', href: '/orders.html?id=' + encodeURIComponent(order.id) }, 'Track this order')));
    })
    .catch((err) => showProblem(err.message));
})();
