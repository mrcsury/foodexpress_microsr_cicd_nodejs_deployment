// FoodExpress - one Node.js process that serves the website, the APIs, the order logic and the emails.
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const emailService = require('./services/emailService');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);

// Basic security headers. Images may come from Unsplash; everything else must be from our own server.
// "upgrade-insecure-requests" is switched off so the app still works over plain HTTP on a fresh EC2 instance.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  hsts: config.isProduction,
}));

app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    emailConfigured: emailService.isConfigured(),
  });
});

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`FoodExpress is running at http://localhost:${config.port} (${config.nodeEnv})`);
    console.log(emailService.isConfigured()
      ? `Email: SMTP configured (${config.smtp.host}:${config.smtp.port})`
      : 'Email: SMTP not configured' + (config.isProduction ? ' - confirmation emails will NOT be sent.' : ' - email previews will be printed here.'));
    console.log('Note: orders are stored in memory and are lost when the server restarts.');
  });
}

module.exports = app;
