// Renders an order (items table, total, email status). Used by the success page and My Orders.
(function () {
  const { el, api, formatPrice } = window.FE;

  function itemsTable(order) {
    return el('div', { class: 'summary' },
      el('table', {},
        el('caption', { class: 'visually-hidden' }, 'Items in order ' + order.id),
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Item'), el('th', { scope: 'col' }, 'Qty'), el('th', { scope: 'col', class: 'num' }, 'Price'))),
        el('tbody', {}, order.items.map((i) => el('tr', {},
          el('td', {}, i.name), el('td', {}, String(i.quantity)), el('td', { class: 'num' }, formatPrice(i.lineTotal))))),
        el('tfoot', {}, el('tr', {}, el('th', { scope: 'row', colspan: '2' }, 'Total'), el('th', { class: 'num' }, formatPrice(order.total))))));
  }

  // Shows the email status accurately and, if sending failed, a retry button for the SAME order.
  function emailStatus(order, onUpdate) {
    const box = el('div', { 'aria-live': 'polite' });
    function draw(o) {
      const kind = o.email.status === 'SENT' ? 'ok' : o.email.status === 'PREVIEW_LOGGED' ? 'info' : 'error';
      const parts = [el('div', { class: 'notice notice-' + kind, role: kind === 'error' ? 'alert' : 'status' },
        el('strong', {}, 'Email: '), o.email.message,
        o.email.status === 'SENT' ? el('div', {}, 'Sent to ' + o.customer.email) : null)];
      if (o.email.canResend && o.email.status !== 'PREVIEW_LOGGED') {
        const btn = el('button', { class: 'btn btn-outline btn-sm', type: 'button' }, 'Try sending the email again');
        const info = el('div', { class: 'field-error' });
        btn.addEventListener('click', async () => {
          btn.disabled = true; btn.textContent = 'Sending...'; info.textContent = '';
          try {
            const res = await api('/api/orders/' + encodeURIComponent(o.id) + '/resend-email', { method: 'POST' });
            if (onUpdate) onUpdate(res.order);
            draw(res.order);
          } catch (err) {
            info.textContent = err.message;
            btn.disabled = false; btn.textContent = 'Try sending the email again';
          }
        });
        parts.push(btn, info);
      }
      box.replaceChildren(...parts);
    }
    draw(order);
    return box;
  }

  window.FE.orderView = { itemsTable, emailStatus };
})();
