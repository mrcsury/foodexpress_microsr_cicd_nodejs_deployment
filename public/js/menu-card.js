// Builds one food card. Used by the home page and the menu page.
(function () {
  const { el, Cart, foodImage, formatPrice } = window.FE;

  window.FE.foodCard = function foodCard(product) {
    const button = el('button', { class: 'btn btn-sm', type: 'button', 'aria-label': 'Add ' + product.name + ' to cart' }, 'Add to Cart');
    let timer;
    button.addEventListener('click', () => {
      Cart.add(product.id);
      button.textContent = 'Added ✓';
      clearTimeout(timer);
      timer = setTimeout(() => { button.textContent = 'Add to Cart'; }, 1200);
    });
    return el('article', { class: 'card' },
      foodImage(product),
      el('div', { class: 'card-body' },
        el('span', { class: 'tag' }, product.category),
        el('h3', {}, product.name),
        el('p', {}, product.description),
        el('div', { class: 'card-meta' }, el('span', { class: 'price' }, formatPrice(product.price)), button)));
  };
})();
