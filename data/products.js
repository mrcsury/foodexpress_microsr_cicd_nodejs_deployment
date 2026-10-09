// The food menu lives here (in memory). Prices are in Indian rupees (INR).
// The server is the ONLY source of truth for prices - the browser never sends them.
const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=70`;

const products = [
  { id: 1, name: 'Margherita Pizza', category: 'Pizza', price: 299, image: img('1574071318508-1cdbab80d002'),
    description: 'Classic hand-stretched pizza with tomato sauce, fresh mozzarella and basil.' },
  { id: 2, name: 'Pepperoni Pizza', category: 'Pizza', price: 399, image: img('1628840042765-356cda07504e'),
    description: 'Crispy pepperoni, bubbling mozzarella and our signature tomato sauce.' },
  { id: 3, name: 'Classic Burger', category: 'Burgers', price: 199, image: img('1568901346375-23c9450c58cd'),
    description: 'Juicy beef patty, cheddar, lettuce, tomato and house sauce in a toasted bun.' },
  { id: 4, name: 'Chicken Burger', category: 'Burgers', price: 229, image: img('1606755962773-d324e0a13086'),
    description: 'Crunchy fried chicken fillet with slaw and spicy mayo.' },
  { id: 5, name: 'French Fries', category: 'Burgers', price: 99, image: img('1573080496219-bb080dd4f877'),
    description: 'Golden, crispy fries lightly salted - the perfect side for any burger.' },
  { id: 6, name: 'Chicken Biryani', category: 'Indian', price: 349, image: img('1563379091339-03b21ab4a4f8'),
    description: 'Fragrant basmati rice slow-cooked with tender chicken and aromatic spices.' },
  { id: 7, name: 'Paneer Butter Masala', category: 'Indian', price: 289, image: img('1631452180519-c014fe946bc7'),
    description: 'Soft paneer cubes simmered in a rich, creamy tomato-butter gravy.' },
  { id: 8, name: 'Fresh Lime Soda', category: 'Indian', price: 79, image: img('1513558161293-cdaf765ed2fd'),
    description: 'Sparkling soda with freshly squeezed lime - sweet, salty or both.' },
  { id: 9, name: 'Veg Fried Rice', category: 'Chinese', price: 219, image: img('1603133872878-684f208fb84b'),
    description: 'Wok-tossed rice with crunchy vegetables, soy and spring onion.' },
  { id: 10, name: 'Chicken Noodles', category: 'Chinese', price: 249, image: img('1585032226651-759b368d7246'),
    description: 'Stir-fried noodles with chicken strips, vegetables and a hint of chilli.' },
  { id: 11, name: 'Chocolate Brownie', category: 'Desserts', price: 149, image: img('1606313564200-e75d5e30476c'),
    description: 'Warm, fudgy chocolate brownie with a gooey centre.' },
  { id: 12, name: 'Cheesecake', category: 'Desserts', price: 189, image: img('1533134242443-d4fd215305ad'),
    description: 'Creamy baked cheesecake on a buttery biscuit base with berry compote.' },
];

const categories = ['Pizza', 'Burgers', 'Indian', 'Chinese', 'Desserts'];

module.exports = { products, categories };
