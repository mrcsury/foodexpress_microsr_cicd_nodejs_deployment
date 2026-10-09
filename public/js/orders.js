(function () {
  const { el, api } = window.FE;
  const form = document.getElementById('lookup-form');
  const input = document.getElementById('order-id');
  const error = document.getElementById('lookup-error');
  const result = document.getElementById('order-result');

  async function lookup(id) {
    error.textContent = '';
    result.hidden = true;
    id = id.trim().toUpperCase();
    if (!/^FE-[A-Z0-9]{8}$/.test(id)) {
      error.textContent = 'Order IDs look like FE-7K3M9QXA. Please check and try again.';
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    input.removeAttribute('aria-invalid');
    try {
      const order = await api('/api/orders/' + encodeURIComponent(id));
      result.hidden = false;
      result.replaceChildren(
        el('h2', {}, 'Order ', el('span', { class: 'order-id order-id-sm' }, order.id)),
        el('p', {}, 'Status: ', el('span', { class: 'badge' }, order.status)),
        el('p', { class: 'muted' }, 'Placed on ' + new Date(order.createdAt).toLocaleString() + ' for ' + order.customer.name),
        window.FE.orderView.itemsTable(order),
        el('div', { class: 'mt-1' }, window.FE.orderView.emailStatus(order)));
    } catch (err) {
      error.textContent = err.message;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    lookup(input.value);
    history.replaceState(null, '', '?id=' + encodeURIComponent(input.value.trim()));
  });

  const initial = new URLSearchParams(location.search).get('id');
  if (initial) { input.value = initial.slice(0, 20); lookup(initial); }
})();
