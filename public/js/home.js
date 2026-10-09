(function () {
  const { loadProducts, foodCard, showMessage } = window.FE;

  document.getElementById('hero-search').addEventListener('submit', (e) => {
    e.preventDefault();
    const q = document.getElementById('hero-q').value.trim();
    location.href = '/menu.html' + (q ? '?q=' + encodeURIComponent(q) : '');
  });

  // Hero image fallback if the remote photo cannot load.
  document.getElementById('hero-img').addEventListener('error', (e) => { e.target.style.display = 'none'; }, { once: true });

  loadProducts()
    .then((data) => {
      const featured = document.getElementById('featured');
      [1, 6, 3, 11].map((id) => data.products.find((p) => p.id === id)).filter(Boolean)
        .forEach((p) => featured.append(foodCard(p)));
    })
    .catch((err) => showMessage(document.getElementById('featured-status'), 'error', err.message));
})();
